import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

from dataset import ChessDataset, load_rows

DATA_PATH = ""
ROW_LIMIT = 100_000
MIN_DEPTH = 25
BATCH_SIZE = 64
EPOCHS = 5
LEARNING_RATE = 1e-3

if torch.cuda.is_available():
    DEVICE = torch.device("cuda")
else:
    DEVICE = torch.device("cpu")


class ChessModel(nn.Module):
    def __init__(self):
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
        
    def forward(self, x):
        return self.net(x)

def make_loaders():
    df = load_rows(DATA_PATH, limit=ROW_LIMIT, min_depth=MIN_DEPTH)
    dataset = ChessDataset(df)

    train_size = int(0.9 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE)

    return train_loader, val_loader

def train(model, loader, optimizer, loss_fn)
    model.train()
    total_loss = 0.0

    for inputs, targets in loader:
        inputs = inputs.to(DEVICE)
        targets = targets.to(DEVICE).unsqueeze(1) # adds dimension to shape

        optimizer.zero_grad()
        predictions = model(inputs)
        loss = loss_fn(predictions, targets)
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    return total_loss / len(loader.dataset)

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

    return total_loss / len(loader.dataset)

def main():
    train_loader, val_loader = make_loaders()

    model = ChessModel().to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    loss_fn = nn.MSELoss()

    for epoch in range(EPOCHS):
        train_loss = train(model, train_loader, optimizer, loss_fn)
        val_loss = validate(model, val_loader, loss_fn)

        print(f"Epoch {epoch+1}/{EPOCHS} - Train Loss: {train_loss:.4f} - Val Loss: {val_loss:.4f}")
    
    torch.save(model.state_dict(), "chess_model.pth")