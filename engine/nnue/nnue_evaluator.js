import {
    NNUE_MANIFEST_PATH,
    NNUE_MODEL_PATH,
} from "./nnue_constants.js";

import {
    fetchBinaryModel,
} from "./nnue_model.js";

import { RuntimeState } from "./nnue_runtime.js";

let loadedModel = null; // the finished nnue model 
let loadPromise = null; // holds the in progress loading which allows for parallel requests

// this function checks whether the board already has a valid runtime state cached
// if not it creates a new one and caches it on the board object for next time
function getState(board, model) {
    const existing = board._nnueRuntime;
    if (existing && existing.model === model) {
        return existing;
    }

    const state = new RuntimeState(board, model);
    board._nnueRuntime = state;
    return state;
}

export function invalidateBoardNNUE(board) {
    board._nnueRuntime?.invalidate();
}

export function applyMoveToBoardNNUE(board, moveRecord) {
    board._nnueRuntime?.applyMove(moveRecord);
}

export function unmakeMoveToBoardNNUE(board, moveRecord) {
    board._nnueRuntime?.undoMove(moveRecord);
}

export function evaluateBoardWithNNUE(board) {
    return getState(board, loadedModel).evaluate();
}

export function hasLoadedNNUEModel() {
    return loadedModel !== null;
}

// loads the nnue model if it hasn't been loaded yet
export async function loadNNUEModel() {
    if (loadedModel) {
        return loadedModel;
    }
    if (loadPromise) {
        return loadPromise;
    }

    // start loading and save the promise so that if another request comes in
    // it can just wait for the same promise instead of starting a new load
    loadPromise = (async () => {
        const model = await fetchBinaryModel(NNUE_MANIFEST_PATH, NNUE_MODEL_PATH);
        loadedModel = model;
        return model;
    })();

    // wait for the load to finish and then return the loaded model, then clear the promise
    try {
        return await loadPromise;
    } finally {
        loadPromise = null;
    }
}