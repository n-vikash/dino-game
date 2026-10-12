import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import "./style.css";
let runnerMixer = null;
let externalRunnerLoaded = false;
const $ = (id) => document.getElementById(id);
const SAVE_KEY = "jungle-dino-escape-3d-records";
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (items) => items[Math.floor(Math.random() * items.length)];

let saved = { best: 0, coins: 0 };
try {
  saved = { ...saved, ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") };
} catch {}
$("bestStart").textContent = String(saved.best).padStart(6, "0");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#1b302a");
scene.fog = new THREE.FogExp2("#64796a", 0.014);
scene.userData.baseFogDensity = 0.014;

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 180);
camera.position.set(0, 5.8, 12.5);
camera.lookAt(0, 1.1, -5);
const baseCameraPosition = new THREE.Vector3(0, 5.8, 12.5);
const cinematicCameraPosition = new THREE.Vector3();
const cinematicLookTarget = new THREE.Vector3();

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.info.autoReset = true;
renderer.setClearColor("#263b35");
$("game").appendChild(renderer.domElement);
// Restrained cinematic bloom: warm highlights glow without washing out the jungle.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.32,
  0.62,
  0.82,
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
const gltfLoader = new GLTFLoader();
let externalTreeTemplate = null;
let deadTrunkTemplate = null;

// Load the realistic tree model.
gltfLoader.load(
  "/models/tree.glb",
  (gltf) => {
    externalTreeTemplate = gltf.scene;

    externalTreeTemplate.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    // Replace the generated trees already in the scenery array.
    const box = new THREE.Box3().setFromObject(externalTreeTemplate);
    const size = box.getSize(new THREE.Vector3());
    const targetHeight = 7.5;
    const scale = targetHeight / Math.max(size.y, 0.001);

    for (const item of scenery) {
      if (item.kind !== "tree") continue;

      const tree = externalTreeTemplate.clone(true);
      tree.scale.setScalar(scale);

      const treeBox = new THREE.Box3().setFromObject(tree);
      tree.position.y -= treeBox.min.y;

      item.obj.clear();
      item.obj.add(tree);

      // Keep the existing scenery position and recycling logic.
    }

    console.log("Realistic tree models loaded");
  },
  undefined,
  (error) => console.error("Tree model failed to load:", error),
);

// Load the fallen tree trunk for log obstacles.
gltfLoader.load(
  "/models/dead-trunk.glb",
  (gltf) => {
    deadTrunkTemplate = gltf.scene;

    deadTrunkTemplate.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    console.log("Dead trunk model loaded");
  },
  undefined,
  (error) => console.error("Dead trunk failed to load:", error),
);
let dinoMixer = null;
let externalDinoLoaded = false;
let externalDinoHasAnimation = false;
let externalFernLoaded = false;

