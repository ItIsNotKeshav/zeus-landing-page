// The page's sky: Zeus's bolt tile, the app's window, the weather and its lightning.
// main.js decides where things are on screen each frame (in CSS pixels, from the
// layout); this file turns that into a WebGL picture.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const FOV = 30;
const CAM_Z = 14;
const WINDOW_ASPECT = 936 / 1600;
// A desktop window's corner, about 20 points on the 1333-point shot, so it stays
// concentric outside the floating chat panel's own corner.
const WINDOW_RADIUS = 0.015;
const PAPER = new THREE.Color("#f7f7f7");
const COAL = new THREE.Color("#0b0b0c");
const ACCENT = new THREE.Color("#ffd60a");

// The logo's bolt, from docs/assets/images/logo.svg: a 120-unit tile at (4, 4).
const BOLT = [
  [40, 37],
  [88, 37],
  [54, 64],
  [75, 64],
  [40, 91],
  [88, 91],
].map(([x, y]) => new THREE.Vector2((x - 64) / 120, -(y - 64) / 120));

export class Sky {
  constructor(canvas, { reduced, lite }) {
    this.reduced = reduced;
    this.lite = lite;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(PAPER, 1);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.camera.position.set(0, 0, CAM_Z);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    // The room's lights are far brighter than the page; a tenth keeps the tile black and glossy.
    this.scene.environmentIntensity = 0.1;
    pmrem.dispose();

    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.key.position.set(-4, 6, 8);
    this.scene.add(this.key);
    this.boltLight = new THREE.PointLight(0xdfe8ff, 0, 30, 1.4);
    this.scene.add(this.boltLight);

    this.time = 0;
    this.flash = 0;
    this.strikes = [];
    this.textures = new Map();
    this.loader = new THREE.TextureLoader();

    this.makeSky();
    this.makeRain();
    this.makeTile();
    this.makeWindow();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (!lite) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 1.0);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  // The ground: flat paper by day, slow clouds lit from inside by night.
  makeSky() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.skyUniforms = {
      uTime: { value: 0 },
      uStorm: { value: 0 },
      uAura: { value: 0 },
      uFlash: { value: 0 },
      uFlashPos: { value: new THREE.Vector2(0, 0.5) },
      uAspect: { value: 1 },
      uPaper: { value: PAPER },
      uCoal: { value: COAL },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xy * 0.5 + 0.5;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime, uStorm, uAura, uFlash, uAspect;
        uniform vec2 uFlashPos;
        uniform vec3 uPaper, uCoal;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
          return v;
        }
        void main() {
          vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
          float t = uTime * 0.025;
          vec2 q = vec2(fbm(p * 1.4 + vec2(t, 0.0)), fbm(p * 1.4 + vec2(4.2, -t)));
          float c = fbm(p * 2.1 + q * 1.6 + vec2(t * 1.7, t * 0.4));
          float body = smoothstep(0.32, 0.86, c);
          vec3 storm = mix(uCoal, vec3(0.055, 0.060, 0.072), body);
          storm += vec3(0.020, 0.022, 0.028) * smoothstep(0.6, 0.95, c);
          float d = length(p - uFlashPos * vec2(uAspect, 1.0));
          float lit = uFlash * (0.18 + 0.82 * exp(-d * 2.4)) * (0.35 + body);
          storm += vec3(0.42, 0.47, 0.62) * lit;
          // The hero's dawn: soft, slow pools of the bolt's yellow and a little sky,
          // drifting like light through leaves, gone by the time the window settles.
          float w = uTime * 0.06;
          float sun = fbm(p * 1.1 + vec2(w, -w * 0.6) + q * 0.9);
          float leaf = fbm(p * 3.2 + vec2(-w * 1.4, w) + 3.0);
          vec3 dawn = mix(vec3(1.0, 0.93, 0.62), vec3(1.0, 0.84, 0.26), smoothstep(0.35, 0.75, sun));
          dawn = mix(dawn, vec3(0.86, 0.68, 0.16), smoothstep(0.55, 0.85, leaf) * 0.45);
          dawn = mix(dawn, vec3(0.80, 0.88, 1.0), smoothstep(0.62, 0.9, fbm(p * 0.8 - vec2(w * 0.5, 7.0))) * 0.55);
          float fade = smoothstep(-0.9, 0.05, p.y);
          vec3 day = mix(uPaper, dawn, uAura * fade);
          gl_FragColor = vec4(mix(day, storm, uStorm), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    this.scene.add(mesh);
  }

  makeRain() {
    const count = this.lite ? 700 : 1800;
    const drop = new Float32Array(count * 2 * 4);
    const end = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 22;
      const y = Math.random() * 14;
      const z = -4 + Math.random() * 9;
      const speed = 0.75 + Math.random() * 0.5;
      for (let k = 0; k < 2; k++) {
        drop.set([x, y, z, speed], (i * 2 + k) * 4);
        end[i * 2 + k] = k;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    geometry.setAttribute("aDrop", new THREE.BufferAttribute(drop, 4));
    geometry.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    this.rainUniforms = { uTime: { value: 0 }, uRain: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      uniforms: this.rainUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 aDrop;
        attribute float aEnd;
        uniform float uTime;
        varying float vEnd;
        void main() {
          float span = 14.0;
          float y = mod(aDrop.y - uTime * 9.0 * aDrop.w, span) - span * 0.5;
          float len = 0.42 * aDrop.w;
          vec3 pos = vec3(aDrop.x - y * 0.16 + aEnd * len * 0.16, y + aEnd * len, aDrop.z);
          vEnd = aEnd;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uRain;
        varying float vEnd;
        void main() {
          gl_FragColor = vec4(vec3(0.62, 0.68, 0.8), uRain * 0.32 * vEnd);
        }`,
    });
    this.rain = new THREE.LineSegments(geometry, material);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  // The app icon: a glossy black tile with the logo's bolt raised on both faces.
  makeTile() {
    const radius = (4.5 / 120) * 1.25;
    const pieces = [];
    for (let i = 0; i < BOLT.length - 1; i++) {
      const a = BOLT[i];
      const b = BOLT[i + 1];
      const piece = new THREE.CapsuleGeometry(radius, a.distanceTo(b), 6, 14);
      piece.rotateZ(Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2);
      piece.translate((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
      pieces.push(piece);
    }
    const front = mergeGeometries(pieces);
    front.scale(1, 1, 0.55);
    front.translate(0, 0, 0.13);
    const back = front.clone().rotateY(Math.PI);

    this.boltMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f4f2,
      roughness: 0.32,
      metalness: 0.05,
      emissive: ACCENT,
      emissiveIntensity: 0,
    });
    const tileMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0f0f11,
      roughness: 0.32,
      metalness: 0.0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.1,
    });

    this.tile = new THREE.Group();
    // The icon's rounded square: the logo's corner is 30 of 120.
    this.tile.add(new THREE.Mesh(roundedSlab(1, 1, 0.25, 0.26, 0.035), tileMaterial));
    this.tile.add(new THREE.Mesh(front, this.boltMaterial));
    this.tile.add(new THREE.Mesh(back, this.boltMaterial));
    this.scene.add(this.tile);
  }

  // The app window: a thin slab whose face is a real screenshot, two of them
  // so one theme can cross into the next.
  makeWindow() {
    // The slab is a hair larger than the shot, so a graphite rim outlines the
    // window even where its paper-white ground meets the paper-white page.
    const rim = 0.006;
    const frame = new THREE.Mesh(
      roundedSlab(1 + rim, WINDOW_ASPECT + rim, WINDOW_RADIUS + rim / 2, 0.028, 0.004),
      new THREE.MeshPhysicalMaterial({
        color: 0x1b1c1e,
        roughness: 0.4,
        metalness: 0.6,
        clearcoat: 0.6,
        transparent: true,
      }),
    );
    this.screenUniforms = {
      mapA: { value: null },
      mapB: { value: null },
      uMix: { value: 0 },
      uOpacity: { value: 1 },
      uAspect: { value: 1 / WINDOW_ASPECT },
      uRadius: { value: WINDOW_RADIUS / WINDOW_ASPECT },
      uFlash: { value: 0 },
      uSheen: { value: 0 },
    };
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1, WINDOW_ASPECT),
      new THREE.ShaderMaterial({
        uniforms: this.screenUniforms,
        transparent: true,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform sampler2D mapA, mapB;
          uniform float uMix, uOpacity, uAspect, uRadius, uFlash, uSheen;
          void main() {
            vec3 a = texture2D(mapA, vUv).rgb;
            vec3 b = texture2D(mapB, vUv).rgb;
            vec3 col = mix(a, b, uMix) * 0.94;
            float band = smoothstep(0.0, 0.22, 0.22 - abs(vUv.x + vUv.y * 0.6 - 0.35 - uSheen));
            col += vec3(band * 0.035);
            col += vec3(0.5, 0.55, 0.7) * uFlash * 0.25;
            vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
            vec2 box = vec2(uAspect, 1.0) * 0.5 - uRadius;
            float d = length(max(abs(p) - box, 0.0)) - uRadius;
            float edge = 1.0 - smoothstep(0.0, fwidth(d) * 1.5, d);
            gl_FragColor = vec4(col, edge * uOpacity);
            #include <colorspace_fragment>
          }`,
      }),
    );
    screen.position.z = 0.0145;
    this.frameMaterial = frame.material;

    // A soft contact shadow on the paper, so the window floats over it by day.
    const blur = document.createElement("canvas");
    blur.width = 320;
    blur.height = 220;
    const ctx = blur.getContext("2d");
    ctx.filter = "blur(18px)";
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.roundRect(48, 48, 224, 124, 16);
    ctx.fill();
    const shadowTexture = new THREE.CanvasTexture(blur);
    this.shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.2 });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.43, WINDOW_ASPECT * 1.7), this.shadowMaterial);
    shadow.position.set(0.02, -0.05, -0.3);

    this.window = new THREE.Group();
    this.window.add(shadow, frame, screen);
    this.scene.add(this.window);
    this.screenKey = null;
    this.pendingKey = null;
  }

  texture(key) {
    if (!this.textures.has(key)) {
      this.textures.set(
        key,
        new Promise((resolve, reject) => {
          this.loader.load(
            `/img/themes/${key}.webp`,
            (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
              texture.generateMipmaps = true;
              this.renderer.initTexture(texture);
              resolve(texture);
            },
            undefined,
            reject,
          );
        }),
      );
    }
    return this.textures.get(key);
  }

  // Shows the screenshot `key` on the window, crossing over from the last one.
  setScreen(key, quick = false) {
    if (key === this.pendingKey) return;
    this.pendingKey = key;
    this.texture(key).then((texture) => {
      if (this.pendingKey !== key) return;
      const u = this.screenUniforms;
      if (!u.mapA.value) {
        u.mapA.value = u.mapB.value = texture;
        this.screenKey = key;
        return;
      }
      u.mapA.value = this.mixedTexture();
      u.mapB.value = texture;
      u.uMix.value = 0;
      this.mixSpeed = quick || this.reduced ? 12 : 3.2;
      this.screenKey = key;
    });
  }

  mixedTexture() {
    const u = this.screenUniforms;
    return u.uMix.value < 0.5 ? u.mapA.value : u.mapB.value;
  }

  // A jagged path from above the sky down to `to`, with a few forks.
  strike(to, { main = false, far = false } = {}) {
    if (this.reduced) return;
    const top = this.worldPerPx(far ? -6 : 0) * this.height * 0.5 + 1;
    const start = new THREE.Vector3(to.x + (Math.random() - 0.5) * 3, top, to.z);
    const segments = [];
    const grow = (a, b, spread, depth, width) => {
      if (depth === 0) {
        segments.push([a, b, width]);
        return;
      }
      const mid = a.clone().lerp(b, 0.5);
      const dir = b.clone().sub(a);
      mid.x += (Math.random() - 0.5) * spread;
      mid.y += (Math.random() - 0.5) * spread * 0.25;
      grow(a, mid, spread * 0.52, depth - 1, width);
      grow(mid, b, spread * 0.52, depth - 1, width);
      if (depth > 2 && Math.random() < 0.32) {
        const fork = mid.clone().add(dir.multiplyScalar(0.35 + Math.random() * 0.25).applyAxisAngle(new THREE.Vector3(0, 0, 1), (Math.random() - 0.5) * 1.6));
        grow(mid, fork, spread * 0.45, depth - 2, width * 0.5);
      }
    };
    const width = far ? 0.025 : main ? 0.07 : 0.05;
    grow(start, to.clone(), start.distanceTo(to) * 0.28, 7, width);

    const positions = [];
    for (const [a, b, w] of segments) {
      const n = new THREE.Vector3(-(b.y - a.y), b.x - a.x, 0).normalize().multiplyScalar(w / 2);
      positions.push(
        a.x - n.x, a.y - n.y, a.z, a.x + n.x, a.y + n.y, a.z, b.x + n.x, b.y + n.y, b.z,
        a.x - n.x, a.y - n.y, a.z, b.x + n.x, b.y + n.y, b.z, b.x - n.x, b.y - n.y, b.z,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(far ? 1.6 : 4.5, far ? 1.7 : 4.6, far ? 2.2 : 5.6),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
    this.strikes.push({ mesh, age: 0, main, far, at: to.clone() });
    this.skyUniforms.uFlashPos.value.set(this.toScreenX(to), this.toScreenY(to));
  }

  // A flash in the clouds with no bolt you can see.
  glow(sx, sy) {
    if (this.reduced) return;
    this.skyUniforms.uFlashPos.value.set(sx - 0.5, 0.5 - sy);
    this.strikes.push({ mesh: null, age: 0, main: false, far: true });
  }

  toScreenX(v) {
    return v.x / (this.worldPerPx(v.z) * this.width);
  }

  toScreenY(v) {
    return v.y / (this.worldPerPx(v.z) * this.height);
  }

  worldPerPx(z) {
    return (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (CAM_Z - z)) / this.height;
  }

  // CSS pixel position on screen, at depth z, to world coordinates.
  place(object, px, py, sizePx, z) {
    const k = this.worldPerPx(z);
    object.position.set((px - this.width / 2) * k, -(py - this.height / 2) * k, z);
    object.scale.setScalar(Math.max(sizePx * k, 0.0001));
  }

  pointToWorld(px, py, z = 0) {
    const k = this.worldPerPx(z);
    return new THREE.Vector3((px - this.width / 2) * k, -(py - this.height / 2) * k, z);
  }

  tileWorld() {
    return this.tile.position.clone();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(this.width, this.height);
    if (this.bloom) this.bloom.resolution.set(this.width / 2, this.height / 2);
    this.skyUniforms.uAspect.value = this.width / this.height;
  }

  // One frame. `s` holds where main.js wants things, in screen pixels.
  frame(dt, s) {
    this.time += dt;
    const u = this.skyUniforms;
    u.uTime.value = this.time;
    u.uStorm.value = s.storm;
    u.uAura.value = s.win.aura ?? 0;
    this.rainUniforms.uTime.value = this.time;
    this.rainUniforms.uRain.value = this.reduced ? 0 : s.rain;
    this.rain.visible = !this.reduced && s.rain > 0.01;

    // The tile.
    this.tile.visible = s.tile.size > 1;
    this.place(this.tile, s.tile.x, s.tile.y, s.tile.size, s.tile.z);
    this.tile.rotation.set(s.tile.rx, s.tile.ry, s.tile.rz);
    this.key.intensity = 2.2 * (1 - s.storm * 0.55);

    // The window.
    const w = s.win;
    this.window.visible = w.opacity > 0.01 && w.w > 1;
    this.place(this.window, w.x, w.y, w.w, w.z);
    this.window.rotation.set(w.rx, w.ry, w.rz);
    this.screenUniforms.uOpacity.value = w.opacity;
    this.frameMaterial.opacity = w.opacity;
    this.shadowMaterial.opacity = 0.2 * w.opacity * (1 - s.storm);
    this.screenUniforms.uSheen.value = w.ry * 0.8 - w.rx * 0.5;
    if (this.screenUniforms.uMix.value < 1) {
      this.screenUniforms.uMix.value = Math.min(1, this.screenUniforms.uMix.value + dt * (this.mixSpeed || 4));
    }

    // Lightning: each strike flickers, lights the clouds, the window and the bolt tile, then goes.
    let flash = 0;
    let charge = s.tile.glow;
    for (const strike of this.strikes) {
      strike.age += dt;
      const t = strike.age;
      const life = strike.far ? 0.5 : 0.62;
      const env = t < 0.05 ? 1 : t < 0.09 ? 0.15 : t < 0.15 ? 0.9 : t < 0.2 ? 0.25 : Math.max(0, 0.75 * (1 - (t - 0.2) / (life - 0.2)));
      if (strike.mesh) strike.mesh.material.opacity = env;
      flash = Math.max(flash, env * (strike.far ? 0.55 : strike.main ? 1 : 0.8));
      if (strike.main) charge = Math.max(charge, env * 1.2);
      if (!strike.far && strike.at) this.boltLight.position.copy(strike.at).add(new THREE.Vector3(0.4, 1.2, 3));
    }
    for (const strike of this.strikes.filter((x) => x.age > 0.7)) {
      if (strike.mesh) {
        this.scene.remove(strike.mesh);
        strike.mesh.geometry.dispose();
        strike.mesh.material.dispose();
      }
    }
    this.strikes = this.strikes.filter((x) => x.age <= 0.7);
    this.flash += (flash - this.flash) * Math.min(1, dt * 40);
    u.uFlash.value = this.flash * Math.max(s.storm, 0.35);
    this.screenUniforms.uFlash.value = this.flash;
    this.boltLight.intensity = this.flash * 9;
    this.boltMaterial.emissiveIntensity = charge * 2.5;

    this.composer.render(dt);
  }

  dispose() {
    this.renderer.dispose();
  }
}

// A rounded rectangle w by h with corner r, extruded to `depth` with a soft
// bevel, centred on the origin.
function roundedSlab(w, h, r, depth, bevel) {
  const x = w / 2 - bevel;
  const y = h / 2 - bevel;
  const c = r - bevel;
  const shape = new THREE.Shape();
  shape.moveTo(-x + c, -y);
  shape.lineTo(x - c, -y);
  shape.quadraticCurveTo(x, -y, x, -y + c);
  shape.lineTo(x, y - c);
  shape.quadraticCurveTo(x, y, x - c, y);
  shape.lineTo(-x + c, y);
  shape.quadraticCurveTo(-x, y, -x, y - c);
  shape.lineTo(-x, -y + c);
  shape.quadraticCurveTo(-x, -y, -x + c, -y);
  const core = depth - bevel * 2;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: core,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 16,
  });
  geometry.translate(0, 0, -core / 2);
  geometry.computeVertexNormals();
  return geometry;
}
