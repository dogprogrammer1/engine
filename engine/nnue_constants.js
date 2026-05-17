export const WHITE = 0;
export const BLACK = 1;

export const PAWN = 0;
export const BISHOP = 1;
export const KNIGHT = 2;
export const ROOK = 3;
export const QUEEN = 4;
export const KING = 5;
export const EMPTY = -1;

export const WHITE_KINGSIDE = 0;
export const BLACK_KINGSIDE = 2;

export const PIECE_STRIDE = 6;
export const PIECE_FEATURES_PER_KING = 10 * 64;

export const EXTRA_FEATURE_LAYOUT = "stm_castling_ep";
export const EXTRA_FEATURE_COUNT = 14;

export const NNUE_MODEL_PATH = "/training/models/weights/nnue_weights.bin";
export const NNUE_MANIFEST_PATH = "/training/models/weights/nnue_manifest.json";
