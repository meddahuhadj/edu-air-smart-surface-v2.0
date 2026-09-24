import * as THREE from "three";
import type { DictKey } from "../i18n/dictionaries";
import type { Object3DDef, Object3DPart } from "./types";

function part(id: string, labelKey: DictKey, mesh: THREE.Object3D, explodeDir: THREE.Vector3): Object3DPart {
  return { id, labelKey, mesh, explodeDir: explodeDir.clone().normalize() };
}

function sphere(radius: number, color: number, segments = 24): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments, segments),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 }),
  );
}

function bond(from: THREE.Vector3, to: THREE.Vector3, radius = 0.04, color = 0x8892a6): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

// --- Astronomy: solar system (schematic, not to scale) ---------------------
function buildSolarSystem() {
  const group = new THREE.Group();
  const parts: Object3DPart[] = [];

  const sun = sphere(0.55, 0xffcc55, 32);
  sun.material = new THREE.MeshStandardMaterial({ color: 0xffcc55, emissive: 0xff9900, emissiveIntensity: 0.6 });
  group.add(sun);
  parts.push(part("sun", "scene3d.part.sun", sun, new THREE.Vector3(0, 0, 0.001)));

  const planets: { id: string; labelKey: DictKey; radius: number; orbit: number; color: number }[] = [
    { id: "mercury", labelKey: "scene3d.part.mercury", radius: 0.09, orbit: 1.0, color: 0xaaa9ad },
    { id: "venus", labelKey: "scene3d.part.venus", radius: 0.14, orbit: 1.45, color: 0xd9b38c },
    { id: "earth", labelKey: "scene3d.part.earth", radius: 0.16, orbit: 1.95, color: 0x4a90e2 },
    { id: "mars", labelKey: "scene3d.part.mars", radius: 0.11, orbit: 2.4, color: 0xc1440e },
  ];

  for (const p of planets) {
    const angle = (p.orbit / 2.4) * Math.PI * 1.3;
    const pos = new THREE.Vector3(Math.cos(angle) * p.orbit, 0, Math.sin(angle) * p.orbit);
    const mesh = sphere(p.radius, p.color);
    mesh.position.copy(pos);
    group.add(mesh);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(p.orbit - 0.01, p.orbit + 0.01, 64),
      new THREE.MeshBasicMaterial({ color: 0x2a3550, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    parts.push(part(p.id, p.labelKey, mesh, pos));
  }

  return { group, parts };
}

// --- Astronomy: Earth & Moon System -----------------------------------------
function buildEarthMoon() {
  const group = new THREE.Group();

  const earth = sphere(0.55, 0x3b82f6);
  earth.position.set(-0.4, 0, 0);

  const moon = sphere(0.18, 0xd1d5db);
  moon.position.set(1.1, 0.2, 0.4);

  const orbitRing = new THREE.Mesh(
    new THREE.RingGeometry(1.48, 1.5, 64),
    new THREE.MeshBasicMaterial({ color: 0x475569, side: THREE.DoubleSide, transparent: true, opacity: 0.4 }),
  );
  orbitRing.rotation.x = Math.PI / 2.2;
  orbitRing.position.set(-0.4, 0, 0);

  group.add(earth, moon, orbitRing);

  const parts: Object3DPart[] = [
    part("earthGlob", "scene3d.part.earth", earth, new THREE.Vector3(-1, 0, 0)),
    part("moonGlob", "scene3d.part.moon", moon, new THREE.Vector3(1, 0.5, 0.5)),
  ];

  return { group, parts };
}

// --- Chemistry: water molecule ----------------------------------------------
function buildWaterMolecule() {
  const group = new THREE.Group();
  const parts: Object3DPart[] = [];

  const oPos = new THREE.Vector3(0, 0, 0);
  const angle = THREE.MathUtils.degToRad(104.5) / 2;
  const bondLen = 0.9;
  const h1Pos = new THREE.Vector3(Math.sin(angle) * bondLen, Math.cos(angle) * bondLen, 0);
  const h2Pos = new THREE.Vector3(-Math.sin(angle) * bondLen, Math.cos(angle) * bondLen, 0);

  const oxygen = sphere(0.42, 0xe0433d);
  oxygen.position.copy(oPos);
  group.add(oxygen);
  parts.push(part("oxygen", "scene3d.part.oxygen", oxygen, new THREE.Vector3(0, -1, 0)));

  const h1 = sphere(0.26, 0xf5f5f5);
  h1.position.copy(h1Pos);
  const h2 = sphere(0.26, 0xf5f5f5);
  h2.position.copy(h2Pos);
  group.add(h1, h2);
  parts.push(part("hydrogen1", "scene3d.part.hydrogen", h1, h1Pos));
  parts.push(part("hydrogen2", "scene3d.part.hydrogen", h2, h2Pos));

  const bonds = new THREE.Group();
  bonds.add(bond(oPos, h1Pos), bond(oPos, h2Pos));
  group.add(bonds);
  parts.push(part("bonds", "scene3d.part.bonds", bonds, new THREE.Vector3(0, 1, 0)));

  return { group, parts };
}

// --- Biology: DNA double helix ----------------------------------------------
function buildDna() {
  const group = new THREE.Group();
  const strandA = new THREE.Group();
  const strandB = new THREE.Group();
  const basePairs = new THREE.Group();

  const turns = 3;
  const steps = 48;
  const height = 3.2;
  const radius = 0.55;
  const pairColors = [0x4ade80, 0xfbbf24, 0x60a5fa, 0xf87171];

  let prevA: THREE.Vector3 | null = null;
  let prevB: THREE.Vector3 | null = null;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = t * Math.PI * 2 * turns;
    const y = t * height - height / 2;
    const a = new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
    const b = new THREE.Vector3(Math.cos(theta + Math.PI) * radius, y, Math.sin(theta + Math.PI) * radius);

    const nodeA = sphere(0.07, 0x38bdf8, 10);
    nodeA.position.copy(a);
    const nodeB = sphere(0.07, 0xa78bfa, 10);
    nodeB.position.copy(b);
    strandA.add(nodeA);
    strandB.add(nodeB);

    if (prevA && prevB) {
      strandA.add(bond(prevA, a, 0.03, 0x38bdf8));
      strandB.add(bond(prevB, b, 0.03, 0xa78bfa));
    }
    if (i % 3 === 0) {
      basePairs.add(bond(a, b, 0.035, pairColors[(i / 3) % pairColors.length]));
    }
    prevA = a;
    prevB = b;
  }

  group.add(strandA, strandB, basePairs);

  const parts: Object3DPart[] = [
    part("strandA", "scene3d.part.strandA", strandA, new THREE.Vector3(1, 0, 0)),
    part("strandB", "scene3d.part.strandB", strandB, new THREE.Vector3(-1, 0, 0)),
    part("basePairs", "scene3d.part.basePairs", basePairs, new THREE.Vector3(0, 1, 0)),
  ];

  return { group, parts };
}

// --- Biology: Human Heart ---------------------------------------------------
function buildHeart() {
  const group = new THREE.Group();

  const ventricles = sphere(0.45, 0xd93838);
  ventricles.scale.set(1.1, 1.3, 0.9);
  ventricles.position.set(0, -0.15, 0);

  const atria = sphere(0.35, 0xef4444);
  atria.scale.set(1.2, 0.8, 0.9);
  atria.position.set(0, 0.35, 0);

  const aortaCurve = new THREE.TorusGeometry(0.25, 0.08, 12, 24, Math.PI);
  const aortaMesh = new THREE.Mesh(aortaCurve, new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }));
  aortaMesh.rotation.z = -Math.PI / 4;
  aortaMesh.position.set(0.1, 0.45, 0);

  const venaCava = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.7, 16),
    new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 }),
  );
  venaCava.position.set(-0.3, 0.3, 0.1);

  group.add(ventricles, atria, aortaMesh, venaCava);

  const parts: Object3DPart[] = [
    part("ventricles", "scene3d.part.ventricles", ventricles, new THREE.Vector3(0, -1, 0)),
    part("atria", "scene3d.part.atria", atria, new THREE.Vector3(0, 1, 0)),
    part("aorta", "scene3d.part.aorta", aortaMesh, new THREE.Vector3(1, 1, 0)),
    part("venaCava", "scene3d.part.venaCava", venaCava, new THREE.Vector3(-1, 0.5, 0)),
  ];

  return { group, parts };
}

