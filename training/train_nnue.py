from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

from training.dataset import NNUEChessDataset, add_padding, load_rows
from training.fen_helpers import NNUE_EXTRA_FEATURE_LAYOUT, NNUE_EXTRA_FEATURES, NNUE_FEATURES


DATA_PATH = "data/train-00000.parquet"
ROW_LIMIT = 1_000_000
MIN_DEPTH = 30
BATCH_SIZE = 256
EPOCHS = 12
LEARNING_RATE = 3e-4
WEIGHT_DECAY = 1e-5
HIDDEN_SIZE = 256
FC1_SIZE = 128
FC2_SIZE = 64
DROPOUT = 0.10
GRAD_CLIP_NORM = 1.0
LR_PATIENCE = 2
MODEL_DIR = Path("training/models")
NNUE_MODEL_PATH = MODEL_DIR / "nnue" / (
    f"best_{ROW_LIMIT // 1000}krows_{EPOCHS}epochs_"
    f"h{HIDDEN_SIZE}_head{FC1_SIZE}x{FC2_SIZE}_{NNUE_EXTRA_FEATURE_LAYOUT}.pth"
)


if torch.cuda.is_available():
    DEVICE = torch.device("cuda")
elif torch.backends.mps.is_available():
    DEVICE = torch.device("mps")
else:
    DEVICE = torch.device("cpu")


class NNUENet(nn.Module):
    def __init__(
        self,
        feature_count=NNUE_FEATURES,
        hidden_size=HIDDEN_SIZE,
        extra_feature_count=NNUE_EXTRA_FEATURES,
        fc1_size=FC1_SIZE,
        fc2_size=FC2_SIZE,
        dropout=DROPOUT,
    ):
        super().__init__()
        self.feature_count = feature_count
        self.hidden_size = hidden_size
        self.extra_feature_count = extra_feature_count
        self.extra_feature_layout = NNUE_EXTRA_FEATURE_LAYOUT
        self.fc1_size = fc1_size
        self.fc2_size = fc2_size
        self.dropout_rate = dropout

        self.feature_embeddings = nn.Embedding(
            feature_count + 1,
            hidden_size,
            padding_idx=feature_count,
        )
        self.fc1 = nn.Linear(hidden_size * 2 + extra_feature_count, fc1_size)
        self.fc2 = nn.Linear(fc1_size, fc2_size)
        self.fc3 = nn.Linear(fc2_size, 1)
        self.dropout = nn.Dropout(dropout)
        self._reset_parameters()

    def _reset_parameters(self):
        nn.init.normal_(self.feature_embeddings.weight, mean=0.0, std=0.02)
        with torch.no_grad():
            self.feature_embeddings.weight[self.feature_count].zero_()

        for layer in (self.fc1, self.fc2, self.fc3):
            nn.init.xavier_uniform_(layer.weight)
            nn.init.zeros_(layer.bias)

    def forward(self, us, them, extra_features):
        us = self.feature_embeddings(us).sum(dim=1)
        them = self.feature_embeddings(them).sum(dim=1)

        x = torch.cat([us, them, extra_features], dim=1)
        x = torch.clamp(self.fc1(x), 0.0, 1.0)
        x = self.dropout(x)
        x = torch.clamp(self.fc2(x), 0.0, 1.0)
        x = self.dropout(x)
        x = torch.tanh(self.fc3(x))
        return x

    def export_metadata(self):
        return {
            "feature_count": self.feature_count,
            "hidden_size": self.hidden_size,
            "extra_feature_count": self.extra_feature_count,
            "extra_feature_layout": self.extra_feature_layout,
            "fc1_size": self.fc1_size,
            "fc2_size": self.fc2_size,
        }


def make_loaders():
    df = load_rows(DATA_PATH, limit=ROW_LIMIT, min_depth=MIN_DEPTH)
    dataset = NNUEChessDataset(df)
    total_rows = len(dataset)

    train_size = int(0.9 * total_rows)
    validation_size = total_rows - train_size
    split_generator = torch.Generator().manual_seed(0)
    train_dataset, validation_dataset = random_split(
        dataset,
        [train_size, validation_size],
        generator=split_generator,
    )

    print(f"{total_rows} rows after depth >= {MIN_DEPTH} filtering")
    print(f"Train rows: {train_size} and Val rows: {validation_size}")

    common_loader_kwargs = {
        "batch_size": BATCH_SIZE,
        "collate_fn": add_padding,
        "pin_memory": DEVICE.type == "cuda",
    }

    train_loader = DataLoader(
        train_dataset,
        shuffle=True,
        **common_loader_kwargs,
    )
    validation_loader = DataLoader(
        validation_dataset,
        shuffle=False,
        **common_loader_kwargs,
    )

    return train_loader, validation_loader


