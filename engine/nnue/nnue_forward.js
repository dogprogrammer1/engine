import {
    fillExtras,
} from "./nnue_features.js";

// clamps extreme values to avoid insanely high nums
export function clamp(value) {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
}

// essentially this outputs the final value of the nnue given a board and weights
export function runLayer(weights, bias, input, out) {
    const cols = input.length;

    // this works by going through each weight at [row][col] which is a flattened matrix basically
    // and then multiply that by the input for
    // the output is just the sum of all those plus the bias
    for (let row = 0; row < out.length; row++) {
        const rowOff = row * cols;
        let sum = bias[row];

        for (let col = 0; col < cols; col++) {
            sum += weights[rowOff + col] * input[col];
        }

        out[row] = clamp(sum);
    }

    return out;
}

// run out is the last layer so it only outputs a single value/evaluation score
// works very similarly to runlayer
export function runOut(model, input) {
    let sum = model.fc3Bias[0];

    for (let col = 0; col < input.length; col++) {
        sum += model.fc3Weight[col] * input[col];
    }

    return Math.tanh(sum);
}

// this is the thing that ties everything together
export function runNet(model, usState, themState, board, scratch) {
    const extras = fillExtras(board, scratch.extraFeatures);
    const fc1 = scratch.fc1;
    const extraCount = extras.length;
    const us = usState.us;
    const them = themState.them;

    // this computes the first fully connected layer
    for (let row = 0; row < model.fc1Size; row++) {
        // main part of the net
        let sum = model.fc1Bias[row] + us[row] + them[row];


        // this adds in the extra features contributions to the first layer
        const rowOff = row * extraCount;
        for (let col = 0; col < extraCount; col++) {
            sum += model.fc1ExtraWeight[rowOff + col] * extras[col];
        }

        fc1[row] = clamp(sum);
    }

    // runs the second layer
    runLayer(model.fc2Weight, model.fc2Bias, fc1, scratch.fc2);

    // gives the final output/evaluation score
    return runOut(model, scratch.fc2);
}
