import * as BABYLON from '@babylonjs/core';

export class SkyBox {
    constructor(scene) {
        this.scene = scene;
        this.skybox = null;
    }

    create() {
        // Создаем меш для skybox
        this.skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, this.scene);
        
        // Создаем материал для skybox
        const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
        skyboxMaterial.backFaceCulling = false;
        
        // Используем встроенную текстуру TropicalSunnyDay из библиотеки
        skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(
            "https://assets.babylonjs.com/textures/TropicalSunnyDay",
            this.scene
        );
        
        skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.disableLighting = true;
        
        // Применяем материал
        this.skybox.material = skyboxMaterial;

        // Делаем skybox бесконечно далеким от камеры
        this.skybox.infiniteDistance = true;
    }

    dispose() {
        if (this.skybox) {
            if (this.skybox.material) {
                if (this.skybox.material.reflectionTexture) {
                    this.skybox.material.reflectionTexture.dispose();
                }
                this.skybox.material.dispose();
            }
            this.skybox.dispose();
            this.skybox = null;
        }
    }
} 