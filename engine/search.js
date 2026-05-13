import { pieceValues } from "./tables.js";

export const searchMethods = {
    findBestMove(depth) {
        const MAXDEPTH = 10;
        if(depth > MAXDEPTH) depth = MAXDEPTH;
        
        this.nodesEvaluated = 0;
        
        // Clear transposition table
        if (this.transpositionTable.size > 100000) {
            this.clearTranspositionTable();
        }
        
        const moves = this.board.generateLegalMoves(this.color);
        console.log(`Engine (color=${this.color}) generating moves, board.turn=${this.board.turn}, found ${moves.length} legal moves`);
        if (moves.length === 0) return null;
        
        // killer moves = best current at each depth :)
        this.killerMoves = Array(depth + 1).fill(null).map(() => []);
        
        let bestMove = moves[0];
        let previousIterationMoves = [];

        for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
            let tempBestScore = this.color === 0 ? -Infinity : Infinity;
            let tempBestMove = moves[0];

            this.sortMovesByPreviousResults(moves, previousIterationMoves);
            previousIterationMoves = [];

            for (const move of moves) {
                const boardState = this.board.cloneState();
                
                // Make the move
                this.board.rawMove(move.x1, move.y1, move.x2, move.y2);
                this.board.turn = 1 - this.board.turn;
                
                // Evaluate with minimax
                const score = this.minimax(currentDepth - 1, -Infinity, Infinity);
                
                // Restore board state
                this.board.restoreState(boardState);
                
                // Update best move
                if (this.color === 0) {
                    if (score > tempBestScore) {
                        tempBestScore = score;
                        tempBestMove = move;
                    }
                } else {
                    if (score < tempBestScore) {
                        tempBestScore = score;
                        tempBestMove = move;
                    }
                }
                
                previousIterationMoves.push({ move, score });
            }
            
            bestMove = tempBestMove;
        }
        
        return bestMove;
    },

    sortMovesByPreviousResults(moves, previousResults) {
        const resultMap = new Map();
        for (const result of previousResults) {
            const key = `${result.move.x1},${result.move.y1},${result.move.x2},${result.move.y2}`;
            resultMap.set(key, result.score);
        }
        moves.sort((a, b) => {
            const sa = resultMap.get(`${a.x1},${a.y1},${a.x2},${a.y2}`) ?? 0;
            const sb = resultMap.get(`${b.x1},${b.y1},${b.x2},${b.y2}`) ?? 0;
            return this.color === 0 ? sb - sa : sa - sb;
        });
    },

    getPieceValue(type) {
        return pieceValues[type] ?? 0;
    },

    minimax(depth, alpha, beta) {
        const maximizingPlayer = this.board.turn === 0;
        this.nodesEvaluated++;
        // Get zobrist hash for transposition table lookup
        const zobristHash = this.calculateZobristHash();
        
        // Transposition table lookup
        const tabEntry = this.lookupTransposition(zobristHash, depth);
        if (tabEntry) {
            if (tabEntry.flag === 0) return tabEntry.score; // Exact score
            if (tabEntry.flag === 1) alpha = Math.max(alpha, tabEntry.score); // Lower bound
            if (tabEntry.flag === 2) beta = Math.min(beta, tabEntry.score);  // Upper bound
            if (alpha >= beta) return tabEntry.score;
        }
        
        // Use quiescence search at leaf nodes for better tactical evaluation
        if (depth === 0) {
            return this.quiescenceSearch(alpha, beta);
        }

        const moves = this.board.generateLegalMoves(this.board.turn);

        if (moves.length === 0) {
            if (this.board.inCheck(this.board.turn)) {
                // Checkmate: penalize based on depth (favor faster checkmates)
                const score = maximizingPlayer ? -10000 + depth : 10000 - depth;
                this.storeTransposition(zobristHash, depth, score, 0);
                return score;
            } else {
                // Stalemate: neutral position
                this.storeTransposition(zobristHash, depth, 0, 0);
                return 0;
            }
        }
        
        let value = maximizingPlayer ? -Infinity : Infinity;
        let bestMove = null;
        const alphaOrig = alpha;
        const betaOrig = beta;

        this.orderMoves(moves);

        for (const move of moves) {
            const boardState = this.board.cloneState();
            this.board.rawMove(move.x1, move.y1, move.x2, move.y2);
            this.board.turn = 1 - this.board.turn;
            const childValue = this.minimax(depth - 1, alpha, beta);
            this.board.restoreState(boardState);

            if (maximizingPlayer ? childValue > value : childValue < value) {
                value = childValue;
                bestMove = move;
            }
            if (maximizingPlayer) { alpha = Math.max(alpha, value); }
            else { beta = Math.min(beta, value); }
            if (alpha >= beta) break;
        }
        
        // Store in transposition table
        let flag = 0;
        if (value <= alphaOrig) flag = 2; // Upper bound
        else if (value >= betaOrig) flag = 1; // Lower bound
        else flag = 0; // Exact
        
        this.storeTransposition(zobristHash, depth, value, flag, bestMove);
        
        return value;
    },

    quiescenceSearch(alpha, beta, depthRemaining = 4) {
        const maximizingPlayer = this.board.turn === 0;
        const standPat = this.evaluateBoard();
        if (depthRemaining <= 0) return standPat;
        
        if (maximizingPlayer) {
            if (standPat >= beta) return beta;
            // Delta pruning: if even the best capture can't help, return early
            const deltaMargin = 900; // Queen value - largest expected gain
            if (standPat + deltaMargin < alpha) return alpha;
            alpha = Math.max(alpha, standPat);
        } else {
            if (standPat <= alpha) return alpha;
            const deltaMargin = 900;
            if (standPat - deltaMargin > beta) return beta;
            beta = Math.min(beta, standPat);
        }
        
        const tacticalMoves = this.generateCaptureMoves(this.board.turn);
        
        if (tacticalMoves.length === 0) {
            return standPat;
        }
        
        // Order captures with MVV-LVA
        tacticalMoves.sort((a, b) => {
            const targetA = this.board.getPiece(a.x2, a.y2);
            const targetB = this.board.getPiece(b.x2, b.y2);
            const srcA = this.board.getPiece(a.x1, a.y1);
            const srcB = this.board.getPiece(b.x1, b.y1);
            
            const valueA = this.getPieceValue(targetA[1]) * 10 - this.getPieceValue(srcA[1]);
            const valueB = this.getPieceValue(targetB[1]) * 10 - this.getPieceValue(srcB[1]);
            return valueB - valueA;
        });
        
        let value = standPat;
        for (const move of tacticalMoves) {
            const boardState = this.board.cloneState();
            this.board.rawMove(move.x1, move.y1, move.x2, move.y2);
            this.board.turn = 1 - this.board.turn;
            const childValue = this.quiescenceSearch(alpha, beta, depthRemaining - 1);
            this.board.restoreState(boardState);

            if (maximizingPlayer) {
                value = Math.max(value, childValue);
                alpha = Math.max(alpha, value);
            } else {
                value = Math.min(value, childValue);
                beta = Math.min(beta, value);
            }
            if (alpha >= beta) break;
        }
        return value;
    },

    generateCaptureMoves(color) {
        const moves = [];
        const pieces = this.board.getPieces();
        const ownPieces = [];
        const enemyPieces = [];
        const originalTurn = this.board.turn;

        for (const piece of pieces) {
            if (piece.color === color) {
                ownPieces.push(piece);
            } else {
                enemyPieces.push(piece);
            }
        }

        this.board.turn = color;

        for (const piece of ownPieces) {
            for (const target of enemyPieces) {
                const move = { x1: piece.x, y1: piece.y, x2: target.x, y2: target.y };
                if (this.board.canGetTo(move.x1, move.y1, move.x2, move.y2) && this.isMoveKingSafe(move, color)) {
                    moves.push(move);
                }
            }

            if (piece.type === 0 && this.board.enPassant[0] !== -1) {
                const move = { x1: piece.x, y1: piece.y, x2: this.board.enPassant[0], y2: this.board.enPassant[1] };
                if (this.board.canGetTo(move.x1, move.y1, move.x2, move.y2) && this.isMoveKingSafe(move, color)) {
                    moves.push(move);
                }
            }
        }

        this.board.turn = originalTurn;
        return moves;
    },

    isMoveKingSafe(move, color) {
        const boardState = this.board.cloneState();

        this.board.rawMove(move.x1, move.y1, move.x2, move.y2);
        const isSafe = !this.board.inCheck(color);

        this.board.restoreState(boardState);
        return isSafe;
    },

    orderMoves(moves) {
        const scores = new Map();
        for (const move of moves) {
            const target = this.board.getPiece(move.x2, move.y2);
            const source = this.board.getPiece(move.x1, move.y1);
            scores.set(move, target[1] !== -1
                ? this.getPieceValue(target[1]) * 10 - this.getPieceValue(source[1])
                : 0);
        }
        moves.sort((a, b) => scores.get(b) - scores.get(a));
    }
};
