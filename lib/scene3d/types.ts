import * as THREE from "three";
import type { DictKey } from "../i18n/dictionaries";

export interface Object3DPart {
  id: string;
  labelKey: DictKey;
  mesh: THREE.Object3D;
  /** normalized outward direction used to spread parts apart in "explode" mode */
  explodeDir: THREE.Vector3;
}

export interface Object3DDef {
  id: string;
  subject: "astronomy" | "chemistry" | "biology" | "math" | "physics" | "engineering" | "geology" | "anatomy";
  nameKey: DictKey;
  noteKey: DictKey; // honesty note, e.g. "simplified schematic, not to scale"
  build: () => { group: THREE.Group; parts: Object3DPart[] };
}
