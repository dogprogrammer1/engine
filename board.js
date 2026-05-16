import Engine from "./engine/engine.js";
import {
    applyMoveToBoardNNUE,
    invalidateBoardNNUE,
    unmakeMoveToBoardNNUE
} from "./engine/nnue.js";
class Llong {
    constructor(x = 0n) {
        this.val = x;
    }

    bit(x, y) {
        return 1n << BigInt(8 * y + x);
    }

    has(x, y) {
        return (this.val & this.bit(x, y)) !== 0n;
    }

    set(x, y) {
        this.val |= this.bit(x, y);
    }

    clear(x, y) {
        this.val &= ~this.bit(x, y);
    }

    move(x1, y1, x2, y2) {
        this.clear(x1, y1);
        this.set(x2, y2);
    }

    clone() {
        return new Llong(this.val);
    }
}

const EMPTY = -1;
const WHITE = 0;
const BLACK = 1;

const PAWN = 0;
const BISHOP = 1;
const KNIGHT = 2;
const ROOK = 3;
const QUEEN = 4;
const KING = 5;

const WHITE_KINGSIDE = 0;
const WHITE_QUEENSIDE = 1;
const BLACK_KINGSIDE = 2;
const BLACK_QUEENSIDE = 3;

function normalizePromotionType(type) {
    return type === BISHOP || type === KNIGHT || type === ROOK || type === QUEEN
        ? type
        : QUEEN;
}

export default class Board {
    constructor(color, options = {}) {
        this.playerColor = color;
        this.silent = options.silent || false;
        this.reset();
    }

    reset() {
        this._nnueRuntime = null;
        this.board = [
            [
                new Llong(0x00FF000000000000n),
                new Llong(0x2400000000000000n),
                new Llong(0x4200000000000000n),
                new Llong(0x8100000000000000n),
                new Llong(0x0800000000000000n),
                new Llong(0x1000000000000000n)
            ],
            [
                new Llong(0x000000000000FF00n),
                new Llong(0x0000000000000024n),
                new Llong(0x0000000000000042n),
                new Llong(0x0000000000000081n),
                new Llong(0x0000000000000008n),
                new Llong(0x0000000000000010n)
            ]
        ];
        
        this.gameResult = null;
        this.canCastle = [true, true, true, true];
        this.enPassant = [-1, -1];
        this.turn = WHITE;
        this.halfmoveClock = 0;
        this.moveHistory = [];

        this.steps = {
            bishop: [[1,1],[1,-1],[-1,1],[-1,-1]],
            rook: [[1,0],[-1,0],[0,1],[0,-1]],
            queen: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
            king: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
            knight: [[1,2],[1,-2],[-1,2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]]
        };

        this.rebuildSquares();
        this.moveHistory = [this.toFEN()];
        
        // Initialize engine for evaluation - engine plays the opponent color
        const engineColor = this.playerColor === WHITE ? BLACK : WHITE;
        this.engine = new Engine(this, engineColor);
        if (!this.silent) {
            console.log(`Board initialized: player color=${this.playerColor}, engine color=${engineColor}`);
        }
    }

    opponent(color) {
        return color === WHITE ? BLACK : WHITE;
    }

    pawnDirection(color) {
        return color === WHITE ? -1 : 1;
    }

    pawnStartRank(color) {
        return color === WHITE ? 6 : 1;
    }

    homeRank(color) {
        return color === WHITE ? 7 : 0;
    }

    castleIndex(color, kingside) {
        if (color === WHITE) {
            return kingside ? WHITE_KINGSIDE : WHITE_QUEENSIDE;
        }

        return kingside ? BLACK_KINGSIDE : BLACK_QUEENSIDE;
    }

    inside(x, y) {
        return x >= 0 && x < 8 && y >= 0 && y < 8;
    }

    squareIndex(x, y) {
        return y * 8 + x;
    }

    getPieceCode(x, y) {
        return this.squares[this.squareIndex(x, y)];
    }

    setPieceCode(x, y, code) {
        this.squares[this.squareIndex(x, y)] = code;
    }

    rebuildSquares() {
        this.squares = new Array(64).fill(EMPTY);

        for (let c = 0; c < 2; c++) {
            for (let t = 0; t < 6; t++) {
                const piece = this.board[c][t];

                for (let y = 0; y < 8; y++) {
                    for (let x = 0; x < 8; x++) {
                        if (piece.has(x, y)) {
                            this.setPieceCode(x, y, c * 6 + t);
                        }
                    }
                }
            }
        }

        invalidateBoardNNUE(this);
    }

