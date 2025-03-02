import * as BABYLON from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';

export class BasicPhysicsDemo {
    constructor(canvas) {
        this.canvas = canvas;
        this.engine = new BABYLON.Engine(canvas, true);
        this.scene = null;
        this.spheres = [];
    }

    async initialize() {
        try {
            // Создаем сцену
            this.scene = new BABYLON.Scene(this.engine);

            // Настраиваем камеру
            const camera = new BABYLON.ArcRotateCamera(
                "camera",
                0,
                Math.PI / 3,
                10,
                BABYLON.Vector3.Zero(),
                this.scene
            );
            camera.attachControl(this.canvas, true);

            // Добавляем свет
            const light = new BABYLON.HemisphericLight(
                "light",
                new BABYLON.Vector3(0, 1, 0),
                this.scene
            );

            // Инициализируем Havok до создания физических объектов
            const havokInstance = await HavokPhysics();
            const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
            
            // Включаем физику в сцене
            const gravityVector = new BABYLON.Vector3(0, -9.81, 0);
            this.scene.enablePhysics(gravityVector, havokPlugin);

            // Создаем плоскость для пола
            const ground = BABYLON.MeshBuilder.CreateBox(
                "ground",
                { width: 6, height: 0.1, depth: 6 },
                this.scene
            );
            ground.position.y = -0.05;

            // Материал для пола
            const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", this.scene);
            groundMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
            ground.material = groundMaterial;

            // Добавляем физику к полу
            const groundAggregate = new BABYLON.PhysicsAggregate(
                ground, 
                BABYLON.PhysicsShapeType.BOX,
                { mass: 0, restitution: 0.7, friction: 0.6 },
                this.scene
            );

            // Добавляем кнопку для создания шаров
            this.setupUI();

            // Запускаем рендеринг
            this.engine.runRenderLoop(() => {
                this.scene.render();
            });

            // Обработка изменения размера окна
            window.addEventListener("resize", () => {
                this.engine.resize();
            });

        } catch (error) {
            console.error("Failed to initialize demo:", error);
            throw error;
        }
    }

    setupUI() {
        const button = document.createElement('button');
        button.textContent = 'Создать шар';
        button.style.position = 'absolute';
        button.style.top = '20px';
        button.style.left = '20px';
        button.style.padding = '10px';
        document.body.appendChild(button);

        button.addEventListener('click', () => this.createSphere());
    }

    createSphere() {
        // Создаем сферу
        const sphere = BABYLON.MeshBuilder.CreateSphere(
            "sphere",
            { diameter: 0.5 },
            this.scene
        );

        // Случайная позиция над полом
        sphere.position = new BABYLON.Vector3(
            (Math.random() - 0.5) * 4,
            5,
            (Math.random() - 0.5) * 4
        );

        // Случайный цвет
        const material = new BABYLON.StandardMaterial("sphereMaterial", this.scene);
        material.diffuseColor = new BABYLON.Color3(
            Math.random(),
            Math.random(),
            Math.random()
        );
        sphere.material = material;

        // Добавляем физику к сфере
        const sphereAggregate = new BABYLON.PhysicsAggregate(
            sphere,
            BABYLON.PhysicsShapeType.SPHERE,
            { mass: 1, restitution: 0.7, friction: 0.6 },
            this.scene
        );

        this.spheres.push(sphere);
    }
} 