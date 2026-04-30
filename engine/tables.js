export const pieceValues = {
            0: 100,   // Pawn (scaled x100 for precision)
            2: 320,   // Knight
            1: 330,   // Bishop
            3: 500,   // Rook
            4: 900,   // Queen
            5: 0      // King (no base value)
        };

export const pieceSquareTables = {
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

export const tableMethods = {
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
    },

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
    },

    xorshift64(seed) {
        let x = BigInt(seed) * 6364136223846793005n + 1442695040888963407n;
        x = x ^ (x >> 33n);
        x = x * 0xff51afd7ed558ccdn;
        x = x ^ (x >> 33n);
        return x;
    },

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
    },

    lookupTransposition(hash, depth) {
        const entry = this.transpositionTable.get(hash);
        if (entry && entry.depth >= depth) {
            return entry;
        }
        return null;
    },

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
    },

    clearTranspositionTable() {
        this.transpositionTable.clear();
        this.nodesEvaluated = 0;
    }
};