scene.add(new THREE.HemisphereLight(0xd8e8d9, 0x20291a, 1.65));
const sun = new THREE.DirectionalLight(0xffd6a0, 3.5);
sun.position.set(-7, 13, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14;
sun.shadow.camera.right = 14;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -12;
sun.shadow.bias = -0.00035;
scene.add(sun);
sun.shadow.normalBias = 0.035;
sun.shadow.radius = 5;
const fill = new THREE.DirectionalLight(0x72a99c, 1.25);
fill.position.set(7, 5, -8);
scene.add(fill);

function makeProceduralTexture(kind, base, accent, seed = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  let n = seed * 9301 + 49297;
  const random = () => {
    n = (n * 16807) % 2147483647;
    return n / 2147483647;
  };
  if (kind === "soil") {
    for (let i = 0; i < 15000; i++) {
      const r = random() * 2.2 + 0.3;
      ctx.globalAlpha = 0.08 + random() * 0.22;
      ctx.fillStyle = random() > 0.5 ? accent : "#171b12";
      ctx.beginPath();
      ctx.ellipse(
        random() * 512,
        random() * 512,
        r * 2,
        r,
        random() * 3.14,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    for (let i = 0; i < 75; i++) {
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = accent;
      ctx.lineWidth = random() * 2 + 1;
      ctx.beginPath();
      let x = random() * 512,
        y = random() * 512;
      ctx.moveTo(x, y);
      ctx.lineTo(x + random() * 35 - 17, y + random() * 18 - 9);
      ctx.stroke();
    }
  } else if (kind === "bark") {
    for (let i = 0; i < 180; i++) {
      const x = random() * 512;
      ctx.globalAlpha = 0.12 + random() * 0.2;
      ctx.strokeStyle = random() > 0.5 ? accent : "#20180f";
      ctx.lineWidth = random() * 5 + 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x - 18, 150, x + 15, 350, x + random() * 12, 512);
      ctx.stroke();
    }
    for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#17130d";
      ctx.fillRect(
        random() * 512,
        random() * 512,
        random() * 15 + 2,
        random() * 4 + 1,
      );
    }
  } else if (kind === "stone") {
    for (let i = 0; i < 4500; i++) {
      ctx.globalAlpha = random() * 0.18;
      ctx.fillStyle = random() > 0.5 ? accent : "#252820";
      ctx.fillRect(
        random() * 512,
        random() * 512,
        random() * 7 + 1,
        random() * 5 + 1,
      );
    }
  } else if (kind === "leaf") {
    for (let i = 0; i < 180; i++) {
      ctx.globalAlpha = 0.08 + random() * 0.22;
      ctx.fillStyle = random() > 0.5 ? accent : "#102b1d";
      ctx.beginPath();
      ctx.ellipse(
        random() * 512,
        random() * 512,
        random() * 35 + 5,
        random() * 9 + 2,
        random() * 3.14,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
const soilTexture = makeProceduralTexture("soil", "#4a4930", "#8b7650", 4);
soilTexture.repeat.set(7, 22);
const trailTexture = makeProceduralTexture("soil", "#765438", "#b58b5b", 8);
trailTexture.repeat.set(2, 24);
const barkTexture = makeProceduralTexture("bark", "#503927", "#98704a", 11);
barkTexture.repeat.set(1, 2);
const rockTexture = makeProceduralTexture("stone", "#656656", "#b2aa8d", 3);
const leafTexture = makeProceduralTexture("leaf", "#28513a", "#6c8b4d", 7);

const mats = {
  ground: new THREE.MeshStandardMaterial({
    color: "#a0a07b",
    map: soilTexture,
    roughness: 1,
  }),
  track: new THREE.MeshStandardMaterial({
    color: "#b49a78",
    map: trailTexture,
    roughness: 0.98,
  }),
  trackEdge: new THREE.MeshStandardMaterial({ color: "#573a2a", roughness: 1 }),
  lane: new THREE.MeshStandardMaterial({ color: "#d2a36a", roughness: 1 }),
  bark: new THREE.MeshStandardMaterial({
    color: "#8b6b4b",
    map: barkTexture,
    roughness: 1,
  }),
  barkLight: new THREE.MeshStandardMaterial({ color: "#806044", roughness: 1 }),
  leaf1: new THREE.MeshStandardMaterial({
    color: "#356748",
    map: leafTexture,
    roughness: 1,
  }),
  leaf2: new THREE.MeshStandardMaterial({
    color: "#4c8156",
    map: leafTexture,
    roughness: 1,
  }),
  leaf3: new THREE.MeshStandardMaterial({
    color: "#70935a",
    map: leafTexture,
    roughness: 1,
  }),
  fern: new THREE.MeshStandardMaterial({
    color: "#4d8548",
    roughness: 0.9,
    side: THREE.DoubleSide,
  }),
  rock: new THREE.MeshStandardMaterial({
    color: "#8a8976",
    map: rockTexture,
    roughness: 1,
  }),
  rockLight: new THREE.MeshStandardMaterial({ color: "#9b9879", roughness: 1 }),
  skin: new THREE.MeshStandardMaterial({ color: "#d5a16e", roughness: 0.78 }),
  cloth: new THREE.MeshStandardMaterial({ color: "#d6a64f", roughness: 0.9 }),
  clothDark: new THREE.MeshStandardMaterial({
    color: "#304a37",
    roughness: 0.95,
  }),
  boot: new THREE.MeshStandardMaterial({ color: "#332a22", roughness: 1 }),
  dino: new THREE.MeshStandardMaterial({ color: "#567b4b", roughness: 0.78 }),
  dinoLight: new THREE.MeshStandardMaterial({
    color: "#87a45d",
    roughness: 0.8,
  }),
  dinoDark: new THREE.MeshStandardMaterial({
    color: "#2c4934",
    roughness: 0.9,
  }),
  tooth: new THREE.MeshStandardMaterial({ color: "#f5e8c8", roughness: 0.5 }),
  eye: new THREE.MeshStandardMaterial({
    color: "#e8bc55",
    roughness: 0.3,
    emissive: "#8a4b12",
    emissiveIntensity: 0.25,
  }),
  black: new THREE.MeshStandardMaterial({ color: "#171d16", roughness: 0.5 }),
  gold: new THREE.MeshStandardMaterial({
    color: "#f5c85f",
    metalness: 0.65,
    roughness: 0.24,
    emissive: "#7b4d12",
    emissiveIntensity: 0.18,
  }),
  vehicleBody: new THREE.MeshStandardMaterial({
    color: "#c64b2f",
    metalness: 0.28,
    roughness: 0.36,
  }),
  glass: new THREE.MeshPhysicalMaterial({
    color: "#8fc5c0",
    metalness: 0.25,
    roughness: 0.18,
    transparent: true,
    opacity: 0.82,
  }),
  rubber: new THREE.MeshStandardMaterial({ color: "#171a17", roughness: 0.88 }),
  headlight: new THREE.MeshStandardMaterial({
    color: "#fff0bb",
    emissive: "#ffcc6a",
    emissiveIntensity: 1.4,
  }),
};

function mesh(geometry, material, parent, pos = [0, 0, 0], scale = null) {
  const obj = new THREE.Mesh(geometry, material);
  obj.position.set(...pos);
  if (scale) obj.scale.set(...scale);
  obj.castShadow = true;
  obj.receiveShadow = true;
  parent.add(obj);
  return obj;
}
function group(parent, pos = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(...pos);
  parent.add(g);
  return g;
}
function capsule(parent, material, pos, radius, length, scale = [1, 1, 1]) {
  const m = mesh(
    new THREE.CapsuleGeometry(radius, length, 4, 8),
    material,
    parent,
    pos,
    scale,
  );
  return m;
}
function createTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = mesh(
    new THREE.CylinderGeometry(0.24 * scale, 0.48 * scale, 4.7 * scale, 8),
    mats.bark,
    g,
    [0, 2.2 * scale, 0],
  );
  trunk.rotation.z = rand(-0.07, 0.07);
  for (let i = 0; i < 5; i++) {
    const y = (2.8 + i * 0.55) * scale;
    const r = (1.1 - i * 0.09) * scale;
    const foliage = mesh(
      new THREE.IcosahedronGeometry(r, 1),
      [mats.leaf1, mats.leaf2, mats.leaf3][i % 3],
      g,
      [rand(-0.5, 0.5) * scale, y, rand(-0.35, 0.35) * scale],
      [1, 0.85 + Math.random() * 0.25, 0.95],
    );
    foliage.rotation.set(rand(-0.2, 0.2), rand(0, 6), rand(-0.15, 0.15));
  }
  // buttress roots
  for (let i = 0; i < 3; i++) {
    const root = mesh(
      new THREE.ConeGeometry(0.28 * scale, 1.5 * scale, 5),
      mats.bark,
      g,
      [
        Math.cos(i * 2.1) * 0.45 * scale,
        0.48 * scale,
        Math.sin(i * 2.1) * 0.45 * scale,
      ],
    );
    root.rotation.z = Math.cos(i * 2.1) * 0.55;
    root.rotation.x = Math.sin(i * 2.1) * 0.55;
  }
  return g;
}
function createFern(scale = 1) {
  const g = new THREE.Group();
  const stem = mesh(
    new THREE.CylinderGeometry(0.025 * scale, 0.045 * scale, 1.7 * scale, 5),
    mats.fern,
    g,
    [0, 0.85 * scale, 0],
  );
  stem.rotation.z = -0.14;
  for (let i = 0; i < 7; i++) {
    const y = 0.25 * scale + i * 0.19 * scale;
    for (const side of [-1, 1]) {
      const leaf = mesh(
        new THREE.ConeGeometry(0.14 * scale, 0.62 * scale, 5),
        mats.fern,
        g,
        [side * (0.18 + i * 0.025) * scale, y, 0],
        [0.65, 1, 0.4],
      );
      leaf.rotation.z = side === -1 ? Math.PI / 2 + 0.2 : -Math.PI / 2 - 0.2;
      leaf.rotation.y = side * 0.15;
    }
  }
  return g;
}
function createVine(scale = 1) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 5.8 * scale, 0),
    new THREE.Vector3(0.25 * scale, 4.7 * scale, 0.05),
    new THREE.Vector3(-0.18 * scale, 3.5 * scale, 0.08),
    new THREE.Vector3(0.12 * scale, 2.2 * scale, -0.04),
    new THREE.Vector3(0.42 * scale, 0.6 * scale, 0),
  ]);
  const stem = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, 0.035 * scale, 5, false),
    mats.leaf1,
  );
  stem.castShadow = true;
  g.add(stem);
  for (let i = 0; i < 9; i++) {
    const t = 0.13 + i * 0.085,
      p = curve.getPoint(t);
    const leaf = mesh(
      new THREE.SphereGeometry(0.16 * scale, 8, 6),
      i % 2 ? mats.leaf2 : mats.leaf3,
      g,
      [p.x + (i % 2 ? -0.16 : 0.16) * scale, p.y, p.z],
      [0.45, 1.6, 0.22],
    );
    leaf.rotation.z = i % 2 ? -0.65 : 0.65;
    leaf.rotation.y = 0.4;
  }
  return g;
}

