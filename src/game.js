import * as BABYLON from '@babylonjs/core';
import { TerrainGenerator } from './terrain/terrainGenerator.js';
import { BallsSimulation } from './simulations/ballsSimulation.js';
import { GameGUI } from './ui/gui.js';

const state = {
    canvas: null,
    engine: null,
    scene: null,
    terrainGenerator: null,
    ballsSimulation: null,
    gui: null
};

function setupCamera(scene, canvas) {
    const camera = new BABYLON.ArcRotateCamera(
        "camera", 0, Math.PI / 3, 40,
        BABYLON.Vector3.Zero(), scene
    );
    camera.attachControl(canvas, true);
    return camera;
}

function setupLighting(scene) {
    return new BABYLON.HemisphericLight(
        "light",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
}

async function setupSimulations(scene) {
    const ballsSimulation = new BallsSimulation(scene);
    await ballsSimulation.initialize();

    const terrainGenerator = new TerrainGenerator();
    const ground = terrainGenerator.createTerrain(scene, {
        width: 30,
        length: 30,
        roughness: 0.05
    });

    ballsSimulation.addPhysicsToTerrain(ground);
    ballsSimulation.startSpawning();

    return { ballsSimulation, terrainGenerator };
}

function setupGUI(scene) {
    const gui = new GameGUI(scene);
    gui.initialize();
    return gui;
}

function setupRendering(engine, scene) {
    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
}

async function createScene() {
    state.canvas = document.getElementById("renderCanvas");
    state.engine = new BABYLON.Engine(state.canvas, true);
    state.scene = new BABYLON.Scene(state.engine);

    setupCamera(state.scene, state.canvas);
    setupLighting(state.scene);

    const { ballsSimulation, terrainGenerator } = await setupSimulations(state.scene);
    state.ballsSimulation = ballsSimulation;
    state.terrainGenerator = terrainGenerator;

    state.gui = setupGUI(state.scene);

    return state.scene;
}

function dispose() {
    if (state.gui) {
        state.gui.dispose();
    }
    if (state.ballsSimulation) {
        state.ballsSimulation.dispose();
    }
    if (state.scene) {
        state.scene.dispose();
    }
    if (state.engine) {
        state.engine.dispose();
    }
}

async function startGame() {
    try {
        await createScene();
        setupRendering(state.engine, state.scene);
    } catch (error) {
        console.error("Failed to start game:", error);
        dispose();
    }
}

// Запуск игры при загрузке страницы
window.addEventListener('DOMContentLoaded', startGame);

// Очистка ресурсов при закрытии страницы
window.addEventListener('beforeunload', dispose);