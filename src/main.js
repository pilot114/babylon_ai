import { Game } from './game.js';

async function startGame() {
    const game = new Game();
    await game.start();
}

window.addEventListener("DOMContentLoaded", startGame); 