function createRock(scale = 1) {
  const g = new THREE.Group();
  const a = mesh(
    new THREE.DodecahedronGeometry(0.65 * scale, 0),
    mats.rock,
    g,
    [0, 0.38 * scale, 0],
    [1.15, 0.75, 0.9],
  );
  a.rotation.set(rand(-0.2, 0.2), rand(0, 3), rand(-0.2, 0.2));
  mesh(
    new THREE.DodecahedronGeometry(0.32 * scale, 0),
    mats.rockLight,
    g,
    [-0.24 * scale, 0.72 * scale, -0.05 * scale],
    [1, 0.65, 0.8],
  );
  return g;
}
function createRunner() {
  const root = group(scene, [0, 0, 3.5]);
  const torso = mesh(
    new THREE.BoxGeometry(0.68, 0.88, 0.4),
    mats.cloth,
    root,
    [0, 1.45, 0],
    [1, 0.96, 1],
  );
  torso.rotation.x = -0.12;
  const pack = mesh(
    new THREE.BoxGeometry(0.48, 0.55, 0.2),
    mats.clothDark,
    root,
    [0, 1.55, 0.26],
  );
  const head = group(root, [0, 2.12, 0]);
  mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    mats.skin,
    head,
    [0, 0, 0],
    [0.86, 1, 0.85],
  );
  mesh(
    new THREE.SphereGeometry(0.3, 12, 8),
    mats.clothDark,
    head,
    [0, 0.13, -0.02],
    [1, 0.5, 0.95],
  );
  mesh(
    new THREE.BoxGeometry(0.34, 0.08, 0.26),
    mats.clothDark,
    head,
    [0, 0.27, 0],
  );
  mesh(
    new THREE.SphereGeometry(0.035, 8, 6),
    mats.black,
    head,
    [-0.09, 0.02, 0.235],
  );
  mesh(
    new THREE.SphereGeometry(0.035, 8, 6),
    mats.black,
    head,
    [0.09, 0.02, 0.235],
  );
  const arms = [],
    legs = [];
  for (const side of [-1, 1]) {
    const arm = group(root, [side * 0.43, 1.66, 0]);
    capsule(arm, mats.skin, [0, -0.28, 0], 0.105, 0.45);
    capsule(arm, mats.cloth, [0, -0.08, 0], 0.13, 0.22);
    arms.push({ g: arm, side });
    const leg = group(root, [side * 0.2, 1.03, 0]);
    capsule(leg, mats.clothDark, [0, -0.25, 0], 0.14, 0.43);
    mesh(
      new THREE.BoxGeometry(0.25, 0.13, 0.4),
      mats.boot,
      leg,
      [0, -0.54, 0.08],
    );
    legs.push({ g: leg, side });
  }
  // belt and small shoulder straps
  mesh(new THREE.BoxGeometry(0.72, 0.12, 0.43), mats.boot, root, [0, 1.08, 0]);
  const scarf = mesh(
    new THREE.BoxGeometry(0.2, 0.18, 0.46),
    mats.clothDark,
    root,
    [0.12, 1.93, 0.02],
  );
  scarf.rotation.z = -0.25;
  root.userData = { torso, head, arms, legs, baseY: 0 };
  return root;
}
function createDino() {
  const root = group(scene, [0, 0, 7.2]);
  const body = mesh(
    new THREE.SphereGeometry(1, 20, 14),
    mats.dino,
    root,
    [0, 1.75, 0],
    [0.95, 0.78, 1.35],
  );
  const belly = mesh(
    new THREE.SphereGeometry(1, 16, 12),
    mats.dinoLight,
    root,
    [0, 1.45, 0.08],
    [0.72, 0.43, 1.03],
  );
  const neck = mesh(
    new THREE.CapsuleGeometry(0.35, 0.75, 5, 10),
    mats.dino,
    root,
    [0, 2.2, -0.9],
    [1, 1, 1],
  );
  neck.rotation.x = -0.58;
  const head = group(root, [0, 2.65, -1.45]);
  mesh(new THREE.BoxGeometry(0.95, 0.62, 1.05), mats.dino, head, [0, 0, -0.12]);
  mesh(
    new THREE.BoxGeometry(0.86, 0.28, 0.65),
    mats.dinoLight,
    head,
    [0, -0.27, -0.27],
  );
  mesh(
    new THREE.BoxGeometry(0.82, 0.17, 0.65),
    mats.dinoDark,
    head,
    [0, -0.4, -0.25],
  );
  for (const side of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.105, 10, 8), mats.eye, head, [
      side * 0.43,
      0.1,
      0.18,
    ]);
    mesh(new THREE.SphereGeometry(0.045, 8, 6), mats.black, head, [
      side * 0.46,
      0.1,
      0.235,
    ]);
    mesh(new THREE.ConeGeometry(0.07, 0.2, 5), mats.tooth, head, [
      side * 0.22,
      -0.38,
      -0.45,
    ]);
    // tiny forearms
    const arm = group(root, [side * 0.7, 1.92, -0.65]);
    capsule(arm, mats.dino, [0, -0.16, -0.1], 0.11, 0.32);
    arm.rotation.x = -0.6;
    arm.rotation.z = side * 0.25;
  }
  const tail = group(root, [0, 1.62, 1.0]);
  let parent = tail;
  for (let i = 0; i < 5; i++) {
    const seg = mesh(
      new THREE.ConeGeometry(0.43 - i * 0.065, 0.75, 8),
      mats.dino,
      parent,
      [0, 0, 0.35],
      [1, 1, 1],
    );
    seg.rotation.x = Math.PI / 2;
    seg.rotation.z = Math.PI;
    parent = group(parent, [0, 0, 0.62]);
  }
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = group(root, [side * 0.48, 1.15, 0.4]);
    capsule(leg, mats.dinoDark, [0, -0.35, 0], 0.2, 0.55);
    mesh(
      new THREE.BoxGeometry(0.43, 0.18, 0.48),
      mats.dinoDark,
      leg,
      [0, -0.68, -0.12],
    );
    legs.push({ g: leg, side });
  }
  root.userData = { body, head, tail, legs };
  return root;
}