// --- Biology: Human Brain ---------------------------------------------------
function buildBrain() {
  const group = new THREE.Group();

  const cerebrumLeft = sphere(0.45, 0xf472b6);
  cerebrumLeft.scale.set(0.85, 1.1, 1.2);
  cerebrumLeft.position.set(-0.32, 0.2, 0);

  const cerebrumRight = sphere(0.45, 0xec4899);
  cerebrumRight.scale.set(0.85, 1.1, 1.2);
  cerebrumRight.position.set(0.32, 0.2, 0);

  const cerebellum = sphere(0.3, 0xdb2777);
  cerebellum.scale.set(1.1, 0.8, 0.9);
  cerebellum.position.set(0, -0.35, -0.3);

  const brainstem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.5 }),
  );
  brainstem.position.set(0, -0.5, 0);

  group.add(cerebrumLeft, cerebrumRight, cerebellum, brainstem);

  const parts: Object3DPart[] = [
    part("cerebrumLeft", "scene3d.part.cerebrumLeft", cerebrumLeft, new THREE.Vector3(-1, 0.5, 0)),
    part("cerebrumRight", "scene3d.part.cerebrumRight", cerebrumRight, new THREE.Vector3(1, 0.5, 0)),
    part("cerebellum", "scene3d.part.cerebellum", cerebellum, new THREE.Vector3(0, -1, -1)),
    part("brainstem", "scene3d.part.brainstem", brainstem, new THREE.Vector3(0, -1, 0.5)),
  ];

  return { group, parts };
}

// --- Biology: Plant Cell ----------------------------------------------------
function buildPlantCell() {
  const group = new THREE.Group();

  const cellWall = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.2, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, transparent: true, opacity: 0.35, roughness: 0.2 }),
  );

  const vacuole = sphere(0.35, 0x38bdf8);
  vacuole.scale.set(1.3, 1.0, 0.9);
  vacuole.position.set(-0.25, -0.1, 0);

  const nucleus = sphere(0.22, 0xa855f7);
  nucleus.position.set(0.4, 0.2, 0);

  const chloroGroup = new THREE.Group();
  const c1 = sphere(0.1, 0x16a34a); c1.position.set(0.4, -0.3, 0.2);
  const c2 = sphere(0.1, 0x16a34a); c2.position.set(-0.5, 0.3, -0.2);
  const c3 = sphere(0.1, 0x16a34a); c3.position.set(0.1, 0.4, 0.1);
  chloroGroup.add(c1, c2, c3);

  group.add(cellWall, vacuole, nucleus, chloroGroup);

  const parts: Object3DPart[] = [
    part("cellWall", "scene3d.part.cellWall", cellWall, new THREE.Vector3(0, 0, 1)),
    part("vacuole", "scene3d.part.vacuole", vacuole, new THREE.Vector3(-1, 0, 0)),
    part("nucleus", "scene3d.part.nucleus", nucleus, new THREE.Vector3(1, 1, 0)),
    part("chloroplasts", "scene3d.part.chloroplasts", chloroGroup, new THREE.Vector3(0, 1, 0)),
  ];

  return { group, parts };
}

// --- Biology: Leaf Cell & Photosynthesis ------------------------------------
function buildLeafCell() {
  const group = new THREE.Group();

  const upperCuticle = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.1, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x84cc16, transparent: true, opacity: 0.5 }),
  );
  upperCuticle.position.set(0, 0.5, 0);

  const palisadeCells = new THREE.Group();
  for (let i = -2; i <= 2; i++) {
    const cell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.3 }),
    );
    cell.position.set(i * 0.3, 0.1, 0);
    palisadeCells.add(cell);
  }

  const stomata = sphere(0.15, 0xeab308);
  stomata.position.set(0, -0.5, 0);

  group.add(upperCuticle, palisadeCells, stomata);

  const parts: Object3DPart[] = [
    part("upperCuticle", "scene3d.part.upperCuticle", upperCuticle, new THREE.Vector3(0, 1, 0)),
    part("palisadeLayer", "scene3d.part.palisadeLayer", palisadeCells, new THREE.Vector3(0, 0.5, 0)),
    part("stomata", "scene3d.part.stomata", stomata, new THREE.Vector3(0, -1, 0)),
  ];

  return { group, parts };
}

