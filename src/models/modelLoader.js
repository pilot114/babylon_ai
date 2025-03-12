import * as BABYLON from '@babylonjs/core';
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";

registerBuiltInLoaders();

export class ModelLoader {
    constructor(scene) {
        this.scene = scene;
        this.loadedModels = new Map();
        this.modelsPath = "/models/";
    }

    /**
     * Загружает и размещает модель на сцене
     */
    async loadAndPlace(fileName, position, options = {}) {

        await BABYLON.AppendSceneAsync(this.modelsPath + fileName, this.scene, {
            position,
            scale: 10,
            rotation: new BABYLON.Vector3(0, 0, 0),
            physics: true,
            physicsShape: "BOX"
        });
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