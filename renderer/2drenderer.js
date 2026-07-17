import { BOARD_SIZE, PIECE_SYMBOLS } from "../ui-constants.js";

const WHITE = 0;
const LIGHT_SQUARE_COLOR = "#f0d9b5";
const DARK_SQUARE_COLOR = "#b58863";
const SELECTED_SQUARE_COLOR = "#6fa86f";
const WHITE_PIECE_COLOR = "#fff8e7";
const BLACK_PIECE_COLOR = "#1f1f1f";
const WHITE_PIECE_OUTLINE = "#8a6f4d";

export default class Renderer2D {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.viewport = { width: 0, height: 0, pixelRatio: 1 };
        this.boardPixelSize = 0;
        this.boardOffsetX = 0;
        this.boardOffsetY = 0;
        this.squareSize = 0;

        this.onResize = () => this.resizeCanvas();
        this.onCanvasClick = event => this.handleCanvasClick(event);
        window.addEventListener("resize", this.onResize);
        canvas.addEventListener("click", this.onCanvasClick);
        this.resizeCanvas();
    }

    resizeCanvas() {
        const width = Math.max(1, window.innerWidth);
        const height = Math.max(1, window.innerHeight);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

        this.viewport = { width, height, pixelRatio };
        this.canvas.width = Math.round(width * pixelRatio);
        this.canvas.height = Math.round(height * pixelRatio);
        this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        this.boardPixelSize = Math.min(720, width - 32, height - 32);
        this.boardOffsetX = (width - this.boardPixelSize) / 2;
        this.boardOffsetY = (height - this.boardPixelSize) / 2;
        this.squareSize = this.boardPixelSize / BOARD_SIZE;
    }

    draw(board, selection) {
        this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
        this.drawBoard(selection);
        this.drawPieces(board);
    }

    drawBoard(selection) {
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                this.ctx.fillStyle = this.getSquareColor(x, y, selection);
                this.ctx.fillRect(
                    this.boardOffsetX + x * this.squareSize,
                    this.boardOffsetY + y * this.squareSize,
                    this.squareSize,
                    this.squareSize
                );
            }
        }
    }

    drawPieces(board) {
        this.ctx.font = `${Math.round(this.squareSize * 0.7)}px Georgia, serif`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        for (const piece of board.getPieces()) {
            const isWhitePiece = piece.color === WHITE;
            const x = this.boardOffsetX + piece.x * this.squareSize + this.squareSize / 2;
            const y = this.boardOffsetY + piece.y * this.squareSize + this.squareSize / 2;

            this.ctx.fillStyle = isWhitePiece ? WHITE_PIECE_COLOR : BLACK_PIECE_COLOR;
            if (isWhitePiece) {
                this.ctx.lineWidth = Math.max(1, this.squareSize * 0.03);
                this.ctx.strokeStyle = WHITE_PIECE_OUTLINE;
                this.ctx.strokeText(PIECE_SYMBOLS[piece.type], x, y);
            }
            this.ctx.fillText(PIECE_SYMBOLS[piece.type], x, y);
        }
    }

    handleCanvasClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.viewport.width / rect.width;
        const scaleY = this.viewport.height / rect.height;
        const x = Math.floor(((event.clientX - rect.left) * scaleX - this.boardOffsetX) / this.squareSize);
        const y = Math.floor(((event.clientY - rect.top) * scaleY - this.boardOffsetY) / this.squareSize);

        if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            this.canvas.dispatchEvent(new CustomEvent("boardClick", { detail: { x, y } }));
        }
    }

    getSquareColor(x, y, selection) {
        if (selection.selected && x === selection.x && y === selection.y) {
            return SELECTED_SQUARE_COLOR;
        }
        return (x + y) % 2 === 0 ? LIGHT_SQUARE_COLOR : DARK_SQUARE_COLOR;
    }

    destroy() {
        window.removeEventListener("resize", this.onResize);
        this.canvas.removeEventListener("click", this.onCanvasClick);
    }
}
