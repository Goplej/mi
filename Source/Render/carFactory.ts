import * as THREE from 'three';
import type { ModelDef } from '../Core/types';
import { modelById } from '../Vehicles/models';
import { emissive, glass, makePaint, metal, rubber } from './materials';

export interface CarPose {
  color: string;
  paint: number;
  dirt: number;
  removed: string[];
  hood: number;
  trunk: number;
  doors: number;
  lift: number;
  steer: number;
  spin: number;
  lights: boolean;
  wing: boolean;
  stripes: boolean;
}

export class CarView {
  readonly root = new THREE.Group();
  private paintMat: THREE.MeshPhysicalMaterial;
  private wheelSpin = 0;
  private parts = new Map<string, THREE.Object3D>();
  private key = '';
  private model: ModelDef;

  constructor(modelId: string, pose: CarPose) {
    this.model = modelById(modelId);
    this.paintMat = makePaint(pose.color, pose.paint, pose.dirt, pose.stripes);
    this.rebuild(pose);
  }

  setPose(pose: CarPose): void {
    const key = `${pose.color}|${Math.round(pose.paint / 8)}|${Math.round(pose.dirt / 12)}|${pose.stripes}|${pose.wing}|${pose.removed.slice().sort().join(',')}`;
    if (key !== this.key) this.rebuild(pose);
    this.apply(pose);
  }

  private rebuild(pose: CarPose): void {
    this.key = `${pose.color}|${Math.round(pose.paint / 8)}|${Math.round(pose.dirt / 12)}|${pose.stripes}|${pose.wing}|${pose.removed.slice().sort().join(',')}`;
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    this.paintMat.dispose();
    this.paintMat = makePaint(pose.color, pose.paint, pose.dirt, pose.stripes || !!this.model.visual.stripes);
    this.parts.clear();
    assemble(this.root, this.model, this.paintMat, this.parts, pose);
    this.apply(pose);
  }

  private apply(pose: CarPose): void {
    const hood = this.parts.get('hood');
    if (hood) {
      hood.visible = !pose.removed.includes('hood');
      hood.rotation.x = -pose.hood * 0.9;
    }
    const trunk = this.parts.get('trunk');
    if (trunk) {
      trunk.visible = !pose.removed.includes('trunk');
      trunk.rotation.x = pose.trunk * 0.6;
    }
    this.wheelSpin += pose.spin;
    for (const corner of ['fl', 'fr', 'rl', 'rr']) {
      const wheel = this.parts.get('wheel_' + corner);
      if (!wheel) continue;
      wheel.visible = !pose.removed.includes('wheel_' + corner);
      wheel.rotation.y = corner[1] === 'l' || corner[1] === 'r' ? (corner.startsWith('f') ? pose.steer : 0) : 0;
      const spin = wheel.getObjectByName('spin');
      if (spin) spin.rotation.x = this.wheelSpin;
    }
    for (const id of ['bumper_f', 'bumper_r', 'wing']) {
      const obj = this.parts.get(id);
      if (obj) obj.visible = !pose.removed.includes(id);
    }
    this.root.position.y = pose.lift * 1.2;
    const lamps = this.parts.get('lamps');
    lamps?.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat?.emissive) mat.emissiveIntensity = pose.lights ? 4 : 0.25;
    });
  }

  dispose(): void {
    this.paintMat.dispose();
  }
}