// --- Anatomy: Respiratory System & Lungs -------------------------------------
function buildLungs() {
  const group = new THREE.Group();

  const trachea = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.9, 16),
    new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.3 }),
  );
  trachea.position.set(0, 0.45, 0);

  const leftLung = sphere(0.42, 0xf43f5e);
  leftLung.scale.set(0.8, 1.3, 0.9);
  leftLung.position.set(-0.35, -0.1, 0);

  const rightLung = sphere(0.45, 0xe11d48);
  rightLung.scale.set(0.85, 1.3, 0.95);
  rightLung.position.set(0.35, -0.1, 0);

  group.add(trachea, leftLung, rightLung);

  const parts: Object3DPart[] = [
    part("trachea", "scene3d.part.trachea", trachea, new THREE.Vector3(0, 1, 0)),
    part("leftLung", "scene3d.part.leftLung", leftLung, new THREE.Vector3(-1, 0, 0)),
    part("rightLung", "scene3d.part.rightLung", rightLung, new THREE.Vector3(1, 0, 0)),
  ];

  return { group, parts };
}

// --- Geology: Volcano Structure ---------------------------------------------
function buildVolcano() {
  const group = new THREE.Group();

  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 1.2, 1.2, 32),
    new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.8 }),
  );
  cone.position.set(0, -0.1, 0);

  const magmaChamber = sphere(0.4, 0xef4444);
  magmaChamber.material = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xd97706, emissiveIntensity: 0.7 });
  magmaChamber.position.set(0, -0.7, 0);

  const conduit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.8, 16),
    new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xd97706 }),
  );
  conduit.position.set(0, -0.1, 0);

  const ashCloud = sphere(0.45, 0x78716c, 16);
  ashCloud.position.set(0, 0.75, 0);

  group.add(cone, magmaChamber, conduit, ashCloud);

  const parts: Object3DPart[] = [
    part("volcanoCone", "scene3d.part.volcanoCone", cone, new THREE.Vector3(0, 0.5, 1)),
    part("magmaChamber", "scene3d.part.magmaChamber", magmaChamber, new THREE.Vector3(0, -1, 0)),
    part("conduit", "scene3d.part.conduit", conduit, new THREE.Vector3(-1, 0, 0)),
    part("ashCloud", "scene3d.part.ashCloud", ashCloud, new THREE.Vector3(0, 1, 0)),
  ];

  return { group, parts };
}

// --- Physics: Bohr Atom -----------------------------------------------------
function buildBohrAtom() {
  const group = new THREE.Group();

  const nucleus = new THREE.Group();
  const p1 = sphere(0.12, 0xef4444); p1.position.set(0.06, 0.05, 0);
  const p2 = sphere(0.12, 0xef4444); p2.position.set(-0.06, -0.05, 0.04);
  const n1 = sphere(0.12, 0x64748b); n1.position.set(-0.05, 0.06, -0.04);
  const n2 = sphere(0.12, 0x64748b); n2.position.set(0.05, -0.06, 0.03);
  nucleus.add(p1, p2, n1, n2);

  const orbits = new THREE.Group();
  const eGroup = new THREE.Group();

  const angles = [0, Math.PI / 3, -Math.PI / 3];
  const orbitRadius = 0.95;

  angles.forEach((ang, idx) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(orbitRadius, 0.015, 12, 64),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.rotation.y = ang;
    orbits.add(ring);

    const electron = sphere(0.07, 0x06b6d4);
    const ePosAngle = idx * 1.8;
    electron.position.set(
      Math.cos(ePosAngle) * orbitRadius * Math.cos(ang),
      Math.sin(ePosAngle) * orbitRadius,
      Math.cos(ePosAngle) * orbitRadius * Math.sin(ang),
    );
    eGroup.add(electron);
  });

  group.add(nucleus, orbits, eGroup);

  const parts: Object3DPart[] = [
    part("nucleus", "scene3d.part.nucleusAtom", nucleus, new THREE.Vector3(0, 0, 0.001)),
    part("orbits", "scene3d.part.orbits", orbits, new THREE.Vector3(0, 1, 0)),
    part("electrons", "scene3d.part.electrons", eGroup, new THREE.Vector3(1, 0, 0)),
  ];

  return { group, parts };
}

// --- Physics: Convex Lens --------------------------------------------------
function buildConvexLens() {
  const group = new THREE.Group();

  const lensMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.5, roughness: 0.1 }),
  );
  lensMesh.scale.set(0.2, 1.2, 1.2);

  const axis = bond(new THREE.Vector3(-1.8, 0, 0), new THREE.Vector3(1.8, 0, 0), 0.015, 0x94a3b8);

  const focalPoint1 = sphere(0.06, 0xef4444);
  focalPoint1.position.set(-0.8, 0, 0);

  const focalPoint2 = sphere(0.06, 0xef4444);
  focalPoint2.position.set(0.8, 0, 0);

  group.add(lensMesh, axis, focalPoint1, focalPoint2);

  const parts: Object3DPart[] = [
    part("lensBody", "scene3d.part.lensBody", lensMesh, new THREE.Vector3(0, 1, 0)),
    part("opticsAxis", "scene3d.part.opticsAxis", axis, new THREE.Vector3(0, -1, 0)),
    part("focalPoint", "scene3d.part.focalPoint", focalPoint1, new THREE.Vector3(-1, 0, 0)),
  ];

  return { group, parts };
}

