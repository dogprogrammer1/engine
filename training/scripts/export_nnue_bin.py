#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path
import torch


SUPPORTED_EXTRA_FEATURE_LAYOUTS = {
    "stm_castling_ep": 14,
}
PIECE_FEATURES_PER_KING = 10 * 64
LEGACY_FEATURE_STRIDE = 1 + PIECE_FEATURES_PER_KING


def load_checkpoint(checkpoint_path):
    return torch.load(checkpoint_path, map_location="cpu")


def extract_state_dict(checkpoint):
    if isinstance(checkpoint, torch.nn.Module):
        return checkpoint.state_dict()

    if isinstance(checkpoint, dict):
        if "state_dict" in checkpoint:
            return checkpoint["state_dict"]
        if "model_state_dict" in checkpoint:
            return checkpoint["model_state_dict"]

    return checkpoint


def extract_model_config(checkpoint):
    if isinstance(checkpoint, dict):
        model_config = checkpoint.get("model_config")
        if isinstance(model_config, dict):
            return model_config

    return {}


def get_tensor(state_dict, *keys):
    for key in keys:
        if key in state_dict:
            return state_dict[key]

    available = ", ".join(state_dict.keys())
    expected = ", ".join(keys)
    raise KeyError(f"Missing tensor. Expected one of: {expected}. Available keys: {available}")


def flatten_tensor_f32(tensor):
    return tensor.detach().cpu().contiguous().reshape(-1).to(torch.float32).numpy()


def default_binary_path(manifest_path):
    return manifest_path.with_name("nnue_weights.bin")


def infer_feature_stride(feature_count):
    if feature_count % 64 != 0:
        raise ValueError(f"feature_count={feature_count} is not divisible by 64 king buckets")

    feature_stride = feature_count // 64
    if feature_stride not in (PIECE_FEATURES_PER_KING, LEGACY_FEATURE_STRIDE):
        raise ValueError(f"Unsupported NNUE feature stride: {feature_stride}")

    return feature_stride


def project_embeddings(embedding, fc1_weight, hidden_size):
    embedding_f32 = embedding.detach().cpu().to(torch.float32)
    fc1_weight_f32 = fc1_weight.detach().cpu().to(torch.float32)

    us_projection = embedding_f32[:-1] @ fc1_weight_f32[:, :hidden_size].T
    them_projection = embedding_f32[:-1] @ fc1_weight_f32[:, hidden_size:hidden_size * 2].T
    extra_weight = fc1_weight_f32[:, hidden_size * 2:]

    return us_projection, them_projection, extra_weight


def split_king_bias(projection, feature_stride):
    _, fc1_out = projection.shape

    if feature_stride == PIECE_FEATURES_PER_KING:
        return torch.zeros((64, fc1_out), dtype=projection.dtype), projection

    king_bias = projection.new_empty((64, fc1_out))
    piece_projection = projection.new_empty((64 * PIECE_FEATURES_PER_KING, fc1_out))

    for king_square in range(64):
        legacy_start = king_square * feature_stride
        piece_start = king_square * PIECE_FEATURES_PER_KING
        king_bias[king_square] = projection[legacy_start]
        piece_projection[piece_start:piece_start + PIECE_FEATURES_PER_KING] = (
            projection[legacy_start + 1:legacy_start + feature_stride]
        )

    return king_bias, piece_projection


def write_tensor_blob(handle, tensor_map):
    offset = 0
    manifest_tensors = {}

    for name, tensor in tensor_map:
        flat = flatten_tensor_f32(tensor)
        handle.write(flat.tobytes(order="C"))
        manifest_tensors[name] = {
            "offset": offset,
            "length": int(flat.size),
            "dtype": "float32",
        }
        offset += int(flat.nbytes)

    return manifest_tensors, offset


