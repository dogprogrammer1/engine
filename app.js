import Game from "./game.js";
import Renderer2D from "./renderer/2drenderer.js";
import Renderer3D from "./renderer/3drenderer.js";

const canvas = document.getElementById("canvas");
const newGameButton = document.getElementById("newGameBtn");
const rendererSelect = document.getElementById("rendererSelect");
const gameModeSelect = document.getElementById("gameModeSelect");
const evalDisplay = document.getElementById("evalDisplay");
const sideDisplay = document.getElementById("sideDisplay");
const rendererInfo = document.getElementById("rendererInfo");

let game = null;
let renderer = null;
let animationFrame = null;

function playerColorForMode(mode) {
    return mode === "manualBlack" || mode === "manualNNUEBlack" ? 1 : 0;
}

function configureGame(gameMode) {
    if (gameMode === "auto") {
        game.startAutoPlay();
    } else if (gameMode === "manual") {
        game.startManualPlay("white", "classical");
    } else if (gameMode === "manualBlack") {
        game.startManualPlay("black", "classical");
    } else if (gameMode === "manualNNUEWhite") {
        game.startManualPlay("white", "nnue");
    } else if (gameMode === "manualNNUEBlack") {
        game.startManualPlay("black", "nnue");
    }
}

function updateRendererInfo() {
    rendererInfo.textContent = rendererSelect.value === "3d"
        ? "3D controls: click the board to focus, WASD moves, IJKL looks, Space / Shift changes height."
        : "2D view active. Click a piece, then click its destination.";
}

function stopRenderLoop() {
    if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
}

function renderFrame() {
    if (rendererSelect.value === "3d" && game) {
        game.draw();
        animationFrame = requestAnimationFrame(renderFrame);
    } else {
        animationFrame = null;
    }
}

function startRenderLoop() {
    stopRenderLoop();
    if (rendererSelect.value === "3d") {
        animationFrame = requestAnimationFrame(renderFrame);
    }
}

function initializeGame() {
    game?.destroy();
    game = new Game(
        renderer,
        playerColorForMode(gameModeSelect.value),
        evalDisplay,
        sideDisplay
    );
    renderer.setPlayerColor?.(game.playerColor);
    configureGame(gameModeSelect.value);
    game.draw();
    startRenderLoop();
}

function initializeRenderer() {
    stopRenderLoop();
    game?.destroy();
    game = null;
    renderer?.destroy();
    renderer = rendererSelect.value === "3d"
        ? new Renderer3D(canvas)
        : new Renderer2D(canvas);
    updateRendererInfo();
    initializeGame();
}

canvas.addEventListener("boardClick", event => {
    game?.click(event.detail.x, event.detail.y);
});

newGameButton.addEventListener("click", initializeGame);
gameModeSelect.addEventListener("change", initializeGame);
rendererSelect.addEventListener("change", initializeRenderer);
window.addEventListener("beforeunload", () => {
    stopRenderLoop();
    game?.destroy();
    renderer?.destroy();
});

initializeRenderer();
