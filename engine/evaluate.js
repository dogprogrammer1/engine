import { pieceValues, pieceSquareTables } from "./tables.js";
import { evaluateBoardWithNNUE, hasLoadedNNUEModel } from "./nnue/nnue_evaluator.js";

export const evaluationMethods = {
    evaluateBoard() {
        const start = performance.now();
        const score = this.evaluator === "NNUE_Evaluator"
            ? this.evaluateBoardNNUE()
            : this.evaluateBoardClassical();

        this.evalCount++;
        this.evalTimeMs += performance.now() - start;
        return score;
    },

    evaluateBoardNNUE() {
        if (hasLoadedNNUEModel()) {
            return evaluateBoardWithNNUE(this.board);
        }

        return this.evaluateBoardClassical();
    },

    calculateGamePhase(totalMaterial) {
        // Tapered evaluation: phase goes from 1 (opening) to 0 (endgame)
        const maxMaterial = 3900; // Approximate max starting material
        const minMaterial = 800;  // Approximate min material for endgame
        
        if (totalMaterial >= maxMaterial) return 1.0;
        if (totalMaterial <= minMaterial) return 0.0;
        
        // Linear interpolation between min and max
        return (totalMaterial - minMaterial) / (maxMaterial - minMaterial);
    },

    evaluateBoardClassical() {
        let openingScore = 0;
        let endgameScore = 0;
        const pieces = this.board.getPieces();
        const whitePawns = [];
        const blackPawns = [];
        let whiteKing = null;
        let blackKing = null;

        const totalMaterial = pieces.reduce((sum, p) => sum + (pieceValues[p.type] || 0), 0);
        const phase = this.calculateGamePhase(totalMaterial);

        for (const piece of pieces) {
            const val = pieceValues[piece.type] || 0;
            const sign = piece.color === 0 ? 1 : -1;
            openingScore += sign * val;
            endgameScore += sign * val;

            if (piece.type === 0) {
                (piece.color === 0 ? whitePawns : blackPawns).push(piece);
            } else if (piece.type === 5) {
                if (piece.color === 0) whiteKing = piece;
                else blackKing = piece;
            }

            const tableIndexEG = piece.type === 5 ? 6 : piece.type;
            const pstOpening = pieceSquareTables[piece.type];
            const pstEndgame = pieceSquareTables[tableIndexEG];
            const row = piece.color === 0 ? piece.y : 7 - piece.y;

            if (pstOpening && pstEndgame) {
                const blendedPstValue = pstOpening[row][piece.x] * phase + pstEndgame[row][piece.x] * (1 - phase);
                openingScore += sign * blendedPstValue;
                endgameScore += sign * blendedPstValue;
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

            const isOpen = !whitePawnFiles.has(piece.x) && !blackPawnFiles.has(piece.x);

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
        switch (piece.type) {
            case 0: return this.countPawnMobility(piece);
            case 2: return this.countStepMobility(piece, this.board.steps.knight);
            case 5: return this.countStepMobility(piece, this.board.steps.king);
            case 1: return this.countSlidingMobility(piece, this.board.steps.bishop);
            case 3: return this.countSlidingMobility(piece, this.board.steps.rook);
            case 4: return this.countSlidingMobility(piece, this.board.steps.queen);
            default: return 0;
        }
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

    _pawnFileMap(pawns) {
        const map = new Map();
        for (const pawn of pawns) {
            if (!map.has(pawn.x)) map.set(pawn.x, []);
            map.get(pawn.x).push(pawn);
        }
        return map;
    },

    evaluatePawnStructure(whitePawns, blackPawns, phase) {
        let openingScore = 0;
        let endgameScore = 0;

        const whitePawnFiles = this._pawnFileMap(whitePawns);
        const blackPawnFiles = this._pawnFileMap(blackPawns);

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

        const white = this._analyzePawnGroup(whitePawns, whitePawnFiles, blackPawns, -1, whitePawnFiles);
        const black = this._analyzePawnGroup(blackPawns, blackPawnFiles, whitePawns, 1, whitePawnFiles);
        openingScore += white.opening - black.opening;
        endgameScore += white.endgame - black.endgame;

        return { opening: openingScore, endgame: endgameScore };
    },

    _analyzePawnGroup(pawns, ownFiles, enemyPawns, advanceDir, supportFiles) {
        let opening = 0, endgame = 0;
        for (const pawn of pawns) {
            const fileCount = ownFiles.get(pawn.x).length;
            if (fileCount > 1) {
                const penalty = 10 * (fileCount - 1);
                opening -= penalty;
                endgame -= penalty * 1.5;
            }

            if (!ownFiles.has(pawn.x - 1) && !ownFiles.has(pawn.x + 1)) {
                opening -= 5;
                endgame -= 10;
            }

            const squareInFront = pawn.y + advanceDir;
            if (squareInFront >= 0 && squareInFront <= 7) {
                const blocked = enemyPawns.some(p => p.x === pawn.x && p.y === squareInFront);
                const supported = (supportFiles.has(pawn.x - 1) && supportFiles.get(pawn.x - 1).some(p => advanceDir < 0 ? p.y < pawn.y : p.y > pawn.y)) ||
                                  (supportFiles.has(pawn.x + 1) && supportFiles.get(pawn.x + 1).some(p => advanceDir < 0 ? p.y < pawn.y : p.y > pawn.y));
                if (blocked && !supported) { opening -= 8; endgame -= 12; }
            }

            const isPassed = !enemyPawns.some(p =>
                (p.x === pawn.x || p.x === pawn.x - 1 || p.x === pawn.x + 1) &&
                (advanceDir < 0 ? p.y <= pawn.y : p.y >= pawn.y)
            );
            if (isPassed) {
                const advancement = pawn.y + 1;
                const passedBonus = 15 + advancement * 5;
                opening += passedBonus * 0.5;
                endgame += passedBonus * 2;
            }
        }
        return { opening, endgame };
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
        const y = king.y + direction;
        if (y < 0 || y > 7) return 0;

        for (const dx of [-1, 0, 1]) {
            const x = king.x + dx;
            if (x < 0 || x > 7) continue;
            const pawn = pieceMap.get(`${x},${y}`);
            if (pawn && pawn.color === color && pawn.type === 0) shelterScore += 10;
        }

        return shelterScore;
    },
};
