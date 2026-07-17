import assert from "node:assert/strict";
import test from "node:test";

import Board from "../board.js";

const WHITE = 0;
const BLACK = 1;
const KING = 5;
const KNIGHT = 2;
const ROOK = 3;

function createBoard() {
    return new Board(WHITE, { silent: true });
}

function boardWithPieces(pieces, turn = WHITE, castle = [false, false, false, false]) {
    const state = Array.from({ length: 2 }, () => Array(6).fill(0n));
    for (const { color, type, x, y } of pieces) {
        state[color][type] |= 1n << BigInt(y * 8 + x);
    }

    const board = createBoard();
    board.restoreState({
        board: state,
        castle,
        ep: [-1, -1],
        turn,
        halfmoveClock: 0,
        fullmoveNumber: 1,
        gameResult: null
    });
    return board;
}

test("the opening position has a complete FEN and valid legal moves", () => {
    const board = createBoard();

    assert.equal(
        board.toFEN(),
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
    assert.equal(board.generateLegalMoves(WHITE).length, 20);
});

test("move counters and clone state remain accurate after a full move", () => {
    const board = createBoard();
    assert.equal(board.move(4, 6, 4, 4), true);
    assert.equal(board.toFEN().endsWith(" 0 1"), true);
    assert.equal(board.move(4, 1, 4, 3), true);
    assert.equal(board.toFEN().endsWith(" 0 2"), true);

    const before = board.cloneState();
    board.generateLegalMoves(board.turn);
    assert.deepEqual(board.cloneState(), before);
});

test("en passant removes the captured pawn", () => {
    const board = createBoard();
    assert.equal(board.move(4, 6, 4, 4), true);
    assert.equal(board.move(0, 1, 0, 2), true);
    assert.equal(board.move(4, 4, 4, 3), true);
    assert.equal(board.move(3, 1, 3, 3), true);
    assert.equal(board.move(4, 3, 3, 2), true);

    assert.deepEqual(board.getPiece(3, 2), [WHITE, 0]);
    assert.deepEqual(board.getPiece(3, 3), [-1, -1]);
});

test("castling moves both the king and rook", () => {
    const board = boardWithPieces([
        { color: WHITE, type: KING, x: 4, y: 7 },
        { color: WHITE, type: ROOK, x: 7, y: 7 },
        { color: BLACK, type: KING, x: 4, y: 0 }
    ], WHITE, [true, false, false, false]);

    assert.equal(board.move(4, 7, 6, 7), true);
    assert.deepEqual(board.getPiece(6, 7), [WHITE, KING]);
    assert.deepEqual(board.getPiece(5, 7), [WHITE, ROOK]);
});

test("king and two knights versus a king is insufficient material", () => {
    const board = boardWithPieces([
        { color: WHITE, type: KING, x: 4, y: 7 },
        { color: WHITE, type: KNIGHT, x: 1, y: 7 },
        { color: WHITE, type: KNIGHT, x: 6, y: 7 },
        { color: BLACK, type: KING, x: 4, y: 0 }
    ]);

    assert.equal(board.isInsufficientMaterial(), true);
});
