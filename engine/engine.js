import { tableMethods } from "./tables.js";
import { evaluationMethods } from "./evaluate.js";
import { searchMethods } from "./search.js";

export const ENGINE_EVALUATORS = {
    CLASSICAL: "classical",
    NNUE: "NNUE_Evaluator"
};

class Engine {
    constructor(board, color, evaluator = ENGINE_EVALUATORS.CLASSICAL) {
        this.board = board;
        this.color = color;
        this.evaluator = this.normalizeEvaluator(evaluator);
        this.transpositionTable = new Map(); // Uses numeric hash for faster lookups
        this.zobristTable = this.initializeZobristTable();
        this.currentZobristHash = 0n; // Cache zobrist hash
        this.killerMoves = []; // Killer moves for move ordering
        this.nodesEvaluated = 0;
        this.evalCount = 0;
        this.evalTimeMs = 0;
        this.initializeHash(); // Calculate initial hash
    }

    updateBoard(board) {
        this.board = board;
    }

    normalizeEvaluator(evaluator) {
        return evaluator === ENGINE_EVALUATORS.NNUE
            ? ENGINE_EVALUATORS.NNUE
            : ENGINE_EVALUATORS.CLASSICAL;
    }
}

Object.assign(Engine.prototype, tableMethods, evaluationMethods, searchMethods);

export default Engine;
