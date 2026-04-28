import math
import pandas as pd
import numpy as np
import torch 
from torch.utils.data import Dataset
from fen_helpers import encode_fen

ROWS = 100_000
MIN_DEPTH = 25


def eval_to_target(cp, mate):
    if pd.notna(mate):
        if (float) > 0:
            return 1.0
        else:
            return -1.0 

    if pd.isna(cp):
        return 0.0

    # tanh is the hyperbolic tan function, maps centipawns to -1 to 1
    return math.tanh(float(cp) / 400)

def load_rows(path, limit = ROWS, min_depth = MIN_DEPTH, columns=None):
    if columns is None:
        columns = ["FEN", "EvalCp", "EvalMate", "Depth"]

    df = pd.read_parquet(path, columns=columns)
    df = df[df["Depth"] >= min_depth]

    df = df.head(limit)
    
    df = df.copy() # cause pandas is anoying ahhh

    df["target"] = [
        eval_to_target(cp, mate)
        for cp, mate in zip(df["EvalCp"], df["EvalMate"])
    ]

    return df

class ChessDataset(Dataset):
    def __init__(self, df):
        self.fens = df["FEN"].tolist()
        self.targets = df["target"].tolist()
    
    def __len__(self):
        return len(self.fens)
    
    def __getitem__(self, idx):
        model_input = torch.from_numpy(encode_fen(self.fens[idx]))
        target = torch.tensor(self.targets[idx], dtype=torch.float32)
        return model_input, target