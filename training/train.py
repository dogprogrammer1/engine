import argparse
import importlib
import sys

from training.train_nn import main as main_nn
from training.train_nnue import main as main_nnue

# the point of this file is just to be able to easily do train nn or nnue
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model",
        choices=["nn", "nnue"],
        default="nn",
    )s
    args = parser.parse_args()

    if args.model == "nn":
        main_nn()
        return

    if args.model == "nnue":
        main_nnue()
        return

if __name__ == "__main__":
    main()