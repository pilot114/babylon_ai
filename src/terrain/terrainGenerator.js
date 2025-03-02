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

        for (let i = 0; i < octaves; i++) {
            height += this.noise(x * frequency, z * frequency) * amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return height;
    }

    createTerrain(scene, options = {}) {
        const width = options.width || 100;
        const length = options.length || 100;
        const roughness = options.roughness || 1;

        const ground = this.createGroundMesh(scene, width, length);
        this.applyPerlinNoise(ground, roughness, width, length);
        this.applyMaterial(ground, scene);

        return ground;
    }

    createGroundMesh(scene, width, length) {
        return BABYLON.MeshBuilder.CreateGround("terrain", {
            width,
            height: length,
            subdivisions: 100
        }, scene);
    }

    applyPerlinNoise(ground, roughness, width, length) {
        const vertices = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const normals = ground.getVerticesData(BABYLON.VertexBuffer.NormalKind);
        
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i] / width * 8;
            const z = vertices[i + 2] / length * 8;
            vertices[i + 1] = this.generateHeight(x, z) * 20 * roughness;
        }

        ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, vertices);
        BABYLON.VertexData.ComputeNormals(vertices, ground.getIndices(), normals);
        ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    }

    applyMaterial(ground, scene) {
        const material = new BABYLON.StandardMaterial("terrainMaterial", scene);
        material.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.3);
        material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        ground.material = material;
    }
} 