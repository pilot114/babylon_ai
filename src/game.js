import * as BABYLON from '@babylonjs/core';
import { TerrainGenerator } from './terrain/terrainGenerator.js';
import { BallsSimulation } from './simulations/ballsSimulation.js';
import { GameGUI } from './ui/gui.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById("renderCanvas");
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = null;
        this.terrainGenerator = new TerrainGenerator();
        this.ballsSimulation = null;
        this.gui = null;
    }

    async createScene() {
        this.scene = new BABYLON.Scene(this.engine);
        this.setupCamera();
        this.setupLighting();
        await this.setupSimulations();
        this.setupGUI();
        return this.scene;
    }

    setupCamera() {
        const camera = new BABYLON.ArcRotateCamera(
            "camera", 0, Math.PI / 3, 40,
            BABYLON.Vector3.Zero(), this.scene
        );
        camera.attachControl(this.canvas, true);
    }

    setupLighting() {
        new BABYLON.HemisphericLight(
            "light",
            new BABYLON.Vector3(0, 1, 0),
            this.scene
        );
    }

    async setupSimulations() {
        this.ballsSimulation = new BallsSimulation(this.scene);
        await this.ballsSimulation.initialize();

        const ground = this.terrainGenerator.createTerrain(this.scene, {
            width: 30,
            length: 30,
            roughness: 2.0
        });

        this.ballsSimulation.addPhysicsToTerrain(ground);
        this.ballsSimulation.startSpawning();
    }

    setupGUI() {
        this.gui = new GameGUI(this.scene);
        this.gui.initialize();
    }

    render() {
        this.engine.runRenderLoop(() => this.scene.render());
        window.addEventListener("resize", () => this.engine.resize());
    }

    async start() {
        await this.createScene();
        this.render();
    }
}