import { tableMethods } from "./tables.js";
import { evaluationMethods } from "./evaluate.js";
import { searchMethods } from "./search.js";

class Engine {
    constructor(board, color) {
        this.board = board;
        this.color = color; 
        this.transpositionTable = new Map(); // Uses numeric hash for faster lookups
        this.zobristTable = this.initializeZobristTable();
        this.currentZobristHash = 0n; // Cache zobrist hash
        this.killerMoves = []; // Killer moves for move ordering
        this.nodesEvaluated = 0;
        this.initializeHash(); // Calculate initial hash
    }

    updateBoard(board) {
        this.board = board;
    }
}

Object.assign(Engine.prototype, tableMethods, evaluationMethods, searchMethods);

export default Engine;
