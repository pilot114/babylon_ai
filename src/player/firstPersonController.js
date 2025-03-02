import * as BABYLON from '@babylonjs/core';

export class FirstPersonController {
    constructor(scene, canvas) {
        this.scene = scene;
        this.canvas = canvas;
        this.camera = null;
        this.moveSpeed = 10;
        this.jumpForce = 5;
        this.gravity = -9.81;
        this.isGrounded = false;
        this.moveDirection = new BABYLON.Vector3();
        this.inputMap = {};
        this.cameraHeight = 0.1;
        this.maxVerticalVelocity = -20;
        this.capsuleHeight = 1.8;
    }

    async initialize() {
        await this.setupCamera();
        this.setupInputs();
    }

    async setupCamera() {
        this.camera = new BABYLON.FreeCamera(
            "fpCamera",
            new BABYLON.Vector3(0, this.capsuleHeight, 0),
            this.scene
        );
        
        this.camera.attachControl(this.canvas, true);
        this.camera.minZ = 0.1;
        this.camera.angularSensibility = 1000;
        this.camera.inertia = 0;
        this.camera.inputs.removeByType("FreeCameraKeyboardMoveInput");

        const mouseSensitivity = 10.0;
        this.camera.inputs.attached.mouse.sensitivity = mouseSensitivity;
        this.camera.inputs.attached.mouse.inertia = 0;

        const collider = BABYLON.MeshBuilder.CreateCapsule(
            "cameraCollider",
            { 
                height: this.capsuleHeight,
                radius: 0.3,
            },
            this.scene
        );
        collider.isVisible = false;
        collider.position = new BABYLON.Vector3(0, this.capsuleHeight - this.cameraHeight, 0);

        this.camera.physicsAggregate = new BABYLON.PhysicsAggregate(
            collider,
            BABYLON.PhysicsShapeType.CAPSULE,
            { 
                mass: 50,
                friction: 0.5,
                restitution: 0,
                linearDamping: 0.5,
                angularDamping: 1.0,
                constraintSleepingThreshold: 0.1,
                enabledRotation: false
            },
            this.scene
        );

        const body = this.camera.physicsAggregate.body;
        
        // Настраиваем физические свойства
        body.setMassProperties({
            inertia: new BABYLON.Vector3(0, 0, 0),
            centerOfMass: new BABYLON.Vector3(0, 0, 0),
            restitution: 0,
        });

        // Устанавливаем нулевые скорости
        // body.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));
        // body.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
    }

    setupInputs() {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            switch (kbInfo.type) {
                case BABYLON.KeyboardEventTypes.KEYDOWN:
                    this.inputMap[kbInfo.event.key.toLowerCase()] = true;
                    break;
                case BABYLON.KeyboardEventTypes.KEYUP:
                    this.inputMap[kbInfo.event.key.toLowerCase()] = false;
                    break;
            }
        });

        this.canvas.addEventListener("click", () => {
            this.canvas.requestPointerLock();
        });

        this.scene.onBeforeRenderObservable.add(() => {
            this.updateMovement();
        });
    }

    updateMovement() {
        if (!this.camera?.physicsAggregate?.body) return;

        const body = this.camera.physicsAggregate.body;
        const currentVelocity = body.getLinearVelocity();

        // Ограничиваем максимальную скорость падения
        if (currentVelocity.y < this.maxVerticalVelocity) {
            currentVelocity.y = this.maxVerticalVelocity;
            body.setLinearVelocity(currentVelocity);
        }

        // Получаем направления из поворота камеры
        const rotation = this.camera.rotation;
        const forward = new BABYLON.Vector3(
            Math.sin(rotation.y),
            0,
            Math.cos(rotation.y)
        );

        const right = new BABYLON.Vector3(
            Math.sin(rotation.y + Math.PI/2),
            0,
            Math.cos(rotation.y + Math.PI/2)
        );

        // Вычисляем направление движения
        const moveDirection = BABYLON.Vector3.Zero();

        if (this.inputMap["w"]) {
            moveDirection.addInPlace(forward);
        }
        if (this.inputMap["s"]) {
            moveDirection.subtractInPlace(forward);
        }
        if (this.inputMap["d"]) {
            moveDirection.addInPlace(right);
        }
        if (this.inputMap["a"]) {
            moveDirection.subtractInPlace(right);
        }

        // Применяем движение
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
            moveDirection.scaleInPlace(this.moveSpeed);

            // Сохраняем текущую вертикальную скорость
            const verticalVelocity = currentVelocity.y;
            
            // Применяем горизонтальное движение
            currentVelocity.x = moveDirection.x;
            currentVelocity.z = moveDirection.z;
            currentVelocity.y = verticalVelocity;

            body.setLinearVelocity(currentVelocity);
        } else if (this.isGrounded) {
            // Останавливаем горизонтальное движение на земле
            currentVelocity.x = 0;
            currentVelocity.z = 0;
            body.setLinearVelocity(currentVelocity);
        }

        // Проверяем столкновение с землей
        const origin = this.camera.position.subtract(new BABYLON.Vector3(0, this.cameraHeight, 0));
        const ray = new BABYLON.Ray(origin, BABYLON.Vector3.Down(), 1.0);
        const hit = this.scene.pickWithRay(ray);
        
        const wasGrounded = this.isGrounded;
        this.isGrounded = hit.hit;

        // Обработка приземления
        if (!wasGrounded && this.isGrounded) {
            currentVelocity.y = 0;
            body.setLinearVelocity(currentVelocity);
        }

        // Обработка прыжка
        if (this.inputMap[" "] && this.isGrounded) {
            currentVelocity.y = this.jumpForce;
            body.setLinearVelocity(currentVelocity);
            this.isGrounded = false;
        }

        // Обновляем позицию камеры
        const bodyPosition = this.camera.physicsAggregate.transformNode.position;
        this.camera.position.copyFrom(bodyPosition);
        this.camera.position.y += this.cameraHeight;
    }

    dispose() {
        if (this.camera) {
            if (this.camera.physicsAggregate) {
                this.camera.physicsAggregate.dispose();
            }
            this.camera.dispose();
        }
    }
} 