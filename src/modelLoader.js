import * as BABYLON from '@babylonjs/core';

export class ModelLoader {
    constructor(scene) {
        this.scene = scene;
        this.loadedModels = new Map();
        this.modelsPath = "/assets/models/";
    }

    /**
     * Создает простое зеркало на сцене
     */
    createMirror(position, size = 5, reflectionLevel = 0.8) {
        // Создаем плоскость для зеркала
        const mirror = BABYLON.MeshBuilder.CreatePlane(
            "mirror", 
            { width: size, height: size, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, 
            this.scene
        );
        
        mirror.position = position;
        
        // Создаем материал для зеркала
        const mirrorMaterial = new BABYLON.StandardMaterial("mirrorMaterial", this.scene);
        mirrorMaterial.backFaceCulling = false;
        
        // Создаем текстуру отражения
        const reflectionTexture = new BABYLON.MirrorTexture(
            "mirrorTexture", 
            1024, 
            this.scene
        );
        
        // Получаем нормаль зеркала
        const normal = new BABYLON.Vector3(0, 0, -1);
        
        // Настраиваем плоскость отражения
        reflectionTexture.mirrorPlane = BABYLON.Plane.FromPositionAndNormal(
            mirror.position,
            normal
        );
        
        // Обновляем плоскость отражения при рендеринге
        this.scene.onBeforeRenderObservable.add(() => {
            // Получаем актуальную нормаль с учетом поворота
            const worldNormal = BABYLON.Vector3.TransformNormal(
                normal,
                mirror.getWorldMatrix()
            );
            
            // Обновляем плоскость отражения
            reflectionTexture.mirrorPlane = BABYLON.Plane.FromPositionAndNormal(
                mirror.position,
                worldNormal
            );
        });
        
        // Добавляем все меши сцены в список отражения
        reflectionTexture.renderList = this.scene.meshes;
        
        // Устанавливаем уровень отражения
        reflectionTexture.level = reflectionLevel;
        
        // Применяем текстуру к материалу
        mirrorMaterial.reflectionTexture = reflectionTexture;
        
        // Применяем материал к зеркалу
        mirror.material = mirrorMaterial;
        
        return mirror;
    }

    async loadAndPlace(fileName, position, scaling, rootMeshIsCollide) {
        
        const result = await BABYLON.ImportMeshAsync(this.modelsPath + fileName, this.scene);
        const rootMesh = result.meshes.find(mesh => mesh.name === "__root__" || mesh.parent === null);
        rootMesh.name = fileName;
        rootMesh.position = position;
        rootMesh.scaling = scaling;

        if (rootMeshIsCollide) {
            result.meshes.forEach(mesh => {
                if (mesh.getTotalVertices() === 0) return;
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
            });
        }
        this.loadedModels.set(fileName, rootMesh);

        return rootMesh;
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