// --- Physics: Optics Prism --------------------------------------------------
function buildOpticsPrism() {
  const group = new THREE.Group();

  const shape = new THREE.Shape();
  shape.moveTo(0, 0.6);
  shape.lineTo(-0.6, -0.5);
  shape.lineTo(0.6, -0.5);
  shape.closePath();

  const extrudeSettings = { depth: 0.6, bevelEnabled: false };
  const prismGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  prismGeo.center();
  const prismMesh = new THREE.Mesh(
    prismGeo,
    new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.45, roughness: 0.1 }),
  );

  const lightBeam = bond(new THREE.Vector3(-1.8, -0.3, 0), new THREE.Vector3(-0.35, -0.1, 0), 0.04, 0xffffff);

  const rainbowColors = [0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x3b82f6, 0x8b5cf6];
  const spectrumGroup = new THREE.Group();

  rainbowColors.forEach((col, i) => {
    const yTarget = -0.4 + i * 0.14;
    const ray = bond(new THREE.Vector3(0.2, 0.05, 0), new THREE.Vector3(1.8, yTarget, 0), 0.025, col);
    spectrumGroup.add(ray);
  });

  group.add(prismMesh, lightBeam, spectrumGroup);

  const parts: Object3DPart[] = [
    part("prism", "scene3d.part.prism", prismMesh, new THREE.Vector3(0, 1, 0)),
    part("lightBeam", "scene3d.part.lightBeam", lightBeam, new THREE.Vector3(-1, 0, 0)),
    part("spectrum", "scene3d.part.spectrum", spectrumGroup, new THREE.Vector3(1, 0, 0)),
  ];

  return { group, parts };
}

// --- Engineering: Gears ----------------------------------------------------
function buildGears() {
  const group = new THREE.Group();

  function makeGear(radius: number, teeth: number, depth: number, color: number) {
    const g = new THREE.Group();
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, depth, 32),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6 }),
    );
    hub.rotation.x = Math.PI / 2;
    g.add(hub);

    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const tooth = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 0.22, radius * 0.25, depth),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6 }),
      );
      tooth.position.set(Math.cos(a) * (radius + 0.08), Math.sin(a) * (radius + 0.08), 0);
      tooth.rotation.z = a;
      g.add(tooth);
    }
    return g;
  }

  const gear1 = makeGear(0.5, 12, 0.15, 0x38bdf8);
  gear1.position.set(-0.55, 0, 0);

  const gear2 = makeGear(0.35, 8, 0.15, 0xf59e0b);
  gear2.position.set(0.4, 0.35, 0);

  group.add(gear1, gear2);

  const parts: Object3DPart[] = [
    part("driverGear", "scene3d.part.driverGear", gear1, new THREE.Vector3(-1, 0, 0)),
    part("drivenGear", "scene3d.part.drivenGear", gear2, new THREE.Vector3(1, 1, 0)),
  ];

  return { group, parts };
}

// --- Engineering: Hydraulic Piston -----------------------------------------
function buildHydraulicPiston() {
  const group = new THREE.Group();

  const cylinderOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 1.4, 32),
    new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.6, roughness: 0.3 }),
  );

  const pistonShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 1.2, 24),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 }),
  );
  pistonShaft.position.set(0, 0.4, 0);

  const fluid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.6, 24),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.7 }),
  );
  fluid.position.set(0, -0.4, 0);

  group.add(cylinderOuter, pistonShaft, fluid);

  const parts: Object3DPart[] = [
    part("pistonCylinder", "scene3d.part.pistonCylinder", cylinderOuter, new THREE.Vector3(1, 0, 0)),
    part("pistonShaft", "scene3d.part.pistonShaft", pistonShaft, new THREE.Vector3(0, 1, 0)),
    part("hydraulicFluid", "scene3d.part.hydraulicFluid", fluid, new THREE.Vector3(0, -1, 0)),
  ];

  return { group, parts };
}

// --- Engineering: Electromagnetic Motor ------------------------------------
function buildElectricMotor() {
  const group = new THREE.Group();

  const northPole = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.8, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }),
  );
  northPole.position.set(-0.7, 0, 0);

  const southPole = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.8, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 }),
  );
  southPole.position.set(0.7, 0, 0);

  const rotor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.6, 24),
    new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 }),
  );
  rotor.rotation.x = Math.PI / 2;

  group.add(northPole, southPole, rotor);

  const parts: Object3DPart[] = [
    part("northPole", "scene3d.part.northPole", northPole, new THREE.Vector3(-1, 0, 0)),
    part("southPole", "scene3d.part.southPole", southPole, new THREE.Vector3(1, 0, 0)),
    part("rotor", "scene3d.part.rotor", rotor, new THREE.Vector3(0, 1, 0)),
  ];

  return { group, parts };
}

// --- Engineering: Wind Turbine ---------------------------------------------
function buildWindTurbine() {
  const group = new THREE.Group();

  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.12, 2.2, 16),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }),
  );
  tower.position.set(0, -0.3, 0);

  const nacelle = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.25, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 }),
  );
  nacelle.position.set(0, 0.8, 0.15);

  const bladesGroup = new THREE.Group();
  bladesGroup.position.set(0, 0.8, 0.42);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.9, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2 }),
    );
    blade.position.set(Math.sin(a) * 0.45, Math.cos(a) * 0.45, 0);
    blade.rotation.z = -a;
    bladesGroup.add(blade);
  }

  group.add(tower, nacelle, bladesGroup);

  const parts: Object3DPart[] = [
    part("tower", "scene3d.part.tower", tower, new THREE.Vector3(0, -1, 0)),
    part("nacelle", "scene3d.part.nacelle", nacelle, new THREE.Vector3(0, 1, 0)),
    part("blades", "scene3d.part.blades", bladesGroup, new THREE.Vector3(0, 0, 1)),
  ];

  return { group, parts };
}