const ground = mesh(
  new THREE.PlaneGeometry(180, 180),
  mats.ground,
  scene,
  [0, -0.12, -35],
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
const track = mesh(
  new THREE.PlaneGeometry(8.2, 180),
  mats.track,
  scene,
  [0, -0.035, -35],
);
track.rotation.x = -Math.PI / 2;
track.receiveShadow = true;
const edgeL = mesh(
  new THREE.PlaneGeometry(0.55, 180),
  mats.trackEdge,
  scene,
  [-4.37, -0.025, -35],
);
edgeL.rotation.x = -Math.PI / 2;
const edgeR = mesh(
  new THREE.PlaneGeometry(0.55, 180),
  mats.trackEdge,
  scene,
  [4.37, -0.025, -35],
);
edgeR.rotation.x = -Math.PI / 2;
const dashMaterial = new THREE.MeshStandardMaterial({
  color: "#e1b879",
  roughness: 1,
});
const dashes = [];
for (let lane = -1; lane <= 1; lane += 2) {
  for (let i = 0; i < 15; i++) {
    const dash = mesh(
      new THREE.BoxGeometry(0.045, 0.018, 0.9),
      dashMaterial,
      scene,
      [lane * 1.34, 0.005, -75 + i * 6],
    );
    dashes.push(dash);
  }
}
const distantRidges = new THREE.Group();
scene.add(distantRidges);
for (let i = 0; i < 12; i++) {
  const ridge = mesh(
    new THREE.ConeGeometry(rand(5, 10), rand(7, 14), 5),
    new THREE.MeshStandardMaterial({
      color: pick(["#355e49", "#416e50", "#557a51"]),
      roughness: 1,
    }),
    distantRidges,
    [rand(-35, 35), rand(2, 5), -48 - rand(0, 12)],
  );
  ridge.rotation.y = rand(0, 6);
  ridge.castShadow = false;
}

const scenery = [];
for (let i = 0; i < 34; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const tree = createTree(rand(0.65, 1.55));
  tree.position.set(side * rand(5.2, 11), 0, -75 + i * 4.3 + rand(-2, 2));
  tree.rotation.y = rand(-0.25, 0.25);
  scene.add(tree);
  scenery.push({ obj: tree, kind: "tree", side });
}
for (let i = 0; i < 38; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const fern = createFern(rand(0.5, 1.2));
  fern.position.set(side * rand(4.5, 8.5), 0, -78 + i * 4.1 + rand(-2, 2));
  fern.rotation.y = side === -1 ? rand(-0.8, 0.8) : Math.PI + rand(-0.8, 0.8);
  scene.add(fern);
  scenery.push({ obj: fern, kind: "fern", side });
}
for (let i = 0; i < 12; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const vine = createVine(rand(0.7, 1.35));
  vine.position.set(side * rand(5.4, 9.5), rand(0, 1.2), -72 + i * 8.2);
  vine.rotation.z = side * rand(-0.12, 0.12);
  scene.add(vine);
  scenery.push({ obj: vine, kind: "vine", side });
}
for (let i = 0; i < 20; i++) {
  const rock = createRock(rand(0.5, 1.1));
  rock.position.set(
    (Math.random() < 0.5 ? -1 : 1) * rand(4.7, 7.5),
    0,
    -85 + i * 7 + rand(-2, 2),
  );
  scene.add(rock);
  scenery.push({ obj: rock, kind: "rock", side: Math.sign(rock.position.x) });
}
// Floating jungle dust and fireflies add depth, especially in the cinematic chase.
const atmosphere = new THREE.Group();
scene.add(atmosphere);
const moteGeo = new THREE.SphereGeometry(0.025, 6, 5);
const moteMats = [
  new THREE.MeshBasicMaterial({
    color: 0xffd99a,
    transparent: true,
    opacity: 0.55,
  }),
  new THREE.MeshBasicMaterial({
    color: 0xaed9a4,
    transparent: true,
    opacity: 0.35,
  }),
];
const motes = [];
for (let i = 0; i < 100; i++) {
  const mote = new THREE.Mesh(moteGeo, moteMats[i % 2]);
  mote.position.set(rand(-9, 9), rand(0.25, 5.5), rand(-72, 8));
  mote.scale.setScalar(rand(0.5, 1.8));
  atmosphere.add(mote);
  motes.push(mote);
}

const runner = createRunner();
const dino = createDino();
// Use the original built-in Three.js runner. No external human model is loaded.
// Real asset files are fetched into public/models by `npm run assets`.
// A procedural fallback keeps the game playable if the downloads are skipped.
gltfLoader.load(
  "/models/dinosaur.glb",
  (gltf) => {
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          o.material.roughness = Math.min(o.material.roughness ?? 0.8, 0.82);
        }
      }
    });
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(2.65 / Math.max(size.y, 0.001));
    const scaledBox = new THREE.Box3().setFromObject(model);
    model.position.y -= scaledBox.min.y;
    // This asset was facing the camera. Rotate it another 180 degrees so its head faces the runner ahead of it on the track.
    model.rotation.y = Math.PI / 2;
    while (dino.children.length) dino.remove(dino.children[0]);
    dino.add(model);
    dino.userData.externalModel = true;
    dinoMixer = gltf.animations.length ? new THREE.AnimationMixer(model) : null;
    externalDinoHasAnimation = Boolean(dinoMixer && gltf.animations.length);
    if (dinoMixer && gltf.animations.length) {
      const runClip =
        gltf.animations.find((c) =>
          /run|walk|locomotion|attack/i.test(c.name),
        ) || gltf.animations[0];
      dinoMixer.clipAction(runClip).play();
    }
    externalDinoLoaded = true;
  },
  undefined,
  () => {
    /* Missing asset: keep the built-in fallback. */
  },
);

