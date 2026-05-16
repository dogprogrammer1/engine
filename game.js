import Board from "./board.js";
const WHITE = 0;
const BLACK = 1;

const BOT_CONFIGS = {
    [WHITE]: {
        label: "Classical",
        evaluator: "classical",
        depth: 4
    },
    [BLACK]: {
        label: "NNUE_Evaluator",
        evaluator: "NNUE_Evaluator",
        depth: 4
    }
};

const COLOR_NAMES = {
    [WHITE]: "White",
    [BLACK]: "Black"
};

function evaluatorLabel(evaluator) {
    if (!evaluator) {
        return null;
    }

    return evaluator === "NNUE_Evaluator" ? "NNUE_Evaluator" : "Classical";
}

export default class Game {
    constructor(renderer, playerColor = 0, evalDisplay = null, sideDisplay = null) {
        this.playerColor = playerColor;
        this.board = new Board(playerColor, { silent: true });
        this.renderer = renderer;
        this.evalDisplay = evalDisplay;
        this.sideDisplay = sideDisplay;
        this.selected = false;
        this.selX = -1;
        this.selY = -1;
        this.engineThinking = false;
        this.moveTimer = null;
        this.lastSearchStats = {
            [WHITE]: null,
            [BLACK]: null
        };

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
        return;
    }

    clearSelection() {
        this.selected = false;
        this.selX = -1;
        this.selY = -1;
    }

    makeEngineMove() {
        if (this.engineThinking || this.board.gameResult?.over) {
            return;
        }

        const sideToMove = this.board.turn;
        const botConfig = BOT_CONFIGS[sideToMove];

        this.engineThinking = true;
        this.draw();

        this.engineWorker.postMessage({
            type: "findBestMove",
            state: this.board.cloneState(),
            color: sideToMove,
            depth: botConfig.depth,
            evaluator: botConfig.evaluator
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
        this.lastSearchStats[data.color] = {
            elapsedMs: data.elapsedMs,
            nodesEvaluated: data.nodesEvaluated,
            evalCount: data.evalCount,
            evalTimeMs: data.evalTimeMs,
            evaluator: data.evaluator,
            requestedEvaluator: data.requestedEvaluator,
            warning: data.warning || null
        };

        if (data.warning) {
            console.warn(data.warning);
        }

        if (bestMove) {
            const moveResult = this.board.move(bestMove.x1, bestMove.y1, bestMove.x2, bestMove.y2);
            console.log(
                `${COLOR_NAMES[data.color]} (${BOT_CONFIGS[data.color].label}) move: ` +
                `(${bestMove.x1},${bestMove.y1}) -> (${bestMove.x2},${bestMove.y2}), success=${moveResult}, ` +
                `time=${data.elapsedMs.toFixed(1)}ms, nodes=${data.nodesEvaluated}, ` +
                `evals=${data.evalCount}, evalTime=${data.evalTimeMs.toFixed(1)}ms, ` +
                `avgEval=${data.evalCount ? (data.evalTimeMs / data.evalCount).toFixed(4) : "0.0000"}ms`
            );

            if (this.board.gameResult?.over) {
                console.log("Game over:", this.board.gameResult);
                this.engineThinking = false;
                this.draw();
                return;
            }

            this.engineThinking = false;
            this.scheduleNextMove();
            return;
        } else {
            console.log("No legal moves available");
        }

        this.engineThinking = false;
        this.draw();
    }

    scheduleNextMove(delay = 350) {
        if (this.moveTimer) {
            clearTimeout(this.moveTimer);
        }

        this.moveTimer = setTimeout(() => {
            this.moveTimer = null;
            this.makeEngineMove();
        }, delay);
    }

    startAutoPlay() {
        this.scheduleNextMove(350);
    }

    destroy() {
        if (this.moveTimer) {
            clearTimeout(this.moveTimer);
            this.moveTimer = null;
        }

        this.engineWorker.terminate();
    }

    startManualPlay() {
        this.destroy();
        this.clearSelection();
    
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

        const sideToMove = COLOR_NAMES[this.board.turn];
        const currentBot =
            evaluatorLabel(this.lastSearchStats[this.board.turn]?.evaluator) ||
            BOT_CONFIGS[this.board.turn].label;
        const whiteStats = this.lastSearchStats[WHITE];
        const blackStats = this.lastSearchStats[BLACK];
        const whiteTime = whiteStats ? `${whiteStats.elapsedMs.toFixed(1)}ms` : "--";
        const blackTime = blackStats ? `${blackStats.elapsedMs.toFixed(1)}ms` : "--";
        const whiteLabel = whiteStats ? evaluatorLabel(whiteStats.evaluator) : BOT_CONFIGS[WHITE].label;
        const blackLabel = blackStats ? evaluatorLabel(blackStats.evaluator) : BOT_CONFIGS[BLACK].label;

        this.evalDisplay.textContent =
            `Turn: ${sideToMove} (${currentBot}) | Last think times - White: ${whiteTime}, Black: ${blackTime}`;

        if (this.sideDisplay) {
            let gameStatus = "";

            if (this.board.gameResult?.over) {
                if (this.board.gameResult.winner === -1) {
                    gameStatus = ` | Result: draw by ${this.board.gameResult.reason}`;
                } else {
                    gameStatus =
                        ` | Result: ${COLOR_NAMES[this.board.gameResult.winner]} wins by ${this.board.gameResult.reason}`;
                }
            }

            this.sideDisplay.textContent =
                `White: ${whiteLabel} | Black: ${blackLabel}${gameStatus}`;
        }
    }
}