// --- Astronomy: Saturn & Rings ----------------------------------------------
function buildSaturn() {
  const group = new THREE.Group();
  const globe = sphere(0.48, 0xe2c792, 32);
  globe.rotation.z = THREE.MathUtils.degToRad(26.7);

  const ringGeo = new THREE.RingGeometry(0.65, 1.05, 64);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xcbb58b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
    roughness: 0.5,
  });
  const rings = new THREE.Mesh(ringGeo, ringMat);
  rings.rotation.x = Math.PI / 2 + THREE.MathUtils.degToRad(26.7);

  const titan = sphere(0.1, 0xdfb56c);
  titan.position.set(1.4, 0.2, 0.3);

  group.add(globe, rings, titan);

  const parts: Object3DPart[] = [
    part("saturnGlobe", "scene3d.part.saturnGlobe", globe, new THREE.Vector3(-0.5, 0.5, 0)),
    part("saturnRings", "scene3d.part.saturnRings", rings, new THREE.Vector3(0, 1, 0)),
    part("titanMoon", "scene3d.part.titanMoon", titan, new THREE.Vector3(1, 0.5, 0.5)),
  ];

  return { group, parts };
}

// --- Astronomy: Black Hole & Accretion Disk ----------------------------------
function buildBlackHole() {
  const group = new THREE.Group();

  const eventHorizon = sphere(0.4, 0x0a0a0c, 32);
  (eventHorizon.material as THREE.MeshStandardMaterial).roughness = 0.9;

  const diskGeo = new THREE.TorusGeometry(0.75, 0.2, 16, 64);
  const diskMat = new THREE.MeshStandardMaterial({
    color: 0xff6600,
    emissive: 0xff3300,
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });
  const disk = new THREE.Mesh(diskGeo, diskMat);
  disk.rotation.x = Math.PI / 2.3;

  const jetsGroup = new THREE.Group();
  const jet1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.22, 1.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x0284c7, emissiveIntensity: 0.9, transparent: true, opacity: 0.7 }),
  );
  jet1.position.set(0, 0.7, 0);
  const jet2 = jet1.clone();
  jet2.rotation.z = Math.PI;
  jet2.position.set(0, -0.7, 0);
  jetsGroup.add(jet1, jet2);

  group.add(eventHorizon, disk, jetsGroup);

  const parts: Object3DPart[] = [
    part("eventHorizon", "scene3d.part.eventHorizon", eventHorizon, new THREE.Vector3(0, 0, 0.001)),
    part("accretionDisk", "scene3d.part.accretionDisk", disk, new THREE.Vector3(1, 0.5, 0)),
    part("plasmaJets", "scene3d.part.plasmaJets", jetsGroup, new THREE.Vector3(0, 1, 0)),
  ];

  return { group, parts };
}

// --- Chemistry: Methane (CH4) ------------------------------------------------
function buildMethaneMolecule() {
  const group = new THREE.Group();
  const carbonPos = new THREE.Vector3(0, 0, 0);
  const carbon = sphere(0.38, 0x334155);
  group.add(carbon);

  const r = 0.85;
  const hPositions = [
    new THREE.Vector3(0, r, 0),
    new THREE.Vector3(r * Math.sqrt(8 / 9), -r / 3, 0),
    new THREE.Vector3(-r * Math.sqrt(2 / 9), -r / 3, r * Math.sqrt(2 / 3)),
    new THREE.Vector3(-r * Math.sqrt(2 / 9), -r / 3, -r * Math.sqrt(2 / 3)),
  ];

  const hGroup = new THREE.Group();
  const bondGroup = new THREE.Group();

  hPositions.forEach((pos) => {
    const hAtom = sphere(0.22, 0xf8fafc);
    hAtom.position.copy(pos);
    hGroup.add(hAtom);
    bondGroup.add(bond(carbonPos, pos, 0.035, 0x94a3b8));
  });

  group.add(hGroup, bondGroup);

  const parts: Object3DPart[] = [
    part("carbon", "scene3d.part.carbon", carbon, new THREE.Vector3(0, -1, 0)),
    part("hydrogens", "scene3d.part.hydrogen", hGroup, new THREE.Vector3(0, 1, 0)),
    part("bonds", "scene3d.part.bonds", bondGroup, new THREE.Vector3(1, 0, 0)),
  ];

  return { group, parts };
}

// --- Chemistry: Carbon Dioxide (CO2) ----------------------------------------
function buildCo2Molecule() {
  const group = new THREE.Group();
  const o1Pos = new THREE.Vector3(-0.95, 0, 0);
  const o2Pos = new THREE.Vector3(0.95, 0, 0);

  const carbon = sphere(0.36, 0x334155);
  const o1 = sphere(0.32, 0xef4444); o1.position.copy(o1Pos);
  const o2 = sphere(0.32, 0xef4444); o2.position.copy(o2Pos);

  const oGroup = new THREE.Group();
  oGroup.add(o1, o2);

  const bondsGroup = new THREE.Group();
  bondsGroup.add(
    bond(new THREE.Vector3(-0.95, 0.07, 0), new THREE.Vector3(0, 0.07, 0), 0.03, 0x94a3b8),
    bond(new THREE.Vector3(-0.95, -0.07, 0), new THREE.Vector3(0, -0.07, 0), 0.03, 0x94a3b8),
    bond(new THREE.Vector3(0, 0.07, 0), new THREE.Vector3(0.95, 0.07, 0), 0.03, 0x94a3b8),
    bond(new THREE.Vector3(0, -0.07, 0), new THREE.Vector3(0.95, -0.07, 0), 0.03, 0x94a3b8),
  );

  group.add(carbon, oGroup, bondsGroup);

  const parts: Object3DPart[] = [
    part("carbon", "scene3d.part.carbon", carbon, new THREE.Vector3(0, 1, 0)),
    part("oxygens", "scene3d.part.oxygen", oGroup, new THREE.Vector3(1, 0, 0)),
    part("doubleBonds", "scene3d.part.doubleBonds", bondsGroup, new THREE.Vector3(0, -1, 0)),
  ];

  return { group, parts };
}