// Photoreal CC0 fern model with embedded PBR textures. Replace generated fern
// props once loaded, while preserving each prop's world position and recycle logic.
gltfLoader.load(
  "/models/fern.glb",
  (gltf) => {
    const source = gltf.scene;
    source.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const sourceBox = new THREE.Box3().setFromObject(source);
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    const fernScale = 1.85 / Math.max(sourceSize.x, sourceSize.z, 0.001);
    for (const item of scenery.filter((entry) => entry.kind === "fern")) {
      const clone = source.clone(true);
      clone.scale.setScalar(fernScale);
      const box = new THREE.Box3().setFromObject(clone);
      clone.position.y -= box.min.y;
      item.obj.clear();
      item.obj.add(clone);
    }
    externalFernLoaded = true;
  },
  undefined,
  () => {
    /* Missing asset: generated fern props remain. */
  },
);
const entities = [];
const coinEntities = [];
const coinMaterial = new THREE.MeshStandardMaterial({
  color: "#f7ca5e",
  metalness: 0.75,
  roughness: 0.2,
  emissive: "#8c5012",
  emissiveIntensity: 0.45,
});
const coinInner = new THREE.MeshStandardMaterial({
  color: "#fff0b1",
  metalness: 0.5,
  roughness: 0.25,
});
const coinGeo = new THREE.TorusGeometry(0.28, 0.075, 8, 18);
const coinCoreGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12);

let chaseActive = false,
  rideUntil = 0,
  vehicle = null,
  chasePulse = 0,
  encounterBannerUntil = 0;
let state = "menu",
  lane = 0,
  laneTarget = 0,
  jumpTime = 0,
  slideTime = 0,
  hits = 0,
  distance = 0,
  score = 0,
  runCoins = 0,
  speed = 11,
  spawnClock = 1,
  coinClock = 1,
  elapsed = 0,
  lastTime = 0,
  invulnerable = 0,
  shake = 0;
runner.visible = false;
dino.visible = false;

function createVehicle() {
  const g = new THREE.Group();
  // Stylized off-road jeep: body, hood, cabin, bumpers, wheels, lights.
  mesh(
    new THREE.BoxGeometry(1.55, 0.48, 2.15),
    mats.vehicleBody,
    g,
    [0, 0.72, 0],
  );
  mesh(
    new THREE.BoxGeometry(1.25, 0.46, 1.02),
    mats.vehicleBody,
    g,
    [0, 1.13, -0.22],
  );
  mesh(
    new THREE.BoxGeometry(1.08, 0.34, 0.78),
    mats.glass,
    g,
    [0, 1.16, -0.24],
  );
  mesh(
    new THREE.BoxGeometry(1.58, 0.12, 0.18),
    mats.rubber,
    g,
    [0, 0.58, -1.08],
  );
  mesh(
    new THREE.BoxGeometry(1.58, 0.12, 0.18),
    mats.rubber,
    g,
    [0, 0.58, 1.08],
  );
  for (const x of [-0.79, 0.79])
    for (const z of [-0.68, 0.7]) {
      const wheel = mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.18, 12),
        mats.rubber,
        g,
        [x, 0.39, z],
      );
      wheel.rotation.z = Math.PI / 2;
      mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.19, 10),
        mats.rockLight,
        g,
        [x * 1.01, 0.39, z],
      ).rotation.z = Math.PI / 2;
    }
  for (const x of [-0.48, 0.48])
    mesh(new THREE.BoxGeometry(0.22, 0.13, 0.08), mats.headlight, g, [
      x,
      0.83,
      -1.1,
    ]);
  mesh(new THREE.BoxGeometry(0.18, 0.4, 0.2), mats.bark, g, [-0.42, 1.35, 0.2]);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
function triggerVehicleRide(withVehicle = true) {
  // One encounter at a time: ignore new triggers until the current chase ends.
  if (state !== "play" || chaseActive || elapsed < rideUntil) return;
  rideUntil = elapsed + 6.5;
  chaseActive = true;
  chasePulse = 1;
  encounterBannerUntil = elapsed + 2.3;
  // The dinosaur is deliberately hidden during normal running and appears only after a challenge collision.
  dino.visible = true;
  dino.position.set(runner.position.x, 0, runner.position.z + 6.2);
  dino.scale.setScalar(1.08);
  scene.fog.color.set("#263b36");
  scene.fog.density = 0.031;
  bloomPass.strength = 0.52;
  renderer.toneMappingExposure = 1.28;
  camera.fov = 68;
  camera.updateProjectionMatrix();
  $("encounterBanner")?.classList.add("active");
  $("cinematicBars")?.classList.add("active");
  if (vehicle) {
    scene.remove(vehicle);
    vehicle = null;
  }
  if (withVehicle) {
    vehicle = createVehicle();
    vehicle.position.set(runner.position.x, 0.0, runner.position.z + 0.05);
    vehicle.scale.setScalar(0.72);
    scene.add(vehicle);
  }
  speed = Math.min(27, speed + 8);
  score += 250;
}

