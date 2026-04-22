import Engine from "./engine.js";


class Llong {
    constructor(x = 0n){
        this.val = x;
    }
    bit(x, y){
        return 1n << BigInt(8 * y + x);
    }
    has(x, y){
        return (this.val & this.bit(x, y)) !== 0n;
    }
    set(x, y){
        this.val |= this.bit(x, y);
    }
    clear(x, y){
        this.val &= ~this.bit(x, y);
    }
    move(x1, y1, x2, y2){
        this.clear(x1, y1);
        this.set(x2, y2);
    }
}

let board = [
[
new Llong(0x000000000000FF00n),
new Llong(0x0000000000000024n),
new Llong(0x0000000000000042n),
new Llong(0x0000000000000081n),
new Llong(0x0000000000000008n),
new Llong(0x0000000000000010n)
],
[
new Llong(0x00FF000000000000n),
new Llong(0x2400000000000000n),
new Llong(0x4200000000000000n),
new Llong(0x8100000000000000n),
new Llong(0x0800000000000000n),
new Llong(0x1000000000000000n)
]
];

let canCastle = [true, true, true, true];
let enPassant = [-1, -1];

const steps = {
bishop: [[1,1],[1,-1],[-1,1],[-1,-1]],
rook: [[1,0],[-1,0],[0,1],[0,-1]],
queen: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
king: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
knight: [[1,2],[1,-2],[-1,2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]]
};

function inside(x,y){
    return x >= 0 && x < 8 && y >= 0 && y < 8;
}

function getPiece(x,y){
    for(let c=0;c<2;c++){
        for(let t=0;t<6;t++){
            if(board[c][t].has(x,y)) return [c,t];
        }
    }
    return [-1,-1];
}

function occupied(x,y){
    return getPiece(x,y)[1] !== -1;
}

function sameColor(x,y,color){
    let p = getPiece(x,y);
    return p[0] === color;
}

function enemyColor(x,y,color){
    let p = getPiece(x,y);
    return p[0] === 1-color;
}

function slideCanReach(x1,y1,x2,y2,dirs){
    for(let d of dirs){
        let x=x1+d[0];
        let y=y1+d[1];

        while(inside(x,y)){
            if(x===x2 && y===y2) return true;
            if(occupied(x,y)) break;
            x += d[0];
            y += d[1];
        }
    }
    return false;
}

function attacksSquare(x1,y1,x2,y2){
    let piece = getPiece(x1,y1);
    if(piece[1] === -1) return false;

    let color = piece[0];
    let type  = piece[1];

    if(type === 0){
        let dir = color === 0 ? 1 : -1;
        return (
            (x2 === x1+1 && y2 === y1+dir) ||
            (x2 === x1-1 && y2 === y1+dir)
        );
    }

    if(type === 1) return slideCanReach(x1,y1,x2,y2,steps.bishop);
    if(type === 3) return slideCanReach(x1,y1,x2,y2,steps.rook);
    if(type === 4) return slideCanReach(x1,y1,x2,y2,steps.queen);

    if(type === 2){
        for(let s of steps.knight){
            if(x1+s[0]===x2 && y1+s[1]===y2) return true;
        }
    }

    if(type === 5){
        for(let s of steps.king){
            if(x1+s[0]===x2 && y1+s[1]===y2) return true;
        }
    }

    return false;
}

function kingPos(color){
    for(let y=0;y<8;y++){
        for(let x=0;x<8;x++){
            if(board[color][5].has(x,y)) return [x,y];
        }
    }
    return [-1,-1];
}

function inCheck(color){
    let k = kingPos(color);

    for(let y=0;y<8;y++){
        for(let x=0;x<8;x++){
            let p = getPiece(x,y);
            if(p[0] === 1-color){
                if(attacksSquare(x,y,k[0],k[1])) return true;
            }
        }
    }
    return false;
}

/* =========================
   MOVE VALIDATION
========================= */

