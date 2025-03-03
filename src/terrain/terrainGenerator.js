import * as BABYLON from '@babylonjs/core';

export class TerrainGenerator {
    constructor() {
        this.initializePerlinNoise();
    }

    initializePerlinNoise() {
        this.permutation = new Array(256).fill(0).map((_, i) => i);
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
        }
        this.p = [...this.permutation, ...this.permutation];
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y, z = 0) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        const A = this.p[X] + Y;
        const AA = this.p[A] + Z;
        const AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y;
        const BA = this.p[B] + Z;
        const BB = this.p[B + 1] + Z;

        return this.lerp(w,
            this.lerp(v,
                this.lerp(u,
                    this.grad(this.p[AA], x, y, z),
                    this.grad(this.p[BA], x - 1, y, z)
                ),
                this.lerp(u,
                    this.grad(this.p[AB], x, y - 1, z),
                    this.grad(this.p[BB], x - 1, y - 1, z)
                )
            ),
            this.lerp(v,
                this.lerp(u,
                    this.grad(this.p[AA + 1], x, y, z - 1),
                    this.grad(this.p[BA + 1], x - 1, y, z - 1)
                ),
                this.lerp(u,
                    this.grad(this.p[AB + 1], x, y - 1, z - 1),
                    this.grad(this.p[BB + 1], x - 1, y - 1, z - 1)
                )
            )
        );
    }

    generateHeight(x, z) {
        let height = 0;
        let amplitude = 1;
        let frequency = 1;
        const persistence = 0.5;
        const octaves = 6;

        // Вычисляем расстояние от центра
        const centerX = 0;
        const centerZ = 0;
        const dx = x - centerX;
        const dz = z - centerZ;
        const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);

        // Определяем размер плоской области
        const flatRadius = 5; // Размер плоской области
        const transitionRadius = 1; // Размер области перехода

        if (distanceFromCenter < flatRadius) {
            // В центральной области возвращаем постоянную высоту
            return 0;
        } else if (distanceFromCenter < flatRadius + transitionRadius) {
            // В области перехода плавно смешиваем плоскую область и шум
            const t = (distanceFromCenter - flatRadius) / transitionRadius;
            const smoothT = t * t * (3 - 2 * t); // Плавная интерполяция

            // Генерируем обычную высоту с шумом Перлина
            for (let i = 0; i < octaves; i++) {
                height += this.noise(x * frequency, z * frequency) * amplitude;
                amplitude *= persistence;
                frequency *= 2;
            }

            // Смешиваем плоскую область и шум
            return height * smoothT;
        } else {
            // За пределами переходной зоны используем обычный шум
            for (let i = 0; i < octaves; i++) {
                height += this.noise(x * frequency, z * frequency) * amplitude;
                amplitude *= persistence;
                frequency *= 2;
            }
            return height;
        }
    }

    createTerrain(scene, options = {}) {
        const width = options.width || 100;
        const length = options.length || 100;
        const roughness = options.roughness || 1;
        const subdivisions = options.subdivisions || 100;

        // Создаем массивы для вершин и индексов
        const positions = [];
        const indices = [];
        const uvs = [];

        // Создаем сетку вершин с применением шума Перлина
        const step = 1;
        const verticesPerRow = subdivisions + 1;

        for (let z = 0; z <= subdivisions; z++) {
            for (let x = 0; x <= subdivisions; x++) {
                // Нормализуем координаты для шума Перлина
                const nx = (x * step / subdivisions) * 8;
                const nz = (z * step / subdivisions) * 8;
                
                // Получаем высоту из шума Перлина
                const height = this.generateHeight(nx, nz) * 20 * roughness;

                // Масштабируем координаты к реальному размеру
                const xPos = (x / subdivisions - 0.5) * width;
                const zPos = (z / subdivisions - 0.5) * length;

                positions.push(xPos, height, zPos);
                uvs.push(x / subdivisions, z / subdivisions);
            }
        }

        // Создаем индексы для треугольников
        for (let z = 0; z < subdivisions; z++) {
            for (let x = 0; x < subdivisions; x++) {
                const baseIdx = z * verticesPerRow + x;
                indices.push(
                    baseIdx, baseIdx + 1, baseIdx + verticesPerRow,
                    baseIdx + 1, baseIdx + verticesPerRow + 1, baseIdx + verticesPerRow
                );
            }
        }

        // Создаем меш
        const ground = new BABYLON.Mesh("terrain", scene);
        
        // Создаем и применяем вертексные данные
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.uvs = uvs;
        
        // Вычисляем нормали для правильного освещения
        const normals = [];
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        vertexData.normals = normals;
        
        vertexData.applyToMesh(ground);

        // Применяем материал
        this.applyMaterial(ground, scene);

        const groundAggregate = new BABYLON.PhysicsAggregate(
            ground,
            BABYLON.PhysicsShapeType.MESH,
            { mass: 0, restitution: 0.7, friction: 0.6 },
            scene
        );

        ground.physicsAggregate = groundAggregate; // Сохраняем ссылку на физический объект
        return ground;
    }

    async applyMaterial(ground, scene) {
        // Создаем базовый материал
        const material = new BABYLON.StandardMaterial("terrainMaterial", scene);

        // Загружаем текстуру травы
        const grassTexture = new BABYLON.Texture("/textures/grass.jpg", scene);

        // Настраиваем масштабирование текстуры
        const textureScale = 128;
        grassTexture.uScale = textureScale;
        grassTexture.vScale = textureScale;

        // Настраиваем материал
        material.diffuseTexture = grassTexture;
        material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        material.specularPower = 32;
        material.ambientColor = new BABYLON.Color3(0.3, 0.3, 0.3);

        // Применяем материал
        ground.material = material;
        ground.receiveShadows = true;
    }
} 