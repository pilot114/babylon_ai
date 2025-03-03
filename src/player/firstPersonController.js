import * as BABYLON from '@babylonjs/core';

export class FirstPersonController {
    constructor(scene, canvas) {
        this.scene = scene;
        this.canvas = canvas;
        this.camera = null;
        this.moveSpeed = 10; // Обычная скорость движения
        this.sprintSpeed = 20; // Скорость бега при нажатии Shift
        this.flySpeed = 40; // Скорость в режиме полета (в 2 раза больше sprint)
        this.acceleration = 50; // ускорение старта
        this.deceleration = 50; // ускорение остановки
        this.airControl = 0.2; // Контроль в воздухе (0-1)
        this.jumpForce = 7;
        this.gravity = -9.81;
        this.isGrounded = false;
        this.moveDirection = new BABYLON.Vector3();
        this.inputMap = {};
        this.cameraHeight = 0.1;
        this.maxVerticalVelocity = -20;
        this.capsuleHeight = 1.8;
        this.friction = 4; // Уменьшаем трение для более плавного движения
        this.lastGroundedTime = 0;
        this.coyoteTime = 150;
        this.maxSlopeAngle = 40;
        this.slopeSlowdownFactor = 0.5;
        this.groundNormal = new BABYLON.Vector3(0, 1, 0);
        this.smoothInputVelocity = new BABYLON.Vector3(0, 0, 0);
        this.inputSmoothingFactor = 0.5; // Увеличиваем для более быстрой реакции на ввод
        this.velocitySmoothingFactor = 0.05; // Новый параметр для сглаживания скорости
        this.lastMoveDirection = new BABYLON.Vector3(0, 0, 0); // Сохраняем последнее направление
        this.isSprinting = false; // Флаг для отслеживания бега
        this.isFlying = false; // Флаг режима полета
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
                mass: 70, // Более реалистичная масса человека
                friction: 0.2, // Меньшее трение для более плавного движения
                restitution: 0, // Полностью отключаем отскок
                linearDamping: 0.05, // Минимальное сопротивление для реалистичного падения
                angularDamping: 1.0, // Максимальное сопротивление вращению
            },
            this.scene
        );

        const body = this.camera.physicsAggregate.body;
        
        // Настраиваем физические свойства
        body.setMassProperties({
            inertia: new BABYLON.Vector3(0, 0, 0),
            centerOfMass: new BABYLON.Vector3(0, 0, 0)
        });

        // Устанавливаем нулевые скорости
        // body.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));
        // body.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
    }

    setupInputs() {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            switch (kbInfo.type) {
                case BABYLON.KeyboardEventTypes.KEYDOWN:
                    if (kbInfo.event.key === "Shift") {
                        this.inputMap["shift"] = true;
                    } else if (kbInfo.event.key === "Control") {
                        this.inputMap["control"] = true;
                    } else if (kbInfo.event.key.toLowerCase() === "q") {
                        // Переключаем режим полета при нажатии Q
                        this.isFlying = !this.isFlying;
                        // Сбрасываем вертикальную скорость при включении полета
                        if (this.isFlying && this.camera?.physicsAggregate?.body) {
                            const currentVel = this.camera.physicsAggregate.body.getLinearVelocity();
                            this.camera.physicsAggregate.body.setLinearVelocity(
                                new BABYLON.Vector3(currentVel.x, 0, currentVel.z)
                            );
                        }
                    } else {
                        this.inputMap[kbInfo.event.key.toLowerCase()] = true;
                    }
                    break;
                case BABYLON.KeyboardEventTypes.KEYUP:
                    if (kbInfo.event.key === "Shift") {
                        this.inputMap["shift"] = false;
                    } else if (kbInfo.event.key === "Control") {
                        this.inputMap["control"] = false;
                    } else {
                        this.inputMap[kbInfo.event.key.toLowerCase()] = false;
                    }
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
        const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

        // Проверяем, нажата ли клавиша Shift для бега
        this.isSprinting = this.inputMap["shift"];

        // Выбираем текущую скорость в зависимости от состояния
        let currentMoveSpeed = this.isFlying ? this.flySpeed : (this.isSprinting ? this.sprintSpeed : this.moveSpeed);

        // Получаем направления из поворота камеры
        const rotation = this.camera.rotation;
        const forward = new BABYLON.Vector3(
            Math.sin(rotation.y),
            this.isFlying ? Math.sin(-rotation.x) : 0, // Добавляем вертикальный компонент в режиме полета
            Math.cos(rotation.y)
        );

        const right = new BABYLON.Vector3(
            Math.sin(rotation.y + Math.PI/2),
            0,
            Math.cos(rotation.y + Math.PI/2)
        );

        // Вычисляем желаемое направление движения
        const rawMoveDirection = BABYLON.Vector3.Zero();

        if (this.inputMap["w"]) {
            rawMoveDirection.addInPlace(forward);
        }
        if (this.inputMap["s"]) {
            rawMoveDirection.subtractInPlace(forward);
        }
        if (this.inputMap["d"]) {
            rawMoveDirection.addInPlace(right);
        }
        if (this.inputMap["a"]) {
            rawMoveDirection.subtractInPlace(right);
        }

        // В режиме полета пробел поднимает вверх независимо от направления взгляда
        if (this.isFlying && this.inputMap[" "]) {
            rawMoveDirection.y += 1;
        }

        // Нормализуем направление движения
        if (rawMoveDirection.length() > 0) {
            rawMoveDirection.normalize();
        }

        // Плавно сглаживаем ввод для устранения дерганья
        if (rawMoveDirection.length() === 0 && (this.isGrounded || this.isFlying)) {
            this.smoothInputVelocity = BABYLON.Vector3.Zero();
        } else {
            this.smoothInputVelocity = BABYLON.Vector3.Lerp(
                this.smoothInputVelocity,
                rawMoveDirection,
                this.inputSmoothingFactor
            );
        }

        // В режиме полета игнорируем проверку земли и склона
        if (!this.isFlying) {
            // Проверяем столкновение с землей и получаем нормаль поверхности
            const origin = this.camera.position.subtract(new BABYLON.Vector3(0, this.cameraHeight, 0));
            const ray = new BABYLON.Ray(origin, BABYLON.Vector3.Down(), 1.0);
            const hit = this.scene.pickWithRay(ray);
            
            const wasGrounded = this.isGrounded;
            this.isGrounded = hit.hit;
            const justLanded = !wasGrounded && this.isGrounded;

            if (this.isGrounded && hit.pickedMesh) {
                this.groundNormal = hit.getNormal(true);
                this.groundNormal.normalize();
            } else {
                this.groundNormal = new BABYLON.Vector3(0, 1, 0);
            }

            // Вычисляем угол наклона поверхности
            const slopeAngle = BABYLON.Vector3.Dot(this.groundNormal, BABYLON.Vector3.Up());
            const slopeAngleDegrees = Math.acos(slopeAngle) * (180 / Math.PI);
            const canWalkOnSlope = slopeAngleDegrees <= this.maxSlopeAngle;

            if (this.isGrounded && canWalkOnSlope) {
                this.lastGroundedTime = performance.now();
            }
        }

        // Вычисляем целевую скорость
        const targetVelocity = this.smoothInputVelocity.scale(currentMoveSpeed);

        // Текущая скорость
        let newVelocity;
        
        if (this.isFlying) {
            // В режиме полета используем прямое управление скоростью
            newVelocity = BABYLON.Vector3.Lerp(
                currentVelocity,
                targetVelocity,
                this.acceleration * deltaTime
            );
        } else {
            // В обычном режиме сохраняем текущую логику движения
            const currentHorizontalVelocity = new BABYLON.Vector3(currentVelocity.x, 0, currentVelocity.z);
            let newHorizontalVelocity;

            if (this.smoothInputVelocity.length() > 0) {
                const acceleration = this.isGrounded ? this.acceleration : this.acceleration * this.airControl;
                newHorizontalVelocity = BABYLON.Vector3.Lerp(
                    currentHorizontalVelocity,
                    new BABYLON.Vector3(targetVelocity.x, 0, targetVelocity.z),
                    Math.min(acceleration * deltaTime, 1)
                );
            } else if (this.isGrounded) {
                newHorizontalVelocity = BABYLON.Vector3.Zero();
            } else {
                newHorizontalVelocity = currentHorizontalVelocity.scale(0.99);
            }

            // Применяем гравитацию только в обычном режиме
            let newVerticalVelocity = currentVelocity.y;
            
            if (!this.isGrounded) {
                newVerticalVelocity += this.gravity * deltaTime;
                if (newVerticalVelocity < this.maxVerticalVelocity) {
                    newVerticalVelocity = this.maxVerticalVelocity;
                }
            } else {
                newVerticalVelocity = 0;
            }

            newVelocity = new BABYLON.Vector3(
                newHorizontalVelocity.x,
                newVerticalVelocity,
                newHorizontalVelocity.z
            );
        }

        // Применяем новую скорость
        body.setLinearVelocity(newVelocity);

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