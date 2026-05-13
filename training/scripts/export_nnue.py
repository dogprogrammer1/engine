#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path

import torch


SUPPORTED_EXTRA_FEATURE_LAYOUTS = {
    "stm_castling_ep": 14,
}


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


def flatten_tensor(tensor):
    return tensor.detach().cpu().reshape(-1).tolist()


def export_nnue(input_path, output_path):
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
    feature_count = embedding_rows - 1
    padding_index = feature_count
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

    export_data = {
        "version": 1,
        "architecture": architecture,
        "featureCount": feature_count,
        "paddingIndex": padding_index,
        "hiddenSize": hidden_size,
        "inputSize": fc1_in,
        "baseInputSize": base_input_size,
        "extraInputCount": extra_input_count,
        "extraFeatureLayout": extra_feature_layout,
        "runtimeCompatible": runtime_compatible,
        "fc1Size": fc1_out,
        "fc2Size": fc2_out,
        "outputSize": fc3_out,
        "embeddingShape": [embedding_rows, hidden_size],
        "fc1Shape": [fc1_out, fc1_in],
        "fc2Shape": [fc2_out, fc2_in],
        "fc3Shape": [fc3_out, fc3_in],
        "embedding": flatten_tensor(embedding),
        "fc1Weight": flatten_tensor(fc1_weight),
        "fc1Bias": flatten_tensor(fc1_bias),
        "fc2Weight": flatten_tensor(fc2_weight),
        "fc2Bias": flatten_tensor(fc2_bias),
        "fc3Weight": flatten_tensor(fc3_weight),
        "fc3Bias": flatten_tensor(fc3_bias),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(export_data, handle, separators=(",", ":"))

    print(f"Exported NNUE weights to {output_path}")
    print(f"architecture={architecture}")
    print(f"featureCount={feature_count}")
    print(f"paddingIndex={padding_index}")
    print(f"hiddenSize={hidden_size}")
    print(f"inputSize={fc1_in}")
    print(f"extraInputCount={extra_input_count}")
    print(f"extraFeatureLayout={extra_feature_layout}")
    print(f"runtimeCompatible={runtime_compatible}")
    print(f"fc1={fc1_out}x{fc1_in}")
    print(f"fc2={fc2_out}x{fc2_in}")
    print(f"fc3={fc3_out}x{fc3_in}")

    if not runtime_compatible:
        print(
            "Warning: this checkpoint requires extra inputs beyond hiddenSize * 2. "
            "The current JS runtime only supports feature_embeddings checkpoints "
            "with extraInputCount=0 or a recognized extraFeatureLayout."
        )


def main():
    parser = argparse.ArgumentParser(description="Export NNUE weights to JSON")
    parser.add_argument("--input", "-i", required=True, help="Path to .pth checkpoint")
    parser.add_argument(
        "--output",
        "-o",
        default="public/models/nnue_weights.json",
        help="Path to output JSON",
    )
    args = parser.parse_args()

    try:
        export_nnue(Path(args.input), Path(args.output))
    except KeyError as e:
        print(f"Export failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
