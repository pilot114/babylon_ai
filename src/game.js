import * as BABYLON from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { TerrainGenerator } from './terrain/terrainGenerator.js';
import { BallsSimulation } from './simulations/ballsSimulation.js';
import { GameGUI } from './ui/gui.js';
import { FirstPersonController } from './player/firstPersonController.js';
import { SkyBox } from './environment/skybox.js';

const state = {
    canvas: null,
    engine: null,
    scene: null,
    terrainGenerator: null,
    ballsSimulation: null,
    gui: null,
    player: null,
    havokPlugin: null
};

async function setupPhysics(scene) {
    const havokInstance = await HavokPhysics();
    state.havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), state.havokPlugin);
}

async function setupPlayer(scene, canvas) {
    state.player = new FirstPersonController(scene, canvas);
    await state.player.initialize();
}

function setupLighting(scene) {
    return new BABYLON.HemisphericLight(
        "light",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
}

async function setupSimulations(scene) {
    const terrainGenerator = new TerrainGenerator();
    const ground = terrainGenerator.createTerrain(scene, {
        width: 300,
        length: 300,
        roughness: 0.4
    });

    const ballsSimulation = new BallsSimulation(scene);
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

    await setupPhysics(state.scene);
    
    setupLighting(state.scene);
    await setupPlayer(state.scene, state.canvas);

    // Добавляем skybox
    const skybox = new SkyBox(state.scene);
    skybox.create();

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