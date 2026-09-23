import * as THREE from "three";
import type { Object3DDef, Object3DPart } from "./types";

const EXPLODE_AMOUNT = 1.1;
const MIN_DISTANCE = 2.2;
const MAX_DISTANCE = 9;
const TRANSPARENT_OPACITY = 0.35;

interface LoadedPart extends Object3DPart {
  originalPosition: THREE.Vector3;
  hidden: boolean;
}

export class SceneController {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private pivot = new THREE.Group();
  private raf: number | null = null;
  private resizeObserver: ResizeObserver;

  private parts: LoadedPart[] = [];
  private explodeOn = false;
  private transparentOn = false;
  private isolatedId: string | null = null;
  private distance = 5;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.updateCameraPosition();

    this.scene.add(this.pivot);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 4, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6ee7f2, 0.35);
    rim.position.set(-4, -2, -3);
    this.scene.add(rim);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();

    const loop = () => {
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private resize() {
    const canvas = this.renderer.domElement;
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  }

  private updateCameraPosition() {
    this.camera.position.set(0, this.distance * 0.32, this.distance);
    this.camera.lookAt(0, 0, 0);
  }

  loadObject(def: Object3DDef) {
    for (const child of [...this.pivot.children]) {
      this.pivot.remove(child);
      disposeObject3D(child);
    }
    this.pivot.rotation.set(0.15, 0, 0);
    this.explodeOn = false;
    this.transparentOn = false;
    this.isolatedId = null;
    this.distance = 5;
    this.updateCameraPosition();

    const { group, parts } = def.build();
    this.pivot.add(group);
    this.parts = parts.map((p) => ({ ...p, originalPosition: p.mesh.position.clone(), hidden: false }));
  }

  listParts() {
    return this.parts.map((p) => ({ id: p.id, labelKey: p.labelKey, hidden: p.hidden }));
  }

  rotateBy(dxNorm: number, dyNorm: number) {
    this.pivot.rotation.y += dxNorm * 4;
    this.pivot.rotation.x = THREE.MathUtils.clamp(this.pivot.rotation.x + dyNorm * 4, -1.3, 1.3);
  }

  zoomBy(deltaNorm: number) {
    this.distance = THREE.MathUtils.clamp(this.distance - deltaNorm * 6, MIN_DISTANCE, MAX_DISTANCE);
    this.updateCameraPosition();
  }

  togglePartVisible(id: string) {
    const p = this.parts.find((x) => x.id === id);
    if (!p) return;
    p.hidden = !p.hidden;
    this.applyVisibility();
  }

  setIsolated(id: string | null) {
    this.isolatedId = this.isolatedId === id ? null : id;
    this.applyVisibility();
  }

  get isolatedPartId() {
    return this.isolatedId;
  }

  private applyVisibility() {
    for (const p of this.parts) {
      if (this.isolatedId) {
        p.mesh.visible = p.id === this.isolatedId;
      } else {
        p.mesh.visible = !p.hidden;
      }
    }
  }

  setExplode(on: boolean) {
    this.explodeOn = on;
    for (const p of this.parts) {
      const offset = this.explodeOn ? p.explodeDir.clone().multiplyScalar(EXPLODE_AMOUNT) : new THREE.Vector3();
      p.mesh.position.copy(p.originalPosition).add(offset);
    }
  }

  get isExploded() {
    return this.explodeOn;
  }

  setTransparent(on: boolean) {
    this.transparentOn = on;
    for (const p of this.parts) {
      p.mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const mat of materials) {
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.transparent = on;
              mat.opacity = on ? TRANSPARENT_OPACITY : 1;
            }
          }
        }
      });
    }
  }

  get isTransparent() {
    return this.transparentOn;
  }

  reset() {
    this.pivot.rotation.set(0.15, 0, 0);
    this.distance = 5;
    this.updateCameraPosition();
    this.isolatedId = null;
    for (const p of this.parts) p.hidden = false;
    this.applyVisibility();
    this.setExplode(false);
    this.setTransparent(false);
  }

  dispose() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    for (const child of [...this.pivot.children]) disposeObject3D(child);
    this.renderer.dispose();
  }
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) mat?.dispose();
    }
  });
}
