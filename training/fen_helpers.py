import numpy as np

PIECE_TO_PLANE = {
    "P": 0,
    "B": 1,
    "N": 2,
    "R": 3,
    "Q": 4,
    "K": 5,
    "p": 6,
    "b": 7,
    "n": 8,
    "r": 9,
    "q": 10,
    "k": 11,
}

def encode_fen(fen):
    """Really cool encoder for NN training it just turns FEN into 18x8x8 tensor :O
    what each plane does:
    0-5   white pieces
    6-11  black pieces
    12    wtv side to move
    13    white kingside castling
    14    white queenside castling
    15    black kingside castling
    16    black queenside castling
    17    en passant square
    """

    parts = fen.strip().split()

    piece_placement, active_color, castling, en_passant = parts[:4]
    tensor = np.zeros((18, 8, 8), dtype=np.float32)

    ranks = piece_placement.split("/")

    for y, rank in enumerate(ranks):
        x = 0
        for char in rank:
            if char.isdigit():
                x += int(char)
                continue

            tensor[PIECE_TO_PLANE[char], y, x] = 1.0
            x += 1

    if active_color == "w":
        tensor[12, :, :] = 1.0

    if castling != "-":
        if "K" in castling:
            tensor[13, :, :] = 1.0
        if "Q" in castling:
            tensor[14, :, :] = 1.0
        if "k" in castling:
            tensor[15, :, :] = 1.0
        if "q" in castling:
            tensor[16, :, :] = 1.0

    if en_passant != "-":
        file_char, rank_char = en_passant
        x = "abcdefgh".index(file_char)
        y = 8 - int(rank_char)
        tensor[17, y, x] = 1.0

    return tensor