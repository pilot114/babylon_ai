import { BasicPhysicsDemo } from './demo/basic-physics-demo';

async function startDemo() {
    const canvas = document.getElementById("renderCanvas");
    const demo = new BasicPhysicsDemo(canvas);
    await demo.initialize();
}

// Запускаем демо при загрузке страницы
window.addEventListener("DOMContentLoaded", startDemo); 