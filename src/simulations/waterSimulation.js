import * as BABYLON from '@babylonjs/core';

export class WaterSimulation {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.waterParticles = new Set();
        this.spawnInterval = null;
        this.particleSystem = null;

        // Настройки по умолчанию
        this.options = {
            spawnRate: options.spawnRate || 30,
            maxParticles: options.maxParticles || 2000,
            spawnPoint: options.spawnPoint || new BABYLON.Vector3(0, 20, 0),
            particleSize: options.particleSize || 0.08,
            spawnRadius: options.spawnRadius || 0.2,
            physics: {
                mass: options.physics?.mass || 0.02,
                restitution: options.physics?.restitution || 0.1,
                friction: options.physics?.friction || 0.95
            }
        };

        this.groundHeight = 0;

        // Добавляем параметры для поверхности воды
        this.waterSurface = null;
        this.waterSurfaceVertices = [];
        this.gridSize = 32; // Размер сетки для поверхности
        this.surfaceUpdateInterval = null;
    }

    initialize() {
        // Создаем систему частиц для визуального эффекта воды
        this.particleSystem = new BABYLON.ParticleSystem("waterParticles", 2000, this.scene);
        
        // Настройка эмиттера
        this.particleSystem.emitter = this.options.spawnPoint;
        this.particleSystem.minEmitBox = new BABYLON.Vector3(-0.2, 0, -0.2);
        this.particleSystem.maxEmitBox = new BABYLON.Vector3(0.2, 0, 0.2);

        // Настройка внешнего вида частиц
        this.particleSystem.color1 = new BABYLON.Color4(0.6, 0.8, 1.0, 0.4);
        this.particleSystem.color2 = new BABYLON.Color4(0.3, 0.5, 1.0, 0.4);
        this.particleSystem.colorDead = new BABYLON.Color4(0.3, 0.6, 1.0, 0);

        // Размер частиц
        this.particleSystem.minSize = 0.03;
        this.particleSystem.maxSize = 0.08;

        // Время жизни частиц
        this.particleSystem.minLifeTime = 1;
        this.particleSystem.maxLifeTime = 2;

        // Скорость эмиссии
        this.particleSystem.emitRate = 200;

        // Режим смешивания
        this.particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

        // Гравитация и направление
        this.particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);
        this.particleSystem.direction1 = new BABYLON.Vector3(-0.1, -1, -0.1);
        this.particleSystem.direction2 = new BABYLON.Vector3(0.1, -1, 0.1);

        // Сила эмиссии
        this.particleSystem.minEmitPower = 1;
        this.particleSystem.maxEmitPower = 2;

        // Обновление частиц
        this.particleSystem.updateSpeed = 0.01;

        this.particleSystem.start();

        // Создаем общий материал для капель воды
        this.waterMaterial = new BABYLON.StandardMaterial("waterMaterial", this.scene);
        this.waterMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.9);
        this.waterMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
        this.waterMaterial.specularPower = 128;
        this.waterMaterial.alpha = 0.4;
        this.waterMaterial.backFaceCulling = false;
        
        // Настройка прозрачности
        this.waterMaterial.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        this.waterMaterial.separateCullingPass = true;

        // Добавляем fresnel эффект
        this.waterMaterial.reflectionFresnelParameters = new BABYLON.FresnelParameters();
        this.waterMaterial.reflectionFresnelParameters.bias = 0.1;
        this.waterMaterial.reflectionFresnelParameters.power = 2;
        this.waterMaterial.reflectionFresnelParameters.leftColor = BABYLON.Color3.White();
        this.waterMaterial.reflectionFresnelParameters.rightColor = BABYLON.Color3.Black();

        this.scene.onBeforeRenderObservable.add(() => {
            this.checkParticles();
        });

        // Создаем поверхность воды
        this.createWaterSurface();
        
        // Обновляем поверхность воды каждые 16мс (примерно 60fps)
        this.surfaceUpdateInterval = setInterval(() => this.updateWaterSurface(), 16);
    }

    createWaterDrop() {
        if (this.waterParticles.size >= this.options.maxParticles) return;

        try {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * this.options.spawnRadius;
            const offsetX = Math.cos(angle) * radius;
            const offsetZ = Math.sin(angle) * radius;

            // Создаем каплю как маленький цилиндр
            const drop = BABYLON.MeshBuilder.CreateCylinder("waterDrop", {
                height: this.options.particleSize * 0.5,
                diameter: this.options.particleSize,
                tessellation: 8,
                subdivisions: 1
            }, this.scene);

            // Поворачиваем случайным образом для разнообразия
            drop.rotation.x = Math.random() * Math.PI * 0.1;
            drop.rotation.z = Math.random() * Math.PI * 0.1;

            drop.position = new BABYLON.Vector3(
                this.options.spawnPoint.x + offsetX,
                this.options.spawnPoint.y,
                this.options.spawnPoint.z + offsetZ
            );

            // Используем общий материал
            drop.material = this.waterMaterial;

            // Добавляем физику с размерами цилиндра
            const dropAggregate = new BABYLON.PhysicsAggregate(
                drop,
                BABYLON.PhysicsShapeType.CYLINDER,
                {
                    mass: this.options.physics.mass,
                    restitution: this.options.physics.restitution,
                    friction: this.options.physics.friction
                },
                this.scene
            );

            drop.physicsAggregate = dropAggregate;
            this.waterParticles.add(drop);

        } catch (error) {
            console.error("Error creating water drop:", error);
        }
    }

    checkParticles() {
        for (const drop of this.waterParticles) {
            if (!drop.isDisposed() && drop.position) {
                if (drop.position.y < this.groundHeight - 1 || 
                    drop.position.y > 100 || 
                    isNaN(drop.position.y)) {
                    this.removeParticle(drop);
                }
            }
        }
    }

    removeParticle(drop) {
        if (!drop || drop.isDisposed()) return;

        try {
            if (drop.physicsAggregate) {
                drop.physicsAggregate.dispose();
                drop.physicsAggregate = null;
            }
            if (drop.material) {
                drop.material.dispose();
            }
            this.waterParticles.delete(drop);
            drop.dispose();
        } catch (error) {
            console.error("Error removing water drop:", error);
        }
    }

    startSpawning() {
        this.stopSpawning();
        this.spawnInterval = setInterval(() => this.createWaterDrop(), this.options.spawnRate);
    }

    stopSpawning() {
        if (this.spawnInterval) {
            clearInterval(this.spawnInterval);
            this.spawnInterval = null;
        }
    }

    setGroundHeight(height) {
        this.groundHeight = height;
    }

    createWaterSurface() {
        // Создаем сетку вершин
        const positions = [];
        const indices = [];
        const uvs = [];

        // Создаем плоскую сетку
        const size = 30; // Размер поверхности
        const step = size / this.gridSize;

        for (let z = 0; z <= this.gridSize; z++) {
            for (let x = 0; x <= this.gridSize; x++) {
                positions.push(
                    x * step - size / 2,
                    0,
                    z * step - size / 2
                );
                uvs.push(x / this.gridSize, z / this.gridSize);
            }
        }

        // Создаем индексы для треугольников
        for (let z = 0; z < this.gridSize; z++) {
            for (let x = 0; x < this.gridSize; x++) {
                const baseIdx = z * (this.gridSize + 1) + x;
                indices.push(
                    baseIdx, baseIdx + 1, baseIdx + this.gridSize + 1,
                    baseIdx + 1, baseIdx + this.gridSize + 2, baseIdx + this.gridSize + 1
                );
            }
        }

        // Создаем меш
        this.waterSurface = new BABYLON.Mesh("waterSurface", this.scene);
        
        // Создаем вертексные данные
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.uvs = uvs;
        
        // Применяем к мешу
        vertexData.applyToMesh(this.waterSurface);

        // Создаем материал для поверхности воды
        const surfaceMaterial = new BABYLON.StandardMaterial("waterSurfaceMaterial", this.scene);
        surfaceMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.9);
        surfaceMaterial.alpha = 0.6;
        surfaceMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
        surfaceMaterial.specularPower = 32;
        surfaceMaterial.backFaceCulling = false;
        
        // Настройка прозрачности
        surfaceMaterial.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        surfaceMaterial.separateCullingPass = true;

        this.waterSurface.material = surfaceMaterial;
    }

    updateWaterSurface() {
        if (!this.waterSurface || !this.waterSurface.isReady()) return;

        const positions = this.waterSurface.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        if (!positions) return;

        // Обновляем высоту каждой вершины на основе близости капель
        for (let i = 0; i < positions.length; i += 3) {
            let height = 0;
            const vertexX = positions[i];
            const vertexZ = positions[i + 2];

            // Влияние каждой капли на высоту поверхности
            for (const drop of this.waterParticles) {
                if (!drop.isDisposed() && drop.position) {
                    const dx = drop.position.x - vertexX;
                    const dz = drop.position.z - vertexZ;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    // Радиус влияния капли
                    const influence = Math.max(0, 1 - distance / 2);
                    height += influence * 0.5;
                }
            }

            positions[i + 1] = height;
        }

        // Обновляем позиции вершин
        this.waterSurface.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        
        // Обновляем нормали для правильного освещения
        BABYLON.VertexData.ComputeNormals(
            positions,
            this.waterSurface.getIndices(),
            this.waterSurface.getVerticesData(BABYLON.VertexBuffer.NormalKind)
        );
    }

    dispose() {
        this.stopSpawning();
        
        if (this.particleSystem) {
            this.particleSystem.dispose();
        }
        
        if (this.waterMaterial) {
            this.waterMaterial.dispose();
        }

        for (const drop of this.waterParticles) {
            this.removeParticle(drop);
        }
        
        this.waterParticles.clear();

        if (this.surfaceUpdateInterval) {
            clearInterval(this.surfaceUpdateInterval);
        }
        
        if (this.waterSurface) {
            this.waterSurface.dispose();
        }
    }
} 