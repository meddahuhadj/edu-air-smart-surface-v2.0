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
    id: "dna",
    subject: "biology",
    nameKey: "scene3d.obj.dna",
    noteKey: "scene3d.note.schematic",
    build: buildDna,
  },
  {
    id: "heart",
    subject: "biology",
    nameKey: "scene3d.obj.heart",
    noteKey: "scene3d.note.schematic",
    build: buildHeart,
  },
  {
    id: "brain",
    subject: "biology",
    nameKey: "scene3d.obj.brain",
    noteKey: "scene3d.note.schematic",
    build: buildBrain,
  },
  {
    id: "plant-cell",
    subject: "biology",
    nameKey: "scene3d.obj.plantCell",
    noteKey: "scene3d.note.schematic",
    build: buildPlantCell,
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
    id: "bohr-atom",
    subject: "physics",
    nameKey: "scene3d.obj.bohrAtom",
    noteKey: "scene3d.note.schematic",
    build: buildBohrAtom,
  },
  {
    id: "optics-prism",
    subject: "physics",
    nameKey: "scene3d.obj.opticsPrism",
    noteKey: "scene3d.note.schematic",
    build: buildOpticsPrism,
  },
  {
    id: "gears",
    subject: "engineering",
    nameKey: "scene3d.obj.gears",
    noteKey: "scene3d.note.schematic",
    build: buildGears,
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
    id: "icosahedron",
    subject: "math",
    nameKey: "scene3d.obj.icosahedron",
    noteKey: "scene3d.note.none",
    build: buildSolid(new THREE.IcosahedronGeometry(1.0), 0x4ade80),
  },
];
