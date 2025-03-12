import * as GUI from '@babylonjs/gui';

export class GameGUI {
    constructor(scene) {
        this.scene = scene;
        this.fpsText = null;
        this.positionText = null;
        this.updateInterval = null;
    }

    initialize() {
        const texture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        this.createFPSCounter(texture);
        this.createPositionDisplay(texture);
        this.startUpdates();
    }

    createFPSCounter(texture) {
        this.fpsText = new GUI.TextBlock();
        this.fpsText.text = "FPS: 0";
        this.fpsText.color = "white";
        this.fpsText.fontSize = 16;
        this.fpsText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.fpsText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this.fpsText.paddingTop = "10px";
        this.fpsText.paddingRight = "10px";
        texture.addControl(this.fpsText);
    }

    createPositionDisplay(texture) {
        this.positionText = new GUI.TextBlock();
        this.positionText.text = "Position: X: 0 Y: 0 Z: 0";
        this.positionText.color = "white";
        this.positionText.fontSize = 16;
        this.positionText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.positionText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this.positionText.paddingTop = "10px";
        this.positionText.paddingLeft = "10px";
        texture.addControl(this.positionText);
    }

    startUpdates() {
        this.updateInterval = setInterval(() => {
            // Обновляем FPS
            this.fpsText.text = `FPS: ${Math.round(this.scene.getEngine().getFps())}`;

            // Обновляем позицию
            const camera = this.scene.activeCamera;
            if (camera) {
                const pos = camera.position;
                this.positionText.text = `Position: X: ${pos.x.toFixed(2)} Y: ${pos.y.toFixed(2)} Z: ${pos.z.toFixed(2)}`;
            }
        }, 100); // Обновляем чаще для более плавного отображения координат
    }

    dispose() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
} 