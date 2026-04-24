export default class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        canvas.height = 480;
        canvas.width = 480;
    }

    draw(board, selection) {
        for(let y=0;y<8;y++){
            for(let x=0;x<8;x++){
                this.ctx.fillStyle = (x+y)%2===0 ? "#eee" : "#057a14";
                if(selection.selected && x===selection.x && y===selection.y){
                    this.ctx.fillStyle = "rgb(84, 96, 223)";
                }
                this.ctx.fillRect(x*60,y*60,60,60);
            }
        }

        this.drawPieces(board);
    }

    drawPieces(board) {
        for(const piece of board.getPieces()){
            this.ctx.fillStyle = piece.color===0 ? "#333" : "#aaa";
            this.ctx.font = "40px Arial";
            let symbol = "";
            if(piece.type===0) symbol = "P";
            if(piece.type===1) symbol = "B";
            if(piece.type===2) symbol = "N";
            if(piece.type===3) symbol = "R";
            if(piece.type===4) symbol = "Q";
            if(piece.type===5) symbol = "K";
            this.ctx.fillText(symbol, piece.x*60+15, piece.y*60+45);
        }
    }
}
