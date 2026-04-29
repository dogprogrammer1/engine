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

export default class Board {
    constructor() {
        this.reset();
    }

    reset() {
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

        this.canCastle = [true, true, true, true];
        this.enPassant = [-1, -1];
        this.turn = WHITE;

        this.steps = {
            bishop: [[1,1],[1,-1],[-1,1],[-1,-1]],
            rook: [[1,0],[-1,0],[0,1],[0,-1]],
            queen: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
            king: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
            knight: [[1,2],[1,-2],[-1,2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]]
        };

        this.rebuildSquares();
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

    rawMove(x1, y1, x2, y2) {
        const [color, type] = this.getPiece(x1, y1);
        const enemy = this.opponent(color);
        const target = this.getPiece(x2, y2);
        if (target[1] !== -1) {
            this.board[target[0]][target[1]].clear(x2, y2);
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
        }

        this.board[color][type].move(x1, y1, x2, y2);
        this.setPieceCode(x1, y1, EMPTY);
        this.setPieceCode(x2, y2, color * 6 + type);

        if (type === KING && Math.abs(x2 - x1) === 2) {
            if (x2 === 6) {
                // Kingside castling: rook h-file to f-file
                this.board[color][ROOK].move(7, y1, 5, y1);
                this.setPieceCode(7, y1, EMPTY);
                this.setPieceCode(5, y1, color * 6 + ROOK);
                this.canCastle[this.castleIndex(color, true)] = false;
            } else {
                // Queenside castling: rook a-file to d-file
                this.board[color][ROOK].move(0, y1, 3, y1);
                this.setPieceCode(0, y1, EMPTY);
                this.setPieceCode(3, y1, color * 6 + ROOK);
                this.canCastle[this.castleIndex(color, false)] = false;
            }
        }

        if (type === PAWN && (y2 === 7 || y2 === 0)) {
            this.board[color][PAWN].clear(x2, y2);
            this.board[color][QUEEN].set(x2, y2);
            this.setPieceCode(x2, y2, color * 6 + QUEEN);
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

        if (target[1] === ROOK) {
            if (target[0] === WHITE && x2 === 0 && y2 === 7) this.canCastle[WHITE_QUEENSIDE] = false;
            if (target[0] === WHITE && x2 === 7 && y2 === 7) this.canCastle[WHITE_KINGSIDE] = false;
            if (target[0] === BLACK && x2 === 0 && y2 === 0) this.canCastle[BLACK_QUEENSIDE] = false;
            if (target[0] === BLACK && x2 === 7 && y2 === 0) this.canCastle[BLACK_KINGSIDE] = false;
        }
    }

    cloneState() {
        return {
            board: this.board.map(side => side.map(p => p.val)),
            castle: [...this.canCastle],
            ep: [...this.enPassant],
            turn: this.turn
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
        this.rebuildSquares();
    }

    isLegalMove(x1, y1, x2, y2) {
        const piece = this.getPiece(x1, y1);

        if (piece[0] !== this.turn) return false;
        if (piece[1] === -1) return false;
        if (!this.canGetTo(x1, y1, x2, y2)) return false;

        const color = piece[0];
        const save = this.cloneState();

        this.rawMove(x1, y1, x2, y2);

        if (this.inCheck(color)) {
            this.restoreState(save);
            return false;
        }

        this.restoreState(save);
        return true;
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

                for (let y2 = 0; y2 < 8; y2++) {
                    for (let x2 = 0; x2 < 8; x2++) {
                        if (this.isLegalMove(x1, y1, x2, y2)) {
                            moves.push({ x1, y1, x2, y2 });
                        }
                    }
                }
            }
        }

        this.turn = saveTurn;
        return moves;
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

    move(x1, y1, x2, y2) {
        if (!this.isLegalMove(x1, y1, x2, y2)) return false;

        this.rawMove(x1, y1, x2, y2);
        this.rebuildSquares();
        this.turn = 1 - this.turn;
        return true;

    }
}
