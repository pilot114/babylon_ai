import * as BABYLON from '@babylonjs/core';
import { TerrainGenerator } from './terrainGenerator.js';
import { BallsSimulation } from './ballsSimulation.js';
import { GameGUI } from './gui.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById("renderCanvas");
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = null;
        this.terrainGenerator = new TerrainGenerator();
        this.ballsSimulation = null;
        this.gui = null;
        
        // Привязываем метод render к текущему контексту
        this.render = this.render.bind(this);
    }

    async createScene() {
        const scene = new BABYLON.Scene(this.engine);
        
        const camera = new BABYLON.ArcRotateCamera(
            "camera",
            0,
            Math.PI / 3,
            50,
            BABYLON.Vector3.Zero(),
            scene
        );
        camera.attachControl(this.canvas, true);

        const light = new BABYLON.HemisphericLight(
            "light",
            new BABYLON.Vector3(0, 1, 0),
            scene
        );

        // Инициализируем симуляцию шариков до создания объектов
        this.ballsSimulation = new BallsSimulation(scene);
        await this.ballsSimulation.initialize();

        // Даем дополнительное время на инициализацию
        await new Promise(resolve => setTimeout(resolve, 100));

        // Создаем ландшафт используя генератор
        const ground = this.terrainGenerator.createTerrain(scene, {
            width: 30,
            length: 30,
            roughness: 2.0
        });

        // Добавляем физику к ландшафту
        this.ballsSimulation.addPhysicsToTerrain(ground);
        this.ballsSimulation.startSpawning(500);

        this.scene = scene;
        
        // Инициализируем GUI
        this.gui = new GameGUI(scene);
        this.gui.initialize();

        return scene;
    }

    render() {
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    async start() {
        await this.createScene();
        this.render();
    }
}