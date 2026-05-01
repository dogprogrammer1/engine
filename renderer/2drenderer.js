import {
    BOARD_SIZE,
    CANVAS_SIZE,
    PIECE_FONT,
    PIECE_OFFSET_X,
    PIECE_OFFSET_Y,
    PIECE_SYMBOLS,
    SQUARE_SIZE
} from "../ui-constants.js";

const WHITE = 0;

const LIGHT_SQUARE_COLOR = "#f0d9b5";
const DARK_SQUARE_COLOR = "#b58863";
const SELECTED_SQUARE_COLOR = "#6fa86f";
const WHITE_PIECE_COLOR = "#fff8e7";
const BLACK_PIECE_COLOR = "#1f1f1f";
const WHITE_PIECE_OUTLINE = "#8a6f4d";


export default class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        this.canvas.height = CANVAS_SIZE;
        this.canvas.width = CANVAS_SIZE;
    }

    draw(board, selection) {
        this.drawBoard(selection);
        this.drawPieces(board);
    }

    drawBoard(selection) {
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                this.ctx.fillStyle = this.getSquareColor(x, y, selection);
                this.ctx.fillRect(
                    x * SQUARE_SIZE,
                    y * SQUARE_SIZE,
                    SQUARE_SIZE,
                    SQUARE_SIZE
                );
            }
        }
    }

    drawPieces(board) {
        this.ctx.font = PIECE_FONT;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        for (const piece of board.getPieces()) {
            const isWhitePiece = piece.color === WHITE;
            this.ctx.fillStyle = isWhitePiece
                ? WHITE_PIECE_COLOR
                : BLACK_PIECE_COLOR;

            if (isWhitePiece) {
                this.ctx.lineWidth = 2;
                this.ctx.strokeStyle = WHITE_PIECE_OUTLINE;
                this.ctx.strokeText(
                    PIECE_SYMBOLS[piece.type],
                    piece.x * SQUARE_SIZE + SQUARE_SIZE / 2,
                    piece.y * SQUARE_SIZE + SQUARE_SIZE / 2
                );
            }

            this.ctx.fillText(
                PIECE_SYMBOLS[piece.type],
                piece.x * SQUARE_SIZE + SQUARE_SIZE / 2,
                piece.y * SQUARE_SIZE + SQUARE_SIZE / 2
            );
        }
    }

    getSquareColor(x, y, selection) {
        if (selection.selected && x === selection.x && y === selection.y) {
            return SELECTED_SQUARE_COLOR;
        }

        return (x + y) % 2 === 0
            ? LIGHT_SQUARE_COLOR
            : DARK_SQUARE_COLOR;
    }
}