function makeObstacle(type, laneIndex, z) {
  const g = new THREE.Group();
  g.userData = { type, lane: laneIndex, z, hit: false };
  if (type === "log") {
    if (deadTrunkTemplate) {
      const trunk = deadTrunkTemplate.clone(true);

      const box = new THREE.Box3().setFromObject(trunk);
      const size = box.getSize(new THREE.Vector3());

      // Fit the log across one lane.
      const targetLength = 2.5;
      const scale = targetLength / Math.max(size.x, size.z, 0.001);
      trunk.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(trunk);
      trunk.position.y -= scaledBox.min.y;

      // Orient the longest axis horizontally across the running lane.
      if (size.z > size.x) {
        trunk.rotation.y = Math.PI / 2;
      }

      trunk.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      g.add(trunk);
    } else {
      // Keep the original procedural log as a loading fallback.
      mesh(
        new THREE.CylinderGeometry(0.36, 0.42, 2.15, 10),
        mats.bark,
        g,
        [0, 0.37, 0],
      ).rotation.z = Math.PI / 2;
    }
  } else if (type === "rock") {
    const r = mesh(
      new THREE.DodecahedronGeometry(0.65, 1),
      mats.rock,
      g,
      [0, 0.5, 0],
      [1.2, 0.9, 1],
    );
    r.rotation.set(0.1, rand(0, 4), 0.15);
    mesh(
      new THREE.DodecahedronGeometry(0.28, 0),
      mats.rockLight,
      g,
      [-0.18, 0.9, -0.1],
      [1, 0.7, 0.9],
    );
    mesh(
      new THREE.DodecahedronGeometry(0.22, 0),
      mats.rockLight,
      g,
      [0.32, 0.62, 0.3],
      [1, 0.7, 0.9],
    );
  } else {
    mesh(
      new THREE.CylinderGeometry(0.15, 0.22, 2.0, 7),
      mats.bark,
      g,
      [0, 0.98, 0],
    );
    const thorn = mesh(
      new THREE.ConeGeometry(0.3, 0.55, 6),
      mats.leaf1,
      g,
      [0, 1.9, 0],
    );
    thorn.rotation.z = Math.PI;
    const branch = mesh(
      new THREE.CylinderGeometry(0.09, 0.13, 1.5, 6),
      mats.bark,
      g,
      [0, 1.2, 0],
    );
    branch.rotation.z = Math.PI / 2.8;
    const leaf = mesh(
      new THREE.ConeGeometry(0.32, 0.85, 5),
      mats.leaf2,
      g,
      [0.35, 1.52, 0],
    );
    leaf.rotation.z = -0.65;
  }
  g.position.set(laneIndex * 2.2, 0, z);
  scene.add(g);
  entities.push(g);
  return g;
}
function makeCoin(laneIndex, z) {
  const g = new THREE.Group();
  g.userData = { lane: laneIndex, z, got: false };
  mesh(coinGeo, coinMaterial, g, [0, 1.35, 0]);
  mesh(coinCoreGeo, coinInner, g, [0, 1.35, 0]).rotation.x = Math.PI / 2;
  g.position.x = laneIndex * 2.2;
  scene.add(g);
  coinEntities.push(g);
  return g;
}
function removeEntity(arr, obj) {
  scene.remove(obj);
  obj.traverse?.((o) => {
    if (o.geometry && o.geometry !== coinGeo && o.geometry !== coinCoreGeo) {
      /* shared geometries are intentionally retained */
    }
  });
  const i = arr.indexOf(obj);
  if (i >= 0) arr.splice(i, 1);
}
function setScreen(which) {
  for (const id of ["startScreen", "helpScreen", "pauseScreen", "overScreen"])
    $(id).classList.toggle("hidden", id !== which);
}
function setPlayingUI(on) {
  $("hud").classList.toggle("active", on);
  $("mobileControls").classList.toggle("active", on);
  $("bottomHint").classList.toggle("hidden", on);
}
function updateHud() {
  $("distance").innerHTML = `${Math.floor(distance)} <i>m</i>`;
  $("score").textContent = String(score).padStart(6, "0");
  $("coins").textContent = runCoins;
}
function startRun() {
  entities.slice().forEach((o) => removeEntity(entities, o));
  coinEntities.slice().forEach((o) => removeEntity(coinEntities, o));
  if (vehicle) {
    scene.remove(vehicle);
    vehicle = null;
  }
  chaseActive = false;
  rideUntil = 0;
  dino.visible = false;
  dino.scale.setScalar(1);
  $("encounterBanner")?.classList.remove("active");
  $("cinematicBars")?.classList.remove("active");
  scene.fog.color.set("#64796a");
  scene.fog.density = scene.userData.baseFogDensity;
  bloomPass.strength = 0.32;
  renderer.toneMappingExposure = 1.18;
  camera.fov = window.innerHeight > window.innerWidth ? 62 : 58;
  camera.updateProjectionMatrix();
  $("encounterBanner")?.classList.remove("active");
  $("cinematicBars")?.classList.remove("active");
  state = "play";
  lane = 0;
  laneTarget = 0;
  jumpTime = 0;
  slideTime = 0;
  hits = 0;
  distance = 0;
  score = 0;
  runCoins = 0;
  speed = 11;
  spawnClock = 0.8;
  coinClock = 1;
  elapsed = 0;
  invulnerable = 0;
  shake = 0;
  runner.position.set(0, 0, 3.5);
  runner.visible = true;
  runner.scale.setScalar(1);
  dino.position.set(0, 0, runner.position.z + 9.5);
  dino.visible = false;
  setScreen(null);
  setPlayingUI(true);
  $("hud").classList.add("active");
  updateHud();
}
function endRun() {
  state = "over";
  runner.visible = false;
  $("finalScore").textContent = String(score).padStart(6, "0");
  $("finalDistance").textContent = `${Math.floor(distance)} m`;
  $("finalCoins").textContent = runCoins;
  saved.best = Math.max(saved.best, score);
  saved.coins = (saved.coins || 0) + runCoins;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch {}
  $("bestStart").textContent = String(saved.best).padStart(6, "0");
  setPlayingUI(false);
  setScreen("overScreen");
}
function pauseRun() {
  if (state === "play") {
    state = "paused";
    setScreen("pauseScreen");
    setPlayingUI(false);
  }
}
function resumeRun() {
  if (state === "paused") {
    state = "play";
    setScreen(null);
    setPlayingUI(true);
  }
}
function action(type) {
  if (state !== "play") return;
  if (type === "left") laneTarget = Math.max(-1, laneTarget - 1);
  if (type === "right") laneTarget = Math.min(1, laneTarget + 1);
  if (type === "jump" && jumpTime <= 0 && slideTime <= 0) jumpTime = 0.001;
  if (type === "slide" && slideTime <= 0 && jumpTime <= 0) slideTime = 0.001;
}
window.addEventListener("keydown", (e) => {
  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (state === "menu" && e.code === "Enter") {
    startRun();
    return;
  }
  if (e.code === "ArrowLeft" || e.code === "KeyA") action("left");
  if (e.code === "ArrowRight" || e.code === "KeyD") action("right");
  if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space")
    action("jump");
  if (e.code === "ArrowDown" || e.code === "KeyS") action("slide");
  if (e.code === "Escape" || e.code === "KeyP") {
    if (state === "play") pauseRun();
    else if (state === "paused") resumeRun();
  }
});
document.querySelectorAll("[data-action]").forEach((btn) => {
  const doAction = (e) => {
    e.preventDefault();
    action(btn.dataset.action);
  };
  btn.addEventListener("pointerdown", doAction);
});
$("playBtn").addEventListener("click", startRun);
$("howBtn").addEventListener("click", () => setScreen("helpScreen"));
$("backBtn").addEventListener("click", () => setScreen("startScreen"));
$("pauseBtn").addEventListener("click", pauseRun);
$("resumeBtn").addEventListener("click", resumeRun);
$("restartPauseBtn").addEventListener("click", startRun);
$("retryBtn").addEventListener("click", startRun);
$("campBtn").addEventListener("click", () => {
  state = "menu";
  runner.visible = false;
  dino.visible = false;
  setPlayingUI(false);
  setScreen("startScreen");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "play") pauseRun();
});

