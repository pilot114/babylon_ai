import * as BABYLON from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { Inspector } from '@babylonjs/inspector';

import { TerrainGenerator } from './terrainGenerator.js';
import { BallsSimulation } from './ballsSimulation.js';
import { GameGUI } from './gui.js';
import { FirstPersonController } from './firstPersonController.js';
import { SkyBox } from './skybox.js';
import { ModelLoader } from './modelLoader.js';

const state = {
    canvas: null,
    engine: null,
    scene: null,
    terrainGenerator: null,
    ballsSimulation: null,
    gui: null,
    player: null,
    havokPlugin: null,
    modelLoader: null
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

async function setupScene(scene) {
    const modelLoader = new ModelLoader(scene);

    await modelLoader.loadAndPlace("rock.glb", new BABYLON.Vector3(-10, 0, -40), new BABYLON.Vector3(1, 1, 1), true);
    await modelLoader.loadAndPlace("tree.glb", new BABYLON.Vector3(-10, 0, -50), new BABYLON.Vector3(0.1, 0.1, 0.1));
    await modelLoader.loadAndPlace("helicopter.glb", new BABYLON.Vector3(-10, 0, -60), new BABYLON.Vector3(0.01, 0.01, 0.01));
    await modelLoader.loadAndPlace("santa_belly_dancing.glb", new BABYLON.Vector3(-10, 0, -70), new BABYLON.Vector3(1, 1, 1));
    await modelLoader.loadAndPlace("bear.glb", new BABYLON.Vector3(-10, 0, -80), new BABYLON.Vector3(1, 1, 1));
    
    return modelLoader;
}

async function createScene() {
    state.canvas = document.getElementById("renderCanvas");
    state.engine = new BABYLON.Engine(state.canvas, true);
    state.scene = new BABYLON.Scene(state.engine);

    await setupPhysics(state.scene);
    
    setupLighting(state.scene);
    await setupPlayer(state.scene, state.canvas);

    const skybox = new SkyBox(state.scene);
    skybox.create();

    const { ballsSimulation, terrainGenerator } = await setupSimulations(state.scene);
    state.ballsSimulation = ballsSimulation;
    state.terrainGenerator = terrainGenerator;

    state.gui = setupGUI(state.scene);

    const modelLoader = await setupScene(state.scene);
    state.modelLoader = modelLoader;

    setupSound(state.scene);

    Inspector.Show(state.scene, {embedMode: true});

    return state.scene;
}

function setupSound(scene) {
    const soundtrackList = [
        { url: "/assets/sounds/macleod/MonkeysSpinningMonkeys.mp3", name: "1" },
        { url: "/assets/sounds/macleod/SchemingWeasel.mp3", name: "2" },
        { url: "/assets/sounds/macleod/SneakySnitch.mp3", name: "3" },
        { url: "/assets/sounds/macleod/TheBuilder.mp3", name: "4" },
    ];

    const randomIndex = Math.floor(Math.random() * soundtrackList.length);
    const selectedTrack = soundtrackList[randomIndex];

    // new BABYLON.Sound(randomIndex, selectedTrack, scene, null, {
    //     loop: true,
    //     autoplay: true,
    // });

    // var audio = new Audio('https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3');
    // audio.play();

    // var audio = new Audio(selectedTrack);
    // audio.play();
}

function dispose() {
    if (state.modelLoader) {
        state.modelLoader.dispose();
    }
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