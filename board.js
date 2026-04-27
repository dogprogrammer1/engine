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

export default class Board {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = [
            [
                new Llong(0x000000000000FF00n),
                new Llong(0x0000000000000024n),
                new Llong(0x0000000000000042n),
                new Llong(0x0000000000000081n),
                new Llong(0x0000000000000008n),
                new Llong(0x0000000000000010n)
            ],
            [
                new Llong(0x00FF000000000000n),
                new Llong(0x2400000000000000n),
                new Llong(0x4200000000000000n),
                new Llong(0x8100000000000000n),
                new Llong(0x0800000000000000n),
                new Llong(0x1000000000000000n)
            ]
        ];

        this.canCastle = [true, true, true, true];
        this.enPassant = [-1, -1];
        this.turn = 1; // 1 = white, 0 = black

        this.steps = {
            bishop: [[1,1],[1,-1],[-1,1],[-1,-1]],
            rook: [[1,0],[-1,0],[0,1],[0,-1]],
            queen: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
            king: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
            knight: [[1,2],[1,-2],[-1,2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]]
        };

        this.rebuildSquares();
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
        return code !== EMPTY && Math.floor(code / 6) === 1 - color;
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

        if (type === 0) {
            const dir = color === 0 ? 1 : -1;
            return (
                (x2 === x1 + 1 && y2 === y1 + dir) ||
                (x2 === x1 - 1 && y2 === y1 + dir)
            );
        }

        if (type === 1) return this.slideCanReach(x1, y1, x2, y2, this.steps.bishop);
        if (type === 3) return this.slideCanReach(x1, y1, x2, y2, this.steps.rook);
        if (type === 4) return this.slideCanReach(x1, y1, x2, y2, this.steps.queen);

        if (type === 2) {
            return this.steps.knight.some(s => x1+s[0]===x2 && y1+s[1]===y2);
        }

        if (type === 5) {
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
                if (p[0] === 1 - color) {
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
        let homeY;
        if (color === 0) {
            homeY = 0;
        } else {
            homeY = 7;
        }
        
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

        let castleIndex;
        if (color === 0) {
            castleIndex = kingside ? 0 : 1;
        } else {
            castleIndex = kingside ? 2 : 3;
        }

        const rookX = kingside ? 7 : 0;
        const rook = this.getPiece(rookX, homeY);
        const enemy = 1 - color;

        if (!this.canCastle[castleIndex]) {
            return false;
        }
        if (rook[0] !== color || rook[1] !== 3){
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

        if (type === 0) {
            const dir = color === 0 ? 1 : -1;
            const start = color === 0 ? 1 : 6;

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

        if (type === 1) return this.slideCanReach(x1, y1, x2, y2, this.steps.bishop);
        if (type === 3) return this.slideCanReach(x1, y1, x2, y2, this.steps.rook);
        if (type === 4) return this.slideCanReach(x1, y1, x2, y2, this.steps.queen);

        if (type === 2) {
            return this.steps.knight.some(s => dx === s[0] && dy === s[1]);
        }

        if (type === 5) {
            if (this.steps.king.some(s => dx === s[0] && dy === s[1])) return true;

            if (dy === 0 && Math.abs(dx) === 2) return this.canCastleTo(color, x1, y1, x2, y2);

            return false;
        }

        return false;
    }

    rawMove(x1, y1, x2, y2) {
        const [color, type] = this.getPiece(x1, y1);
        const enemy = 1 - color;

        const target = this.getPiece(x2, y2);
        if (target[1] !== -1) {
            this.board[target[0]][target[1]].clear(x2, y2);
        }

        if (
            type === 0 &&
            x2 === this.enPassant[0] &&
            y2 === this.enPassant[1] &&
            !this.occupied(x2, y2)
        ) {
            const capY = color === 0 ? y2 - 1 : y2 + 1;
            this.board[enemy][0].clear(x2, capY);
            this.setPieceCode(x2, capY, EMPTY);
        }

        this.board[color][type].move(x1, y1, x2, y2);
        this.setPieceCode(x1, y1, EMPTY);
        this.setPieceCode(x2, y2, color * 6 + type);

        if (type === 5 && Math.abs(x2 - x1) === 2) {
            if (x2 === 6) {
                this.board[color][3].move(7, y1, 5, y1);
                this.setPieceCode(7, y1, EMPTY);
                this.setPieceCode(5, y1, color * 6 + 3);
            } else {
                this.board[color][3].move(0, y1, 3, y1);
                this.setPieceCode(0, y1, EMPTY);
                this.setPieceCode(3, y1, color * 6 + 3);
            }
        }

        if (type === 0 && (y2 === 7 || y2 === 0)) {
            this.board[color][0].clear(x2, y2);
            this.board[color][4].set(x2, y2);
            this.setPieceCode(x2, y2, color * 6 + 4);
        }

        this.enPassant = [-1, -1];

        if (type === 0 && Math.abs(y2 - y1) === 2) {
            this.enPassant = [x1, (y1 + y2) / 2];
        }

        if (type === 5) {
            if (color === 0) this.canCastle[0] = this.canCastle[1] = false;
            else this.canCastle[2] = this.canCastle[3] = false;
        }

        if (type === 3) {
            if (color === 0 && x1 === 0 && y1 === 0) this.canCastle[1] = false;
            if (color === 0 && x1 === 7 && y1 === 0) this.canCastle[0] = false;
            if (color === 1 && x1 === 0 && y1 === 7) this.canCastle[3] = false;
            if (color === 1 && x1 === 7 && y1 === 7) this.canCastle[2] = false;
        }

        if (target[1] === 3) {
            if (target[0] === 0 && x2 === 0 && y2 === 0) this.canCastle[1] = false;
            if (target[0] === 0 && x2 === 7 && y2 === 0) this.canCastle[0] = false;
            if (target[0] === 1 && x2 === 0 && y2 === 7) this.canCastle[3] = false;
            if (target[0] === 1 && x2 === 7 && y2 === 7) this.canCastle[2] = false;
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
                rank += color === 1 ? piece.toUpperCase() : piece;
            }

            if (empty > 0) {
                rank += empty;
            }
            ranks.push(rank);
        }

        let castling = "";
        if (this.canCastle[2]) {
            castling += "K"
        }
        if (this.canCastle[3]) {
            castling += "Q"
        }
        if (this.canCastle[0]) {
            castling += 'k'
        }
        if (this.canCastle[1]) {
            castling += 'q';
        }
        if (castling === "") {
            castling = "-";
        }

        const enPassant = this.enPassant[0] === -1
            ? "-"
            : this.squareName(this.enPassant[0], this.enPassant[1]);
        
        return `${ranks.join("/")} ${this.turn === 1 ? "w" : "b"} ${castling} ${enPassant} 0 1`;
    }

    move(x1, y1, x2, y2) {
        if (!this.isLegalMove(x1, y1, x2, y2)) return false;

        this.rawMove(x1, y1, x2, y2);
        this.turn = 1 - this.turn;
        return true;
    }
}
