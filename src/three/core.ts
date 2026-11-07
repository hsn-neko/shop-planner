// Three.js renderer, scene, lights and small mesh helpers.
import * as THREE from "three";
import type { Palette } from "../types";

export { THREE };

/** Set to false when the browser can't create a WebGL context. */
export const gl = { ok: true };

/**
 * Some browsers (WebGL turned off, old devices, machines without graphics) can't draw 3D.
 * A stand-in keeps the planner working in the 2D plan instead of stopping at startup.
 */
export function makeRenderer(): THREE.WebGLRenderer {
  try {
    return new THREE.WebGLRenderer({ antialias: true });
  } catch {
    gl.ok = false;
    const stub = { domElement: document.createElement("canvas"), shadowMap: {}, outputEncoding: 0, setPixelRatio() {}, setSize() {}, render() {} };
    return stub as unknown as THREE.WebGLRenderer;
  }
}
export function setupRenderer(r: THREE.WebGLRenderer): void {
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.outputEncoding = THREE.sRGBEncoding;
}

export const renderer = makeRenderer();
setupRenderer(renderer);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
camera.position.set(9, 11, 13);
export const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7b70, 0.65);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(6, 12, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.2));
export const roomG = new THREE.Group();
scene.add(roomG);
export const itemsG = new THREE.Group();
scene.add(itemsG);

type MatOpts = THREE.MeshStandardMaterialParameters;
/** A standard material with a sensible default roughness. */
export const M = (color: THREE.Color | string | number, o: MatOpts = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });

/** A box standing on y (its bottom), centred on x/z. */
export function box(g: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}
/** A cylinder standing on y. */
export function cyl(g: THREE.Object3D, r1: number, r2: number, h: number, mat: THREE.Material, x: number, y: number, z: number, seg = 20): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}

function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}
function canvas2d(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  if (!x) throw new Error("2D canvas unavailable");
  return [c, x];
}

/** Shop-floor texture for a palette: terrazzo, checkerboard or wood boards. */
export function floorTexture(p: Palette): THREE.CanvasTexture {
  const [c, x] = canvas2d(512);
  x.fillStyle = p.f1;
  x.fillRect(0, 0, 512, 512);
  if (p.floor === "terrazzo") {
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const chips = p.chips ?? ["#999"];
    for (let i = 0; i < 900; i++) {
      x.fillStyle = chips[i % chips.length]!;
      x.beginPath();
      const r = 2 + rnd() * 7;
      x.ellipse(rnd() * 512, rnd() * 512, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, 7);
      x.fill();
    }
  } else if (p.floor === "checker") {
    const n = 6, t = 512 / n;
    x.fillStyle = p.f2 ?? "#ddd";
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2) x.fillRect(i * t, j * t, t, t);
  } else {
    const rows = 8, h = 512 / rows;
    for (let r = 0; r < rows; r++) {
      x.fillStyle = r % 2 ? (p.f2 ?? p.f1) : p.f1;
      x.fillRect(0, r * h, 512, h);
      x.fillStyle = "rgba(0,0,0,.12)";
      x.fillRect(0, r * h, 512, 1.5);
      const off = (r * 173) % 512;
      x.fillRect(off, r * h, 1.5, h);
      x.fillRect((off + 256) % 512, r * h, 1.5, h);
    }
  }
  return canvasTexture(c);
}

/** Kitchen tiles or storage concrete. */
export function backRoomTexture(kind: "kitchen" | "storage"): THREE.CanvasTexture {
  const [c, x] = canvas2d(256);
  if (kind === "kitchen") {
    x.fillStyle = "#b4ada6";
    x.fillRect(0, 0, 256, 256);
    const n = 8, q = 256 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      x.fillStyle = (i * 3 + j) % 4 ? "#d9d4ce" : "#d1cbc4";
      x.fillRect(i * q + 2, j * q + 2, q - 4, q - 4);
    }
  } else {
    x.fillStyle = "#cbc6c0";
    x.fillRect(0, 0, 256, 256);
    let sd = 11;
    const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 2600; k++) {
      x.fillStyle = r() < 0.5 ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.09)";
      x.fillRect(r() * 256, r() * 256, 2, 2);
    }
  }
  return canvasTexture(c);
}
