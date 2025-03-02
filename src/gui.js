import * as GUI from '@babylonjs/gui';

export class GameGUI {
    constructor(scene) {
        this.scene = scene;
        this.fpsText = null;
        this.updateInterval = null;
    }

    initialize() {
        // Создаем динамическую текстуру для FPS
        const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

        // Создаем текстовый блок для FPS
        this.fpsText = new GUI.TextBlock();
        this.fpsText.text = "FPS: 0";
        this.fpsText.color = "white";
        this.fpsText.fontSize = 16;
        this.fpsText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.fpsText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this.fpsText.paddingTop = "10px";
        this.fpsText.paddingRight = "10px";

        // Добавляем текст на UI
        advancedTexture.addControl(this.fpsText);

        // Обновляем FPS каждые 500мс
        this.updateInterval = setInterval(() => {
            this.fpsText.text = `FPS: ${Math.round(this.scene.getEngine().getFps())}`;
        }, 500);
    }

    dispose() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
} 