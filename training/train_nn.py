from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

from training.dataset import ChessDataset, load_rows

# Constants this is currently the best ones i found but there might be better
DATA_PATH = "data/train-00000.parquet"
ROW_LIMIT = 100_000
MIN_DEPTH = 25
BATCH_SIZE = 64
EPOCHS = 10
LEARNING_RATE = 1e-3
MODEL_DIR = Path("training/models")
NN_MODEL_PATH = MODEL_DIR / "nn" / f"best_{ROW_LIMIT / 1000:.0f}krows_{EPOCHS}epochs.pth"

if torch.cuda.is_available():
    DEVICE = torch.device("cuda")
else:
    DEVICE = torch.device("cpu")

# This is a simple convolutional neural network for chess position evaluation
class ChessModel(nn.Module):
    def __init__(self):
        # This looks kinda fancy but it's pretty simple
        # Basically input has 18 channels but then outputs 32 channels
        # Then ReLu adds non linearity by getting rid of negatives
        # Then you flatten and relu and flatten again boom it works
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(18, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Flatten(),
            nn.Linear(64 * 8 * 8, 256),
            nn.ReLU(),
            nn.Linear(256, 1),
            nn.Tanh(),
        )

    # self explanatory just inputs x through the net
    def forward(self, x):
        return self.net(x)

# loads the rows from teh parquet file
# wrap them in the dataset object from datset.py
# then split that dataset into train and validation and yeah wrap it again in dataloaders
def make_loaders():
    df = load_rows(DATA_PATH, limit=ROW_LIMIT, min_depth=MIN_DEPTH)
    dataset = ChessDataset(df)
    total_rows = len(dataset)

    train_size = int(0.9 * total_rows)
    val_size = total_rows - train_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])

    print(f"{total_rows} rows after {MIN_DEPTH} filtering")
    print(f"Train rows: {train_size} and Val rows: {val_size}")

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

    return train_loader, val_loader

# loop through all batches once and update weights
def train_one_epoch(model, loader, optimizer, loss_fn):
    model.train()
    total_loss = 0.0

    for inputs, targets in loader:
        inputs = inputs.to(DEVICE)
        targets = targets.to(DEVICE).unsqueeze(1) # unsqueeze adds dimensions

        optimizer.zero_grad() # clear old gradients
        predictions = model(inputs)
        loss = loss_fn(predictions, targets)

        # This computes gradients for every trainable weight to reduce loss
        # and then it updates the weights
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    return total_loss / len(loader)

# pretty simple loop through validation set and compute average loss without updating weights
def validate(model, loader, loss_fn):
    model.eval()
    total_loss = 0.0

    with torch.no_grad():
        for inputs, targets in loader:
            inputs = inputs.to(DEVICE)
            targets = targets.to(DEVICE).unsqueeze(1)

            predictions = model(inputs)
            loss = loss_fn(predictions, targets)
            total_loss += loss.item()

    return total_loss / len(loader)


# uh it's the main function? just puts everything together
def main():
    NN_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True) # just chore to create output folder

    train_loader, val_loader = make_loaders() # build the dataloaders

    model = ChessModel().to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE) # sets up adam to update model weights
    loss_fn = nn.MSELoss()
    best_val_loss = float("inf")

    for epoch in range(EPOCHS):
        train_loss = train_one_epoch(model, train_loader, optimizer, loss_fn)
        val_loss = validate(model, val_loader, loss_fn)

        print(f"Epoch {epoch + 1}/{EPOCHS} - Train Loss: {train_loss:.4f} - Val Loss: {val_loss:.4f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), NN_MODEL_PATH)
            print(f"Saved best model to {NN_MODEL_PATH} (val={best_val_loss:.4f})")

if __name__ == "__main__":
    main()
