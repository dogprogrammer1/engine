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

const LIGHT_SQUARE_COLOR = "#eee";
const DARK_SQUARE_COLOR = "#057a14";
const SELECTED_SQUARE_COLOR = "rgb(84, 96, 223)";
const WHITE_PIECE_COLOR = "#ffd43a";
const BLACK_PIECE_COLOR = "#222";

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

        for (const piece of board.getPieces()) {
            this.ctx.fillStyle = piece.color === WHITE
                ? WHITE_PIECE_COLOR
                : BLACK_PIECE_COLOR;
            this.ctx.fillText(
                PIECE_SYMBOLS[piece.type],
                piece.x * SQUARE_SIZE + PIECE_OFFSET_X,
                piece.y * SQUARE_SIZE + PIECE_OFFSET_Y
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
