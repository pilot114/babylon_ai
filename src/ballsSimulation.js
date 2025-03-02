import * as BABYLON from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';

export class BallsSimulation {
    constructor(scene) {
        this.scene = scene;
        this.balls = [];
        this.spawnInterval = null;
        this.spawnAreaSize = 8; // Размер области спавна шариков
        this.monitorInterval = null;
        this.groundHeight = 0; // Добавляем отслеживание высоты поверхности
        this.maxBalls = 50; // Ограничиваем максимальное количество шариков
        this.cleanupInterval = null; // Интервал для периодической очистки
    }

    async initialize() {
        try {
            // Инициализируем Havok
            const havokInstance = await HavokPhysics();
            const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
            
            // Включаем физику в сцене
            const gravityVector = new BABYLON.Vector3(0, -9.81, 0);
            this.scene.enablePhysics(gravityVector, havokPlugin);

            return true;
        } catch (error) {
            console.error("Failed to initialize Havok physics:", error);
            throw error;
        }
    }

    addPhysicsToTerrain(ground) {
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

    createBall() {
        if (this.balls.length >= this.maxBalls) {
            return;
        }

        const x = (Math.random() - 0.5) * this.spawnAreaSize;
        const z = (Math.random() - 0.5) * this.spawnAreaSize;
        const y = 20;

        const ball = BABYLON.MeshBuilder.CreateSphere("ball", {
            diameter: 0.3,
            segments: 16
        }, this.scene);

        ball.position = new BABYLON.Vector3(x, y, z);

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

        this.balls.push(ball);

        // Обновляем проверку позиции
        ball.onAfterWorldMatrixUpdateObservable.add(() => {
            if (ball.position.y < this.groundHeight - 1 || 
                ball.position.y > 100 || 
                isNaN(ball.position.y)) {
                
                if (sphereAggregate) {
                    sphereAggregate.dispose();
                }
                ball.dispose();
                this.balls = this.balls.filter(b => b !== ball);
            }
        });
    }

    startSpawning(interval = 500) {
        if (this.spawnInterval) {
            clearInterval(this.spawnInterval);
        }
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
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.balls.forEach(ball => {
            if (ball.physicsAggregate) {
                ball.physicsAggregate.dispose();
            }
            ball.dispose();
        });
        this.balls = [];
    }
} 