function canGetTo(x1,y1,x2,y2){

    if(!inside(x1,y1) || !inside(x2,y2)) return false;

    let piece = getPiece(x1,y1);
    if(piece[1] === -1) return false;

    let color = piece[0];
    let type  = piece[1];

    if(sameColor(x2,y2,color)) return false;

    let dx = x2-x1;
    let dy = y2-y1;

    /* pawn */
    if(type === 0){

        let dir = color===0 ? 1 : -1;
        let start = color===0 ? 1 : 6;

        if(dx===0 && dy===dir && !occupied(x2,y2)) return true;

        if(dx===0 && y1===start && dy===2*dir &&
           !occupied(x1,y1+dir) &&
           !occupied(x2,y2)) return true;

        if(Math.abs(dx)===1 && dy===dir && enemyColor(x2,y2,color))
            return true;

        if(Math.abs(dx)===1 && dy===dir &&
           x2===enPassant[0] && y2===enPassant[1])
            return true;

        return false;
    }

    if(type === 1) return slideCanReach(x1,y1,x2,y2,steps.bishop);
    if(type === 3) return slideCanReach(x1,y1,x2,y2,steps.rook);
    if(type === 4) return slideCanReach(x1,y1,x2,y2,steps.queen);

    if(type === 2){
        for(let s of steps.knight){
            if(dx===s[0] && dy===s[1]) return true;
        }
        return false;
    }

    if(type === 5){

        for(let s of steps.king){
            if(dx===s[0] && dy===s[1]) return true;
        }

        /* castling */
        if(color===0 && y1===0 && y2===0){

            if(x2===6 && canCastle[0] &&
               !occupied(5,0) && !occupied(6,0))
                return true;

            if(x2===2 && canCastle[1] &&
               !occupied(1,0) && !occupied(2,0) && !occupied(3,0))
                return true;
        }

        if(color===1 && y1===7 && y2===7){

            if(x2===6 && canCastle[2] &&
               !occupied(5,7) && !occupied(6,7))
                return true;

            if(x2===2 && canCastle[3] &&
               !occupied(1,7) && !occupied(2,7) && !occupied(3,7))
                return true;
        }

        return false;
    }

    return false;
}


function rawMove(x1,y1,x2,y2){

    let p = getPiece(x1,y1);
    let color = p[0];
    let type = p[1];
    let enemy = 1-color;

    /* capture */
    let target = getPiece(x2,y2);
    if(target[1] !== -1){
        board[target[0]][target[1]].clear(x2,y2);
    }

    /* en passant capture */
    if(type===0 && x2===enPassant[0] && y2===enPassant[1] && !occupied(x2,y2)){
        let capY = color===0 ? y2-1 : y2+1;
        board[enemy][0].clear(x2,capY);
    }

    board[color][type].move(x1,y1,x2,y2);

    /* castle rook */
    if(type===5 && Math.abs(x2-x1)===2){
        if(x2===6){
            board[color][3].move(7,y1,5,y1);
        }else{
            board[color][3].move(0,y1,3,y1);
        }
    }

    /* promotion auto queen */
    if(type===0 && (y2===7 || y2===0)){
        board[color][0].clear(x2,y2);
        board[color][4].set(x2,y2);
    }

    /* reset EP */
    enPassant = [-1,-1];

    if(type===0 && Math.abs(y2-y1)===2){
        enPassant = [x1,(y1+y2)/2];
    }

    /* castle rights */
    if(type===5){
        if(color===0){ canCastle[0]=false; canCastle[1]=false; }
        else{ canCastle[2]=false; canCastle[3]=false; }
    }

    if(type===3){
        if(color===0 && x1===0 && y1===0) canCastle[1]=false;
        if(color===0 && x1===7 && y1===0) canCastle[0]=false;
        if(color===1 && x1===0 && y1===7) canCastle[3]=false;
        if(color===1 && x1===7 && y1===7) canCastle[2]=false;
    }
}

function cloneState(){
    return {
        board: board.map(side => side.map(p => p.val)),
        castle: [...canCastle],
        ep: [...enPassant]
    };
}

function restoreState(s){
    for(let c=0;c<2;c++){
        for(let t=0;t<6;t++){
            board[c][t].val = s.board[c][t];
        }
    }
    canCastle = [...s.castle];
    enPassant = [...s.ep];
}

function move(x1,y1,x2,y2){ // also checks if the move is valid
    if (turn == getPiece(x1,y1)[0]) return false;
    let piece = getPiece(x1,y1);
    if(piece[1] === -1) return false;

    if(!canGetTo(x1,y1,x2,y2)) return false;

    let color = piece[0];

    let save = cloneState();

    rawMove(x1,y1,x2,y2);

    if(inCheck(color)){
        restoreState(save);
        return false;
    }

    return true;
}




const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.height = 480;
canvas.width = 480;

let selected = false;
let turn = 0; // 0 white, 1 black
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
    for(let c=0;c<2;c++){
        for(let t=0;t<6;t++){
            let piece = board[c][t];
            for(let y=0;y<8;y++){
                for(let x=0;x<8;x++){
                    if(piece.has(x,y)){
                        ctx.fillStyle = c===0 ? "#333" : "#aaa";
                        ctx.font = "40px Arial";
                        let symbol = "";
                        if(t===0) symbol = "P";
                        if(t===1) symbol = "B";
                        if(t===2) symbol = "N";
                    if(t===3) symbol = "R";
                        if(t===4) symbol = "Q";
                        if(t===5) symbol = "K";
                        ctx.fillText(symbol, x*60+15, y*60+45);
                    }
                }
            }
        }
    }
}


canvas.addEventListener("click", e => {
    let x = Math.floor(e.offsetX / 60);
    let y = Math.floor(e.offsetY / 60);
    if(!selected){
        if(getPiece(x,y)[1] !== -1){
            selected = true;
            selX = x;
            selY = y;
        }
    }else{
        if(move(selX, selY, x, y)){
            turn = 1 - turn;
        }
        selected = false;
    }
    drawBoard();
});
drawBoard();

