import * as BABYLON from '@babylonjs/core';

export class FirstPersonController {
    constructor(scene, canvas) {
        this.scene = scene;
        this.canvas = canvas;
        this.camera = null;
        this.moveSpeed = 10; // Обычная скорость движения
        this.sprintSpeed = 20; // Скорость бега при нажатии Shift
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
                    // Обрабатываем Shift для бега
                    if (kbInfo.event.key === "Shift") {
                        this.inputMap["shift"] = true;
                    } else {
                        this.inputMap[kbInfo.event.key.toLowerCase()] = true;
                    }
                    break;
                case BABYLON.KeyboardEventTypes.KEYUP:
                    // Обрабатываем Shift для бега
                    if (kbInfo.event.key === "Shift") {
                        this.inputMap["shift"] = false;
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

        // Выбираем текущую скорость в зависимости от состояния бега
        const currentMoveSpeed = this.isSprinting ? this.sprintSpeed : this.moveSpeed;

        // Проверяем столкновение с землей и получаем нормаль поверхности
        const origin = this.camera.position.subtract(new BABYLON.Vector3(0, this.cameraHeight, 0));
        const ray = new BABYLON.Ray(origin, BABYLON.Vector3.Down(), 1.0);
        const hit = this.scene.pickWithRay(ray);
        
        const wasGrounded = this.isGrounded;
        this.isGrounded = hit.hit;

        // Обнаруживаем момент приземления
        const justLanded = !wasGrounded && this.isGrounded;

        // Обновляем нормаль поверхности
        if (this.isGrounded && hit.pickedMesh) {
            this.groundNormal = hit.getNormal(true);
            this.groundNormal.normalize();
        } else {
            this.groundNormal = new BABYLON.Vector3(0, 1, 0);
        }

        // Вычисляем угол наклона поверхности в градусах
        const slopeAngle = BABYLON.Vector3.Dot(this.groundNormal, BABYLON.Vector3.Up());
        const slopeAngleDegrees = Math.acos(slopeAngle) * (180 / Math.PI);
        
        // Определяем, можем ли мы двигаться по этому склону
        const canWalkOnSlope = slopeAngleDegrees <= this.maxSlopeAngle;

        // Обновляем время последнего контакта с землей
        if (this.isGrounded && canWalkOnSlope) {
            this.lastGroundedTime = performance.now();
        }

        // Проверяем, можем ли мы прыгнуть (на земле или в пределах coyote time)
        const canJump = (this.isGrounded && canWalkOnSlope) || 
                        (performance.now() - this.lastGroundedTime < this.coyoteTime);

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

        // Нормализуем направление движения
        if (rawMoveDirection.length() > 0) {
            rawMoveDirection.normalize();
        }

        // Плавно сглаживаем ввод для устранения дерганья
        // Если нет ввода и на земле, мгновенно останавливаемся
        if (rawMoveDirection.length() === 0 && this.isGrounded) {
            // Мгновенно обнуляем сглаженную скорость ввода
            this.smoothInputVelocity = BABYLON.Vector3.Zero();
        } else {
            // Обычное сглаживание при движении
            this.smoothInputVelocity = BABYLON.Vector3.Lerp(
                this.smoothInputVelocity,
                rawMoveDirection,
                this.inputSmoothingFactor
            );
        }

        // Сглаживаем изменение направления движения
        if (this.smoothInputVelocity.length() > 0) {
            // Сохраняем последнее ненулевое направление
            this.lastMoveDirection.copyFrom(this.smoothInputVelocity);
        }

        // Проецируем направление движения на плоскость склона, если мы на земле
        let moveDirection = this.smoothInputVelocity.clone();
        
        if (this.isGrounded && canWalkOnSlope) {
            // Проецируем вектор движения на плоскость склона
            const projectedDirection = moveDirection.subtract(
                this.groundNormal.scale(BABYLON.Vector3.Dot(moveDirection, this.groundNormal))
            );
            
            // Нормализуем проецированное направление
            if (projectedDirection.length() > 0) {
                projectedDirection.normalize();
            }
            
            // Вычисляем фактор замедления на основе направления движения и наклона
            let slopeFactor = 1.0;
            
            // Если движемся вверх по склону, замедляемся
            if (moveDirection.y > 0 || BABYLON.Vector3.Dot(moveDirection, this.groundNormal) > 0) {
                // Чем круче склон, тем сильнее замедление
                slopeFactor = 1.0 - (slopeAngleDegrees / this.maxSlopeAngle) * this.slopeSlowdownFactor;
            }
            
            // Применяем проецированное направление и фактор наклона
            moveDirection = projectedDirection.scale(slopeFactor);
        }

        // Вычисляем целевую скорость с учетом контроля в воздухе и бега
        const controlFactor = (this.isGrounded && canWalkOnSlope) ? 1.0 : this.airControl;
        const targetVelocity = moveDirection.scale(currentMoveSpeed * controlFactor);

        // Текущая горизонтальная скорость
        const currentHorizontalVelocity = new BABYLON.Vector3(
            currentVelocity.x,
            0,
            currentVelocity.z
        );

        // Вычисляем новую горизонтальную скорость с плавным ускорением/замедлением
        let newHorizontalVelocity;
        
        if (moveDirection.length() > 0) {
            // Если движемся, применяем ускорение с дополнительным сглаживанием
            const acceleration = this.isGrounded ? this.acceleration : this.acceleration * this.airControl;
            
            // Сначала вычисляем скорость с обычным ускорением
            const acceleratedVelocity = BABYLON.Vector3.Lerp(
                currentHorizontalVelocity,
                targetVelocity,
                Math.min(acceleration * deltaTime, 1)
            );
            
            // Затем применяем дополнительное сглаживание для плавности
            newHorizontalVelocity = BABYLON.Vector3.Lerp(
                currentHorizontalVelocity,
                acceleratedVelocity,
                this.velocitySmoothingFactor
            );
        } else if (this.isGrounded) {
            // Если на земле и не движемся, мгновенно останавливаемся
            newHorizontalVelocity = BABYLON.Vector3.Zero();
        } else {
            // В воздухе сохраняем горизонтальную скорость с небольшим замедлением
            newHorizontalVelocity = currentHorizontalVelocity.scale(0.99);
        }

        // Применяем гравитацию с ускорением
        let newVerticalVelocity = currentVelocity.y;
        
        if (!this.isGrounded || !canWalkOnSlope) {
            // Увеличиваем скорость падения с течением времени
            newVerticalVelocity += this.gravity * deltaTime;
            
            // Ограничиваем максимальную скорость падения
            if (newVerticalVelocity < this.maxVerticalVelocity) {
                newVerticalVelocity = this.maxVerticalVelocity;
            }
        } else {
            // Если на земле, полностью останавливаем вертикальное движение
            newVerticalVelocity = 0;
            
            // Если только что приземлились, обнуляем вертикальную скорость
            if (justLanded) {
                // Мгновенно останавливаем вертикальное движение
                body.setLinearVelocity(new BABYLON.Vector3(
                    currentVelocity.x,
                    0,
                    currentVelocity.z
                ));
            }
        }

        // Обработка прыжка
        if (this.inputMap[" "] && canJump) {
            newVerticalVelocity = this.jumpForce;
            this.isGrounded = false;
            this.lastGroundedTime = 0; // Сбрасываем время, чтобы избежать двойного прыжка
        }

        // Применяем новую скорость
        const newVelocity = new BABYLON.Vector3(
            newHorizontalVelocity.x,
            newVerticalVelocity,
            newHorizontalVelocity.z
        );
        
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