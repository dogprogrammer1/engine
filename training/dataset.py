import math

import numpy as np
import pandas as pd
import torch
from torch.nn.utils.rnn import pad_sequence
from torch.utils.data import Dataset

from training.fen_helpers import encode_fen, encode_fen_NNUE, NNUE_FEATURES


def eval_to_target(cp, mate):
    if pd.notna(mate):
        return 1.0 if float(mate) > 0 else -1.0

    if pd.isna(cp):
        return 0.0

    return math.tanh(float(cp) / 400.0)


def load_rows(path, limit=100_000, min_depth=25, columns=None):
    if columns is None:
        columns = ["fen", "depth", "cp", "mate"]

    df = pd.read_parquet(path, columns=columns)
    df = df[df["depth"] >= min_depth]

    if limit is not None:
        df = df.head(limit)

    df = df.copy()
    df["target"] = [
        eval_to_target(cp, mate)
        for cp, mate in zip(df["cp"], df["mate"])
    ]

    return df


class ChessDataset(Dataset):
    def __init__(self, df):
        self.fens = df["fen"].tolist()
        self.targets = df["target"].to_numpy(dtype=np.float32)

    def __len__(self):
        return len(self.fens)

    def __getitem__(self, idx):
        model_input = torch.from_numpy(encode_fen(self.fens[idx]))
        target = torch.tensor(self.targets[idx], dtype=torch.float32)
        return model_input, target

class NNUEChessDataset (Dataset):
    def __init__ (self, df):
        self.fens = df["fen"].tolist()
        self.targets = df["target"].to_numpy(dtype=np.float32)
    
    def __len__(self):
        return len(self.fens)
    
    def __getitem__ (self, idx):
        features = encode_fen_NNUE(self.fens[idx])
        us = torch.from_numpy(features["us"]).long()
        them = torch.from_numpy(features["them"]).long()
        target = torch.tensor(self.targets[idx], dtype=torch.float32)
        return us, them, target

# NNUE inputs are weird ah so positions have different encoded lengths
# so unfortunately have to add padding so everything got same length
def add_padding(batch):
    us, them, targets = zip(*batch)

    us = pad_sequence(us, batch_first=True, padding_value=NNUE_FEATURES)
    them = pad_sequence(them, batch_first=True, padding_value=NNUE_FEATURES)
    targets = torch.stack(targets)

    return us, them, targets