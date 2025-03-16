import * as BABYLON from '@babylonjs/core';

export class HelicopterController {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.helicopter = null;
        this.isInHelicopter = false;
        this.originalCamera = null;
        this.helicopterCamera = null;
        this.interactionDistance = 5; // Distance at which player can interact with helicopter
        this.rotorSpeed = 0.1;
        this.maxSpeed = 50; // Maximum speed
        this.currentSpeed = 0;
        this.acceleration = 0.2; // Reduced for smoother acceleration
        this.deceleration = 0.1; // Reduced for smoother deceleration
        this.velocity = new BABYLON.Vector3(0, 0, 0);
        this.targetVelocity = new BABYLON.Vector3(0, 0, 0);
        this.rotationVelocity = new BABYLON.Vector3(0, 0, 0);
        this.targetRotationVelocity = new BABYLON.Vector3(0, 0, 0);
        this.inputMap = {};
        this.mainRotor = null;
        this.tailRotor = null;
        this.collisionBox = null;
        this.physicsAggregate = null;
        this.rotorSpeedFactor = 0.5; // Current rotor speed factor (0-1)
        this.maxRotorSpeed = 0.3; // Maximum rotor speed
    }

    initialize(helicopterMesh) {
        this.helicopter = helicopterMesh;
        
        // Ensure the helicopter uses quaternion rotation
        if (!this.helicopter.rotationQuaternion) {
            this.helicopter.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(
                this.helicopter.rotation.y,
                this.helicopter.rotation.x,
                this.helicopter.rotation.z
            );
        }
        
        this.setupHelicopterPhysics();
        this.setupHelicopterParts();
        this.setupInputs();
        this.createHelicopterCamera();
        this.setupInteractionCheck();
    }

    setupHelicopterPhysics() {
        // Remove any existing physics if present
        if (this.helicopter.physicsAggregate) {
            this.helicopter.physicsAggregate.dispose();
        }

        // Create a simple collision box for the helicopter
        // Use fixed dimensions instead of trying to calculate from the model
        const collisionBox = BABYLON.MeshBuilder.CreateBox("heliCollision", {
            width: 5,
            height: 2,
            depth: 5
        }, this.scene);
        
        // Make it invisible and position it at the helicopter
        collisionBox.isVisible = false;
        collisionBox.position = new BABYLON.Vector3(0, 0, 0); // Center it on the helicopter
        
        // Parent it to the helicopter so it moves with it
        collisionBox.parent = this.helicopter;
        
        // Store reference for later cleanup
        this.collisionBox = collisionBox;

        // Add physics to the collision box
        this.physicsAggregate = new BABYLON.PhysicsAggregate(
            collisionBox,
            BABYLON.PhysicsShapeType.BOX,
            { 
                mass: 0,  // Start as static
                friction: 0.5,
                restitution: 0.3,
                disableBidirectionalTransformation: false // Allow physics to move the mesh
            },
            this.scene
        );
    }

    setupHelicopterParts() {
        // Find main and tail rotors in the helicopter model
        // Note: This assumes the helicopter model has parts named appropriately
        // You may need to adjust these names based on your actual model structure
        this.helicopter.getChildMeshes().forEach(mesh => {
            const lowerName = mesh.name.toLowerCase();
            if (lowerName.includes('mainrotor') || lowerName.includes('main_rotor')) {
                this.mainRotor = mesh;
            } else if (lowerName.includes('tailrotor') || lowerName.includes('tail_rotor')) {
                this.tailRotor = mesh;
            }
        });

        // If rotors weren't found, create simple placeholder rotors
        if (!this.mainRotor) {
            // Create a simple main rotor if not found in model
            this.mainRotor = BABYLON.MeshBuilder.CreateCylinder("mainRotor", {
                height: 0.1,
                diameter: 5
            }, this.scene);
            this.mainRotor.parent = this.helicopter;
            this.mainRotor.position.y = 1.5; // Adjust based on helicopter model
        }

        if (!this.tailRotor) {
            // Create a simple tail rotor if not found in model
            this.tailRotor = BABYLON.MeshBuilder.CreateCylinder("tailRotor", {
                height: 0.05,
                diameter: 1
            }, this.scene);
            this.tailRotor.parent = this.helicopter;
            this.tailRotor.position = new BABYLON.Vector3(0, 1, -3); // Adjust based on helicopter model
            this.tailRotor.rotation.x = Math.PI / 2; // Rotate to correct orientation
        }
    }

    createHelicopterCamera() {
        this.helicopterCamera = new BABYLON.FreeCamera(
            "helicopterCamera",
            new BABYLON.Vector3(0, 0, 0),
            this.scene
        );
        this.helicopterCamera.rotation = new BABYLON.Vector3(0, 0, 0);

        this.helicopterCamera.parent = this.helicopter;
        this.helicopterCamera.position = new BABYLON.Vector3(-60, 220, 570);
        this.helicopterCamera.maxZ = 1000000;

        this.helicopterCamera.detachControl();
    }

    setupInputs() {
        // Setup keyboard inputs for helicopter control
        this.scene.onKeyboardObservable.add((kbInfo) => {
            switch (kbInfo.type) {
                case BABYLON.KeyboardEventTypes.KEYDOWN:
                    if (kbInfo.event.key.toLowerCase() === 'e') {
                        if (this.canInteractWithHelicopter()) {
                            this.toggleHelicopterMode();
                        }
                    } else {
                        const key = kbInfo.event.key.toLowerCase();
                        // Handle numpad keys specifically
                        if (key === '1' || key === '3' || key === '4' || key === '5' || 
                            key === '6' || key === '7' || key === '8' || key === '9') {
                            // Store both regular and numpad version to ensure it works
                            this.inputMap[key] = true;
                            this.inputMap[`numpad${key}`] = true;
                        } else {
                            this.inputMap[key] = true;
                        }
                    }
                    break;
                case BABYLON.KeyboardEventTypes.KEYUP:
                    const key = kbInfo.event.key.toLowerCase();
                    // Handle numpad keys specifically
                    if (key === '1' || key === '3' || key === '4' || key === '5' || 
                        key === '6' || key === '7' || key === '8' || key === '9') {
                        // Clear both regular and numpad version
                        this.inputMap[key] = false;
                        this.inputMap[`numpad${key}`] = false;
                    } else {
                        this.inputMap[key] = false;
                    }
                    break;
            }
        });
    }

    setupInteractionCheck() {
        // Add a render loop to check for helicopter interaction
        this.scene.onBeforeRenderObservable.add(() => {
            if (this.isInHelicopter) {
                this.updateHelicopterMovement();
                this.animateRotors();
            } else {
                // Show interaction prompt when near helicopter
                if (this.canInteractWithHelicopter()) {
                    // You could add UI prompt here
                    // For example: "Press E to enter helicopter"
                }
            }
        });
    }

    canInteractWithHelicopter() {
        if (!this.player || !this.player.camera || !this.helicopter) return false;
        
        const playerPosition = this.player.camera.position;
        const helicopterPosition = this.helicopter.position;
        
        // Calculate distance between player and helicopter
        const distance = BABYLON.Vector3.Distance(playerPosition, helicopterPosition);
        
        return distance <= this.interactionDistance;
    }

    toggleHelicopterMode() {
        if (this.isInHelicopter) {
            // Exit helicopter
            this.exitHelicopter();
        } else {
            // Enter helicopter
            this.enterHelicopter();
        }
    }

    enterHelicopter() {
        if (!this.player || !this.player.camera) return;
        
        // Store original camera
        this.originalCamera = this.player.camera;

        // Disable player controls
        this.player.camera.detachControl();

        // Enable helicopter camera
        this.scene.activeCamera = this.helicopterCamera;

        // для управления камерой в вертолете
        // this.helicopterCamera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
        
        this.isInHelicopter = true;
    }

    exitHelicopter() {
        if (!this.originalCamera) return;
        
        // Restore original camera
        this.scene.activeCamera = this.originalCamera;
        this.originalCamera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
        
        // Position player outside helicopter
        const exitPosition = this.helicopter.position.clone();
        exitPosition.addInPlace(new BABYLON.Vector3(0, 0, -5)); // Position player a bit away from helicopter
        this.player.camera.position.copyFrom(exitPosition);
        
        // Reset helicopter control variables
        this.velocity = BABYLON.Vector3.Zero();
        this.rotationVelocity = BABYLON.Vector3.Zero();
        
        this.isInHelicopter = false;
    }

    updateHelicopterMovement() {
        if (!this.helicopter) return;
        
        const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
        
        // Reset target velocity and rotation
        this.targetVelocity = BABYLON.Vector3.Zero();
        this.targetRotationVelocity = BABYLON.Vector3.Zero();
        let hasInput = false;
        
        // Get the helicopter's current rotation as Euler angles
        const currentRotation = this.helicopter.rotationQuaternion.toEulerAngles();
        const yaw = currentRotation.y; // Current yaw angle
        
        // Calculate direction vectors based on helicopter's orientation
        const forward = new BABYLON.Vector3(
            Math.sin(yaw),
            0,
            Math.cos(yaw)
        );
        
        const right = new BABYLON.Vector3(
            Math.sin(yaw + Math.PI/2),
            0,
            Math.cos(yaw + Math.PI/2)
        );
        
        const up = new BABYLON.Vector3(0, 1, 0);
        
        // Pitch control (8/5 - forward/backward)
        if (this.inputMap["8"]) {
            // 8 = Forward movement
            this.targetRotationVelocity.x = 0.5; // Tilt forward
            this.targetVelocity.addInPlace(forward.scale(this.maxSpeed * this.rotorSpeedFactor)); // Move forward relative to orientation
            hasInput = true;
        }
        if (this.inputMap["5"]) {
            // 5 = Backward movement
            this.targetRotationVelocity.x = -0.5; // Tilt backward
            this.targetVelocity.addInPlace(forward.scale(-this.maxSpeed * this.rotorSpeedFactor)); // Move backward relative to orientation
            hasInput = true;
        }
        
        // Roll control (4/6 - left/right)
        if (this.inputMap["4"]) {
            // 4 = Left movement
            this.targetRotationVelocity.z = 0.3; // Tilt left
            this.targetVelocity.addInPlace(right.scale(-this.maxSpeed * this.rotorSpeedFactor)); // Move left relative to orientation
            hasInput = true;
        }
        if (this.inputMap["6"]) {
            // 6 = Right movement
            this.targetRotationVelocity.z = -0.3; // Tilt right
            this.targetVelocity.addInPlace(right.scale(this.maxSpeed * this.rotorSpeedFactor)); // Move right relative to orientation
            hasInput = true;
        }
        
        if (this.inputMap["7"] || this.inputMap["numpad7"]) {
            const yawQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, -0.5 * deltaTime);
            this.helicopter.rotationQuaternion = this.helicopter.rotationQuaternion.multiply(yawQuaternion);
            hasInput = true;
        }
        if (this.inputMap["9"] || this.inputMap["numpad9"]) {
            const yawQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, 0.5 * deltaTime);
            this.helicopter.rotationQuaternion = this.helicopter.rotationQuaternion.multiply(yawQuaternion);
            hasInput = true;
        }
        
        if (this.inputMap["1"] || this.inputMap["numpad1"]) {
            this.rotorSpeedFactor = Math.max(this.rotorSpeedFactor - 0.05 * deltaTime, 0.1);
            this.targetVelocity.addInPlace(up.scale(-this.maxSpeed * 0.5 * this.rotorSpeedFactor)); // Move down
            hasInput = true;
        }
        if (this.inputMap["3"] || this.inputMap["numpad3"]) {
            this.rotorSpeedFactor = Math.min(this.rotorSpeedFactor + 0.05 * deltaTime, 1.0);
            this.targetVelocity.addInPlace(up.scale(this.maxSpeed * this.rotorSpeedFactor)); // Move up
            hasInput = true;
        }
        
        // Apply smooth acceleration/deceleration to velocity
        this.velocity = BABYLON.Vector3.Lerp(
            this.velocity,
            this.targetVelocity,
            this.acceleration * deltaTime
        );
        
        // Apply smooth changes to rotation
        this.rotationVelocity = BABYLON.Vector3.Lerp(
            this.rotationVelocity,
            this.targetRotationVelocity,
            this.acceleration * deltaTime
        );
        
        // Apply velocity to helicopter position
        this.helicopter.position.addInPlace(this.velocity.scale(deltaTime));
        
        // Apply pitch and roll rotations using quaternions
        if (this.rotationVelocity.x !== 0 || this.rotationVelocity.z !== 0) {
            // Create quaternions for pitch and roll
            const pitchQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, this.rotationVelocity.x * deltaTime);
            const rollQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, this.rotationVelocity.z * deltaTime);
            
            // Apply both rotations
            this.helicopter.rotationQuaternion = this.helicopter.rotationQuaternion
                .multiply(pitchQuaternion)
                .multiply(rollQuaternion);
        }
        
        // If no input, gradually return to neutral rotation (auto-stabilize)
        if (!hasInput) {
            // Gradually slow down
            this.velocity = this.velocity.scale(1 - this.deceleration);
            this.rotationVelocity = this.rotationVelocity.scale(1 - this.deceleration);
            
            // Gradually decrease rotor speed when not actively controlling altitude
            if (!this.inputMap["1"] && !this.inputMap["3"]) {
                this.rotorSpeedFactor = Math.max(this.rotorSpeedFactor - 0.01 * deltaTime, 0.5);
            }
            
            // Gradually level the helicopter (auto-stabilize pitch and roll)
            if (this.helicopter.rotationQuaternion) {
                // Extract current rotation angles
                const currentRotation = this.helicopter.rotationQuaternion.toEulerAngles();
                
                // Create a new quaternion that gradually levels pitch and roll
                const targetQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(
                    currentRotation.y, // Keep current yaw
                    BABYLON.Scalar.Lerp(currentRotation.x, 0, 0.05), // Gradually level pitch
                    BABYLON.Scalar.Lerp(currentRotation.z, 0, 0.05)  // Gradually level roll
                );
                
                // Smoothly interpolate to the target rotation
                BABYLON.Quaternion.SlerpToRef(
                    this.helicopter.rotationQuaternion,
                    targetQuaternion,
                    0.1,
                    this.helicopter.rotationQuaternion
                );
            }
        }
        
        // Update rotor animation based on rotor speed factor
        this.rotorSpeed = this.maxRotorSpeed * this.rotorSpeedFactor;
    }

    animateRotors() {
        if (!this.mainRotor || !this.tailRotor) return;
        
        // Calculate rotor speed based on helicopter movement
        const speed = this.isInHelicopter ? this.rotorSpeed * this.rotorSpeedFactor : 0;
        
        // Rotate main rotor around Y axis
        this.mainRotor.rotation.y += speed;
        
        // Rotate tail rotor around X axis
        this.tailRotor.rotation.z += speed * 1.5; // Tail rotor spins faster
    }

    dispose() {
        // Clean up resources
        if (this.helicopterCamera) {
            this.helicopterCamera.dispose();
        }
        
        // Clean up physics
        if (this.physicsAggregate) {
            this.physicsAggregate.dispose();
        }
        
        // Clean up collision box
        if (this.collisionBox) {
            this.collisionBox.dispose();
        }
        
        // Remove observables
        this.scene.onBeforeRenderObservable.clear();
    }
}