    getPiece(x, y) {
        const code = this.getPieceCode(x, y);
        if (code === EMPTY) {
            return [-1, -1];
        }

        return [Math.floor(code / 6), code % 6];
    }

    getPieces() {
        const pieces = [];

        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const code = this.getPieceCode(x, y);
                if (code === EMPTY) continue;

                pieces.push({
                    x,
                    y,
                    color: Math.floor(code / 6),
                    type: code % 6
                });
            }
        }

        return pieces;
    }

    occupied(x, y) {
        return this.getPieceCode(x, y) !== EMPTY;
    }

    sameColor(x, y, color) {
        const code = this.getPieceCode(x, y);
        return code !== EMPTY && Math.floor(code / 6) === color;
    }

    enemyColor(x, y, color) {
        const code = this.getPieceCode(x, y);
        return code !== EMPTY && Math.floor(code / 6) === this.opponent(color);
    }

    slideCanReach(x1, y1, x2, y2, dirs) {
        for (const d of dirs) {
            let x = x1 + d[0];
            let y = y1 + d[1];

            while (this.inside(x, y)) {
                if (x === x2 && y === y2) return true;
                if (this.occupied(x, y)) break;
                x += d[0];
                y += d[1];
            }
        }
        return false;
    }

    attacksSquare(x1, y1, x2, y2) {
        const piece = this.getPiece(x1, y1);
        if (piece[1] === -1) return false;

        const color = piece[0];
        const type = piece[1];

        if (type === PAWN) {
            const dir = this.pawnDirection(color);
            return (
                (x2 === x1 + 1 && y2 === y1 + dir) ||
                (x2 === x1 - 1 && y2 === y1 + dir)
            );
        }

        if (type === BISHOP) return this.slideCanReach(x1, y1, x2, y2, this.steps.bishop);
        if (type === ROOK) return this.slideCanReach(x1, y1, x2, y2, this.steps.rook);
        if (type === QUEEN) return this.slideCanReach(x1, y1, x2, y2, this.steps.queen);

        if (type === KNIGHT) {
            return this.steps.knight.some(s => x1+s[0]===x2 && y1+s[1]===y2);
        }

        if (type === KING) {
            return this.steps.king.some(s => x1+s[0]===x2 && y1+s[1]===y2);
        }

        return false;
    }

    kingPos(color) {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                if (this.board[color][5].has(x, y)) return [x, y];
            }
        }
        return [-1, -1];
    }

    inCheck(color) {
        const [kx, ky] = this.kingPos(color);

        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const p = this.getPiece(x, y);
                if (p[0] === this.opponent(color)) {
                    if (this.attacksSquare(x, y, kx, ky)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    squareAttackedBy(x, y, color) {
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const p = this.getPiece(j, i);
                if (p[0] === color && this.attacksSquare(j, i, x, y)) {
                    return true;
                }
            }
        }

        return false;
    }

    canCastleTo(color, x1, y1, x2, y2) { 
        const homeY = this.homeRank(color);
        
        if (x1 !== 4 || y1 !== homeY || y2 !== homeY) {
            return false;
        }

        if (x2 !== 6 && x2 !== 2) {
            return false
        }

        if (this.inCheck(color)) {
            return false;
        }
        
        const kingside = (x2 === 6);

        const castleIndex = this.castleIndex(color, kingside);

        const rookX = kingside ? 7 : 0;
        const rook = this.getPiece(rookX, homeY);
        const enemy = this.opponent(color);

        if (!this.canCastle[castleIndex]) {
            return false;
        }
        if (rook[0] !== color || rook[1] !== ROOK){
            return false;
        }

        const emptySquares = kingside ? [5, 6] : [1, 2, 3];
        if (emptySquares.some(x => this.occupied(x, homeY))) {
            return false;
        }

        const kingPath = kingside ? [5, 6] : [3, 2];
        if (kingPath.some(x => this.squareAttackedBy(x, homeY, enemy))) {
            return false;
        } else {
            return true;
        }
    }

    canGetTo(x1, y1, x2, y2) {
        if (!this.inside(x1, y1) || !this.inside(x2, y2)) return false;

        const piece = this.getPiece(x1, y1);
        if (piece[1] === -1) return false;

        const color = piece[0];
        const type = piece[1];

        if (this.sameColor(x2, y2, color)) return false;

        const dx = x2 - x1;
        const dy = y2 - y1;

        if (type === PAWN) {
            const dir = this.pawnDirection(color);
            const start = this.pawnStartRank(color);

            if (dx === 0 && dy === dir && !this.occupied(x2, y2)) return true;

            if (
                dx === 0 &&
                y1 === start &&
                dy === 2 * dir &&
                !this.occupied(x1, y1 + dir) &&
                !this.occupied(x2, y2)
            ) return true;

            if (Math.abs(dx) === 1 && dy === dir && this.enemyColor(x2, y2, color))
                return true;

            if (
                Math.abs(dx) === 1 &&
                dy === dir &&
                x2 === this.enPassant[0] &&
                y2 === this.enPassant[1]
            ) return true;

            return false;
        }

        if (type === BISHOP) return this.slideCanReach(x1, y1, x2, y2, this.steps.bishop);
        if (type === ROOK) return this.slideCanReach(x1, y1, x2, y2, this.steps.rook);
        if (type === QUEEN) return this.slideCanReach(x1, y1, x2, y2, this.steps.queen);

        if (type === KNIGHT) {
            return this.steps.knight.some(s => dx === s[0] && dy === s[1]);
        }

        if (type === KING) {
            if (this.steps.king.some(s => dx === s[0] && dy === s[1])) return true;

            if (dy === 0 && Math.abs(dx) === 2) return this.canCastleTo(color, x1, y1, x2, y2);

            return false;
        }

        return false;
    }

    makeMove(x1, y1, x2, y2, promotionType = QUEEN) {
        const [color, type] = this.getPiece(x1, y1);
        const enemy = this.opponent(color);
        const targetCode = this.getPieceCode(x2, y2);
        const undo = {
            x1,
            y1,
            x2,
            y2,
            color,
            type,
            targetCode,
            canCastle: [...this.canCastle],
            enPassant: [...this.enPassant],
            turn: this.turn,
            halfmoveClock: this.halfmoveClock,
            gameResult: this.gameResult,
            rookMove: null,
            enPassantCapture: null,
            promotion: false,
            promotionType: null
        };

        if (targetCode !== EMPTY) {
            const targetColor = Math.floor(targetCode / 6);
            const targetType = targetCode % 6;
            this.board[targetColor][targetType].clear(x2, y2);
        }

        if (
            type === PAWN &&
            x2 === this.enPassant[0] &&
            y2 === this.enPassant[1] &&
            !this.occupied(x2, y2)
        ) {
            const capY = color === WHITE ? y2 + 1 : y2 - 1;
            this.board[enemy][PAWN].clear(x2, capY);
            this.setPieceCode(x2, capY, EMPTY);
            undo.enPassantCapture = {
                x: x2,
                y: capY,
                code: enemy * 6 + PAWN
            };
        }

        this.board[color][type].move(x1, y1, x2, y2);
        this.setPieceCode(x1, y1, EMPTY);
        this.setPieceCode(x2, y2, color * 6 + type);

        if (type === KING && Math.abs(x2 - x1) === 2) {
            if (x2 === 6) {
                this.board[color][ROOK].move(7, y1, 5, y1);
                this.setPieceCode(7, y1, EMPTY);
                this.setPieceCode(5, y1, color * 6 + ROOK);
                undo.rookMove = { fromX: 7, toX: 5, y: y1 };
            } else {
                this.board[color][ROOK].move(0, y1, 3, y1);
                this.setPieceCode(0, y1, EMPTY);
                this.setPieceCode(3, y1, color * 6 + ROOK);
                undo.rookMove = { fromX: 0, toX: 3, y: y1 };
            }
        }

        if (type === PAWN && (y2 === 7 || y2 === 0)) {
            const promotedType = normalizePromotionType(promotionType);
            this.board[color][PAWN].clear(x2, y2);
            this.board[color][promotedType].set(x2, y2);
            this.setPieceCode(x2, y2, color * 6 + promotedType);
            undo.promotion = true;
            undo.promotionType = promotedType;
        }

        this.enPassant = [-1, -1];

        if (type === PAWN && Math.abs(y2 - y1) === 2) {
            this.enPassant = [x1, (y1 + y2) / 2];
        }

        if (type === KING) {
            this.canCastle[this.castleIndex(color, true)] = false;
            this.canCastle[this.castleIndex(color, false)] = false;
        }

        if (type === ROOK) {
            if (color === WHITE && x1 === 0 && y1 === 7) this.canCastle[WHITE_QUEENSIDE] = false;
            if (color === WHITE && x1 === 7 && y1 === 7) this.canCastle[WHITE_KINGSIDE] = false;
            if (color === BLACK && x1 === 0 && y1 === 0) this.canCastle[BLACK_QUEENSIDE] = false;
            if (color === BLACK && x1 === 7 && y1 === 0) this.canCastle[BLACK_KINGSIDE] = false;
        }

        if (targetCode !== EMPTY && (targetCode % 6) === ROOK) {
            const targetColor = Math.floor(targetCode / 6);
            if (targetColor === WHITE && x2 === 0 && y2 === 7) this.canCastle[WHITE_QUEENSIDE] = false;
            if (targetColor === WHITE && x2 === 7 && y2 === 7) this.canCastle[WHITE_KINGSIDE] = false;
            if (targetColor === BLACK && x2 === 0 && y2 === 0) this.canCastle[BLACK_QUEENSIDE] = false;
            if (targetColor === BLACK && x2 === 7 && y2 === 0) this.canCastle[BLACK_KINGSIDE] = false;
        }

        if (targetCode !== EMPTY || type === PAWN || undo.enPassantCapture) {
            this.halfmoveClock = 0;
        } else {
            this.halfmoveClock++;
        }

        applyMoveToBoardNNUE(this, undo);
        return undo;
    }

    unmakeMove(undo) {
        const { x1, y1, x2, y2, color, type, targetCode } = undo;

        if (undo.promotion) {
            this.board[color][undo.promotionType ?? QUEEN].clear(x2, y2);
            this.board[color][PAWN].set(x1, y1);
            this.setPieceCode(x1, y1, color * 6 + PAWN);
        } else {
            this.board[color][type].move(x2, y2, x1, y1);
            this.setPieceCode(x1, y1, color * 6 + type);
        }

        this.setPieceCode(x2, y2, EMPTY);

        if (undo.rookMove) {
            const { fromX, toX, y } = undo.rookMove;
            this.board[color][ROOK].move(toX, y, fromX, y);
            this.setPieceCode(toX, y, EMPTY);
            this.setPieceCode(fromX, y, color * 6 + ROOK);
        }

        if (undo.enPassantCapture) {
            const { x, y, code } = undo.enPassantCapture;
            this.board[Math.floor(code / 6)][code % 6].set(x, y);
            this.setPieceCode(x, y, code);
        } else if (targetCode !== EMPTY) {
            const targetColor = Math.floor(targetCode / 6);
            const targetType = targetCode % 6;
            this.board[targetColor][targetType].set(x2, y2);
            this.setPieceCode(x2, y2, targetCode);
        }

        this.canCastle = [...undo.canCastle];
        this.enPassant = [...undo.enPassant];
        this.turn = undo.turn;
        this.halfmoveClock = undo.halfmoveClock;
        this.gameResult = undo.gameResult;
        unmakeMoveToBoardNNUE(this, undo);
    }

    rawMove(x1, y1, x2, y2, promotionType = QUEEN) {
        return this.makeMove(x1, y1, x2, y2, promotionType);
    }

    cloneState() {
        return {
            board: this.board.map(side => side.map(p => p.val)),
            castle: [...this.canCastle],
            ep: [...this.enPassant],
            turn: this.turn,
            halfmoveClock: this.halfmoveClock,
            gameResult: this.gameResult
        };
    }

    restoreState(s) {
        for (let c = 0; c < 2; c++) {
            for (let t = 0; t < 6; t++) {
                this.board[c][t].val = s.board[c][t];
            }
        }

        this.canCastle = [...s.castle];
        this.enPassant = [...s.ep];
        this.turn = s.turn;
        this.halfmoveClock = s.halfmoveClock;
        this.gameResult = s.gameResult;
        this.rebuildSquares();
    }

    isLegalMove(x1, y1, x2, y2) {
        const piece = this.getPiece(x1, y1);

        if (piece[0] !== this.turn) return false;
        if (piece[1] === -1) return false;
        if (!this.canGetTo(x1, y1, x2, y2)) return false;

        const color = piece[0];
        const undo = this.makeMove(x1, y1, x2, y2);
        const legal = !this.inCheck(color);
        this.unmakeMove(undo);

        return legal;
    }

    generateCandidateMovesForPiece(x1, y1, color, type) {
        const moves = [];
        const pushMove = (x2, y2) => {
            if (this.inside(x2, y2)) {
                moves.push({ x1, y1, x2, y2 });
            }
        };

        if (type === PAWN) {
            const dir = this.pawnDirection(color);
            const startRank = this.pawnStartRank(color);
            const oneStepY = y1 + dir;

            if (this.inside(x1, oneStepY) && !this.occupied(x1, oneStepY)) {
                pushMove(x1, oneStepY);

                const twoStepY = y1 + 2 * dir;
                if (y1 === startRank && this.inside(x1, twoStepY) && !this.occupied(x1, twoStepY)) {
                    pushMove(x1, twoStepY);
                }
            }

            for (const dx of [-1, 1]) {
                const x2 = x1 + dx;
                const y2 = y1 + dir;
                if (!this.inside(x2, y2)) continue;

                if (this.enemyColor(x2, y2, color) || (x2 === this.enPassant[0] && y2 === this.enPassant[1])) {
                    pushMove(x2, y2);
                }
            }

            return moves;
        }

        if (type === KNIGHT) {
            for (const [dx, dy] of this.steps.knight) {
                const x2 = x1 + dx;
                const y2 = y1 + dy;
                if (this.inside(x2, y2) && !this.sameColor(x2, y2, color)) {
                    pushMove(x2, y2);
                }
            }

            return moves;
        }

        if (type === KING) {
            for (const [dx, dy] of this.steps.king) {
                const x2 = x1 + dx;
                const y2 = y1 + dy;
                if (this.inside(x2, y2) && !this.sameColor(x2, y2, color)) {
                    pushMove(x2, y2);
                }
            }

            const homeY = this.homeRank(color);
            if (x1 === 4 && y1 === homeY) {
                pushMove(6, homeY);
                pushMove(2, homeY);
            }

            return moves;
        }

        const directions =
            type === BISHOP ? this.steps.bishop :
            type === ROOK ? this.steps.rook :
            this.steps.queen;

        for (const [dx, dy] of directions) {
            let x2 = x1 + dx;
            let y2 = y1 + dy;

            while (this.inside(x2, y2)) {
                if (this.sameColor(x2, y2, color)) break;

                pushMove(x2, y2);
                if (this.enemyColor(x2, y2, color)) break;

                x2 += dx;
                y2 += dy;
            }
        }

        return moves;
    }

    generateLegalMoves(color = this.turn) {
        const moves = [];
        const saveTurn = this.turn;

        this.turn = color;

        for (let y1 = 0; y1 < 8; y1++) {
            for (let x1 = 0; x1 < 8; x1++) {
                const piece = this.getPiece(x1, y1);
                if (piece[0] !== color) {
                    continue;
                }

                const candidates = this.generateCandidateMovesForPiece(x1, y1, color, piece[1]);
                for (const move of candidates) {
                    if (this.isLegalMove(move.x1, move.y1, move.x2, move.y2)) {
                        moves.push(move);
                    }
                }
            }
        }

        this.turn = saveTurn;
        return moves;
    }

    isCheckmate(color) {
        if (!this.inCheck(color)) {
            return false;
        }

        const legalMoves = this.generateLegalMoves(color);
        return legalMoves.length === 0;
    }

    isStalemate(color) {
        if (this.inCheck(color)) {
            return false;
        }

        const legalMoves = this.generateLegalMoves(color);
        return legalMoves.length === 0;
    }

    squareName(x, y) {
        return "abcdefgh"[x] + (8 - y);
    }

    // Key FEN Components (Example: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1) 
    // 1. Piece Placement: Lists pieces rank-by-rank starting from 8 down to 1, separated by slashes (/). Uppercase letters are White (PNBRQK), lowercase are Black (pnbrqk), and numbers indicate consecutive empty squares.
    // 2. Active Color: w means it is White's turn, b means Black's turn.
    // 3. Castling Rights: Indicates if castling is still possible for either side (K, Q, k, q). If not, a - is used.
    // 4. En Passant Target: If a pawn just moved two squares, the square behind it is listed; otherwise, a - is used.
    // 5. Halfmove Clock: The number of halfmoves since the last capture or pawn move, used for the 50-move draw rule.
    // 6. Fullmove Number: The total turn number, starting at 1 and incrementing after black moves. 
    toFEN() {
        const pieceChars = ["p", "b", "n", "r", "q", "k"];
        const ranks = [];

        for (let y = 0; y < 8; y++) {
            let rank = "";
            let empty = 0;

            for (let x = 0; x < 8; x++) {
                const [color, type] = this.getPiece(x, y);

                if (type === -1) {
                    empty++;
                    continue;
                }

                if (empty > 0) {
                    rank += empty;
                    empty = 0;
                }

                const piece = pieceChars[type];
                rank += color === WHITE ? piece.toUpperCase() : piece;
            }

            if (empty > 0) {
                rank += empty;
            }
            ranks.push(rank);
        }

        let castling = "";
        if (this.canCastle[0]) {
            castling += "K"
        }
        if (this.canCastle[1]) {
            castling += "Q"
        }
        if (this.canCastle[2]) {
            castling += 'k'
        }
        if (this.canCastle[3]) {
            castling += 'q';
        }
        if (castling === "") {
            castling = "-";
        }

        const enPassant = this.enPassant[0] === -1
            ? "-"
            : this.squareName(this.enPassant[0], this.enPassant[1]);
        
        return `${ranks.join("/")} ${this.turn === WHITE ? "w" : "b"} ${castling} ${enPassant} 0 1`;
    }

    moveToFEN() {
        return this.toFEN();
    }

    move(x1, y1, x2, y2, promotionType = QUEEN) {
        if (!this.isLegalMove(x1, y1, x2, y2)) {
            const piece = this.getPiece(x1, y1);
            console.log(`Move rejected: (${x1},${y1}) -> (${x2},${y2}). Piece at start: [${piece[0]}, ${piece[1]}], turn: ${this.turn}`);
            return false;
        }

        this.makeMove(x1, y1, x2, y2, promotionType);
        this.turn = 1 - this.turn;
        this.moveHistory.push(this.toFEN());
        
        // Update game result after move
        this.gameResult = this.isGameOver();
        if(this.gameResult.over) {
            console.log(this.gameResult);
        }
        
        // Update engine's board reference (color should remain the same - the engine's starting color)
        this.engine.board = this;
        
        return true;

    }

    isInsufficientMaterial() {
        const pieces = this.getPieces();

        // Need at least a pawn, rook, or queen to checkmate
        for (const p of pieces) {
            if (p.type === PAWN || p.type === ROOK || p.type === QUEEN) {
                return false;
            }
        }

        // If only kings remain, it's insufficient
        if (pieces.length === 2) {
            return true;
        }

        // King and single knight or bishop vs king is insufficient
        if (pieces.length === 3) {
            const minors = pieces.filter(p => p.type === KNIGHT || p.type === BISHOP);
            return minors.length === 1;
        }

        // King and two knights vs king (cannot force checkmate)
        if (pieces.length === 3) {
            const knights = pieces.filter(p => p.type === KNIGHT);
            if (knights.length === 2 && knights.every(k => k.color === knights[0].color)) {
                return true;
            }
        }

        return false;
    }

    isThreefoldRepetition() {
        const currentFEN = this.toFEN();
        let count = 0;

        // Count occurrences of current position in move history
        for (const fen of this.moveHistory) {
            // Compare FEN without halfmove and fullmove numbers
            const fenParts = fen.split(' ').slice(0, 4).join(' ');
            const currentParts = currentFEN.split(' ').slice(0, 4).join(' ');
            if (fenParts === currentParts) {
                count++;
            }
        }

        // Add current position once if it isn't already the last history entry
        if (this.moveHistory.length === 0 || this.moveHistory[this.moveHistory.length - 1].split(' ').slice(0, 4).join(' ') !== currentFEN.split(' ').slice(0, 4).join(' ')) {
            count++;
        }

        return count >= 3;
    }

    isFiftyMoveRule() {
        return this.halfmoveClock >= 100;
    }

    isGameOver() {
        const currentPlayer = this.turn;
        const opponent = this.opponent(currentPlayer);

        // Check checkmate and stalemate
        if (this.isCheckmate(currentPlayer)) {
            return { over: true, reason: 'checkmate', winner: opponent };
        }

        if (this.isStalemate(currentPlayer)) {
            return { over: true, reason: 'stalemate', winner: -1 };
        }

        // Check insufficient material
        if (this.isInsufficientMaterial()) {
            return { over: true, reason: 'insufficient material', winner: -1 };
        }

        // Check threefold repetition
        if (this.isThreefoldRepetition()) {
            return { over: true, reason: 'threefold repetition', winner: -1 };
        }

        // Check 50-move rule
        if (this.isFiftyMoveRule()) {
            return { over: true, reason: '50-move rule', winner: -1 };
        }

        return { over: false };
    }
}