function resize() {
  const w = window.innerWidth,
    h = window.innerHeight;
  camera.aspect = w / h;
  camera.fov = h > w ? 62 : 56;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, h > w ? 1.2 : 1.65),
  );
  renderer.setSize(w, h);
  composer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, h > w ? 1.2 : 1.65),
  );
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
}
window.addEventListener("resize", resize);

function animateRunner(dt) {
  const ud = runner.userData;
  const running = state === "play";
  if (runnerMixer) {
    runnerMixer.update(dt);
  }
  const t = elapsed * 11;
  const jumping = jumpTime > 0;
  const sliding = slideTime > 0;
  const jumpY = jumping
    ? Math.sin(clamp(jumpTime / 0.85, 0, 1) * Math.PI) * 1.45
    : 0;
  runner.position.y = jumpY;
  runner.position.x = THREE.MathUtils.damp(
    runner.position.x,
    laneTarget * 2.2,
    12,
    dt,
  );
  runner.scale.y = sliding ? (externalRunnerLoaded ? 0.82 : 0.66) : 1;
  ud.torso.rotation.x = sliding ? 0.65 : -0.12 + Math.sin(t) * 0.04;
  ud.head.rotation.x = sliding ? 0.15 : Math.sin(t) * 0.035;
  ud.arms.forEach(({ g, side }, i) => {
    g.rotation.x = sliding ? -0.85 : Math.sin(t + i * Math.PI) * 0.85;
    g.rotation.z = side * 0.08;
  });
  ud.legs.forEach(({ g }, i) => {
    g.rotation.x = sliding ? 0.2 : Math.sin(t + i * Math.PI) * 0.9;
  });
  runner.visible =
    (state === "play" || state === "paused") &&
    !(vehicle && elapsed < rideUntil);
  if (invulnerable > 0) {
    invulnerable -= dt;
    runner.visible = Math.floor(invulnerable * 16) % 2 === 0;
  }
  if (jumpTime > 0) {
    jumpTime += dt;
    if (jumpTime >= 0.85) jumpTime = 0;
  }
  if (slideTime > 0) {
    slideTime += dt;
    if (slideTime >= 0.72) slideTime = 0;
  }
  if (chaseActive && dino.visible) {
    dino.position.x = THREE.MathUtils.damp(
      dino.position.x,
      runner.position.x * 0.55,
      3.8,
      dt,
    );
    dino.position.z =
      THREE.MathUtils.damp(dino.position.z, runner.position.z + 3.9, 2.8, dt) +
      Math.sin(elapsed * 11) * 0.045;
  }
  const du = dino.userData;
  if (dinoMixer) dinoMixer.update(dt);
  if (externalDinoLoaded && chaseActive && dino.visible) {
    // Lightweight body motion still gives a static hero mesh a sense of weight.
    dino.position.y = externalDinoHasAnimation
      ? Math.abs(Math.sin(elapsed * 10)) * 0.025
      : Math.abs(Math.sin(elapsed * 11)) * 0.13;
    dino.rotation.z =
      Math.sin(elapsed * 8) * (externalDinoHasAnimation ? 0.012 : 0.028);
    if (!externalDinoHasAnimation) {
      // The source model may be a static mesh. A rhythmic bounce and body pitch
      // keep it visibly running instead of looking like a frozen cut-out.
      const hero = dino.children[0];
      if (hero) {
        hero.rotation.x = Math.sin(elapsed * 11) * 0.055;
        hero.rotation.z = Math.sin(elapsed * 5.5) * 0.018;
      }
    }
  } else if (externalDinoLoaded) {
    dino.position.y = 0;
    dino.rotation.z = 0;
  }
  if (!externalDinoLoaded && chaseActive && dino.visible) {
    du.body.rotation.z = Math.sin(elapsed * 9) * 0.075;
    du.head.rotation.x = Math.sin(elapsed * 7.5) * 0.13;
    du.tail.rotation.y = Math.sin(elapsed * 6) * 0.3;
    du.legs.forEach(
      ({ g, side }) =>
        (g.rotation.x =
          Math.sin(elapsed * 11 + (side > 0 ? Math.PI : 0)) * 0.72),
    );
  } else if (!externalDinoLoaded) {
    du.body.rotation.z = 0;
    du.head.rotation.x = 0;
    du.tail.rotation.y = 0;
  }
}

