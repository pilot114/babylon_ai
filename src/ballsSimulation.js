import * as BABYLON from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';

export class BallsSimulation {
    constructor(scene) {
        this.scene = scene;
        this.balls = new Set(); // Используем Set вместо массива
        this.spawnInterval = null;
        this.spawnAreaSize = 8; // Размер области спавна шариков
        this.groundHeight = 0; // Добавляем отслеживание высоты поверхности
        this.maxBalls = 50; // Ограничиваем максимальное количество шариков
        this.physicsEnabled = false;
        this.physicsPlugin = null;
    }

    async initialize() {
        try {
            // Инициализируем Havok
            const havokInstance = await HavokPhysics();
            this.physicsPlugin = new BABYLON.HavokPlugin(true, havokInstance);
            
            // Включаем физику в сцене
            const gravityVector = new BABYLON.Vector3(0, -9.81, 0);
            this.scene.enablePhysics(gravityVector, this.physicsPlugin);
            this.physicsEnabled = true;

            // Добавляем обработчик перед рендерингом для проверки шаров
            this.scene.onBeforeRenderObservable.add(() => {
                this.checkBalls();
            });

            return true;
        } catch (error) {
            console.error("Failed to initialize Havok physics:", error);
            throw error;
        }
    }

    addPhysicsToTerrain(ground) {
        if (!this.physicsEnabled) {
            console.error("Physics not yet initialized!");
            return;
        }

        // Сохраняем минимальную высоту поверхности
        const verticesData = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        let minY = Infinity;
        for (let i = 1; i < verticesData.length; i += 3) {
            minY = Math.min(minY, verticesData[i]);
        }
        this.groundHeight = minY;

        // Добавляем физику к поверхности
        const groundAggregate = new BABYLON.PhysicsAggregate(
            ground,
            BABYLON.PhysicsShapeType.BOX,
            { mass: 0, restitution: 0.7, friction: 0.6 },
            this.scene
        );
    }

    checkBalls() {
        for (const ball of this.balls) {
            if (!ball.isDisposed() && ball.position) {
                if (ball.position.y < this.groundHeight - 1 || 
                    ball.position.y > 100 || 
                    isNaN(ball.position.y)) {
                    this.removeBall(ball);
                }
            }
        }
    }

    createBall() {
        if (!this.physicsEnabled || this.balls.size >= this.maxBalls) {
            return;
        }

        try {
            const ball = BABYLON.MeshBuilder.CreateSphere("ball", {
                diameter: 0.3,
                segments: 16
            }, this.scene);

            ball.position = new BABYLON.Vector3(
                (Math.random() - 0.5) * this.spawnAreaSize,
                20,
                (Math.random() - 0.5) * this.spawnAreaSize
            );

            const material = new BABYLON.StandardMaterial("ballMaterial", this.scene);
            material.diffuseColor = new BABYLON.Color3(
                Math.random(),
                Math.random(),
                Math.random()
            );
            ball.material = material;

            // Добавляем физику к шару
            const sphereAggregate = new BABYLON.PhysicsAggregate(
                ball,
                BABYLON.PhysicsShapeType.SPHERE,
                { mass: 1, restitution: 0.7, friction: 0.6 },
                this.scene
            );

            // Сохраняем ссылку на aggregate
            ball.physicsAggregate = sphereAggregate;
            
            this.balls.add(ball);
        } catch (error) {
            console.error("Error creating ball:", error);
        }
    }

    removeBall(ball) {
        if (!ball || ball.isDisposed()) return;

        try {
            if (ball.physicsAggregate) {
                ball.physicsAggregate.dispose();
                ball.physicsAggregate = null;
            }
            if (ball.material) {
                ball.material.dispose();
            }
            this.balls.delete(ball);
            ball.dispose();
        } catch (error) {
            console.error("Error removing ball:", error);
        }
    }

    startSpawning(interval = 500) {
        this.stopSpawning();
        this.spawnInterval = setInterval(() => this.createBall(), interval);
    }

    stopSpawning() {
        if (this.spawnInterval) {
            clearInterval(this.spawnInterval);
            this.spawnInterval = null;
        }
    }

    dispose() {
        this.stopSpawning();
        
        // Очищаем все шары
        for (const ball of this.balls) {
            this.removeBall(ball);
        }
        
        this.balls.clear();
        this.physicsEnabled = false;
        this.physicsPlugin = null;
    }
} 