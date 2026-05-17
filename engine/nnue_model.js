import {
    PIECE_FEATURES_PER_KING
} from "./nnue_constants.js";

// read binary as float32 arrays according to the specs in manifest
function readFloat32Array(buffer, spec) {
    return new Float32Array(buffer, spec.offset, spec.length);
}

// basically this returns one JS object that represents the NNUE model
// with all the metadeta and weights as F32 arrays
export async function fetchBinaryModel(manifestPath, weightPath) {
    // these are just the response objects
    // allows us to check if they're all good and gives methods to extract the body
    const [manifestRes, weightsRes] = await Promise.all([
        fetch(manifestPath),
        fetch(weightPath)
    ]);

    if (!manifestRes.ok) {
        throw new Error(`Failed to load NNUE manifest: ${manifestRes.status} ${manifestRes.statusText}`);
    }
    if (!weightsRes.ok) {
        throw new Error(`Failed to load NNUE weights: ${weightsRes.status} ${weightsRes.statusText}`);
    }

    // the actual json data and binary weights
    const [manifest, weightsBuffer] = await Promise.all([
        manifestRes.json(),
        weightsRes.arrayBuffer()
    ]);

    const [fc1Size] = manifest.fc1Shape;
    const [fc2Size] = manifest.fc2Shape;
    const extraCount = manifest.extraInputCount ?? 0;
    const extraLayout = manifest.extraFeatureLayout ?? null;
    const tensors = manifest.tensors ?? {};

    if (manifest.featureCount !== PIECE_FEATURES_PER_KING * 64) {
        throw new Error(`Unsupported NNUE feature count: ${manifest.featureCount}`);
    }
    if (!tensors.kingUsBias || !tensors.kingThemBias) {
        throw new Error("NNUE manifest is missing king bias tensors.");
    }

    return {
        fc1Size,
        fc2Size,
        extraInputCount: extraCount,
        kingUsBias: readFloat32Array(weightsBuffer, tensors.kingUsBias),
        kingThemBias: readFloat32Array(weightsBuffer, tensors.kingThemBias),
        featureUsProjection: readFloat32Array(weightsBuffer, tensors.featureUsProjection),
        featureThemProjection: readFloat32Array(weightsBuffer, tensors.featureThemProjection),
        fc1ExtraWeight: readFloat32Array(weightsBuffer, tensors.fc1ExtraWeight),
        fc1Bias: readFloat32Array(weightsBuffer, tensors.fc1Bias),
        fc2Weight: readFloat32Array(weightsBuffer, tensors.fc2Weight),
        fc2Bias: readFloat32Array(weightsBuffer, tensors.fc2Bias),
        fc3Weight: readFloat32Array(weightsBuffer, tensors.fc3Weight),
        fc3Bias: readFloat32Array(weightsBuffer, tensors.fc3Bias)
    };
}
