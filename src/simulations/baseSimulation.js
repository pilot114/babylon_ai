export class BaseSimulation {
    constructor(scene) {
        this.scene = scene;
        this.objects = new Set();
    }

    initialize() {
        throw new Error('Method initialize() must be implemented');
    }

    dispose() {
        for (const obj of this.objects) {
            this.removeObject(obj);
        }
        this.objects.clear();
    }

    removeObject(obj) {
        if (!obj || obj.isDisposed()) return;

        try {
            if (obj.physicsAggregate) {
                obj.physicsAggregate.dispose();
                obj.physicsAggregate = null;
            }
            if (obj.material) {
                obj.material.dispose();
            }
            this.objects.delete(obj);
            obj.dispose();
        } catch (error) {
            console.error("Error removing object:", error);
        }
    }
} 