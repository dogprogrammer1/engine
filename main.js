import Game from "./game.js";
import Renderer from "./renderer.js";

const canvas = document.getElementById("canvas");
const renderer = new Renderer(canvas);
const game = new Game(renderer);

canvas.addEventListener("click", e => {
    let x = Math.floor(e.offsetX / 60);
    let y = Math.floor(e.offsetY / 60);
    game.click(x, y);
});
game.draw();

