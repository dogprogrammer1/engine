#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path

import torch


def load_state_dict(checkpoint_path):
    checkpoint = torch.load(checkpoint_path, map_location="cpu")

    if isinstance(checkpoint, torch.nn.Module):
        return checkpoint.state_dict()

    if isinstance(checkpoint, dict):
        if "state_dict" in checkpoint:
            return checkpoint["state_dict"]
        if "model_state_dict" in checkpoint:
            return checkpoint["model_state_dict"]

    return checkpoint


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
    state_dict = load_state_dict(input_path)

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

    export_data = {
        "version": 1,
        "featureCount": feature_count,
        "paddingIndex": padding_index,
        "hiddenSize": hidden_size,
        "inputSize": hidden_size * 2,
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
    print(f"featureCount={feature_count}")
    print(f"paddingIndex={padding_index}")
    print(f"hiddenSize={hidden_size}")
    print(f"fc1={fc1_out}x{fc1_in}")
    print(f"fc2={fc2_out}x{fc2_in}")
    print(f"fc3={fc3_out}x{fc3_in}")


def main():
    parser = argparse.ArgumentParser(description="Export NNUE weights to JSON")
    parser.add_argument("--input", "-i", required=True, help="Path to .pth checkpoint")
    parser.add_argument("--output", "-o", default="nnue_weights.json", help="Path to output JSON")
    args = parser.parse_args()

    try:
        export_nnue(Path(args.input), Path(args.output))
    except KeyError as e:
        print(f"Export failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
