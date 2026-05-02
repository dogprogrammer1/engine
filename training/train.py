import argparse
import importlib
import sys

from training.train_nn import main as main_nn
from training.train_nnue import main as main_nnue

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model",
        choices=["nn", "nnue"],
        default="nn",
    )
    args = parser.parse_args()

    if args.model == "nn":
        main_nn()
        return

    if args.model == "nnue":
        main_nnue()
        return

if __name__ == "__main__":
    main()