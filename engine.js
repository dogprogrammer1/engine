export default class Engine {
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

    initializeHash() {
        let hash = 0n;
        const pieces = this.board.getPieces();
        
        for (const piece of pieces) {
            const square = piece.y * 8 + piece.x;
            hash ^= this.zobristTable[piece.color][piece.type][square];
        }
        
        // XOR with turn and castling rights
        hash ^= BigInt(this.board.turn);
        hash ^= BigInt(this.board.canCastle[0] << 2 | this.board.canCastle[1] << 1 | 
                       this.board.canCastle[2] << 3 | this.board.canCastle[3]);
        
        this.currentZobristHash = hash;
    }

    // Initialize Zobrist hashing - minimal memory usage with 64-bit hashes
    // Generates random 64-bit values for each piece type, color, and square
    initializeZobristTable() {
        // Zobrist table: [color][pieceType][square] = random 64-bit BigInt
        const table = [[], []];
        
        for (let color = 0; color < 2; color++) {
            table[color] = [];
            for (let type = 0; type < 6; type++) {
                table[color][type] = [];
                for (let square = 0; square < 64; square++) {
                    // Generate pseudo-random 64-bit values
                    const seed = color * 384 + type * 64 + square;
                    table[color][type][square] = this.xorshift64(seed);
                }
            }
        }
        
        return table;
    }

    // Xorshift-based pseudo-random number generator for 64-bit values
    xorshift64(seed) {
        let x = BigInt(seed) * 6364136223846793005n + 1442695040888963407n;
        x = x ^ (x >> 33n);
        x = x * 0xff51afd7ed558ccdn;
        x = x ^ (x >> 33n);
        return x;
    }

    // Calculate Zobrist hash for current board position and convert to numeric hash
    calculateZobristHash() {
        // Optimize: rebuild from scratch only when needed (after board restore)
        let hash = 0n;
        const pieces = this.board.getPieces();
        
        for (const piece of pieces) {
            const square = piece.y * 8 + piece.x;
            hash ^= this.zobristTable[piece.color][piece.type][square];
        }
        
        // XOR with turn and castling rights for completeness
        hash ^= BigInt(this.board.turn);
        hash ^= BigInt(this.board.canCastle[0] << 2 | this.board.canCastle[1] << 1 | 
                       this.board.canCastle[2] << 3 | this.board.canCastle[3]);
        
        // Convert to numeric hash for faster Map lookups (using last 53 bits of BigInt)
        return Number(hash & 0x1FFFFFFFFFFFFFn);
    }

    // Lookup position in transposition table with numeric hash
    lookupTransposition(hash, depth) {
        const entry = this.transpositionTable.get(hash);
        if (entry && entry.depth >= depth) {
            return entry;
        }
        return null;
    }

    // Store position evaluation in transposition table with numeric hash
    storeTransposition(hash, depth, score, flag, bestMove) {
        // flag: 0 = exact, 1 = lower bound, 2 = upper bound
        
        // Prevent unbounded transposition table growth
        if (this.transpositionTable.size > 200000) {
            // Clear when threshold exceeded
            this.transpositionTable.clear();
        }
        
        const entry = this.transpositionTable.get(hash);
        
        // Only store if deeper or first time
        if (!entry || entry.depth <= depth) {
            this.transpositionTable.set(hash, { depth, score, flag, bestMove });
        }
    }

    // Clear transposition table and reset stats
    clearTranspositionTable() {
        this.transpositionTable.clear();
        this.nodesEvaluated = 0;
    }
    updateBoard(board) {
        this.board = board;
    }
    evaluateBoardClassical(){
        // Optimized material values with refined weights
        // Piece types from board: 0=Pawn, 1=Bishop, 2=Knight, 3=Rook, 4=Queen, 5=King
        const pieceValues = {
            0: 100,   // Pawn (scaled x100 for precision)
            2: 320,   // Knight
            1: 330,   // Bishop
            3: 500,   // Rook
            4: 900,   // Queen
            5: 0      // King (no base value)
        };

        // Using piece type indexes: 0=Pawn, 2=Knight, 1=Bishop, 3=Rook, 4=Queen, 5=King, 6=Endgame King
        const pieceSquareTables = {
            0: [ // Pawn 
                [0, 0, 0, 0, 0, 0, 0, 0],
                [50, 50, 50, 50, 50, 50, 50, 50],
                [20, 20, 30, 40, 40, 30, 20, 20],
                [10, 10, 15, 30, 30, 15, 10, 10],
                [5, 5, 10, 25, 25, 10, 5, 5],
                [5, -5, -10, 5, 5, -10, -5, 5],
                [5, 10, 10, -20, -20, 10, 10, 5],
                [0, 0, 0, 0, 0, 0, 0, 0]
            ],
            2: [ // Knight 
                [-50, -40, -30, -30, -30, -30, -40, -50],
                [-40, -20, 0, 5, 5, 0, -20, -40],
                [-30, 5, 15, 20, 20, 15, 5, -30],
                [-30, 5, 20, 25, 25, 20, 5, -30],
                [-30, 5, 20, 25, 25, 20, 5, -30],
                [-30, 5, 15, 20, 20, 15, 5, -30],
                [-40, -20, 0, 5, 5, 0, -20, -40],
                [-50, -40, -30, -30, -30, -30, -40, -50]
            ],
            1: [ // Bishop 
                [-20, -10, -10, -10, -10, -10, -10, -20],
                [-10, 5, 0, 0, 0, 0, 5, -10],
                [-10, 0, 10, 15, 15, 10, 0, -10],
                [-10, 5, 10, 15, 15, 10, 5, -10],
                [-10, 0, 15, 15, 15, 15, 0, -10],
                [-10, 5, 5, 10, 10, 5, 5, -10],
                [-10, 0, 5, 5, 5, 5, 0, -10],
                [-20, -10, -10, -10, -10, -10, -10, -20]
            ],
            3: [ // Rook 
                [5, 5, 5, 5, 5, 5, 5, 5],
                [10, 15, 15, 15, 15, 15, 15, 10],
                [0, 5, 5, 5, 5, 5, 5, 0],
                [0, 5, 5, 5, 5, 5, 5, 0],
                [0, 5, 5, 5, 5, 5, 5, 0],
                [0, 5, 5, 5, 5, 5, 5, 0],
                [0, 5, 5, 5, 5, 5, 5, 0],
                [5, 10, 10, 10, 10, 10, 10, 5]
            ],
            4: [ // Queen
                [-20, -10, -10, -5, -5, -10, -10, -20],
                [-10, 0, 5, 0, 0, 5, 0, -10],
                [-10, 5, 10, 10, 10, 10, 5, -10],
                [-5, 0, 10, 10, 10, 10, 0, -5],
                [-5, 0, 10, 10, 10, 10, 0, -5],
                [-10, 5, 10, 10, 10, 10, 5, -10],
                [-10, 0, 5, 5, 5, 5, 0, -10],
                [-20, -10, -10, -5, -5, -10, -10, -20]
            ],
            5: [ // King - middlegame
                [-30, -40, -40, -50, -50, -40, -40, -30],
                [-30, -40, -40, -50, -50, -40, -40, -30],
                [-30, -40, -40, -50, -50, -40, -40, -30],
                [-30, -40, -40, -50, -50, -40, -40, -30],
                [-20, -30, -30, -40, -40, -30, -30, -20],
                [-10, -20, -20, -20, -20, -20, -20, -10],
                [20, 20, 0, 0, 0, 0, 20, 20],
                [20, 30, 10, 0, 0, 10, 30, 20]
            ],
            6: [ // King - endgame
                [-50, -40, -30, -20, -20, -30, -40, -50],
                [-30, -20, -10, 0, 0, -10, -20, -30],
                [-30, -10, 20, 30, 30, 20, -10, -30],
                [-30, -10, 30, 40, 40, 30, -10, -30],
                [-30, -10, 30, 40, 40, 30, -10, -30],
                [-30, -10, 20, 30, 30, 20, -10, -30],
                [-30, -30, 0, 0, 0, 0, -30, -30],
                [-50, -40, -30, -20, -20, -30, -40, -50]
            ]
        };

        let score = 0;
        let totalMaterial = 0;
        const pieces = this.board.getPieces();
        
        // Build piece maps for O(1) lookups
        const whitePawns = [];
        const blackPawns = [];
        let whiteKing = null;
        let blackKing = null;

        // Material evaluation and collect piece info
        for (const piece of pieces) {
            let val = pieceValues[piece.type] || 0;
            totalMaterial += val;
            if (piece.color === 0) {
                score += val;
                if (piece.type === 0) whitePawns.push(piece);
                else if (piece.type === 5) whiteKing = piece;
            } else {
                score -= val;
                if (piece.type === 0) blackPawns.push(piece);
                else if (piece.type === 5) blackKing = piece;
            }
        }

        // Determine game phase
        const isEndgame = totalMaterial < 2600;
        const isMiddlegame = totalMaterial > 5200;

        // PST eval
        for (const piece of pieces) {
            let tableIndex = piece.type;
            
            // Use endgame king table if king and in endgame
            if (piece.type === 5 && isEndgame) {
                tableIndex = 6;
            }
            
            let pst = pieceSquareTables[tableIndex];
            if (!pst) continue;
            
            // For white: use position as-is, for black: mirror vertically
            const row = piece.color === 0 ? piece.y : 7 - piece.y;
            const pstValue = pst[row][piece.x];
            
            if (piece.color === 0) {
                score += pstValue;
            } else {
                score -= pstValue;
            }
        }

        // Pawn structure evaluation - pass pre-filtered pieces
        const pawnScore = this.evaluatePawnStructure(whitePawns, blackPawns);
        score += pawnScore;

        // King safety evaluation (higher weight in middlegame)
        const kingSafetyScore = this.evaluateKingSafety(pieces, whiteKing, blackKing, isMiddlegame);
        score += kingSafetyScore;

        score += this.evaluateDevelopment(pieces, whiteKing, blackKing, isMiddlegame);

        // Cheap pseudo-mobility. Full legal move generation here makes every
        // leaf evaluation extremely expensive during search.
        score += this.evaluateMobility(pieces) * 2;

        return score / 100; // Normalize the score
    }

    evaluateMobility(pieces) {
        let score = 0;

        for (const piece of pieces) {
            const mobility = this.countPieceMobility(piece);
            score += piece.color === 0 ? mobility : -mobility;
        }

        return score;
    }

    evaluateDevelopment(pieces, whiteKing, blackKing, isMiddlegame) {
        if (!isMiddlegame) return 0;

        let score = 0;

        for (const piece of pieces) {
            if (piece.type !== 1 && piece.type !== 2) continue;

            const homeRank = piece.color === 0 ? 7 : 0;
            const onStartingSquare = piece.y === homeRank && [1, 2, 5, 6].includes(piece.x);
            const developmentScore = onStartingSquare ? -12 : 8;
            score += piece.color === 0 ? developmentScore : -developmentScore;
        }

        score += this.evaluateOpeningKingPlacement(whiteKing, 0);
        score -= this.evaluateOpeningKingPlacement(blackKing, 1);

        return score;
    }

    evaluateOpeningKingPlacement(king, color) {
        if (!king) return 0;

        const homeRank = color === 0 ? 7 : 0;
        const isCastled = king.y === homeRank && (king.x === 2 || king.x === 6);
        const isHome = king.x === 4 && king.y === homeRank;
        const canStillCastle = (
            this.board.canCastle[this.board.castleIndex(color, true)] ||
            this.board.canCastle[this.board.castleIndex(color, false)]
        );

        if (isCastled) return 50;
        if (isHome && canStillCastle) return 15;
        if (isHome) return -20;
        return -80;
    }

    countPieceMobility(piece) {
        if (piece.type === 0) return this.countPawnMobility(piece);

        if (piece.type === 2) {
            return this.countStepMobility(piece, this.board.steps.knight);
        }

        if (piece.type === 5) {
            return this.countStepMobility(piece, this.board.steps.king);
        }

        if (piece.type === 1) {
            return this.countSlidingMobility(piece, this.board.steps.bishop);
        }

        if (piece.type === 3) {
            return this.countSlidingMobility(piece, this.board.steps.rook);
        }

        if (piece.type === 4) {
            return this.countSlidingMobility(piece, this.board.steps.queen);
        }

        return 0;
    }

    countPawnMobility(piece) {
        const dir = piece.color === 0 ? -1 : 1;
        let mobility = 0;
        const oneStepY = piece.y + dir;

        if (this.board.inside(piece.x, oneStepY) && !this.board.occupied(piece.x, oneStepY)) {
            mobility++;
        }

        for (const dx of [-1, 1]) {
            const x = piece.x + dx;
            const y = piece.y + dir;
            if (!this.board.inside(x, y)) continue;
            if (this.board.enemyColor(x, y, piece.color) || (x === this.board.enPassant[0] && y === this.board.enPassant[1])) {
                mobility++;
            }
        }

        return mobility;
    }

    countStepMobility(piece, steps) {
        let mobility = 0;

        for (const [dx, dy] of steps) {
            const x = piece.x + dx;
            const y = piece.y + dy;
            if (!this.board.inside(x, y) || this.board.sameColor(x, y, piece.color)) continue;
            mobility++;
        }

        return mobility;
    }

    countSlidingMobility(piece, directions) {
        let mobility = 0;

        for (const [dx, dy] of directions) {
            let x = piece.x + dx;
            let y = piece.y + dy;

            while (this.board.inside(x, y)) {
                if (this.board.sameColor(x, y, piece.color)) break;
                mobility++;
                if (this.board.enemyColor(x, y, piece.color)) break;
                x += dx;
                y += dy;
            }
        }

        return mobility;
    }

    evaluatePawnStructure(whitePawns, blackPawns) {
        let score = 0;

        // Build pawn file maps for O(1) access
        const whitePawnFiles = new Map();
        const blackPawnFiles = new Map();
        
        for (const pawn of whitePawns) {
            if (!whitePawnFiles.has(pawn.x)) whitePawnFiles.set(pawn.x, []);
            whitePawnFiles.get(pawn.x).push(pawn);
        }
        for (const pawn of blackPawns) {
            if (!blackPawnFiles.has(pawn.x)) blackPawnFiles.set(pawn.x, []);
            blackPawnFiles.get(pawn.x).push(pawn);
        }

        // Analyze white pawns
        for (const pawn of whitePawns) {
            // Check for doubled pawns
            const fileCount = whitePawnFiles.get(pawn.x).length;
            if (fileCount > 1) {
                score -= 10 * (fileCount - 1);
            }

            // Check for isolated pawns (no pawn on adjacent files)
            const hasLeft = whitePawnFiles.has(pawn.x - 1);
            const hasRight = whitePawnFiles.has(pawn.x + 1);
            if (!hasLeft && !hasRight) {
                score -= 5;
            }

            // Bonus for passed pawns
            const isPassedPawn = !blackPawns.some(p => 
                (p.x === pawn.x || p.x === pawn.x - 1 || p.x === pawn.x + 1) && 
                p.y <= pawn.y
            );
            if (isPassedPawn) {
                score += 15 + (6 - pawn.y) * 5;
            }
        }

        // Analyze black pawns
        for (const pawn of blackPawns) {
            // Check for doubled pawns
            const fileCount = blackPawnFiles.get(pawn.x).length;
            if (fileCount > 1) {
                score += 10 * (fileCount - 1);
            }

            // Check for isolated pawns
            const hasLeft = blackPawnFiles.has(pawn.x - 1);
            const hasRight = blackPawnFiles.has(pawn.x + 1);
            if (!hasLeft && !hasRight) {
                score += 5;
            }

            // Bonus for passed pawns
            const isPassedPawn = !whitePawns.some(p => 
                (p.x === pawn.x || p.x === pawn.x - 1 || p.x === pawn.x + 1) && 
                p.y >= pawn.y
            );
            if (isPassedPawn) {
                score -= 15 + (pawn.y + 1) * 5;
            }
        }

        return score;
    }

    evaluateKingSafety(pieces, whiteKing, blackKing, isMiddlegame) {
        let score = 0;
        const kingSafetyWeight = isMiddlegame ? 2.0 : 0.5; // Higher weight in middlegame

        // Build piece position map for O(1) lookups
        const pieceMap = new Map();
        for (const piece of pieces) {
            const key = `${piece.x},${piece.y}`;
            pieceMap.set(key, piece);
        }

        if (whiteKing) {
            // Evaluate white king safety
            const whiteKingAttackers = this.countAttackersAroundKing(whiteKing, 1, pieceMap);
            score -= whiteKingAttackers * 3 * kingSafetyWeight;

            // Bonus for king shelter (pawns in front of king)
            const kingPawnShield = this.evaluateKingShelter(whiteKing, 0, pieceMap);
            score += kingPawnShield * kingSafetyWeight;
        }

        if (blackKing) {
            // Evaluate black king safety
            const blackKingAttackers = this.countAttackersAroundKing(blackKing, 0, pieceMap);
            score += blackKingAttackers * 3 * kingSafetyWeight;

            // Bonus for king shelter
            const kingPawnShield = this.evaluateKingShelter(blackKing, 1, pieceMap);
            score -= kingPawnShield * kingSafetyWeight;
        }

        return score;
    }

    countAttackersAroundKing(king, enemyColor, pieceMap) {
        let attackers = 0;
        const directions = [
            [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]
        ];

        for (const [dx, dy] of directions) {
            const x = king.x + dx;
            const y = king.y + dy;
            if (x < 0 || x > 7 || y < 0 || y > 7) continue;

            const key = `${x},${y}`;
            const attacker = pieceMap.get(key);
            if (attacker && attacker.color === enemyColor) {
                // Weight attackers: queen and rooks are most dangerous
                // type 4 = QUEEN, type 3 = ROOK, type 2 = KNIGHT, type 1 = BISHOP
                if (attacker.type === 4) attackers += 3;
                else if (attacker.type === 3) attackers += 2;
                else if (attacker.type === 2 || attacker.type === 1) attackers += 1;
            }
        }

        return attackers;
    }

    evaluateKingShelter(king, color, pieceMap) {
        let shelterScore = 0;
        const direction = color === 0 ? -1 : 1;

        // Check for pawns protecting the king
        const shelterPositions = [
            [king.x - 1, king.y + direction],
            [king.x, king.y + direction],
            [king.x + 1, king.y + direction]
        ];

        for (const [x, y] of shelterPositions) {
            if (x < 0 || x > 7 || y < 0 || y > 7) continue;
            const key = `${x},${y}`;
            const pawn = pieceMap.get(key);
            if (pawn && pawn.color === color && pawn.type === 0) {  // type 0 = PAWN
                shelterScore += 10; // Bonus for each pawn protecting the king
            }
        }

        return shelterScore;
    }
    evaluateBoardNN(){
        // Placeholder for neural network evaluation logic
    }
    evaluateBoardNNUE(){
        // Placeholder for NNUE evaluation logic
    }
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
    }

    // Sort moves by previous iteration results for better move ordering
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
    }

    // Calculate piece value for MVV-LVA move ordering
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
    }

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
    }

    // Quiescence search for tactical positions (handles captures and checks)
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
    }

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
    }

    isMoveKingSafe(move, color) {
        const boardState = this.board.cloneState();

        this.board.rawMove(move.x1, move.y1, move.x2, move.y2);
        const isSafe = !this.board.inCheck(color);

        this.board.restoreState(boardState);
        return isSafe;
    }

    // Improved move ordering with MVV-LVA and killer moves
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
}
