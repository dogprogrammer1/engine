import { pieceValues, pieceSquareTables } from "./tables.js";

export const evaluationMethods = {
    calculateGamePhase(totalMaterial) {
        // Tapered evaluation: phase goes from 1 (opening) to 0 (endgame)
        const maxMaterial = 3900; // Approximate max starting material
        const minMaterial = 800;  // Approximate min material for endgame
        
        if (totalMaterial >= maxMaterial) return 1.0;
        if (totalMaterial <= minMaterial) return 0.0;
        
        // Linear interpolation between min and max
        return (totalMaterial - minMaterial) / (maxMaterial - minMaterial);
    },

    evaluateBoardClassical(){
        
        let openingScore = 0;
        let endgameScore = 0;
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
                openingScore += val;
                endgameScore += val;
                if (piece.type === 0) whitePawns.push(piece);
                else if (piece.type === 5) whiteKing = piece;
            } else {
                openingScore -= val;
                endgameScore -= val;
                if (piece.type === 0) blackPawns.push(piece);
                else if (piece.type === 5) blackKing = piece;
            }
        }

        // Calculate game phase for tapered evaluation
        const phase = this.calculateGamePhase(totalMaterial);

        // PST eval - blend opening and endgame values per piece
        for (const piece of pieces) {
            const tableIndex = piece.type;
            const tableIndexEG = piece.type === 5 ? 6 : piece.type;
            const pstOpening = pieceSquareTables[tableIndex];
            const pstEndgame = pieceSquareTables[tableIndexEG];
            const row = piece.color === 0 ? piece.y : 7 - piece.y;

            if (pstOpening && pstEndgame) {
                const openingValue = pstOpening[row][piece.x];
                const endgameValue = pstEndgame[row][piece.x];
                const blendedPstValue = (openingValue * phase) + (endgameValue * (1 - phase));

                if (piece.color === 0) {
                    openingScore += blendedPstValue;
                    endgameScore += blendedPstValue;
                } else {
                    openingScore -= blendedPstValue;
                    endgameScore -= blendedPstValue;
                }
            }
        }

        // Pawn structure evaluation
        const pawnScore = this.evaluatePawnStructure(whitePawns, blackPawns, phase);
        openingScore += pawnScore.opening;
        endgameScore += pawnScore.endgame;

        // King safety evaluation
        const isEndgame = phase < 0.3;
        const { attacked, pressure } = this._buildAttackMaps();
        const kingSafetyScore = this.evaluateKingSafety(pieces, whiteKing, blackKing, isEndgame, pressure);
        openingScore += kingSafetyScore;
        endgameScore += kingSafetyScore * 0.5; // King safety matters less in endgame

        // Development evaluation
        const developmentScore = this.evaluateDevelopment(pieces, whiteKing, blackKing, phase, pressure);
        openingScore += developmentScore;

        // Mobility evaluation
        const mobilityScore = this.evaluateMobility(pieces, attacked);
        openingScore += mobilityScore * 0.8;
        endgameScore += mobilityScore;

        // Rook open file bonus
        const rookOpenFileScore = this.evaluateRookOpenFiles(pieces, whitePawns, blackPawns);
        openingScore += rookOpenFileScore * 0.5;
        endgameScore += rookOpenFileScore;

        // Tapered evaluation: blend opening and endgame scores based on phase
        const finalScore = (openingScore * phase) + (endgameScore * (1 - phase));

        return finalScore / 100; // Normalize the score
    },

    _buildAttackMaps() {
        const attacked = [new Uint8Array(64), new Uint8Array(64)];
        const pressure = [new Float32Array(64), new Float32Array(64)];
        const dirs = this.board.steps;

        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const code = this.board.getPieceCode(x, y);
                if (code === -1) continue;

                const color = Math.floor(code / 6);
                const type = code % 6;
                const weight = type === 4 ? 3 : type === 3 ? 2 : 1;

                const mark = (tx, ty) => {
                    const sq = ty * 8 + tx;
                    attacked[color][sq] = 1;
                    pressure[color][sq] += weight;
                };

                if (type === 0) {
                    const dir = color === 0 ? -1 : 1;
                    for (const dx of [-1, 1]) {
                        const nx = x + dx, ny = y + dir;
                        if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) mark(nx, ny);
                    }
                } else if (type === 2) {
                    for (const [dx, dy] of dirs.knight) {
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) mark(nx, ny);
                    }
                } else if (type === 5) {
                    for (const [dx, dy] of dirs.king) {
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) mark(nx, ny);
                    }
                } else {
                    const slideDirs = type === 1 ? dirs.bishop : type === 3 ? dirs.rook : dirs.queen;
                    for (const [dx, dy] of slideDirs) {
                        let nx = x + dx, ny = y + dy;
                        while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) {
                            mark(nx, ny);
                            if (this.board.occupied(nx, ny)) break;
                            nx += dx; ny += dy;
                        }
                    }
                }
            }
        }

        return { attacked, pressure };
    },

    evaluateRookOpenFiles(pieces, whitePawns, blackPawns) {
        let score = 0;

        // Build pawn file maps
        const whitePawnFiles = new Set(whitePawns.map(p => p.x));
        const blackPawnFiles = new Set(blackPawns.map(p => p.x));

        for (const piece of pieces) {
            // Only evaluate rooks and queens (they benefit from open files)
            if (piece.type !== 3 && piece.type !== 4) continue;

            const isOpen = piece.color === 0 
                ? !whitePawnFiles.has(piece.x) && !blackPawnFiles.has(piece.x)
                : !whitePawnFiles.has(piece.x) && !blackPawnFiles.has(piece.x);

            if (isOpen) {
                // Bonus for rook/queen on open file
                const bonus = piece.type === 3 ? 15 : 10; // Rook gets more bonus than queen
                score += piece.color === 0 ? bonus : -bonus;
            }
        }

        return score;
    },

    evaluateMobility(pieces, attacked) {
        let score = 0;

        for (const piece of pieces) {
            let mobility = this.countPieceMobility(piece);

            if (piece.type === 2 || piece.type === 1) {
                const enemyAttacked = attacked[1 - piece.color];
                const safeSquares = this.countSafePieceMobility(piece, enemyAttacked);
                if (safeSquares <= 1) {
                    const distanceFromCenter = Math.max(Math.abs(piece.x - 3.5), Math.abs(piece.y - 3.5));
                    const trappedPenalty = 20 + Math.max(0, Math.floor((distanceFromCenter - 2.5) * 10));
                    mobility -= trappedPenalty;
                }
            }

            score += piece.color === 0 ? mobility : -mobility;
        }

        return score;
    },

    countSafePieceMobility(piece, enemyAttacked) {
        if (piece.type === 2) return this.countSafeStepMobility(piece, this.board.steps.knight, enemyAttacked);
        if (piece.type === 1) return this.countSafeSlidingMobility(piece, this.board.steps.bishop, enemyAttacked);
        return 0;
    },

    countSafeStepMobility(piece, steps, enemyAttacked) {
        let safeMoves = 0;
        for (const [dx, dy] of steps) {
            const x = piece.x + dx, y = piece.y + dy;
            if (!this.board.inside(x, y) || this.board.sameColor(x, y, piece.color)) continue;
            if (!enemyAttacked[y * 8 + x]) safeMoves++;
        }
        return safeMoves;
    },

    countSafeSlidingMobility(piece, directions, enemyAttacked) {
        let safeMoves = 0;
        for (const [dx, dy] of directions) {
            let x = piece.x + dx, y = piece.y + dy;
            while (this.board.inside(x, y)) {
                if (this.board.sameColor(x, y, piece.color)) break;
                if (!enemyAttacked[y * 8 + x]) safeMoves++;
                if (this.board.enemyColor(x, y, piece.color)) break;
                x += dx; y += dy;
            }
        }
        return safeMoves;
    },

    evaluateDevelopment(pieces, whiteKing, blackKing, phase, pressure) {
        // Apply development penalty only early in the game (when phase is high)
        if (phase < 0.3) return 0;

        let score = 0;

        for (const piece of pieces) {
            if (piece.type !== 1 && piece.type !== 2) continue;

            const homeRank = piece.color === 0 ? 7 : 0;
            const onStartingSquare = piece.y === homeRank && [1, 2, 5, 6].includes(piece.x);
            // Scale penalty based on phase - less penalty as game progresses
            const developmentScore = onStartingSquare ? -12 * phase : 8 * phase;
            score += piece.color === 0 ? developmentScore : -developmentScore;
        }

        score += this.evaluateOpeningKingPlacement(whiteKing, 0, 1, pressure) * phase;
        score -= this.evaluateOpeningKingPlacement(blackKing, 1, 0, pressure) * phase;

        return score;
    },

    evaluateOpeningKingPlacement(king, color, enemyColor, pressure) {
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

        const followUpPressure = this.countKingPressure(king, enemyColor, pressure);
        if (followUpPressure < 2) {
            return -20;
        }

        return -45;
    },

    countKingPressure(king, enemyColor, pressure) {
        if (!king) return 0;

        const enemyPressure = pressure[enemyColor];
        let total = enemyPressure[king.y * 8 + king.x];

        for (const [dx, dy] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
            const x = king.x + dx, y = king.y + dy;
            if (x < 0 || x > 7 || y < 0 || y > 7) continue;
            total += enemyPressure[y * 8 + x] * 0.5;
        }

        return total;
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

    evaluatePawnStructure(whitePawns, blackPawns, phase) {
        let openingScore = 0;
        let endgameScore = 0;

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

        // Pawn space control: count how many squares on each side are controlled by friendly pawns vs enemy pawns
        const whitePawnSpace = new Set();
        const blackPawnSpace = new Set();
        const whitePawnThreat = new Set();
        const blackPawnThreat = new Set();

        for (const pawn of whitePawns) {
            const attackY = pawn.y - 1;
            for (const dx of [-1, 1]) {
                const x = pawn.x + dx;
                if (!this.board.inside(x, attackY)) continue;
                const key = `${x},${attackY}`;
                if (attackY >= 4) whitePawnSpace.add(key);
                if (attackY <= 3) blackPawnThreat.add(key);
            }
        }

        for (const pawn of blackPawns) {
            const attackY = pawn.y + 1;
            for (const dx of [-1, 1]) {
                const x = pawn.x + dx;
                if (!this.board.inside(x, attackY)) continue;
                const key = `${x},${attackY}`;
                if (attackY <= 3) blackPawnSpace.add(key);
                if (attackY >= 4) whitePawnThreat.add(key);
            }
        }

        const whiteSpaceScore = (whitePawnSpace.size - whitePawnThreat.size) * 7;
        const blackSpaceScore = (blackPawnSpace.size - blackPawnThreat.size) * 7;
        openingScore += whiteSpaceScore - blackSpaceScore;
        endgameScore += whiteSpaceScore * 0.8 - blackSpaceScore * 0.8;

        // if opening, central pawns are more valuable, encourage e4/d4/e5/d5
        if (phase > 0.5) {
            for (const pawn of whitePawns) {
                // d-file or e-file pawns
                if (pawn.x === 3 || pawn.x === 4) {
                    // advanced toward center
                    if (pawn.y === 4) openingScore += 50; // d4/e4
                    if (pawn.y === 3) openingScore += 50; // d5/e5
                }
            }

            for (const pawn of blackPawns) {
                if (pawn.x === 3 || pawn.x === 4) {
                    if (pawn.y === 3) openingScore -= 50; // ...d5/...e5
                    if (pawn.y === 4) openingScore -= 50; // ...d4/...e4 advanced
                }
            }
        }

        // Analyze white pawns
        for (const pawn of whitePawns) {
            // Check for doubled pawns
            const fileCount = whitePawnFiles.get(pawn.x).length;
            if (fileCount > 1) {
                const doubledPenalty = 10 * (fileCount - 1);
                openingScore -= doubledPenalty;
                endgameScore -= doubledPenalty * 1.5; // More severe in endgame
            }

            // Check for isolated pawns (no pawn on adjacent files)
            const hasLeft = whitePawnFiles.has(pawn.x - 1);
            const hasRight = whitePawnFiles.has(pawn.x + 1);
            if (!hasLeft && !hasRight) {
                openingScore -= 5;
                endgameScore -= 10; // More severe in endgame
            }

            // Check for backward pawns (pawn blocked with no support from adjacent pawns)
            const squareInFront = pawn.y - 1;
            const blockedByBlack = squareInFront >= 0 && blackPawns.some(p => p.x === pawn.x && p.y === squareInFront);
            const supportedByAdjacent = (whitePawnFiles.has(pawn.x - 1) && whitePawnFiles.get(pawn.x - 1).some(p => p.y < pawn.y)) ||
                                       (whitePawnFiles.has(pawn.x + 1) && whitePawnFiles.get(pawn.x + 1).some(p => p.y < pawn.y));
            if (blockedByBlack && !supportedByAdjacent) {
                openingScore -= 8;
                endgameScore -= 12;
            }

            // Bonus for passed pawns
            const isPassedPawn = !blackPawns.some(p => 
                (p.x === pawn.x || p.x === pawn.x - 1 || p.x === pawn.x + 1) && 
                p.y <= pawn.y
            );
            if (isPassedPawn) {
                const passedBonus = 15 + (6 - pawn.y) * 5;
                openingScore += passedBonus * 0.5;
                endgameScore += passedBonus * 2; // More valuable in endgame
            }
        }

        // Analyze black pawns
        for (const pawn of blackPawns) {
            // Check for doubled pawns
            const fileCount = blackPawnFiles.get(pawn.x).length;
            if (fileCount > 1) {
                const doubledPenalty = 10 * (fileCount - 1);
                openingScore += doubledPenalty;
                endgameScore += doubledPenalty * 1.5;
            }

            // Check for isolated pawns
            const hasLeft = blackPawnFiles.has(pawn.x - 1);
            const hasRight = blackPawnFiles.has(pawn.x + 1);
            if (!hasLeft && !hasRight) {
                openingScore += 5;
                endgameScore += 10;
            }

            // Check for backward pawns (pawn blocked with no support from adjacent pawns)
            const squareInFront = pawn.y + 1;
            const blockedByWhite = squareInFront <= 7 && whitePawns.some(p => p.x === pawn.x && p.y === squareInFront);
            const supportedByAdjacent = (whitePawnFiles.has(pawn.x - 1) && whitePawnFiles.get(pawn.x - 1).some(p => p.y > pawn.y)) ||
                                       (whitePawnFiles.has(pawn.x + 1) && whitePawnFiles.get(pawn.x + 1).some(p => p.y > pawn.y));
            if (blockedByWhite && !supportedByAdjacent) {
                openingScore += 8;
                endgameScore += 12;
            }
            
            // Bonus for passed pawns
            const isPassedPawn = !whitePawns.some(p => 
                (p.x === pawn.x || p.x === pawn.x - 1 || p.x === pawn.x + 1) && 
                p.y >= pawn.y
            );
            if (isPassedPawn) {
                const passedBonus = 15 + (pawn.y + 1) * 5;
                openingScore -= passedBonus * 0.5;
                endgameScore -= passedBonus * 2;
            }
        }

        return { opening: openingScore, endgame: endgameScore };
    },

    evaluateKingSafety(pieces, whiteKing, blackKing, isEndgame, pressure) {
        let score = 0;
        const kingSafetyWeight = isEndgame ? 0.5 : 2; // King safety is less critical in endgame, more critical in middlegame
        const placementWeight = isEndgame ? 0.3 : 1;

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

        score += this.evaluateOpeningKingPlacement(whiteKing, 0, 1, pressure) * placementWeight;
        score -= this.evaluateOpeningKingPlacement(blackKing, 1, 0, pressure) * placementWeight;

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
