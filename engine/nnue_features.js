import {
    BLACK,
    BLACK_KINGSIDE,
    EMPTY,
    EXTRA_FEATURE_COUNT,
    KING,
    PIECE_FEATURES_PER_KING,
    PIECE_STRIDE,
    WHITE,
    WHITE_KINGSIDE,
} from "./nnue_constants.js";

// What this entire file is about is encoding the chess board state into the feature space
const MAX_PIECE_CODE = PIECE_STRIDE * 2;

// this is because for SOME REASON THE BOARD USES BISHOP = 1 and KNIGHT = 2
const TRAIN_TYPE_BY_PIECE = new Int8Array([0, 2, 1, 3, 4, -1]);

// this might seem contradictory but FOR SOME REASON 
// the BOARD.js USES a8 = 0 and a1 = 56
function toPerspectiveSquare(boardSq, side) {
    return side === BLACK ? boardSq : boardSq ^ 56;
}

export function toBoardIndex(x, y) {
    return y * 8 + x;
}

// this returns the extra features which are side to move, castling rights, and en passant
export function fillExtras(board, output) {
    output.fill(0);

    const whiteToMove = board.turn === WHITE;
    const castle = board.canCastle ?? [false, false, false, false];
    const epFile = board.enPassant?.[0] ?? -1;
    const ownCastle = whiteToMove ? WHITE_KINGSIDE : BLACK_KINGSIDE;
    const oppCastle = whiteToMove ? BLACK_KINGSIDE : WHITE_KINGSIDE;

    output[0] = whiteToMove ? 1 : 0;
    output[1] = whiteToMove ? 0 : 1;
    output[2] = castle[ownCastle] ? 1 : 0;
    output[3] = castle[ownCastle + 1] ? 1 : 0;
    output[4] = castle[oppCastle] ? 1 : 0;
    output[5] = castle[oppCastle + 1] ? 1 : 0;

    if (epFile >= 0) {
        output[6 + epFile] = 1;
    }

    return output;
}

// what this does is it this moves the evaluation up or down based on the feature and delta
export function addDelta(state, model, feature, delta) {
    const starting_index = feature * model.fc1Size; // starting index of feature's row inside the flattened projection array
    const usProj = model.featureUsProjection;
    const themProj = model.featureThemProjection;

    for (let i = 0; i < model.fc1Size; i++) {
        const projIdx = starting_index + i;
        state.us[i] += usProj[projIdx] * delta;
        state.them[i] += themProj[projIdx] * delta;
    }
}

// This is pretty simple it just converts one piece on one square into the
// single sparse nnue feature id that the model wants
export function getFeatIndex(color, type, boardSq, side, kingSq) {
    const bucket = TRAIN_TYPE_BY_PIECE[type];
    if (color !== side) {
        bucket += 5;
    }

    return kingSq * PIECE_FEATURES_PER_KING + bucket * 64 + toPerspectiveSquare(boardSq, side);
}


// This is the main function that rebuilds the full NNUE accumlator from scratch for one side
export function rebuildState(board, model, side, state) {
    // finds the king square
    const [kingX, kingY] = board.kingPos(side);
    const kingSq = toPerspectiveSquare(toBoardIndex(kingX, kingY), side);

    // load the king bias/baseline into the state as the starting point 
    const kingOff = kingSq * model.fc1Size;
    state.us.set(model.kingUsBias.subarray(kingOff, kingOff + model.fc1Size));
    state.them.set(model.kingThemBias.subarray(kingOff, kingOff + model.fc1Size));

    const squares = board.squares;
    for (let sq = 0; sq < 64; sq++) {
        const code = squares[sq];
        if (code === EMPTY || code == null) {
            continue;
        }

        const type = code % PIECE_STRIDE;
        if (type === KING) {
            continue;
        }


        // this is the main part it extracts the piece color
        // computes that piece's feature index for this perspective and king square
        // then adds that feature's contribution to the accumulator
        addDelta(
            state,
            model,
            getFeatIndex((code / PIECE_STRIDE) | 0, type, sq, side, kingSq),
            1
        );
    }

    // cache this because future incremental updates need to know the current king bucket
    return kingSq;
}
