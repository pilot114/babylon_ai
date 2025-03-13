import * as BABYLON from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { BaseSimulation } from './baseSimulation.js';

export class BallsSimulation extends BaseSimulation {
    constructor(scene, options = {}) {
        super(scene);
        this.options = {
            spawnRate: options.spawnRate || 50,
            maxBalls: options.maxBalls || 100,
            spawnHeight: options.spawnHeight || 20,
            spawnAreaSize: options.spawnAreaSize || 30,
            ballSize: options.ballSize || 0.3
        };
        this.spawnInterval = null;
    }

    async initialize() {
        const havokInstance = await HavokPhysics();
        const physicsPlugin = new BABYLON.HavokPlugin(true, havokInstance);
        this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), physicsPlugin);
    }

    createBall() {
        if (this.objects.size >= this.options.maxBalls) return;

        const ball = BABYLON.MeshBuilder.CreateSphere("ball", {
            diameter: this.options.ballSize,
            segments: 16
        }, this.scene);

        ball.position = new BABYLON.Vector3(
            (Math.random() - 0.5) * this.options.spawnAreaSize,
            this.options.spawnHeight,
            (Math.random() - 0.5) * this.options.spawnAreaSize
        );

        ball.material = this.createRandomMaterial();
        ball.physicsAggregate = this.addPhysics(ball);
        this.objects.add(ball);
    }

    createRandomMaterial() {
        const material = new BABYLON.StandardMaterial("ballMaterial", this.scene);
        material.diffuseColor = new BABYLON.Color3(
            Math.random(),
            Math.random(),
            Math.random()
        );
        return material;
    }

    addPhysics(mesh) {
        return new BABYLON.PhysicsAggregate(
            mesh,
            BABYLON.PhysicsShapeType.SPHERE,
            { mass: 1, restitution: 0.7, friction: 0.6 },
            this.scene
        );
    }

    addPhysicsToTerrain(ground) {
        // Физика уже добавлена в TerrainGenerator
        // Просто сохраняем ссылку на землю
        this.ground = ground;
    }

    startSpawning() {
        this.stopSpawning();
        this.spawnInterval = setInterval(() => this.createBall(), this.options.spawnRate);
    }

    stopSpawning() {
        if (this.spawnInterval) {
            clearInterval(this.spawnInterval);
            this.spawnInterval = null;
        }
    }

    dispose() {
        this.stopSpawning();
        super.dispose();
    }
} 