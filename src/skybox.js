import * as BABYLON from '@babylonjs/core';

export class SkyBox {
    constructor(scene) {
        this.scene = scene;
        this.skybox = null;
    }

    create() {
        this.skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, this.scene);
        
        const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
        skyboxMaterial.backFaceCulling = false;
        
        skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(
            "https://assets.babylonjs.com/textures/TropicalSunnyDay",
            this.scene
        );
        
        skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.disableLighting = true;
        
        this.skybox.material = skyboxMaterial;
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