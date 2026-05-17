import argparse
import json
import sys
from pathlib import Path

import torch


EXTRA_FEATURE_COUNT = 14
PIECE_FEATURES_PER_KING = 10 * 64

INPUT_PATH = Path("training/models/nnue/best_1000krows_12epochs_h256_head128x64_stm_castling_ep.pth")
MANIFEST_PATH = Path("training/models/weights/nnue_manifest.json")
BINARY_PATH = Path("training/models/weights/nnue_weights.bin")

def load_checkpoint(checkpoint_path):
    return torch.load(checkpoint_path, map_location="cpu")

# pulls out the actual model weights dictionary from the checkpoint
def extract_state_dict(checkpoint):
    return checkpoint["model_state_dict"]

# pulls the model metadata
def extract_model_config(checkpoint):
    return checkpoint["model_config"]

# returns the tensor for the first key that exists in the state dict and returns an error if not found
def get_tensor(state_dict, *keys):
    for key in keys:
        if key in state_dict:
            return state_dict[key]

    available = ", ".join(state_dict.keys())
    expected = ", ".join(keys)
    raise KeyError(f"Missing tensor. Expected one of: {expected}. Available keys: {available}")

# converts a tensor to a flat list of python floats
def flatten_tensor(tensor):
    return tensor.detach().cpu().contiguous().reshape(-1).to(torch.float32).numpy()

# it puts both tensors on cpu and converts them to float32
# then it precomputes the projection from the embedding to the first layer
def project_embeddings(embedding, fc1_weight, hidden_size):
    embedding_float = embedding.detach().cpu().to(torch.float32)
    fc1_weight_float = fc1_weight.detach().cpu().to(torch.float32)

    feature_us_projection = embedding_float[:-1] @ fc1_weight_float[:, :hidden_size].T
    feature_them_projection = embedding_float[:-1] @ fc1_weight_float[:, hidden_size:hidden_size * 2].T
    fc1_extra_weight = fc1_weight_float[:, hidden_size * 2:]

    return feature_us_projection, feature_them_projection, fc1_extra_weight


def write_tensor_blob(handle, tensor_map):
    offset = 0
    manifest_tensors = {}

    for name, tensor in tensor_map:
        flat = flatten_tensor(tensor)
        handle.write(flat.tobytes(order="C"))
        manifest_tensors[name] = {
            "offset": offset, # where in the binary file this tensor's data starts
            "length": int(flat.size),
            "dtype": "float32",
        }
        offset += int(flat.nbytes)

    return manifest_tensors, offset


def export_nnue_bin(input_path, manifest_path, binary_path):
    checkpoint = load_checkpoint(input_path)
    state_dict = extract_state_dict(checkpoint)
    model_config = extract_model_config(checkpoint)

    embedding = get_tensor(state_dict, "feature_embeddings.weight")
    fc1_weight = get_tensor(state_dict, "fc1.weight")
    fc1_bias = get_tensor(state_dict, "fc1.bias")
    fc2_weight = get_tensor(state_dict, "fc2.weight")
    fc2_bias = get_tensor(state_dict, "fc2.bias")
    fc3_weight = get_tensor(state_dict, "fc3.weight")
    fc3_bias = get_tensor(state_dict, "fc3.bias")

    embedding_rows, hidden_size = embedding.shape
    feature_count = embedding_rows - 1

    fc1_out, fc1_in = fc1_weight.shape
    fc2_out, fc2_in = fc2_weight.shape
    fc3_out, fc3_in = fc3_weight.shape

    base_input_size = hidden_size * 2
    extra_input_count = fc1_in - base_input_size
    extra_feature_layout = model_config.get("extra_feature_layout")

    # makes sure the model has the expected architecture for the extra features
    if extra_input_count == EXTRA_FEATURE_COUNT and extra_feature_layout != "stm_castling_ep":
        raise ValueError(
            f"Expected extra_feature_layout=stm_castling_ep, got {extra_feature_layout}"
        )

    # projects all the features onto the first layer
    feature_us_projection, feature_them_projection, fc1_extra_weight = project_embeddings(
        embedding,
        fc1_weight,
        hidden_size,
    )

    king_us_bias = torch.zeros((64, fc1_out), dtype=torch.float32)
    king_them_bias = torch.zeros((64, fc1_out), dtype=torch.float32)

    # the list of tensors to write to the binary file
    # bias is basically a shifted baseline that lets neurons have a default tendency
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

    # manifest is a json files that describes the architecture of the bin file for runtime usage
    manifest = {
        "version": 2,
        "featureCount": feature_count,
        "paddingIndex": feature_count,
        "hiddenSize": hidden_size,
        "inputSize": fc1_in,
        "baseInputSize": base_input_size,
        "extraInputCount": extra_input_count,
        "extraFeatureLayout": extra_feature_layout,
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

    # logging
    print(f"Exported NNUE manifest to {manifest_path}")
    print(f"Exported NNUE weights to {binary_path}")
    print(f"featureCount={feature_count}")
    print(f"hiddenSize={hidden_size}")
    print(f"inputSize={fc1_in}")
    print(f"extraInputCount={extra_input_count}")
    print(f"extraFeatureLayout={extra_feature_layout}")
    print(f"fc1={fc1_out}x{fc1_in}")
    print(f"fc2={fc2_out}x{fc2_in}")
    print(f"fc3={fc3_out}x{fc3_in}")
    print(f"totalBytes={total_bytes}")

# runs it ig
def main():
    try:
        export_nnue_bin(INPUT_PATH, MANIFEST_PATH, BINARY_PATH)
    except (KeyError, ValueError) as error:
        print(f"Export failed: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
