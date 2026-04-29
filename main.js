import Game from "./game.js";
import Renderer3D from "./renderer/3drenderer.js";

const canvas = document.getElementById("canvas");
const renderer = new Renderer3D(canvas);
const game = new Game(renderer);

canvas.addEventListener("boardClick", e => {
    const { x, y } = e.detail;
    game.click(x, y);
});

game.draw();

// Continuous render loop for 3D renderer
function gameLoop() {
    game.draw();
    requestAnimationFrame(gameLoop);
}
gameLoop();
