export function drawPieces(ctx, board) {
    for(let c=0;c<2;c++){
        for(let t=0;t<6;t++){
            let piece = board.board[c][t];
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
