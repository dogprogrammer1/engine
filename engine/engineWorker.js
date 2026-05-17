import Board from "../board.js";
import Engine, { ENGINE_EVALUATORS } from "./engine.js";
import { loadDefaultNNUEModel } from "./nnue_evaluator.js";

async function resolveEvaluator(requestedEvaluator) {
  if (requestedEvaluator !== ENGINE_EVALUATORS.NNUE) {
    return {
      evaluator: ENGINE_EVALUATORS.CLASSICAL,
      warning: null
    };
  }

  try {
    await loadDefaultNNUEModel();
    return {
      evaluator: ENGINE_EVALUATORS.NNUE,
      warning: null
    };
  } catch (error) {
    return {
      evaluator: ENGINE_EVALUATORS.CLASSICAL,
      warning: `NNUE unavailable: ${error.message}`
    };
  }
}

async function handleFindBestMove(message) {
  const { evaluator, warning } = await resolveEvaluator(
    message.evaluator || ENGINE_EVALUATORS.CLASSICAL
  );

  try {
    const board = new Board(0, { silent: true });
    board.restoreState(message.state);
    const workerEngine = new Engine(
      board,
      message.color,
      evaluator
    );

    const start = performance.now();
    const bestMove = workerEngine.findBestMove(message.depth);
    const elapsedMs = performance.now() - start;
    self.postMessage({
      type: "bestMove",
      bestMove,
      color: message.color,
      evaluator: workerEngine.evaluator,
      requestedEvaluator: message.evaluator || ENGINE_EVALUATORS.CLASSICAL,
      warning,
      elapsedMs,
      nodesEvaluated: workerEngine.nodesEvaluated,
      evalCount: workerEngine.evalCount,
      evalTimeMs: workerEngine.evalTimeMs
    });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message, stack: error.stack });
  }
}

self.addEventListener("message", event => {
  const message = event.data;
  if (message.type !== "findBestMove") {
    return;
  }

  void handleFindBestMove(message);
});