def export_nnue_bin(input_path, manifest_path, binary_path):
    checkpoint = load_checkpoint(input_path)
    state_dict = extract_state_dict(checkpoint)
    model_config = extract_model_config(checkpoint)

    architecture = "feature_embeddings"
    if "accumulator.weight" in state_dict:
        architecture = "accumulator"

    embedding = get_tensor(
        state_dict,
        "feature_embeddings.weight",
        "embedding.weight",
        "accumulator.weight",
    )
    fc1_weight = get_tensor(state_dict, "fc1.weight")
    fc1_bias = get_tensor(state_dict, "fc1.bias")
    fc2_weight = get_tensor(state_dict, "fc2.weight")
    fc2_bias = get_tensor(state_dict, "fc2.bias")
    fc3_weight = get_tensor(state_dict, "fc3.weight", "output.weight")
    fc3_bias = get_tensor(state_dict, "fc3.bias", "output.bias")

    embedding_rows, hidden_size = embedding.shape
    source_feature_count = embedding_rows - 1
    source_padding_index = source_feature_count
    source_feature_stride = infer_feature_stride(source_feature_count)
    fc1_out, fc1_in = fc1_weight.shape
    fc2_out, fc2_in = fc2_weight.shape
    fc3_out, fc3_in = fc3_weight.shape
    base_input_size = hidden_size * 2
    extra_input_count = fc1_in - base_input_size
    extra_feature_layout = model_config.get("extra_feature_layout")
    layout_is_supported = (
        extra_feature_layout in SUPPORTED_EXTRA_FEATURE_LAYOUTS
        and SUPPORTED_EXTRA_FEATURE_LAYOUTS[extra_feature_layout] == extra_input_count
    )
    runtime_compatible = architecture == "feature_embeddings" and (
        extra_input_count == 0 or layout_is_supported
    )

    feature_us_projection, feature_them_projection, fc1_extra_weight = project_embeddings(
        embedding,
        fc1_weight,
        hidden_size,
    )
    king_us_bias, feature_us_projection = split_king_bias(feature_us_projection, source_feature_stride)
    king_them_bias, feature_them_projection = split_king_bias(feature_them_projection, source_feature_stride)
    feature_count = 64 * PIECE_FEATURES_PER_KING
    padding_index = feature_count

    tensor_map = [
        ("kingUsBias", king_us_bias),
        ("kingThemBias", king_them_bias),
        ("featureUsProjection", feature_us_projection),
        ("featureThemProjection", feature_them_projection),
        ("fc1ExtraWeight", fc1_extra_weight),
        ("fc1Bias", fc1_bias),
        ("fc2Weight", fc2_weight),
        ("fc2Bias", fc2_bias),
        ("fc3Weight", fc3_weight),
        ("fc3Bias", fc3_bias),
    ]

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    binary_path.parent.mkdir(parents=True, exist_ok=True)

    with binary_path.open("wb") as handle:
        tensor_manifest, total_bytes = write_tensor_blob(handle, tensor_map)

    manifest = {
        "version": 2,
        "architecture": architecture,
        "featureCount": feature_count,
        "paddingIndex": padding_index,
        "sourceFeatureCount": source_feature_count,
        "sourcePaddingIndex": source_padding_index,
        "sourceFeatureStride": source_feature_stride,
        "featureStride": PIECE_FEATURES_PER_KING,
        "pieceFeatureOffset": 0,
        "hiddenSize": hidden_size,
        "inputSize": fc1_in,
        "baseInputSize": base_input_size,
        "extraInputCount": extra_input_count,
        "extraFeatureLayout": extra_feature_layout,
        "runtimeCompatible": runtime_compatible,
        "fc1Size": fc1_out,
        "fc2Size": fc2_out,
        "outputSize": fc3_out,
        "kingUsBiasShape": [64, fc1_out],
        "kingThemBiasShape": [64, fc1_out],
        "featureUsProjectionShape": [feature_count, fc1_out],
        "featureThemProjectionShape": [feature_count, fc1_out],
        "fc1ExtraShape": [fc1_out, extra_input_count],
        "fc1Shape": [fc1_out, fc1_in],
        "fc2Shape": [fc2_out, fc2_in],
        "fc3Shape": [fc3_out, fc3_in],
        "binaryFile": binary_path.name,
        "totalBytes": total_bytes,
        "tensors": tensor_manifest,
    }

    with manifest_path.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, separators=(",", ":"))

    print(f"Exported NNUE manifest to {manifest_path}")
    print(f"Exported NNUE weights to {binary_path}")
    print(f"architecture={architecture}")
    print(f"featureCount={feature_count}")
    print(f"paddingIndex={padding_index}")
    print(f"sourceFeatureCount={source_feature_count}")
    print(f"sourceFeatureStride={source_feature_stride}")
    print(f"hiddenSize={hidden_size}")
    print(f"inputSize={fc1_in}")
    print(f"extraInputCount={extra_input_count}")
    print(f"extraFeatureLayout={extra_feature_layout}")
    print(f"runtimeCompatible={runtime_compatible}")
    print(f"fc1={fc1_out}x{fc1_in}")
    print(f"fc2={fc2_out}x{fc2_in}")
    print(f"fc3={fc3_out}x{fc3_in}")
    print(f"totalBytes={total_bytes}")

    if not runtime_compatible:
        print(
            "Warning: this checkpoint requires extra inputs beyond hiddenSize * 2. "
            "The current JS runtime only supports feature_embeddings checkpoints "
            "with extraInputCount=0 or a recognized extraFeatureLayout."
        )


def main():
    parser = argparse.ArgumentParser(description="Export NNUE weights to manifest JSON + binary blob")
    parser.add_argument("--input", "-i", required=True, help="Path to .pth checkpoint")
    parser.add_argument(
        "--manifest",
        "-m",
        default="public/models/nnue_manifest.json",
        help="Path to output manifest JSON",
    )
    parser.add_argument(
        "--binary",
        "-b",
        default=None,
        help="Path to output binary blob (defaults to nnue_weights.bin beside the manifest)",
    )
    args = parser.parse_args()
    manifest_path = Path(args.manifest)
    binary_path = Path(args.binary) if args.binary else default_binary_path(manifest_path)

    try:
        export_nnue_bin(Path(args.input), manifest_path, binary_path)
    except (KeyError, ValueError) as e:
        print(f"Export failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
