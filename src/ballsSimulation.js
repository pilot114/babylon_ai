import * as BABYLON from '@babylonjs/core';

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
        this.physicsEnabled = false;
    }

    async initialize() {
        try {
            // Ждем загрузки Havok
            const havokInstance = await window.HavokPhysics();
            
            // Создаем плагин физики
            const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
            
            // Включаем физику в сцене
            this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), havokPlugin);
            
            // Даем время на инициализацию
            await new Promise(resolve => setTimeout(resolve, 100));
            
            this.physicsEnabled = true;
            this.setupMonitoring();

            return true;
        } catch (error) {
            console.error("Failed to initialize Havok physics:", error);
            throw error;
        }
    }

    setupMonitoring() {
        this.monitorInterval = setInterval(() => {
            console.log(`Количество шариков в сцене: ${this.balls.length}`);
        }, 1000);

        this.cleanupInterval = setInterval(() => {
            this.cleanupOldBalls();
        }, 5000);
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

        // Создаем статичный импостор для земли
        ground.physicsImpostor = new BABYLON.PhysicsImpostor(
            ground,
            BABYLON.PhysicsImpostor.PlaneImpostor,
            { 
                mass: 0,
                friction: 0.2,
                restitution: 0.3
            },
            this.scene
        );
    }

    cleanupOldBalls() {
        // Удаляем старые шарики, если их слишком много
        if (this.balls.length > this.maxBalls * 0.8) { // Если больше 80% от максимума
            const ballsToRemove = this.balls.slice(0, 10); // Удаляем 10 старейших шариков
            ballsToRemove.forEach(ball => {
                if (ball.physicsImpostor) {
                    ball.physicsImpostor.dispose();
                }
                ball.dispose();
            });
            this.balls = this.balls.filter(b => !ballsToRemove.includes(b));
        }
    }

    createBall() {
        if (!this.physicsEnabled) {
            console.error("Physics not yet initialized!");
            return;
        }

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

        // Упрощенные параметры физики для шарика
        ball.physicsImpostor = new BABYLON.PhysicsImpostor(
            ball,
            BABYLON.PhysicsImpostor.SphereImpostor,
            { 
                mass: 1,
                friction: 0.2,
                restitution: 0.3
            },
            this.scene
        );

        this.balls.push(ball);

        // Обновляем проверку позиции
        ball.onAfterWorldMatrixUpdateObservable.add(() => {
            if (ball.position.y < this.groundHeight - 1 || 
                ball.position.y > 100 || 
                isNaN(ball.position.y)) {
                
                if (ball.physicsImpostor) {
                    ball.physicsImpostor.dispose();
                }
                ball.dispose();
                this.balls = this.balls.filter(b => b !== ball);
            }
        });
    }

    startSpawning(interval = 500) {
        if (this.spawnInterval) {
            this.stopSpawning();
        }
        
        this.spawnInterval = setInterval(() => {
            if (this.balls.length < this.maxBalls) {
                this.createBall();
            }
        }, interval);
    }

    stopSpawning() {
        if (this.spawnInterval) {
            clearInterval(this.spawnInterval);
            this.spawnInterval = null;
        }
    }

    cleanup() {
        this.stopSpawning();
        // Останавливаем мониторинг
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        this.balls.forEach(ball => {
            if (ball.physicsImpostor) {
                ball.physicsImpostor.dispose();
            }
            ball.dispose();
        });
        this.balls = [];
    }
} 