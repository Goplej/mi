import * as THREE from 'three';

export function paintTexture(hex: string, paint: number, dirt: number, stripes: boolean, rust: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = hex;
  g.fillRect(0, 0, 512, 512);
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 16) {
    const n = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const flake = (n - 0.5) * 10 * (paint / 100);
    img.data[i] = clampByte(img.data[i] + flake);
    img.data[i + 1] = clampByte(img.data[i + 1] + flake);
    img.data[i + 2] = clampByte(img.data[i + 2] + flake);
  }
  g.putImageData(img, 0, 0);
  if (stripes) {
    g.fillStyle = 'rgba(255,255,255,0.82)';
    g.fillRect(228, 0, 28, 512);
    g.fillRect(262, 0, 8, 512);
  }
  if (paint < 72) {
    g.strokeStyle = `rgba(255,255,255,${0.15 + (72 - paint) / 200})`;
    g.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      g.beginPath();
      g.moveTo(Math.random() * 512, Math.random() * 512);
      g.lineTo(Math.random() * 512, Math.random() * 512);
      g.stroke();
    }
  }
  if (rust > 0.2 || paint < 42) {
    g.fillStyle = `rgba(122,58,28,${0.25 + rust * 0.4})`;
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.ellipse(40 + Math.random() * 430, 300 + Math.random() * 180, 18 + Math.random() * 40, 10 + Math.random() * 16, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (dirt > 8) {
    const grd = g.createLinearGradient(0, 280, 0, 512);
    grd.addColorStop(0, 'rgba(60,48,32,0)');
    grd.addColorStop(1, `rgba(48,40,28,${Math.min(0.72, dirt / 120)})`);
    g.fillStyle = grd;
    g.fillRect(0, 280, 512, 232);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, n));
}

export function concreteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6d7278';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const v = 80 + Math.random() * 50;
    g.fillStyle = `rgba(${v},${v},${v + 4},${Math.random() * 0.35})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(40,40,40,0.25)';
  g.strokeRect(8, 8, 240, 240);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function roadTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a2e33';
  g.fillRect(0, 0, 128, 256);
  g.strokeStyle = 'rgba(220,220,200,0.55)';
  g.setLineDash([18, 16]);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(64, 0);
  g.lineTo(64, 256);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function signTexture(text: string, accent = '#e3a008'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#12161c';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = accent;
  g.fillRect(0, 108, 512, 8);
  g.fillStyle = '#f4f7fb';
  g.font = '600 42px Manrope, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text.slice(0, 22), 256, 58);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makePaint(hex: string, paint: number, dirt: number, stripes: boolean): THREE.MeshPhysicalMaterial {
  const rust = paint < 40 ? (40 - paint) / 40 : 0;
  return new THREE.MeshPhysicalMaterial({
    map: paintTexture(hex, paint, dirt, stripes, rust),
    color: new THREE.Color(hex),
    metalness: 0.55,
    roughness: THREE.MathUtils.clamp(0.18 + (100 - paint) / 160 + dirt / 220, 0.12, 0.85),
    clearcoat: THREE.MathUtils.clamp(paint / 140, 0.05, 0.85),
    clearcoatRoughness: THREE.MathUtils.clamp(0.08 + dirt / 200, 0.05, 0.6),
    envMapIntensity: 1,
  });
}

export function rubber(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.86, metalness: 0.05 });
}

export function metal(color = 0xb9c0c8, rough = 0.35): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.82 });
}

export function glass(tint = 0x9bb4c8): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    metalness: 0,
    roughness: 0.05,
    transmission: 0.55,
    transparent: true,
    opacity: 0.45,
    thickness: 0.2,
    envMapIntensity: 1,
  });
}

export function emissive(color: number, intensity = 2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
}