// --- Chemistry: NaCl Crystal Lattice ----------------------------------------
function buildCrystalLattice() {
  const group = new THREE.Group();
  const naGroup = new THREE.Group();
  const clGroup = new THREE.Group();
  const bondsGroup = new THREE.Group();

  const spacing = 0.55;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const pos = new THREE.Vector3(x * spacing, y * spacing, z * spacing);
        const isNa = (x + y + z) % 2 === 0;
        if (isNa) {
          const na = sphere(0.12, 0xa855f7);
          na.position.copy(pos);
          naGroup.add(na);
        } else {
          const cl = sphere(0.15, 0x22c55e);
          cl.position.copy(pos);
          clGroup.add(cl);
        }
      }
    }
  }

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const p1 = new THREE.Vector3(x * spacing, y * spacing, z * spacing);
        if (x < 1) bondsGroup.add(bond(p1, new THREE.Vector3((x + 1) * spacing, y * spacing, z * spacing), 0.015, 0x64748b));
        if (y < 1) bondsGroup.add(bond(p1, new THREE.Vector3(x * spacing, (y + 1) * spacing, z * spacing), 0.015, 0x64748b));
        if (z < 1) bondsGroup.add(bond(p1, new THREE.Vector3(x * spacing, y * spacing, (z + 1) * spacing), 0.015, 0x64748b));
      }
    }
  }

  group.add(naGroup, clGroup, bondsGroup);

  const parts: Object3DPart[] = [
    part("naIons", "scene3d.part.naIons", naGroup, new THREE.Vector3(-1, 1, 0)),
    part("clIons", "scene3d.part.clIons", clGroup, new THREE.Vector3(1, 1, 0)),
    part("latticeGrid", "scene3d.part.latticeGrid", bondsGroup, new THREE.Vector3(0, -1, 0)),
  ];

  return { group, parts };
}

// --- Anatomy: Human Eye -----------------------------------------------------
function buildHumanEye() {
  const group = new THREE.Group();

  const sclera = sphere(0.65, 0xf8fafc, 32);
  (sclera.material as THREE.MeshStandardMaterial).roughness = 0.2;

  const irisPupilGroup = new THREE.Group();
  const iris = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.3, 32),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, side: THREE.DoubleSide, roughness: 0.3 }),
  );
  iris.position.set(0, 0, 0.63);
  const pupil = sphere(0.12, 0x0f172a, 24);
  pupil.position.set(0, 0, 0.62);
  irisPupilGroup.add(iris, pupil);

  const lensEye = sphere(0.2, 0x38bdf8, 24);
  lensEye.scale.set(1.2, 1.2, 0.5);
  lensEye.position.set(0, 0, 0.42);
  (lensEye.material as THREE.MeshStandardMaterial).transparent = true;
  (lensEye.material as THREE.MeshStandardMaterial).opacity = 0.6;

  const retina = sphere(0.6, 0xef4444, 24);
  retina.scale.set(0.98, 0.98, 0.98);
  retina.position.set(0, 0, -0.05);

  const opticNerve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5 }),
  );
  opticNerve.rotation.x = Math.PI / 2;
  opticNerve.position.set(0, 0, -0.8);

  group.add(sclera, irisPupilGroup, lensEye, retina, opticNerve);

  const parts: Object3DPart[] = [
    part("sclera", "scene3d.part.sclera", sclera, new THREE.Vector3(0, 1, 0)),
    part("irisPupil", "scene3d.part.irisPupil", irisPupilGroup, new THREE.Vector3(0, 0, 1)),
    part("lensEye", "scene3d.part.lensEye", lensEye, new THREE.Vector3(0, 0.5, 0.5)),
    part("retina", "scene3d.part.retina", retina, new THREE.Vector3(0, -1, 0)),
    part("opticNerve", "scene3d.part.opticNerve", opticNerve, new THREE.Vector3(0, 0, -1)),
  ];

  return { group, parts };
}

// --- Biology: Animal Cell ---------------------------------------------------
function buildAnimalCell() {
  const group = new THREE.Group();

  const membrane = sphere(0.7, 0xf472b6, 32);
  (membrane.material as THREE.MeshStandardMaterial).transparent = true;
  (membrane.material as THREE.MeshStandardMaterial).opacity = 0.35;

  const nucleusGroup = new THREE.Group();
  const nucleus = sphere(0.28, 0x8b5cf6, 24);
  const nucleolus = sphere(0.1, 0x4c1d95, 16);
  nucleolus.position.set(0.05, 0.05, 0.05);
  nucleusGroup.add(nucleus, nucleolus);
  nucleusGroup.position.set(-0.1, 0.1, 0);

  const mitoGroup = new THREE.Group();
  const m1 = sphere(0.12, 0xef4444, 16); m1.scale.set(1.5, 0.8, 0.8); m1.position.set(0.35, -0.2, 0.2);
  const m2 = sphere(0.12, 0xef4444, 16); m2.scale.set(1.5, 0.8, 0.8); m2.position.set(-0.35, -0.2, -0.1);
  mitoGroup.add(m1, m2);

  const er = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.05, 12, 24, Math.PI * 1.5),
    new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.4 }),
  );
  er.position.set(-0.1, 0.1, 0);

  group.add(membrane, nucleusGroup, mitoGroup, er);

  const parts: Object3DPart[] = [
    part("membrane", "scene3d.part.membrane", membrane, new THREE.Vector3(0, 0, 1)),
    part("nucleus", "scene3d.part.nucleus", nucleusGroup, new THREE.Vector3(-1, 1, 0)),
    part("mitochondria", "scene3d.part.mitochondria", mitoGroup, new THREE.Vector3(1, -1, 0)),
    part("endoplasmic", "scene3d.part.endoplasmic", er, new THREE.Vector3(1, 1, 0)),
  ];

  return { group, parts };
}

