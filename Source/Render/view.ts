import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { GameState, Settings } from '../Core/types';
import { clockParts } from '../Core/util';
import { sunColor } from '../Weather/weather';
import { POIS, cityBuildings } from '../World/city';
import { CarView, type CarPose, simpleTrafficCar } from './carFactory';
import { concreteTexture, metal, roadTexture, signTexture } from './materials';
import { modelById } from '../Vehicles/models';

export interface ViewSession {
  mode: 'menu' | 'garage' | 'city' | 'track';
  selectedId: string | null;
  drive?: { x: number; z: number; heading: number; steer: number; speed: number; lights: boolean } | null;
}

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 600);
  readonly controls: OrbitControls;
  private sun = new THREE.DirectionalLight(0xfff4df, 1.1);
  private amb = new THREE.HemisphereLight(0xc5d4e8, 0x2a241c, 0.55);
  private garage = new THREE.Group();
  private city = new THREE.Group();
  private track = new THREE.Group();
  private cars = new Map<string, CarView>();
  private rain: THREE.Points;
  private clock = new THREE.Clock();
  private quality: Settings['quality'] = 'medium';
  private menuCar?: CarView;
  private traffic: THREE.Group[] = [];
  private focused = new THREE.Vector3(0, 0.8, 0);
  private garageKey = '';
  private lastMode = '';
  private dt = 0.016;
  private spot = new THREE.SpotLight(0xffe2b0, 0, 18, 0.6, 0.4, 1);
  private head = new THREE.SpotLight(0xfff1c8, 0, 46, 0.55, 0.45, 1);
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  constructor(private canvas: HTMLCanvasElement, private onPick?: (id: string) => void) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.fog = new THREE.FogExp2(0x8eb4d6, 0.008);
    this.sun.position.set(30, 40, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.scene.add(this.sun, this.amb, this.sun.target);
    this.spot.position.set(0, 3.2, 1.2);
    this.spot.castShadow = false;
    this.head.target.position.set(0, 0.4, 8);
    this.scene.add(this.spot, this.head, this.head.target);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(0, 0.7, 0);
    this.camera.position.set(6.5, 2.4, 7.2);
    this.rain = makeRain();
    this.scene.add(this.rain);
    this.buildCity();
    this.buildTrack();
    this.buildGarage([]);
    this.scene.add(this.garage);
    this.menuCar = new CarView('nordheim-rs', emptyPose('#8d1d2c'));
    this.menuCar.root.position.set(0, 0, 0);
    this.garage.add(this.menuCar.root);
    this.canvas.addEventListener('pointerdown', (ev) => this.pick(ev));
    this.resize();
  }

  setQuality(q: Settings['quality']): void {
    this.quality = q;
    const ratio = q === 'low' ? 1 : q === 'high' ? Math.min(2, window.devicePixelRatio) : Math.min(1.4, window.devicePixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    this.sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
    this.resize();
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  sync(state: GameState | null, session: ViewSession): void {
    const mode = session.mode;
    if (mode !== this.lastMode) {
      this.lastMode = mode;
      if (mode === 'garage' || mode === 'menu') {
        this.camera.position.set(6.5, 2.4, 7.2);
        this.controls.target.set(0, 0.7, 0);
      }
    }
    this.garage.visible = mode === 'menu' || mode === 'garage';
    this.city.visible = mode === 'city';
    this.track.visible = mode === 'track';
    this.controls.enabled = mode === 'menu' || mode === 'garage';
    const minute = state ? state.clock.absolute : 15 * 60;
    const sun = sunColor(minute);
    this.scene.background = new THREE.Color(sun.sky);
    this.scene.fog = new THREE.FogExp2(new THREE.Color(sun.sky), mode === 'city' ? 0.012 : 0.0015);
    this.sun.color.set(sun.light);
    this.sun.intensity = sun.intensity * (state?.weather.kind === 'heavy-rain' ? 0.35 : state?.weather.kind === 'cloudy' || state?.weather.kind === 'fog' ? 0.55 : 1);
    this.amb.intensity = sun.ambient;
    const hour = clockParts(minute).hour;
    this.sun.position.set(Math.cos(((hour - 6) / 12) * Math.PI) * 40, Math.max(4, Math.sin(((hour - 6) / 12) * Math.PI) * 40), 16);
    const wet = state?.weather.kind === 'rain' || state?.weather.kind === 'heavy-rain' || state?.weather.kind === 'snow';
    this.rain.visible = !!wet && this.quality !== 'low';
    if (mode === 'menu') {
      if (this.menuCar && this.menuCar.root.parent !== this.garage) this.garage.add(this.menuCar.root);
      this.menuCar!.root.visible = true;
      this.head.intensity = 0;
      this.hideDynamic();
      return;
    }
    if (this.menuCar) this.menuCar.root.visible = false;
    if (!state) return;
    if (mode === 'garage') {
      const key = state.garage.upgrades.join(',') + state.meta.company;
      if (key !== this.garageKey) {
        this.garageKey = key;
        this.buildGarage(state.garage.upgrades, state.meta.company);
      }
    }
    if (!session.drive) this.head.intensity = 0;
    this.syncCars(state, session);
  }

  update(): number {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.dt = dt || this.dt;
    if (this.garage.visible && this.menuCar?.root.visible) {
      this.menuCar.root.rotation.y += dt * 0.15;
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.4;
    } else this.controls.autoRotate = false;
    this.controls.update();
    if (this.rain.visible) this.rain.position.copy(this.camera.position);
    for (let i = 0; i < this.traffic.length; i++) {
      const car = this.traffic[i];
      car.position.x += dt * (4 + (i % 3)) * (i % 2 ? 1 : -1);
      if (car.position.x > 140) car.position.x = -140;
      if (car.position.x < -140) car.position.x = 140;
    }
    this.renderer.render(this.scene, this.camera);
    return dt;
  }

  focusBay(index: number): void {
    this.focused.set(index * 4.2, 0.8, 0.4);
    this.controls.target.lerp(this.focused, 0.2);
  }

  private hideDynamic(): void {
    for (const car of this.cars.values()) car.root.visible = false;
  }

  private syncCars(state: GameState, session: ViewSession): void {
    const visible = state.vehicles.filter((v) => v.location !== 'offsite' || session.selectedId === v.id);
    const keep = new Set<string>();
    for (const v of visible) {
      if (session.mode === 'garage' && !v.location.startsWith('bay') && v.location !== 'parking' && v.location !== 'yard' && v.location !== 'showroom') continue;
      if (session.mode === 'track' && v.id !== session.selectedId) continue;
      if (session.mode === 'city' && v.id !== session.selectedId) continue;
      keep.add(v.id);
      let view = this.cars.get(v.id);
      if (!view) {
        view = new CarView(v.modelId, emptyPose(v.color));
        view.root.userData.vid = v.id;
        this.cars.set(v.id, view);
        this.scene.add(view.root);
      }
      view.root.userData.vid = v.id;
      const removed = Object.entries(v.slots).filter(([, uid]) => !uid).map(([slot]) => slot);
      const pose: CarPose = {
        color: v.color,
        paint: v.paintCondition,
        dirt: v.dirt,
        removed,
        hood: v.panels?.hood ? 1 : 0,
        trunk: v.panels?.trunk ? 1 : 0,
        doors: Object.values(v.panels?.doors ?? {}).some(Boolean) ? 1 : 0,
        lift: v.panels?.lift ? 1 : 0,
        steer: session.drive && session.selectedId === v.id ? session.drive.steer : 0,
        spin: session.drive && session.selectedId === v.id ? (session.drive.speed / 0.32) * this.dt : 0,
        lights: v.lights || (session.drive?.lights ?? false),
        wing: !!v.slots.wing,
        stripes: !!modelById(v.modelId).visual.stripes,
      };
      view.setPose(pose);
      view.root.visible = true;
      if (session.mode === 'garage') {
        const bay = v.location.startsWith('bay:') ? Number(v.location.split(':')[1]) : v.location === 'parking' ? 2.2 : v.location === 'yard' ? -1.6 : 3.4;
        const z = v.location.startsWith('bay:') ? 0 : 6.5;
        view.root.position.x = typeof bay === 'number' && v.location.startsWith('bay:') ? bay * 4.4 - 2 : bay === 2.2 ? 8 : bay === -1.6 ? -8 : 4;
        view.root.position.z = z;
        view.root.rotation.y = v.location.startsWith('bay:') ? 0.2 : 0.8;
      } else if (session.drive && session.selectedId === v.id) {
        const d = session.drive;
        view.root.position.set(d.x, 0, d.z);
        view.root.rotation.y = -d.heading;
        const fx = Math.sin(d.heading);
        const fz = Math.cos(d.heading);
        this.camera.position.lerp(new THREE.Vector3(d.x - fx * 8, 3.2, d.z - fz * 8), 0.12);
        this.controls.target.lerp(new THREE.Vector3(d.x, 0.8, d.z), 0.18);
        this.head.position.set(d.x + fx * 1.4, 0.7, d.z + fz * 1.4);
        this.head.target.position.set(d.x + fx * 16, 0.3, d.z + fz * 16);
        this.head.intensity = d.lights ? 36 : 0;
      }
      if (session.mode === 'garage' && v.id === session.selectedId && v.location.startsWith('bay:')) {
        this.focusBay(Number(v.location.split(':')[1]));
        this.spot.intensity = 18;
        this.spot.position.set(view.root.position.x, 3.4, view.root.position.z + 1);
        this.spot.target.position.copy(view.root.position);
      }
    }
    for (const [id, view] of this.cars) {
      if (!keep.has(id)) view.root.visible = false;
    }
  }

  private buildGarage(upgrades: string[], company = 'GARAGE EMPIRE'): void {
    while (this.garage.children.length) this.garage.remove(this.garage.children[0]);
    const bays = 1 + upgrades.filter((u) => u.startsWith('bay')).length;
    const width = 8 + bays * 4;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(width + 6, 0.2, 16), new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.9, metalness: 0.02 }));
    floor.receiveShadow = true;
    floor.position.y = -0.1;
    this.garage.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.82, metalness: 0.08 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(width + 4, 4.2, 0.3), wallMat);
    back.position.set(0, 2, -6);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.2, 14), wallMat);
    left.position.set(-width / 2 - 1, 2, 0);
    const right = left.clone();
    right.position.x = width / 2 + 1;
    this.garage.add(back, left, right);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, 0.2), metal(0x8d939b, 0.4));
    beam.position.set(0, 3.6, 0);
    this.garage.add(beam);
    for (let i = 0; i < 3; i++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0xfff4d2, emissive: 0xffe7b0, emissiveIntensity: 1.4 }));
      lamp.position.set(-width / 3 + i * (width / 3), 3.45, 0.4);
      const glow = new THREE.PointLight(0xffe2b8, 6, 16, 2);
      glow.position.set(lamp.position.x, 3.1, 0.6);
      this.garage.add(lamp, glow);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.7), new THREE.MeshBasicMaterial({ map: signTexture(company, '#e3a008') }));
    sign.position.set(0, 3.1, -5.8);
    this.garage.add(sign);
    if (upgrades.includes('lift')) {
      for (let b = 0; b < bays; b++) {
        const x = b * 4.4 - 2;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), metal(0xc4552a, 0.45));
        post.position.set(x - 1.1, 1.2, -1.2);
        const post2 = post.clone();
        post2.position.x = x + 1.1;
        this.garage.add(post, post2);
      }
    }
    if (upgrades.includes('office')) {
      const office = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x2c3340, roughness: 0.7 }));
      office.position.set(width / 2 - 0.2, 1.2, -4);
      this.garage.add(office);
    }
    if (upgrades.includes('paintBooth')) {
      const booth = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 4), new THREE.MeshPhysicalMaterial({ color: 0xfff6ea, roughness: 0.15, transmission: 0.4, transparent: true, opacity: 0.45 }));
      booth.position.set(-width / 2 + 0.4, 1.3, 2);
      this.garage.add(booth);
    }
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.5), metal(0xb4532a, 0.5));
    chest.position.set(-width / 2 + 1.2, 0.45, -4.5);
    this.garage.add(chest);
    this.scene.add(this.garage);
  }

  private buildCity(): void {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshStandardMaterial({ color: 0x3d4a38, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.city.add(ground);
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.86, metalness: 0.04 });
    const ew = new THREE.Mesh(new THREE.BoxGeometry(360, 0.06, 16), roadMat);
    ew.position.y = 0.03;
    const ns = new THREE.Mesh(new THREE.BoxGeometry(16, 0.06, 360), roadMat);
    ns.position.y = 0.04;
    this.city.add(ew, ns);
    const buildings = cityBuildings();
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2c3442, roughness: 0.8, metalness: 0.1 }), buildings.length);
    const dummy = new THREE.Object3D();
    buildings.forEach((b, i) => {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, new THREE.Color(b.color));
    });
    inst.castShadow = false;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.city.add(inst);
    for (const poi of POIS) {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1), new THREE.MeshBasicMaterial({ map: signTexture(poi.name.ru) }));
      board.position.set(poi.x, 3.2, poi.z);
      this.city.add(board);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(poi.w * 0.4, 0.2, poi.d * 0.4), new THREE.MeshStandardMaterial({ color: 0x4a453c, roughness: 0.9 }));
      pad.position.set(poi.x, 0.1, poi.z);
      this.city.add(pad);
    }
    for (let i = 0; i < 6; i++) {
      const car = simpleTrafficCar([0x234e70, 0x8d1d2c, 0x1f6f4a, 0xd8d2c6, 0xc4552a, 0x111111][i]);
      car.position.set(-80 + i * 24, 0, i % 2 ? 4 : -4);
      car.rotation.y = i % 2 ? Math.PI / 2 : -Math.PI / 2;
      this.traffic.push(car);
      this.city.add(car);
    }
    this.scene.add(this.city);
    this.city.visible = false;
  }

  private buildTrack(): void {
    const asphalt = new THREE.Mesh(new THREE.BoxGeometry(28, 0.08, 210), new THREE.MeshStandardMaterial({ color: 0x2e3338, roughness: 0.78 }));
    asphalt.position.set(0, 0, 100);
    asphalt.receiveShadow = true;
    const loop = new THREE.Mesh(new THREE.BoxGeometry(90, 0.08, 70), new THREE.MeshStandardMaterial({ color: 0x343a40, roughness: 0.8 }));
    loop.position.set(40, 0, 40);
    const dirt = new THREE.Mesh(new THREE.BoxGeometry(16, 0.1, 40), new THREE.MeshStandardMaterial({ color: 0x6a5438, roughness: 1 }));
    dirt.position.set(78, 0.02, 70);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xc4552a, roughness: 0.6 });
    for (const x of [-12, 12]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 180), wallMat);
      wall.position.set(x, 0.4, 90);
      this.track.add(wall);
    }
    const start = new THREE.Mesh(new THREE.BoxGeometry(16, 0.02, 0.4), new THREE.MeshBasicMaterial({ color: 0xf4f4f4 }));
    start.position.set(0, 0.08, 8);
    this.track.add(asphalt, loop, dirt, start);
    this.scene.add(this.track);
    this.track.visible = false;
  }

  private pick(ev: PointerEvent): void {
    if (!this.onPick || this.lastMode === 'menu' || this.lastMode === 'track' || this.lastMode === 'city') return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.pointer, this.camera);
    const roots = [...this.cars.values()].filter((c) => c.root.visible).map((c) => c.root);
    const hit = this.ray.intersectObjects(roots, true)[0];
    if (!hit) return;
    let obj: THREE.Object3D | null = hit.object;
    while (obj && !obj.userData.vid) obj = obj.parent;
    if (obj?.userData.vid) this.onPick(String(obj.userData.vid));
  }
}

function emptyPose(color: string): CarPose {
  return { color, paint: 80, dirt: 8, removed: [], hood: 0, trunk: 0, doors: 0, lift: 0, steer: 0, spin: 0, lights: true, wing: false, stripes: false };
}

function makeRain(): THREE.Points {
  const geo = new THREE.BufferGeometry();
  const n = 700;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 40;
    pos[i * 3 + 1] = Math.random() * 18;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd5e4f2, size: 0.05, transparent: true, opacity: 0.45 }));
}
