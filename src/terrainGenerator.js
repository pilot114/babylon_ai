import * as BABYLON from '@babylonjs/core';

export class TerrainGenerator {
    constructor() {
        // Инициализация таблицы перестановок для шума Перлина
        this.p = new Array(512);
        const permutation = [...Array(256)].map((_, i) => i);
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
        }
        for (let i = 0; i < 512; i++) {
            this.p[i] = permutation[i & 255];
        }
    }

    createTerrain(scene, options = {}) {
        const width = options.width || 100;
        const length = options.length || 100;
        const roughness = options.roughness || 1;

        // Создаем сетку для ландшафта
        const ground = new BABYLON.GroundBuilder.CreateGround("terrain", {
            width: width,
            height: length,
            subdivisions: 100
        }, scene);

        // Создаем материал
        const groundMaterial = new BABYLON.StandardMaterial("terrainMaterial", scene);
        groundMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.3);
        groundMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        ground.material = groundMaterial;

        // Получаем вершины для модификации
        const vertices = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const normals = ground.getVerticesData(BABYLON.VertexBuffer.NormalKind);
        
        const baseScale = 20; // Базовый масштаб высоты
        
        // Применяем шум Перлина для создания рельефа
        for (let i = 0; i < vertices.length; i += 3) {
            // Увеличиваем масштаб координат для более детального рельефа
            const x = vertices[i] / width * 8;
            const z = vertices[i + 2] / length * 8;
            
            let height = 0;
            let amplitude = 1;
            let frequency = 1;
            
            // Используем больше октав для более детального рельефа
            for (let octave = 0; octave < 6; octave++) {
                height += amplitude * this.noise(x * frequency, z * frequency);
                amplitude *= 0.5;
                frequency *= 2;
            }
            
            // Применяем базовый масштаб и roughness
            vertices[i + 1] = height * baseScale * roughness;
        }

        // Обновляем геометрию и нормали
        ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, vertices);
        BABYLON.VertexData.ComputeNormals(vertices, ground.getIndices(), normals);
        ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
        ground.computeWorldMatrix(true);

        return ground;
    }

    noise(x, z) {
        const X = Math.floor(x) & 255;
        const Z = Math.floor(z) & 255;
        x -= Math.floor(x);
        z -= Math.floor(z);
        
        const u = this.fade(x);
        const w = this.fade(z);
        
        const A = this.p[X] + Z;
        const B = this.p[X + 1] + Z;
        
        return this.lerp(w,
            this.lerp(u,
                this.grad(this.p[A], x, z),
                this.grad(this.p[B], x - 1, z)
            ),
            this.lerp(u,
                this.grad(this.p[A + 1], x, z - 1),
                this.grad(this.p[B + 1], x - 1, z - 1)
            )
        );
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, z) {
        const h = hash & 15;
        const grad = 1 + (h & 7);
        return ((h & 8) ? -grad : grad) * x + ((h & 4) ? -grad : grad) * z;
    }
}