// --- Biology: Neuron --------------------------------------------------------
function buildNeuron() {
  const group = new THREE.Group();

  const soma = sphere(0.32, 0xec4899, 24);
  soma.position.set(-0.8, 0, 0);

  const dendrites = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 1.6 - Math.PI * 0.8;
    const end = new THREE.Vector3(-0.8 + Math.cos(angle) * 0.5, Math.sin(angle) * 0.5, 0);
    dendrites.add(bond(new THREE.Vector3(-0.8, 0, 0), end, 0.03, 0xf472b6));
  }

  const axon = bond(new THREE.Vector3(-0.8, 0, 0), new THREE.Vector3(1.1, 0, 0), 0.04, 0x3b82f6);

  const myelinGroup = new THREE.Group();
  for (let x = -0.3; x <= 0.8; x += 0.35) {
    const sheath = sphere(0.09, 0xfde047, 16);
    sheath.scale.set(1.8, 1, 1);
    sheath.position.set(x, 0, 0);
    myelinGroup.add(sheath);
  }

  group.add(soma, dendrites, axon, myelinGroup);

  const parts: Object3DPart[] = [
    part("soma", "scene3d.part.soma", soma, new THREE.Vector3(-1, 0, 0)),
    part("dendrites", "scene3d.part.dendrites", dendrites, new THREE.Vector3(-1, 1, 0)),
    part("axon", "scene3d.part.axon", axon, new THREE.Vector3(0, -1, 0)),
    part("myelinSheath", "scene3d.part.myelinSheath", myelinGroup, new THREE.Vector3(1, 0, 0)),
  ];

  return { group, parts };
}

// --- Geology: Earth Internal Layers -----------------------------------------
function buildEarthLayers() {
  const group = new THREE.Group();

  const crust = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 32, 32, 0, Math.PI * 1.6),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6, side: THREE.DoubleSide }),
  );

  const mantle = sphere(0.58, 0xd97706, 24);

  const outerCore = sphere(0.38, 0xef4444, 24);

  const innerCore = sphere(0.2, 0xfef08a, 24);
  (innerCore.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xfde047);
  (innerCore.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;

  group.add(crust, mantle, outerCore, innerCore);

  const parts: Object3DPart[] = [
    part("crust", "scene3d.part.crust", crust, new THREE.Vector3(0, 0, 1)),
    part("mantle", "scene3d.part.mantle", mantle, new THREE.Vector3(-1, 1, 0)),
    part("outerCore", "scene3d.part.outerCore", outerCore, new THREE.Vector3(1, 1, 0)),
    part("innerCore", "scene3d.part.innerCore", innerCore, new THREE.Vector3(0, -1, 0)),
  ];

  return { group, parts };
}

// --- Engineering: Photovoltaic Solar Panel ---------------------------------
function buildSolarPanel() {
  const group = new THREE.Group();

  const panelBoard = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.0, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.2, metalness: 0.5 }),
  );
  panelBoard.rotation.x = -Math.PI / 4;

  const frameGroup = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 1.0, 16),
    new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 }),
  );
  pole.position.set(0, -0.5, -0.2);
  frameGroup.add(pole);

  const raysGroup = new THREE.Group();
  for (let i = -2; i <= 2; i++) {
    const ray = bond(new THREE.Vector3(i * 0.3, 1.2, 0.4), new THREE.Vector3(i * 0.25, 0.2, 0), 0.02, 0xfacc15);
    raysGroup.add(ray);
  }

  const battery = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.3, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4 }),
  );
  battery.position.set(0.6, -0.7, -0.1);

  group.add(panelBoard, frameGroup, raysGroup, battery);

  const parts: Object3DPart[] = [
    part("pvGrid", "scene3d.part.pvGrid", panelBoard, new THREE.Vector3(0, 1, 0)),
    part("frameStand", "scene3d.part.frameStand", frameGroup, new THREE.Vector3(-1, 0, 0)),
    part("sunRays", "scene3d.part.sunRays", raysGroup, new THREE.Vector3(0, 1, 1)),
    part("batteryUnit", "scene3d.part.batteryUnit", battery, new THREE.Vector3(1, -1, 0)),
  ];

  return { group, parts };
}

// --- Physics: Tesla Coil ----------------------------------------------------
function buildTeslaCoil() {
  const group = new THREE.Group();

  const toroid = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.12, 16, 32),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 }),
  );
  toroid.rotation.x = Math.PI / 2;
  toroid.position.set(0, 0.75, 0);

  const coil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 1.0, 24),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 }),
  );
  coil.position.set(0, 0.15, 0);

  const sparksGroup = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const spark = bond(new THREE.Vector3(Math.cos(a) * 0.4, 0.75, Math.sin(a) * 0.4), new THREE.Vector3(Math.cos(a) * 0.9, 0.9, Math.sin(a) * 0.9), 0.025, 0x38bdf8);
    sparksGroup.add(spark);
  }

  group.add(toroid, coil, sparksGroup);

  const parts: Object3DPart[] = [
    part("toroid", "scene3d.part.toroid", toroid, new THREE.Vector3(0, 1, 0)),
    part("secondaryCoil", "scene3d.part.secondaryCoil", coil, new THREE.Vector3(-1, 0, 0)),
    part("sparkArcs", "scene3d.part.sparkArcs", sparksGroup, new THREE.Vector3(1, 1, 0)),
  ];

  return { group, parts };
}

// --- Math: regular solids -----------------------------------------------
function buildSolid(geometry: THREE.BufferGeometry, color: number) {
  return () => {
    const group = new THREE.Group();
    const solid = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.5, flatShading: true }));
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0x0a0a12 }),
    );
    group.add(solid, wire);
    const parts: Object3DPart[] = [part("solid", "scene3d.part.solid", solid, new THREE.Vector3(0, 1, 0))];
    return { group, parts };
  };
}

