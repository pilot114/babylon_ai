import { Game } from './game.js';

// Запускаем игру при загрузке страницы
window.addEventListener("DOMContentLoaded", async () => {
    const game = new Game();
    await game.start();
}); 