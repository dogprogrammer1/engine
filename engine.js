export default class Engine {
    constructor(board, color) {
        this.board = board;
        this.color = color; 
    }
    updateBoard(board) {
        this.board = board;
    }
    evaluateBoardClassical(){
        // material: 1 for pawn, 3 for knight/bishop, 5 for rook, 9 for queen
        const pieceValues = {
            1: 1,   // Pawn
            2: 3,   // Knight
            3: 3,   // Bishop
            4: 5,   // Rook
            5: 9    // Queen
        };

        //piece square tables:
        const pieceSquareTables = {
            1: [ // Pawn
                [0, 0, 0, 0, 0, 0, 0, 0],
                [50, 50, 50, 50, 50, 50, 50, 50],
                [10, 10, 20, 30, 30, 20, 10, 10],
                [5, 5, 10, 25, 25, 10, 5, 5],
                [0, 0, 0, 20, 20, 0, 0, 0],
                [5, -5, -10, 0, 0, -10, -5, 5],
                [5, 10, 10, -20, -20, 10, 10, 5],
                [0, 0, 0, 0, 0, 0, 0, 0]
            ],
            2: [ // Knight
                [-50, -40, -30, -30, -30, -30, -40, -50],
                [-40, -20, 0, 0, 0, 0, -20, -40],
                [-30, 0, 10, 15, 15, 10, 0, -30],
                [-30, 5, 15, 20, 20, 15, 5, -30],
                [-30, 0, 15, 20, 20, 15, 0, -30],
                [-30, 5, 10, 15, 15, 10, 5, -30],
                [-40, -20, 0, 5, 5, 0, -20, -40],
                [-50, -40, -30, -30, -30, -30, -40, -50]
            ],
            3: [ // Bishop
                [-20, -10, -10, -10, -10, -10, -10, -20],
                [-10, 0, 0, 0, 0, 0, 0, -10],
                [-10, 0, 5, 10, 10, 5, 0, -10],
                [-10, 5, 5, 10, 10, 5, 5, -10],
                [-10, 0, 10, 10, 10, 10, 0, -10],
                [-10, 5, 0, 0, 0, 0, 5, -10],
                [-10, 0, 0, 0, 0, 0, 0, -10],
                [-20, -10, -10, -10, -10, -10, -10, -20]
            ],
            4: [ // Rook
                [0, 0, 0, 0, 0, 0, 0, 0],
                [5, 10, 10, 10, 10, 10, 10, 5],
                [-5, 0, 0, 0, 0, 0, 0, -5],
                [-5, 0, 0, 0, 0, 0, 0, -5],
                [-5, 0, 0, 0, 0, 0, 0, -5],
                [-5, 0, 0, 0, 0, 0, 0, -5],
                [-5, 0, 0, 0, 0, 0, 0, -5],
                [0, 0, 0, 5, 5, 0, 0, 0]
            ],
            5: [ // Queen
                [-20, -10, -10, -5, -5, -10, -10, -20],
                [-10, 0, 0, 0, 0, 0, 0, -10],
                [-10, 0, 5, 5, 5, 5, 0, -10],
                [-5, 0, 5, 5, 5, 5, 0, -5],
                [0, 0, 5, 5, 5, 5, 0, -5],
                [-10, 0, 5, 5, 5, 5, 0, -10],
                [-10, 0, 0, 0, 0, 0, 0, -10],
                [-20, -10, -10, -5, -5, -10, -10, -20]
            ],
            6: [ // King
                [-30, -40, -40, -50, -50, -40, -40, -30],
                [-30, -40, -40, -50, -50, -40, -40, -30],
                [-30, -40, -40, -50, -50, -40, -40, -30],
                [-30, -40, -40, -50, -50, -40, -40, -30],
                [-20, -30, -30, -40, -40, -30, -30, -20],
                [-10, -20, -20, -20, -20, -20, -20, -10],
                [20, 20, 0, 0, 0, 0, 20, 20],
                [20, 30, 10, 0, 0, 10, 30, 20]
            ],
            7:[//endgame king
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

        for (const piece of pieces) {
            let val = pieceValues[piece.type] || 0;
            if (piece.color === 0) {
                score += val;
                totalMaterial += val;
            } else {
                score -= val;
            }
        }

        //piece square table evaluation
        // Determine if we're in endgame (low material)
        const isEndgame = totalMaterial < 15;

        for (const piece of pieces) {
            let tableIndex = piece.type;
            
            // Use endgame king table if king and in endgame
            if (piece.type === 5 && isEndgame) {
                tableIndex = 7;
            }
            
            let pst = pieceSquareTables[tableIndex];
            if (!pst) continue;
            
            // For white: use position as-is, for black: mirror vertically
            const row = piece.color === 0 ? piece.y : 7 - piece.y;
            const pstValue = pst[row][piece.x];
            
            if (piece.color === 0) {
                score += pstValue/20;
            } else {
                score -= pstValue/20;
            }
        }

        return score;
    }
    evaluateBoardNN(){
        // Placeholder for neural network evaluation logic
    }
    evaluateBoardNNUE(){
        // Placeholder for NNUE evaluation logic
    }
    findBestMove() {
        // Placeholder for move finding logic
        return null;
    }
}