function updateWorld(dt) {
  // Dash marks and scenery drift towards the player, creating forward movement.
  for (const dash of dashes) {
    dash.position.z += speed * dt;
    if (dash.position.z > 12) dash.position.z = -78;
  }
  for (const item of scenery) {
    item.obj.position.z += speed * dt * (item.kind === "tree" ? 0.92 : 1.0);
    if (item.obj.position.z > 12) {
      item.obj.position.z = -88 - rand(0, 24);
      item.obj.position.x =
        item.side *
        rand(item.kind === "tree" ? 5.2 : 4.5, item.kind === "tree" ? 11 : 8.5);
    }
  }
  spawnClock -= dt;
  coinClock -= dt;
  if (spawnClock <= 0) {
    const laneIndex = pick([-1, 0, 1]);
    if (Math.random() < 0.16) {
      const car = group(scene, [laneIndex * 2.2, 0, -58]);
      car.userData = { type: "vehicle", lane: laneIndex, z: -58, hit: false };
      const model = createVehicle();
      model.scale.setScalar(0.62);
      car.add(model);
      entities.push(car);
    } else {
      const type = pick(["log", "rock", "branch"]);
      makeObstacle(type, laneIndex, -58);
    }
    if (Math.random() < 0.3) {
      const other = pick([-1, 0, 1].filter((n) => n !== laneIndex));
      makeCoin(other, -48);
    }
    spawnClock = Math.max(
      0.68,
      rand(1.05, 1.55) - Math.min(0.35, distance / 1200),
    );
  }
  if (coinClock <= 0) {
    const laneIndex = pick([-1, 0, 1]);
    const count = pick([3, 4, 5]);
    for (let i = 0; i < count; i++) makeCoin(laneIndex, -50 - i * 2.25);
    coinClock = rand(2.5, 4.1);
  }
  for (const o of [...entities]) {
    o.userData.z += speed * dt;
    o.position.z = o.userData.z;
    o.rotation.y += dt * 0.12;
    // Use the active vehicle as the collision target during the car ride.
    // The ride car is longer/wider than the runner, so its collision envelope
    // needs a larger forward/backward range and width. This applies to every
    // obstacle type, including logs, rocks, branches, and other cars.
    const ridingNow = elapsed < rideUntil && Boolean(vehicle);

    const playerX = ridingNow ? vehicle.position.x : runner.position.x;

    const playerZ = ridingNow ? vehicle.position.z : runner.position.z;

    const collisionDistance = ridingNow
      ? 2.9
      : o.userData.type === "vehicle"
        ? 2.6
        : 1.65;

    const near = Math.abs(o.userData.z - playerZ) < collisionDistance;

    const obstacleX = o.position.x;

    const playerHalfWidth = ridingNow ? 1.05 : 0.38;

    const obstacleHalfWidth = o.userData.type === "vehicle" ? 0.85 : 0.62;

    const laneOverlap =
      Math.abs(obstacleX - playerX) < playerHalfWidth + obstacleHalfWidth;

    // Ignore collisions during car mode.
    // The hit count remains unchanged until car mode ends.
    // Ignore car collisions and all obstacle collisions during car mode.
  // Car collision triggers car mode but does not count as a hit.
if (
  near &&
  laneOverlap &&
  !o.userData.hit
) {
  if (o.userData.type === "vehicle") {
    o.userData.hit = true;
    triggerVehicleRide(true);
    removeEntity(entities, o);
    continue;
  }

  // Ignore trunk and rock collisions during car mode.
  if (ridingNow) {
    continue;
  }

  const safeJump =
    jumpTime > 0.12 && o.userData.type !== "branch";

  const safeSlide =
    slideTime > 0.12 && o.userData.type === "branch";

  if (!safeJump && !safeSlide) {
    o.userData.hit = true;
    hits++;

    if (hits >= 2) {
      removeEntity(entities, o);
      endRun();
      break;
    }

    invulnerable = 1.0;
    speed = Math.max(8, speed * 0.78);

    if (["log", "rock", "branch"].includes(o.userData.type)) {
      triggerVehicleRide(false);
    }

    removeEntity(entities, o);
  }
}
}
  for (const c of [...coinEntities]) {
    c.userData.z += speed * dt;
    c.position.z = c.userData.z;
    c.rotation.y += dt * 2.6;
    if (
      !c.userData.got &&
      Math.abs(c.userData.z - runner.position.z) < 0.8 &&
      c.userData.lane === laneTarget
    ) {
      c.userData.got = true;
      runCoins++;
      score += 50;
      c.scale.setScalar(0.01);
      removeEntity(coinEntities, c);
    } else if (c.userData.z > 13) removeEntity(coinEntities, c);
  }
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000 || 0, 0.04);
  lastTime = now;
  for (const mote of motes) {
    mote.position.z += (state === "play" ? speed * 0.24 : 1.1) * dt;
    mote.position.x += Math.sin(now * 0.0003 + mote.position.y) * dt * 0.12;
    if (mote.position.z > 9) {
      mote.position.z = -78 - rand(0, 12);
      mote.position.x = rand(-9, 9);
      mote.position.y = rand(0.25, 5.5);
    }
  }
  if (state === "play") {
    elapsed += dt;
    const riding = elapsed < rideUntil;
    distance += speed * dt * (riding ? 1.7 : 1);
    speed = Math.min(riding ? 29 : 23, speed + dt * (riding ? 0.02 : 0.085));
    if (vehicle) {
      vehicle.position.x = THREE.MathUtils.damp(
        vehicle.position.x,
        runner.position.x,
        10,
        dt,
      );
      vehicle.position.z = runner.position.z + 0.05;
      vehicle.rotation.z = Math.sin(elapsed * 8) * 0.015;
      if (!riding) {
        scene.remove(vehicle);
        vehicle = null;
      }
    }
    if (elapsed >= rideUntil && !riding) {
      chaseActive = false;
      dino.visible = false;
      dino.scale.setScalar(1);
      scene.fog.color.set("#64796a");
      scene.fog.density = scene.userData.baseFogDensity;
      bloomPass.strength = 0.32;
      renderer.toneMappingExposure = 1.18;
      camera.fov = window.innerHeight > window.innerWidth ? 62 : 58;
      camera.updateProjectionMatrix();
      $("encounterBanner")?.classList.remove("active");
      $("cinematicBars")?.classList.remove("active");
    }
    if (elapsed > encounterBannerUntil)
      $("encounterBanner")?.classList.remove("active");
    score = Math.floor(distance * 10) + runCoins * 50;
    updateWorld(dt);
    animateRunner(dt);
    updateHud();
  } else if (state === "paused") {
    // freeze gameplay while preserving a subtle idle dino animation
    elapsed += dt * 0.12;
    animateRunner(dt * 0.12);
  } else {
    elapsed += dt * 0.35;
    dino.visible = false;
    // slow ambient drift in title scene
    scenery.forEach((item, i) => {
      item.obj.rotation.y += Math.sin(elapsed * 0.25 + i) * dt * 0.006;
    });
  }
  if (shake > 0) {
    shake -= dt;
    camera.position.x = rand(-0.12, 0.12);
    camera.position.y = 5.8 + rand(-0.08, 0.08);
  } else {
    camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 6, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 5.8, 6, dt);
  }
  if (state === "play" && chaseActive) {
    const cinematicTargetZ = runner.position.z + 10.6;
    cinematicCameraPosition.set(
      runner.position.x * 0.22,
      5.45,
      cinematicTargetZ,
    );
    camera.position.lerp(cinematicCameraPosition, Math.min(1, dt * 2.2));
    cinematicLookTarget.set(
      runner.position.x * 0.2,
      1.45,
      runner.position.z - 6.8,
    );
    camera.lookAt(cinematicLookTarget);
  } else {
    camera.position.lerp(baseCameraPosition, Math.min(1, dt * 3.5));
    camera.lookAt(0, 1.1, -5);
  }
  composer.render();
}
resize();
setScreen("startScreen");
setPlayingUI(false);
requestAnimationFrame(animate);
