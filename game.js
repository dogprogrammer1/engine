import Board from "./board.js";
export default class Game {
    constructor(renderer, playerColor = 0, evalDisplay = null) {
        this.playerColor = playerColor; // 0 = white, 1 = black
        this.board = new Board(playerColor);
        this.renderer = renderer;
        this.evalDisplay = evalDisplay;
        this.selected = false;
        this.selX = -1;
        this.selY = -1;
        this.engineThinking = false;
    }

    click(x, y) {
        // Don't allow clicks during engine move or if not player's turn
        if (this.engineThinking || this.board.turn !== this.playerColor) {
            return;
        }

        if (!this.selected) {
            if (this.board.getPiece(x, y)[1] !== -1 && this.board.getPiece(x, y)[0] === this.playerColor) {
                this.selected = true;
                this.selX = x;
                this.selY = y;
            }
        } else {
            const clickedPiece = this.board.getPiece(x, y);

            if (x === this.selX && y === this.selY) {
                this.clearSelection();
            } else if (clickedPiece[0] === this.playerColor) {
                this.selX = x;
                this.selY = y;
            } else if (this.board.move(this.selX, this.selY, x, y)) {
                this.clearSelection();
                this.draw();
                
                // Check if game is over
                if (this.board.gameResult?.over) {
                    console.log("Game over:", this.board.gameResult);
                    return;
                }

                // If it's now the engine's turn, make a move after a delay
                if (this.board.turn !== this.playerColor) {
                    this.engineThinking = true;
                    setTimeout(() => this.makeEngineMove(), 500);
                }
            }
        }

        this.draw();
    }

    clearSelection() {
        this.selected = false;
        this.selX = -1;
        this.selY = -1;
    }

    makeEngineMove() {
        const depth = 4; // Engine search depth
        const bestMove = this.board.engine.findBestMove(depth);

        if (bestMove) {
            console.log(`Engine move: (${bestMove.x1},${bestMove.y1}) -> (${bestMove.x2},${bestMove.y2})`);
            console.log(`Board turn before move: ${this.board.turn}, player color: ${this.playerColor}`);
            const moveResult = this.board.move(bestMove.x1, bestMove.y1, bestMove.x2, bestMove.y2);
            console.log(`Move result: ${moveResult}, board turn after: ${this.board.turn}`);
            
            // Check if game is over
            if (this.board.gameResult?.over) {
                console.log("Game over:", this.board.gameResult);
                this.engineThinking = false;
                this.draw();
                return;
            }

            // If it's player's turn again, allow clicks
            if (this.board.turn === this.playerColor) {
                this.engineThinking = false;
            } else {
                // Engine has another move in some edge case
                setTimeout(() => this.makeEngineMove(), 500);
            }
        } else {
            console.log("No legal moves available");
            this.engineThinking = false;
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
        this.updateEvalDisplay();
    }

    updateEvalDisplay() {
        if (!this.evalDisplay) return;

        const evalScore = this.board.engine.evaluateBoardClassical();
        const sign = evalScore > 0 ? "+" : "";
        this.evalDisplay.textContent = `Eval: ${sign}${evalScore.toFixed(2)}`;
    }
}
