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

        this.engineWorker = new Worker(new URL("./engine/engineWorker.js", import.meta.url), {
            type: "module"
        });

        this.engineWorker.onmessage = event => this.handleEngineWorkerMessage(event.data);
        this.engineWorker.onerror = event => {
            console.error("Engine worker error:", event);
            this.engineThinking = false;
            this.draw();
        };
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
        if (this.engineThinking) {
            return;
        }

        this.engineThinking = true;
        this.draw();

        const depth = 4; // Engine search depth
        this.engineWorker.postMessage({
            type: "findBestMove",
            state: this.board.cloneState(),
            color: this.board.engine.color,
            depth
        });
    }

    handleEngineWorkerMessage(data) {
        if (data.type !== "bestMove") {
            if (data.type === "error") {
                console.error("Engine worker error:", data.message, data.stack);
            }
            this.engineThinking = false;
            this.draw();
            return;
        }

        const bestMove = data.bestMove;
        if (bestMove) {
            console.log(`Engine move: (${bestMove.x1},${bestMove.y1}) -> (${bestMove.x2},${bestMove.y2})`);
            console.log(`Board turn before move: ${this.board.turn}, player color: ${this.playerColor}`);
            const moveResult = this.board.move(bestMove.x1, bestMove.y1, bestMove.x2, bestMove.y2);
            console.log(`Move result: ${moveResult}, board turn after: ${this.board.turn}`);

            if (this.board.gameResult?.over) {
                console.log("Game over:", this.board.gameResult);
                this.engineThinking = false;
                this.draw();
                return;
            }

            if (this.board.turn !== this.playerColor) {
                this.engineThinking = false;
                setTimeout(() => this.makeEngineMove(), 500);
                return;
            }
        } else {
            console.log("No legal moves available");
        }

        this.engineThinking = false;
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
