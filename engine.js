export default class Engine {
    constructor(board, color) {
        this.board = board;
        this.color = color;
    }
    updateBoard(board) {
        this.board = board;
    }
    evaluateBoardClassical(){
        // Placeholder for board evaluation logic
        
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