export const OBJECT_LIBRARY: Object3DDef[] = [
  {
    id: "solar-system",
    subject: "astronomy",
    nameKey: "scene3d.obj.solarSystem",
    noteKey: "scene3d.note.notToScale",
    build: buildSolarSystem,
  },
  {
    id: "saturn",
    subject: "astronomy",
    nameKey: "scene3d.obj.saturn",
    noteKey: "scene3d.note.schematic",
    build: buildSaturn,
  },
  {
    id: "black-hole",
    subject: "astronomy",
    nameKey: "scene3d.obj.blackHole",
    noteKey: "scene3d.note.schematic",
    build: buildBlackHole,
  },
  {
    id: "earth-moon",
    subject: "astronomy",
    nameKey: "scene3d.obj.earthMoon",
    noteKey: "scene3d.note.schematic",
    build: buildEarthMoon,
  },
  {
    id: "water-molecule",
    subject: "chemistry",
    nameKey: "scene3d.obj.water",
    noteKey: "scene3d.note.schematic",
    build: buildWaterMolecule,
  },
  {
    id: "methane",
    subject: "chemistry",
    nameKey: "scene3d.obj.methane",
    noteKey: "scene3d.note.schematic",
    build: buildMethaneMolecule,
  },
  {
    id: "carbon-dioxide",
    subject: "chemistry",
    nameKey: "scene3d.obj.co2",
    noteKey: "scene3d.note.schematic",
    build: buildCo2Molecule,
  },
  {
    id: "crystal-lattice",
    subject: "chemistry",
    nameKey: "scene3d.obj.crystalLattice",
    noteKey: "scene3d.note.schematic",
    build: buildCrystalLattice,
  },
  {
    id: "dna",
    subject: "biology",
    nameKey: "scene3d.obj.dna",
    noteKey: "scene3d.note.schematic",
    build: buildDna,
  },
  {
    id: "animal-cell",
    subject: "biology",
    nameKey: "scene3d.obj.animalCell",
    noteKey: "scene3d.note.schematic",
    build: buildAnimalCell,
  },
  {
    id: "neuron",
    subject: "biology",
    nameKey: "scene3d.obj.neuron",
    noteKey: "scene3d.note.schematic",
    build: buildNeuron,
  },
  {
    id: "plant-cell",
    subject: "biology",
    nameKey: "scene3d.obj.plantCell",
    noteKey: "scene3d.note.schematic",
    build: buildPlantCell,
  },
  {
    id: "leaf-cell",
    subject: "biology",
    nameKey: "scene3d.obj.leafCell",
    noteKey: "scene3d.note.schematic",
    build: buildLeafCell,
  },
  {
    id: "heart",
    subject: "anatomy",
    nameKey: "scene3d.obj.heart",
    noteKey: "scene3d.note.schematic",
    build: buildHeart,
  },
  {
    id: "brain",
    subject: "anatomy",
    nameKey: "scene3d.obj.brain",
    noteKey: "scene3d.note.schematic",
    build: buildBrain,
  },
  {
    id: "human-eye",
    subject: "anatomy",
    nameKey: "scene3d.obj.humanEye",
    noteKey: "scene3d.note.schematic",
    build: buildHumanEye,
  },
  {
    id: "lungs",
    subject: "anatomy",
    nameKey: "scene3d.obj.lungs",
    noteKey: "scene3d.note.schematic",
    build: buildLungs,
  },
  {
    id: "volcano",
    subject: "geology",
    nameKey: "scene3d.obj.volcano",
    noteKey: "scene3d.note.schematic",
    build: buildVolcano,
  },
  {
    id: "earth-layers",
    subject: "geology",
    nameKey: "scene3d.obj.earthLayers",
    noteKey: "scene3d.note.schematic",
    build: buildEarthLayers,
  },
  {
    id: "bohr-atom",
    subject: "physics",
    nameKey: "scene3d.obj.bohrAtom",
    noteKey: "scene3d.note.schematic",
    build: buildBohrAtom,
  },
  {
    id: "tesla-coil",
    subject: "physics",
    nameKey: "scene3d.obj.teslaCoil",
    noteKey: "scene3d.note.schematic",
    build: buildTeslaCoil,
  },
  {
    id: "optics-prism",
    subject: "physics",
    nameKey: "scene3d.obj.opticsPrism",
    noteKey: "scene3d.note.schematic",
    build: buildOpticsPrism,
  },
  {
    id: "convex-lens",
    subject: "physics",
    nameKey: "scene3d.obj.convexLens",
    noteKey: "scene3d.note.schematic",
    build: buildConvexLens,
  },
  {
    id: "solar-panel",
    subject: "engineering",
    nameKey: "scene3d.obj.solarPanel",
    noteKey: "scene3d.note.schematic",
    build: buildSolarPanel,
  },
  {
    id: "gears",
    subject: "engineering",
    nameKey: "scene3d.obj.gears",
    noteKey: "scene3d.note.schematic",
    build: buildGears,
  },
  {
    id: "hydraulic-piston",
    subject: "engineering",
    nameKey: "scene3d.obj.hydraulicPiston",
    noteKey: "scene3d.note.schematic",
    build: buildHydraulicPiston,
  },
  {
    id: "electric-motor",
    subject: "engineering",
    nameKey: "scene3d.obj.electricMotor",
    noteKey: "scene3d.note.schematic",
    build: buildElectricMotor,
  },
  {
    id: "wind-turbine",
    subject: "engineering",
    nameKey: "scene3d.obj.windTurbine",
    noteKey: "scene3d.note.schematic",
    build: buildWindTurbine,
  },
  {
    id: "cube",
    subject: "math",
    nameKey: "scene3d.obj.cube",
    noteKey: "scene3d.note.none",
    build: buildSolid(new THREE.BoxGeometry(1.3, 1.3, 1.3), 0x6ee7f2),
  },
  {
    id: "tetrahedron",
    subject: "math",
    nameKey: "scene3d.obj.tetrahedron",
    noteKey: "scene3d.note.none",
    build: buildSolid(new THREE.TetrahedronGeometry(1.1), 0xa78bfa),
  },
  {
    id: "octahedron",
    subject: "math",
    nameKey: "scene3d.obj.octahedron",
    noteKey: "scene3d.note.none",
    build: buildSolid(new THREE.OctahedronGeometry(1.1), 0x8b5cf6),
  },
  {
    id: "dodecahedron",
    subject: "math",
    nameKey: "scene3d.obj.dodecahedron",
    noteKey: "scene3d.note.none",
    build: buildSolid(new THREE.DodecahedronGeometry(1.0), 0xf43f5e),
  },
  {
    id: "icosahedron",
    subject: "math",
    nameKey: "scene3d.obj.icosahedron",
    noteKey: "scene3d.note.none",
    build: buildSolid(new THREE.IcosahedronGeometry(1.0), 0x4ade80),
  },
  {
    id: "torus-knot",
    subject: "math",
    nameKey: "scene3d.obj.torusKnot",
    noteKey: "scene3d.note.none",
    build: buildSolid(new THREE.TorusKnotGeometry(0.6, 0.18, 100, 16), 0x06b6d4),
  },
];

