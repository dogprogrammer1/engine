import Board from "./board.js";
const WHITE = 0;
const BLACK = 1;
const HUMAN_LABEL = "Human";

const DEFAULT_BOT_CONFIGS = {
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
        this.humanColor = null;
        this.botConfigs = this.cloneBotConfigs(DEFAULT_BOT_CONFIGS);

        this.engineWorker = this.createEngineWorker();
    }

    createEngineWorker() {
        const worker = new Worker(new URL("./engine/engineWorker.js", import.meta.url), {
            type: "module"
        });

        worker.onmessage = event => this.handleEngineWorkerMessage(event.data);
        worker.onerror = event => {
            console.error("Engine worker error:", event);
            this.engineThinking = false;
            this.draw();
        };

        return worker;
    }

    cloneBotConfigs(configs) {
        return {
            [WHITE]: configs[WHITE] ? { ...configs[WHITE] } : null,
            [BLACK]: configs[BLACK] ? { ...configs[BLACK] } : null
        };
    }

    isEngineControlled(color) {
        return Boolean(this.botConfigs[color]);
    }

    currentHumanColor() {
        return this.humanColor;
    }

    clearMoveTimer() {
        if (!this.moveTimer) {
            return;
        }

        clearTimeout(this.moveTimer);
        this.moveTimer = null;
    }

    click(x, y) {
        const humanColor = this.currentHumanColor();

        // Ignore clicks unless this side is controlled by a human player.
        if (humanColor === null || this.engineThinking || this.board.turn !== humanColor) {
            return;
        }
 
        if (!this.selected) {
            if (this.board.getPiece(x, y)[1] !== -1 && this.board.getPiece(x, y)[0] === humanColor) {
                this.selected = true;
                this.selX = x;
                this.selY = y;
            }
        } else {
            const clickedPiece = this.board.getPiece(x, y);
 
            if (x === this.selX && y === this.selY) {
                this.clearSelection();
            } else if (clickedPiece[0] === humanColor) {
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
 
                if (this.isEngineControlled(this.board.turn)) {
                    this.scheduleNextMove(500);
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
        const botConfig = this.botConfigs[sideToMove];
        if (!botConfig) {
            return;
        }

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
                `${COLOR_NAMES[data.color]} (${this.botConfigs[data.color]?.label ?? HUMAN_LABEL}) move: ` +
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
            if (this.isEngineControlled(this.board.turn)) {
                this.scheduleNextMove();
            } else {
                this.draw();
            }
            return;
        } else {
            console.log("No legal moves available");
        }

        this.engineThinking = false;
        this.draw();
    }

    scheduleNextMove(delay = 350) {
        this.clearMoveTimer();

        this.moveTimer = setTimeout(() => {
            this.moveTimer = null;
            this.makeEngineMove();
        }, delay);
    }

    startAutoPlay() {
        this.clearMoveTimer();
        this.clearSelection();
        this.engineThinking = false;
        this.humanColor = null;
        this.botConfigs = this.cloneBotConfigs(DEFAULT_BOT_CONFIGS);
        this.draw();
        this.scheduleNextMove(350);
    }

    destroy() {
        this.clearMoveTimer();

        this.engineWorker.terminate();
    }

    startManualPlay(playerSide = "white", evaluator = "classical") {
        const humanColor = playerSide === "black" ? BLACK : WHITE;
        const engineColor = humanColor === WHITE ? BLACK : WHITE;
        const engineEvaluator = evaluator === "nnue" ? "NNUE_Evaluator" : "classical";

        this.clearMoveTimer();
        this.clearSelection();
        this.engineThinking = false;
        this.humanColor = humanColor;
        this.botConfigs = {
            [WHITE]: null,
            [BLACK]: null
        };
        this.botConfigs[engineColor] = {
            label: evaluatorLabel(engineEvaluator),
            evaluator: engineEvaluator,
            depth: 4
        };

        this.draw();

        if (this.isEngineControlled(this.board.turn)) {
            this.scheduleNextMove(350);
        }
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
            (this.isEngineControlled(this.board.turn)
                ? this.botConfigs[this.board.turn].label
                : HUMAN_LABEL);
        const whiteStats = this.lastSearchStats[WHITE];
        const blackStats = this.lastSearchStats[BLACK];
        const whiteTime = whiteStats ? `${whiteStats.elapsedMs.toFixed(1)}ms` : "--";
        const blackTime = blackStats ? `${blackStats.elapsedMs.toFixed(1)}ms` : "--";
        const whiteLabel = whiteStats
            ? evaluatorLabel(whiteStats.evaluator)
            : (this.botConfigs[WHITE]?.label ?? HUMAN_LABEL);
        const blackLabel = blackStats
            ? evaluatorLabel(blackStats.evaluator)
            : (this.botConfigs[BLACK]?.label ?? HUMAN_LABEL);

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
