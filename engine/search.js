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
        let bestScore = this.color === 0 ? -Infinity : Infinity;
        let previousIterationMoves = [];

        //iteration
        for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
            
            let tempBestScore = this.color === 0 ? -Infinity : Infinity;
            let tempBestMove = moves[0];
            
            // Sort moves based on previous iteration results
            const sortedMoves = this.sortMovesByPreviousResults(moves, previousIterationMoves);
            previousIterationMoves = [];
            
            for (const move of sortedMoves) {
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
            
            // Update best move for this iteration
            bestMove = tempBestMove;
            bestScore = tempBestScore;
        }
        
        return bestMove;
    },

    sortMovesByPreviousResults(moves, previousResults) {
        // Build a fast lookup map - using string keys only when needed
        const resultMap = new Map();
        for (let i = 0; i < previousResults.length; i++) {
            const result = previousResults[i];
            const key = `${result.move.x1},${result.move.y1},${result.move.x2},${result.move.y2}`;
            resultMap.set(key, result.score);
        }
        
        // Sort moves directly without creating intermediate objects
        moves.sort((a, b) => {
            const keyA = `${a.x1},${a.y1},${a.x2},${a.y2}`;
            const keyB = `${b.x1},${b.y1},${b.x2},${b.y2}`;
            const scoreA = resultMap.get(keyA) ?? 0;
            const scoreB = resultMap.get(keyB) ?? 0;
            
            // Sort descending for white, ascending for black
            return this.color === 0 ? scoreB - scoreA : scoreA - scoreB;
        });
        
        return moves;
    },

    getPieceValue(type) {
        switch(type) {
            case 0: return 100;  // Pawn
            case 1: return 330;  // Bishop
            case 2: return 320;  // Knight
            case 3: return 500;  // Rook
            case 4: return 900;  // Queen
            case 5: return 10000; // King (never captured)
            default: return 0;
        }
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
        
        // Generate legal moves
        const moves = this.board.generateLegalMoves(this.board.turn);
        
        // Terminal node: checkmate or stalemate
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
        
        let value;
        let bestMove = null;
        const alphaOrig = alpha;
        const betaOrig = beta;
        
        // Sort moves with improved heuristic
        this.orderMoves(moves);
        
        if (maximizingPlayer) {
            value = -Infinity;
            
            for (const move of moves) {
                const boardState = this.board.cloneState();
                
                // Make move
                this.board.rawMove(move.x1, move.y1, move.x2, move.y2);
                this.board.turn = 1 - this.board.turn;
                
                // Recursive minimax call
                const childValue = this.minimax(depth - 1, alpha, beta);
                
                // Restore board
                this.board.restoreState(boardState);
                
                if (childValue > value) {
                    value = childValue;
                    bestMove = move;
                }
                
                alpha = Math.max(alpha, value);
                if (alpha >= beta) break; // Beta cutoff - early termination
            }
        } else {
            value = Infinity;
            
            for (const move of moves) {
                const boardState = this.board.cloneState();
                
                // Make move
                this.board.rawMove(move.x1, move.y1, move.x2, move.y2);
                this.board.turn = 1 - this.board.turn;
                
                // Recursive minimax call
                const childValue = this.minimax(depth - 1, alpha, beta);
                
                // Restore board
                this.board.restoreState(boardState);
                
                if (childValue < value) {
                    value = childValue;
                    bestMove = move;
                }
                
                beta = Math.min(beta, value);
                if (alpha >= beta) break; // Alpha cutoff - early termination
            }
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
        const standPat = this.evaluateBoardClassical();
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
        
        if (maximizingPlayer) {
            let value = standPat;
            for (const move of tacticalMoves) {
                const boardState = this.board.cloneState();
                
                this.board.rawMove(move.x1, move.y1, move.x2, move.y2);
                this.board.turn = 1 - this.board.turn;
                
                const childValue = this.quiescenceSearch(alpha, beta, depthRemaining - 1);
                
                this.board.restoreState(boardState);
                
                value = Math.max(value, childValue);
                alpha = Math.max(alpha, value);
                if (alpha >= beta) break;
            }
            return value;
        } else {
            let value = standPat;
            for (const move of tacticalMoves) {
                const boardState = this.board.cloneState();
                
                this.board.rawMove(move.x1, move.y1, move.x2, move.y2);
                this.board.turn = 1 - this.board.turn;
                
                const childValue = this.quiescenceSearch(alpha, beta, depthRemaining - 1);
                
                this.board.restoreState(boardState);
                
                value = Math.min(value, childValue);
                beta = Math.min(beta, value);
                if (alpha >= beta) break;
            }
            return value;
        }
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
        // Pre-calculate piece values for all moves using a single pass
        const moveScores = [];
        
        for (const move of moves) {
            const target = this.board.getPiece(move.x2, move.y2);
            const source = this.board.getPiece(move.x1, move.y1);
            
            let score = 0;
            
            // Captures: MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
            if (target[1] !== -1) {
                score = this.getPieceValue(target[1]) * 10 - this.getPieceValue(source[1]);
            }
            
            moveScores.push({ move, score });
        }
        
        // Sort by score descending
        moveScores.sort((a, b) => b.score - a.score);
        
        // Replace original moves array with sorted moves - in-place for performance
        moves.length = 0;
        for (let i = 0; i < moveScores.length; i++) {
            moves[i] = moveScores[i].move;
        }
    }
};
