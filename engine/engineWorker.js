import Board from "../board.js";
import Engine, { ENGINE_EVALUATORS } from "./engine.js";

self.addEventListener("message", event => {
  const message = event.data;
  if (message.type !== "findBestMove") {
    return;
  }

  try {
    const board = new Board(0, { silent: true });
    board.restoreState(message.state);
    const workerEngine = new Engine(
      board,
      message.color,
      message.evaluator || ENGINE_EVALUATORS.CLASSICAL
    );

    const start = performance.now();
    const bestMove = workerEngine.findBestMove(message.depth);
    const elapsedMs = performance.now() - start;
    self.postMessage({
      type: "bestMove",
      bestMove,
      color: message.color,
      evaluator: workerEngine.evaluator,
      elapsedMs,
      nodesEvaluated: workerEngine.nodesEvaluated
    });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message, stack: error.stack });
  }
});
