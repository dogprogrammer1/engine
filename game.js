import Board from "./board.js";
export default class Game {
    constructor(renderer) {
        this.board = new Board();
        this.renderer = renderer;
        this.selected = false;
        this.selX = -1;
        this.selY = -1;
    }

    click(x, y) {
        if(!this.selected){
            if(this.board.getPiece(x,y)[1] !== -1){
                this.selected = true;
                this.selX = x;
                this.selY = y;
            }
        }else{
            this.board.move(this.selX, this.selY, x, y);
            this.selected = false;
        }

        this.draw();
    }

    selection() {
        return {
            selected: this.selected,
            x: this.selX,
            y: this.selY
        };
    }

    draw() {
        this.renderer.draw(this.board, this.selection());
    }
}