def train_one_epoch(model, loader, optimizer, loss_fn, mse_fn):
    model.train()
    total_loss = 0.0
    total_mse = 0.0

    for us, them, extra_features, targets in loader:
        us = us.to(DEVICE)
        them = them.to(DEVICE)
        extra_features = extra_features.to(DEVICE)
        targets = targets.to(DEVICE).unsqueeze(1)

        optimizer.zero_grad(set_to_none=True)
        predictions = model(us, them, extra_features)
        loss = loss_fn(predictions, targets)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), GRAD_CLIP_NORM)
        optimizer.step()

        total_loss += loss.item()
        total_mse += mse_fn(predictions, targets).item()

    return total_loss / len(loader), total_mse / len(loader)


def validate(model, loader, loss_fn, mse_fn):
    model.eval()
    total_loss = 0.0
    total_mse = 0.0

    with torch.no_grad():
        for us, them, extra_features, targets in loader:
            us = us.to(DEVICE)
            them = them.to(DEVICE)
            extra_features = extra_features.to(DEVICE)
            targets = targets.to(DEVICE).unsqueeze(1)

            predictions = model(us, them, extra_features)
            total_loss += loss_fn(predictions, targets).item()
            total_mse += mse_fn(predictions, targets).item()

    return total_loss / len(loader), total_mse / len(loader)


def save_checkpoint(model, optimizer, epoch, val_loss, val_mse):
    checkpoint = {
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "model_config": model.export_metadata(),
        "training_config": {
            "data_path": DATA_PATH,
            "row_limit": ROW_LIMIT,
            "min_depth": MIN_DEPTH,
            "batch_size": BATCH_SIZE,
            "epochs": EPOCHS,
            "learning_rate": LEARNING_RATE,
            "weight_decay": WEIGHT_DECAY,
            "dropout": DROPOUT,
            "grad_clip_norm": GRAD_CLIP_NORM,
        },
        "metrics": {
            "epoch": epoch,
            "val_loss": val_loss,
            "val_mse": val_mse,
        },
    }
    torch.save(checkpoint, NNUE_MODEL_PATH)


def main():
    NNUE_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

    print(f"Training NNUE on {DEVICE}")
    print(
        f"Config: rows={ROW_LIMIT}, min_depth={MIN_DEPTH}, batch={BATCH_SIZE}, "
        f"epochs={EPOCHS}, hidden={HIDDEN_SIZE}, head={FC1_SIZE}x{FC2_SIZE}, "
        f"extras={NNUE_EXTRA_FEATURE_LAYOUT}"
    )

    train_loader, validation_loader = make_loaders()

    model = NNUENet().to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="min",
        factor=0.5,
        patience=LR_PATIENCE,
    )
    loss_fn = nn.SmoothL1Loss(beta=0.20)
    mse_fn = nn.MSELoss()
    best_val_mse = float("inf")

    for epoch in range(EPOCHS):
        train_loss, train_mse = train_one_epoch(model, train_loader, optimizer, loss_fn, mse_fn)
        val_loss, val_mse = validate(model, validation_loader, loss_fn, mse_fn)
        scheduler.step(val_mse)

        current_lr = optimizer.param_groups[0]["lr"]
        print(
            f"Epoch {epoch + 1}/{EPOCHS} - "
            f"Train Huber: {train_loss:.4f} - Train MSE: {train_mse:.4f} - "
            f"Val Huber: {val_loss:.4f} - Val MSE: {val_mse:.4f} - "
            f"LR: {current_lr:.6f}"
        )

        if val_mse < best_val_mse:
            best_val_mse = val_mse
            save_checkpoint(model, optimizer, epoch + 1, val_loss, val_mse)
            print(f"Saved best model to {NNUE_MODEL_PATH} (val_mse={best_val_mse:.4f})")


if __name__ == "__main__":
    main()
