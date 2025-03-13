import * as BABYLON from '@babylonjs/core';
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";

registerBuiltInLoaders();

export class ModelLoader {
    constructor(scene) {
        this.scene = scene;
        this.loadedModels = new Map();
        this.modelsPath = "/models/";``
    }

    async loadAndPlace(fileName, position, scaling, rootMeshIsCollide) {
        
        const result = await BABYLON.ImportMeshAsync(this.modelsPath + fileName, this.scene);
        const rootMesh = result.meshes.find(mesh => mesh.name === "__root__" || mesh.parent === null);
        rootMesh.name = fileName;
        rootMesh.position = position;
        rootMesh.scaling = scaling;

        if (rootMeshIsCollide) {
            result.meshes.forEach(mesh => {
                if (mesh.getTotalVertices() > 0) {
                    new BABYLON.PhysicsAggregate(
                        mesh,
                        BABYLON.PhysicsImpostor.MeshImpostor,
                        { 
                            mass: 0,
                            friction: 0.2,
                            restitution: 0.2
                        },
                        this.scene
                    );
                }
            });
        }
    }

    clearCache() {
        this.loadedModels.clear();
    }

    dispose() {
        for (const model of this.loadedModels.values()) {
            if (model.physicsAggregate) model.physicsAggregate.dispose();
            model.dispose();
        }
        this.loadedModels.clear();
    }
} 