function assemble(root: THREE.Group, model: ModelDef, paint: THREE.Material, parts: Map<string, THREE.Object3D>, pose: CarPose): void {
  const L = model.length;
  const W = model.width;
  const H = model.height;
  const style = model.body;
  const tall = style === 'suv' || style === 'van' || style === 'pickup';
  const low = style === 'supercar' || style === 'coupe' || model.class === 'race';
  const ride = tall ? 0.38 : low ? 0.18 : 0.24;
  const dark = metal(0x171b20, 0.5);
  const trim = model.visual.chrome ? metal(0xe4ded2, 0.2) : dark;
  const glassMat = glass();

  root.add(mesh(W * 0.96, H * 0.28, L * 0.9, paint, 0, ride + H * 0.12, 0));
  root.add(mesh(W * 0.98, 0.08, L * 0.78, dark, 0, ride, 0));

  const cabinL = style === 'wagon' || style === 'van' ? L * 0.58 : style === 'hatch' ? L * 0.46 : low ? L * 0.32 : L * 0.4;
  const cabinH = low ? H * 0.38 : tall ? H * 0.55 : H * 0.46;
  const cabinZ = style === 'muscle' || style === 'pickup' ? -L * 0.06 : low ? -L * 0.04 : 0;
  root.add(mesh(W * 0.84, cabinH, cabinL, paint, 0, ride + H * 0.28 + cabinH * 0.35, cabinZ));

  const wind = mesh(W * 0.76, cabinH * 0.62, 0.04, glassMat, 0, ride + H * 0.42, cabinZ + cabinL * 0.48);
  wind.rotation.x = -0.55;
  root.add(wind);
  root.add(mesh(0.03, cabinH * 0.42, cabinL * 0.7, glassMat, -W * 0.4, ride + H * 0.48, cabinZ));
  root.add(mesh(0.03, cabinH * 0.42, cabinL * 0.7, glassMat, W * 0.4, ride + H * 0.48, cabinZ));

  const hood = new THREE.Group();
  hood.add(mesh(W * 0.88, 0.05, L * 0.28, paint, 0, 0, L * 0.12));
  hood.position.set(0, ride + H * 0.3, L * 0.16);
  root.add(hood);
  parts.set('hood', hood);

  const trunk = new THREE.Group();
  trunk.add(mesh(W * 0.86, 0.05, L * 0.18, paint, 0, 0, -L * 0.06));
  trunk.position.set(0, ride + H * 0.3, -L * 0.3);
  root.add(trunk);
  parts.set('trunk', trunk);

  const bf = mesh(W * 0.98, H * 0.12, 0.1, trim, 0, ride + 0.1, L * 0.48);
  const br = mesh(W * 0.96, H * 0.11, 0.1, trim, 0, ride + 0.1, -L * 0.48);
  root.add(bf, br);
  parts.set('bumper_f', bf);
  parts.set('bumper_r', br);

  const grille = grilleFor(model.visual.grille, W);
  grille.position.set(0, ride + H * 0.2, L * 0.5);
  root.add(grille);

  const lamps = new THREE.Group();
  const lampGeo = model.visual.lights === 'round' ? new THREE.SphereGeometry(0.07, 12, 10) : new THREE.BoxGeometry(W * 0.16, 0.07, 0.06);
  const lampMat = emissive(0xfff3c4, 0.4);
  const hl = new THREE.Mesh(lampGeo, lampMat);
  hl.position.set(-W * 0.28, 0, 0);
  const hr = hl.clone();
  hr.position.x = W * 0.28;
  lamps.add(hl, hr);
  lamps.position.set(0, ride + H * 0.22, L * 0.5);
  root.add(lamps);
  parts.set('lamps', lamps);

  const tail = emissive(0xe23b32, 0.6);
  root.add(meshMat(new THREE.BoxGeometry(0.22, 0.07, 0.05), tail, -W * 0.3, ride + H * 0.26, -L * 0.49));
  root.add(meshMat(new THREE.BoxGeometry(0.22, 0.07, 0.05), tail, W * 0.3, ride + H * 0.26, -L * 0.49));

  const track = W * 0.78;
  const zf = model.wheelbase * 0.5;
  const zr = -model.wheelbase * 0.5;
  wheel(root, parts, 'fl', -track / 2, ride, zf);
  wheel(root, parts, 'fr', track / 2, ride, zf);
  wheel(root, parts, 'rl', -track / 2, ride, zr);
  wheel(root, parts, 'rr', track / 2, ride, zr);

  if (pose.wing || model.visual.wing) {
    const wing = new THREE.Group();
    wing.add(mesh(W * 0.72, 0.03, 0.22, paint, 0, 0.28, 0));
    wing.add(mesh(0.04, 0.28, 0.04, dark, 0, 0.12, 0));
    wing.position.set(0, ride + H * 0.36, -L * 0.36);
    root.add(wing);
    parts.set('wing', wing);
  }
  root.add(mesh(0.16, 0.05, 0.08, paint, -W * 0.5, ride + H * 0.48, cabinZ + cabinL * 0.2));
  root.add(mesh(0.16, 0.05, 0.08, paint, W * 0.5, ride + H * 0.48, cabinZ + cabinL * 0.2));
  if (style === 'pickup') root.add(mesh(W * 0.9, H * 0.16, L * 0.32, dark, 0, ride + 0.2, -L * 0.22));
}

function mesh(width: number, height: number, length: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.04, width), Math.max(0.03, height), Math.max(0.04, length)), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function meshMat(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function wheel(root: THREE.Group, parts: Map<string, THREE.Object3D>, id: string, x: number, y: number, z: number): void {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 16), rubber());
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.23, 8), metal(0xd5d8de, 0.25));
  rim.rotation.z = Math.PI / 2;
  spin.add(tire, rim);
  g.add(spin);
  g.position.set(x, y, z);
  root.add(g);
  parts.set('wheel_' + id, g);
}

function grilleFor(kind: string, width: number): THREE.Object3D {
  const g = new THREE.Group();
  const mat = metal(0x101216, 0.45);
  if (kind === 'closed') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(width * 0.42, 0.06, 0.04), mat));
    return g;
  }
  if (kind === 'split') {
    const a = new THREE.Mesh(new THREE.BoxGeometry(width * 0.14, 0.1, 0.05), mat);
    a.position.x = -width * 0.12;
    const b = a.clone();
    b.position.x = width * 0.12;
    g.add(a, b);
    return g;
  }
  g.add(new THREE.Mesh(new THREE.BoxGeometry(width * 0.4, kind === 'oval' ? 0.08 : 0.12, 0.04), mat));
  return g;
}

export function simpleTrafficCar(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 4.2), new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.45 }));
  body.position.y = 0.55;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 1.8), new THREE.MeshStandardMaterial({ color: 0x1c2128, roughness: 0.25, metalness: 0.2 }));
  cab.position.set(0, 0.95, -0.15);
  g.add(body, cab);
  return g;
}
