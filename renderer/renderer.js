import {
    BOARD_SIZE,
    CANVAS_SIZE,
    PIECE_FONT,
    PIECE_OFFSET_X,
    PIECE_OFFSET_Y,
    PIECE_SYMBOLS,
    SQUARE_SIZE
} from "../ui-constants.js";

export default class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        canvas.height = CANVAS_SIZE;
        canvas.width = CANVAS_SIZE;
    }

    draw(board, selection) {
        for(let y=0;y<BOARD_SIZE;y++){
            for(let x=0;x<BOARD_SIZE;x++){
                this.ctx.fillStyle = (x+y)%2===0 ? "#eee" : "#057a14";
                if(selection.selected && x===selection.x && y===selection.y){
                    this.ctx.fillStyle = "rgb(84, 96, 223)";
                }
                this.ctx.fillRect(x * SQUARE_SIZE, y * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
            }
        }

        this.drawPieces(board);
    }

    drawPieces(board) {
        for(const piece of board.getPieces()){
            this.ctx.fillStyle = piece.color===0 ? "#333" : "#aaa";
            this.ctx.font = PIECE_FONT;
            this.ctx.fillText(
                PIECE_SYMBOLS[piece.type],
                piece.x * SQUARE_SIZE + PIECE_OFFSET_X,
                piece.y * SQUARE_SIZE + PIECE_OFFSET_Y
            );
        }
    }
}
