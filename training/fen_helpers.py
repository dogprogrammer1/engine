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

NNUE_SQUARES = 1 + 10 * 64
NNUE_FEATURES = 64 * NNUE_SQUARES

PIECE_TYPE = {
    "P": 0,
    "N": 1,
    "B": 2,
    "R": 3,
    "Q": 4,
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

# mirrors board bc NNUE checks perspective from both white and black
def _mirror_square(square):
    return square ^ 56

# parses FEN to board array
def _parse_fen(fen):
    board_fen = fen.strip().split()[0]
    board = {}
    ranks = board_fen.split("/")
    
    for i, rank in enumerate(ranks):
        r = 7 - i
        file = 0
        
        for char in rank:
            if char.isdigit():
                file += int(char)
                continue
            
            square = r * 8 + file
            board[square] = char
            file += 1
    return board

# instead of a giant tensor the other nn uses
# nnue uses sparse features where each num is encoded
# each num is kingsquare + piecetype + square which is relationship to kings
def _feature_index(piece, square, king, perspective):
    is_white = piece.isupper()
    own_piece = is_white
    
    if piece.upper() == "K":
        return None
    
    if perspective == "b":
        square = _mirror_square(square)
        king = _mirror_square(king)    
        own_piece = not is_white
    
    base_piece = piece.upper()
    piece_type = PIECE_TYPE[base_piece]
    
    if not own_piece:
        piece_type += 5
        
    feature = 1 + piece_type * 64 + square
    
    return king * NNUE_SQUARES + feature


def _encode_one_side(board, perspective):
    if perspective == "w":
        king = "K"
    else:
        king = "k"
        
    for square, piece in board.items():
        if piece == king:
            king_square = square
            break
    
    if perspective == "b":
        king_in_perspective = _mirror_square(king_square)
    else:
        king_in_perspective = king_square
    
    indices = [king_in_perspective * NNUE_SQUARES]
    
    for square, piece in board.items():
        i = _feature_index(piece, square, king_square, perspective)
        if i is not None:
            indices.append(i)
            
    return np.array(indices, dtype=np.int32)

# Returns:
# "us": side to move indices
# "them": opponent indices

def encode_fen_NNUE(fen):
    parts = fen.strip().split()
    
    side = parts[1]
    board = _parse_fen(fen)
    
    white_indices = _encode_one_side(board, "w")
    black_indices = _encode_one_side(board, "b")
    
    if side == "w":
        us = white_indices
        them = black_indices
    else:
        us = black_indices
        them = white_indices
        
    return {
        "us": us,
        "them": them,
    }