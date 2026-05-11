import Board from "../board.js";
import Engine from "./engine.js";

self.addEventListener("message", event => {
  const message = event.data;
  if (message.type !== "findBestMove") {
    return;
  }

  try {
    const board = new Board(0, { silent: true });
    board.restoreState(message.state);
    const workerEngine = new Engine(board, message.color);

    const bestMove = workerEngine.findBestMove(message.depth);
    self.postMessage({ type: "bestMove", bestMove });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message, stack: error.stack });
  }
});
