import { pieceValues, pieceSquareTables } from "./tables.js";

export const evaluationMethods = {
    evaluateBoardClassical(){
        // Optimized material values with refined weights
        // Piece types from board: 0=Pawn, 1=Bishop, 2=Knight, 3=Rook, 4=Queen, 5=King
        // Using piece type indexes: 0=Pawn, 2=Knight, 1=Bishop, 3=Rook, 4=Queen, 5=King, 6=Endgame King
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
    },

    evaluateMobility(pieces) {
        let score = 0;

        for (const piece of pieces) {
            const mobility = this.countPieceMobility(piece);
            score += piece.color === 0 ? mobility : -mobility;
        }

        return score;
    },

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
    },

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
    },

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
    },

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
    },

    countStepMobility(piece, steps) {
        let mobility = 0;

        for (const [dx, dy] of steps) {
            const x = piece.x + dx;
            const y = piece.y + dy;
            if (!this.board.inside(x, y) || this.board.sameColor(x, y, piece.color)) continue;
            mobility++;
        }

        return mobility;
    },

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
    },

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
    },

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
    },

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
    },

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
    },

    evaluateBoardNN(){
        // Placeholder for neural network evaluation logic
    },

    evaluateBoardNNUE(){
        // Placeholder for NNUE evaluation logic
    }
};
