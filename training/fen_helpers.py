PIECE_CHARS = ["p", "b", "n", "r", "q", "k"]


def square_name(x, y):
    return "abcdefgh"[x] + str(8 - y)

def to_fen(board):
    ranks = []

    for y in range(8):
        rank = ""
        empty = 0

        for x in range(8):
            color, piece_type = board.getPiece(x, y)

            if piece_type == -1:
                empty += 1
                continue

            if empty > 0:
                rank += str(empty)
                empty = 0

            piece = PIECE_CHARS[piece_type]
            if (color == 1):
                rank += piece.upper()
            else:
                rank += piece

        if empty > 0:
            rank += str(empty)

        ranks.append(rank)

    castling = ""
    if board.canCastle[2]:
        castling += "K"
    if board.canCastle[3]:
        castling += "Q"
    if board.canCastle[0]:
        castling += "k"
    if board.canCastle[1]:
        castling += "q"
    if not castling:
        castling = "-"

    if board.enPassant[0] == -1:
        en_passant = "-"
    else:
        en_passant = square_name(board.enPassant[0], board.enPassant[1])

    if board.turn == 1:
        color = "w"
    else:
        color = "b"
    return f"{'/'.join(ranks)} {active_color} {castling} {en_passant} 0 1"
