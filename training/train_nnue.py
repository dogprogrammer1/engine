from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

from training.dataset import NNUEChessDataset, add_padding, load_rows
from training.fen_helpers import NNUE_FEATURES


DATA_PATH = "data/train-00000.parquet"
ROW_LIMIT = 100_000
MIN_DEPTH = 25
BATCH_SIZE = 256
EPOCHS = 10
LEARNING_RATE = 1e-3
HIDDEN_SIZE = 256
MODEL_DIR = Path("training/models")
NNUE_MODEL_PATH = MODEL_DIR / "nnue" / f"best_{ROW_LIMIT // 1000}krows_{EPOCHS}epochs.pth"

if torch.cuda.is_available():
    DEVICE = torch.device("cuda")
else:
    DEVICE = torch.device("cpu")


class NNUENet(nn.Module):
    def __init__(self, feature_count=NNUE_FEATURES, hidden_size=HIDDEN_SIZE):
        super().__init__()
        self.feature_embeddings = nn.Embedding(
            feature_count + 1,
            hidden_size,
            padding_idx=feature_count,
        )
        self.fc1 = nn.Linear(hidden_size * 2, 32)
        self.fc2 = nn.Linear(32, 32)
        self.fc3 = nn.Linear(32, 1)

    def forward(self, us, them):
        us = self.feature_embeddings(us).sum(dim=1)
        them = self.feature_embeddings(them).sum(dim=1)

        x = torch.cat([us, them], dim=1)
        x = torch.clamp(self.fc1(x), 0.0, 1.0)
        x = torch.clamp(self.fc2(x), 0.0, 1.0)
        x = torch.tanh(self.fc3(x))
        return x


def make_loaders():
    df = load_rows(DATA_PATH, limit=ROW_LIMIT, min_depth=MIN_DEPTH)
    dataset = NNUEChessDataset(df)
    total_rows = len(dataset)

    train_size = int(0.9 * total_rows)
    validation_size = total_rows - train_size
    train_dataset, validation_dataset = random_split(dataset, [train_size, validation_size])

    print(f"{total_rows} rows after depth >= {MIN_DEPTH} filtering")
    print(f"Train rows: {train_size} and Val rows: {validation_size}")

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        padding=add_padding,
    )
    validation_loader = DataLoader(
        validation_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        padding=add_padding,
    )

    return train_loader, validation_loader


def train_one_epoch(model, loader, optimizer, loss_fn):
    model.train()
    total_loss = 0.0

    for us, them, targets in loader:
        us = us.to(DEVICE)
        them = them.to(DEVICE)
        targets = targets.to(DEVICE).unsqueeze(1)

        optimizer.zero_grad()
        predictions = model(us, them)
        loss = loss_fn(predictions, targets)
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    return total_loss / len(loader)


def validate(model, loader, loss_fn):
    model.eval()
    total_loss = 0.0

    with torch.no_grad():
        for us, them, targets in loader:
            us = us.to(DEVICE)
            them = them.to(DEVICE)
            targets = targets.to(DEVICE).unsqueeze(1)

            predictions = model(us, them)
            loss = loss_fn(predictions, targets)
            total_loss += loss.item()

    return total_loss / len(loader)


def main():
    NNUE_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

    train_loader, validation_loader = make_loaders()

    model = NNUENet().to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    loss_fn = nn.MSELoss()
    best_val_loss = float("inf")

    for epoch in range(EPOCHS):
        train_loss = train_one_epoch(model, train_loader, optimizer, loss_fn)
        val_loss = validate(model, validation_loader, loss_fn)

        print(
            f"Epoch {epoch + 1}/{EPOCHS} - "
            f"Train Loss: {train_loss:.4f} - Val Loss: {val_loss:.4f}"
        )

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), NNUE_MODEL_PATH)
            print(f"Saved best model to {NNUE_MODEL_PATH} (val={best_val_loss:.4f})")


if __name__ == "__main__":
    main()
