import Board from "./board.js";
import { drawPieces } from "./renderer.js";

let b = new Board();


const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.height = 480;
canvas.width = 480;

let selected = false;
let selX = -1;
let selY = -1;

function drawBoard(){
    for(let y=0;y<8;y++){
        for(let x=0;x<8;x++){
            ctx.fillStyle = (x+y)%2===0 ? "#eee" : "#057a14";
            if(selected && x===selX && y===selY){
                ctx.fillStyle = "rgb(84, 96, 223)";
            }
            ctx.fillRect(x*60,y*60,60,60);
        }
    }
    drawPieces(ctx, b);
}


canvas.addEventListener("click", e => {
    let x = Math.floor(e.offsetX / 60);
    let y = Math.floor(e.offsetY / 60);
    if(!selected){
        if(b.getPiece(x,y)[1] !== -1){
            selected = true;
            selX = x;
            selY = y;
        }
    }else{
        b.move(selX, selY, x, y);
        selected = false;
    }
    drawBoard();
});
drawBoard();

