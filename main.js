import Game from "./game.js";
import Renderer from "./renderer/renderer.js";
import { SQUARE_SIZE } from "./ui-constants.js";

const canvas = document.getElementById("canvas");
const renderer = new Renderer(canvas);
const game = new Game(renderer);

canvas.addEventListener("click", e => {
    let x = Math.floor(e.offsetX / SQUARE_SIZE);
    let y = Math.floor(e.offsetY / SQUARE_SIZE);
    game.click(x, y);
});
game.draw();
