import {
    KING,
} from "./nnue_constants.js";

import {
    addDelta,
    getFeatIndex,
    rebuildState,
} from "./nnue_features.js";

import {
    runNet,
} from "./nnue_forward.js";

// The purpose of this file is to hold the RuntimeState class
// which holds cached NNUE states for a board
// it can rebuild, make moves, and undo moves when needed
export class RuntimeState {
    constructor(board, model) {
        this.board = board;
        this.model = model;

        // two accumulator states one for each side
        this.states = [
            { us: new Float32Array(model.fc1Size), them: new Float32Array(model.fc1Size) },
            { us: new Float32Array(model.fc1Size), them: new Float32Array(model.fc1Size) }
        ];

        // cached king buckets/squares
        this.kingSquares = new Int16Array(2);

        // scratch space to avoid allocations
        this.scratch = {
            extraFeatures: new Float32Array(model.extraInputCount),
            fc1: new Float32Array(model.fc1Size),
            fc2: new Float32Array(model.fc2Size)
        };

        // this is valid if the cached accumulators are up to date with the board position
        this.valid = false;
    }

    // uhm sets valid to false...
    invalidate() {
        this.valid = false;
    }

    // rebuilds if no longer matching
    ensureValid() {
        if (!this.valid) {
            this.rebuildAll();
        }
    }

    // this rebuilds the entire accumulator state from scratch 
    // goes through each side and calls the goated rebuildState function
    rebuildAll() {
        for (let side = 0; side < 2; side++) {
            this.kingSquares[side] = rebuildState(
                this.board,
                this.model,
                side,
                this.states[side]
            );
        }
        this.valid = true;
    }


    applyMove(moveRecord) {
        if (this.valid) {
            this.syncMove(moveRecord, true);
        }
    }

    undoMove(moveRecord) {
        if (this.valid) {
            this.syncMove(moveRecord, false);
        }
    }

    syncMove(moveRecord, forward) {
        const nnueUpdateInfo = moveRecord.nnue;

        // boolean array of whether it's required to rebuild each side
        // usually only needed when a king is moved
        const rebuild = nnueUpdateInfo.rebuildColors.slice();
        const direction = forward ? 1 : -1;

        // deltas is an array of per piece feature changes that need to be applied
        // to the NNUE accumulator state to update it to match the board
        for (const delta of nnueUpdateInfo.deltas) {
            this.updatePiece(
                rebuild,
                delta.color,
                delta.type,
                delta.square,
                delta.delta * direction
            );
        }

        for (let side = 0; side < 2; side++) {
            if (rebuild[side]) {
                // Note: rebuild state not only overwrite current accumulator states
                // but also returns the current king square/bucket
                this.kingSquares[side] = rebuildState(
                    this.board,
                    this.model,
                    side,
                    this.states[side]
                );
            }
        }
    }


    updatePiece(rebuild, color, type, sq, delta) {
        if (type === KING) {
            return;
        }
        
        // go through each side and update the board with piece delta
        // but only for the side that isn't going to get rebuilt anyways
        for (let side = 0; side < 2; side++) {
            if (!rebuild[side]) {
                addDelta(
                    this.states[side],
                    this.model,
                    getFeatIndex(color, type, sq, side, this.kingSquares[side]),
                    delta
                );
            }
        }
    }

    // main function that check if it's valid
    // then it picks the side to move as the active perspective
    // finally it runs the NNUE which returns the evaluation for the current position
    evaluate() {
        this.ensureValid();

        const us = this.board.turn; // 0 for white, 1 for black
        return runNet(
            this.model,
            this.states[us],
            this.states[us ^ 1],
            this.board,
            this.scratch
        );
    }
}
