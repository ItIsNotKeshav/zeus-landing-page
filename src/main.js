import Lenis from "lenis";
import { Sky } from "./scene.js";
import { ACCENTS, THEMES } from "./themes.js";
import { REPO, fromApi, renderPane, renderRow, version } from "./releases.js";

const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const lite = matchMedia("(max-width: 900px)").matches || (navigator.hardwareConcurrency || 8) <= 4;
const $ = (selector, el = document) => el.querySelector(selector);
const $$ = (selector, el = document) => [...el.querySelectorAll(selector)];
root.classList.add("js-motion");

// The headline arrives a word at a time, each one coming into focus.
for (const line of document.querySelectorAll("[data-split]")) {
  let i = 0;
  const wrap = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) frag.append(part);
          else {
            const word = document.createElement("span");
            word.className = "word";
            word.style.setProperty("--i", String(i++));
            word.textContent = part;
            frag.append(word);
          }
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName === "EM") {
          child.classList.add("word");
          child.style.setProperty("--i", String(i++));
        } else wrap(child);
      }
    }
  };
  wrap(line);
}

const WINDOW_ASPECT = 936 / 1600;
const TAU = Math.PI * 2;

const el = {
  nav: $(".nav"),
  unveil: $(".unveil"),
  stats: $(".stats"),
  storm: $(".storm"),
  themes: $(".themes"),
  calls: $(".calls"),
  footer: $(".footer"),
  slotHero: $('[data-slot="hero"]'),
  monument: $(".hero .monument"),
  stageHero: $('[data-stage="hero"]'),
  slotFooter: $('[data-slot="footer"]'),
  stageUnveil: $('[data-stage="unveil"]'),
  stageStats: $('[data-stage="stats"]'),
  stageStorm: $('[data-stage="storm"]'),
  stageThemes: $('[data-stage="themes"]'),
  flash: $(".flash"),
};

// Smooth scrolling, unless the reader asked for less motion.
// A fixed-length glide per wheel step with an expo ease-out reads calmer than lerp,
// and touch keeps the device's own momentum.
const lenis = reduced
  ? null
  : new Lenis({
      duration: 1.15,
      easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1,
      syncTouch: false,
      anchors: { duration: 1.4 },
    });

let sky = null;
try {
  sky = new Sky($("#sky"), { reduced, lite });
  root.classList.add("has-3d");
  sky.setScreen("zeus-light");
  sky.texture("zeus-dark");
  if (import.meta.env.DEV) window.__sky = sky;
} catch (error) {
  console.warn("Zeus: 3D is off, showing still pictures instead.", error);
}

// Section positions in the document, measured on layout changes rather than every frame.
const m = {};
let stops = [];
function measure() {
  const vh = window.innerHeight;
  for (const key of ["unveil", "stats", "storm", "themes", "calls", "footer"]) {
    const r = el[key].getBoundingClientRect();
    m[key] = { top: r.top + window.scrollY, h: r.height };
  }
  m.max = Math.max(1, document.documentElement.scrollHeight - vh);
  m.strike = m.storm.top + 0.55 * (m.storm.h - vh);
  m.darkScreenUntil = m.storm.top + m.storm.h - vh;
  stops = [
    ["hero", 0],
    ["unveilA", m.unveil.top],
    ["unveilB", m.unveil.top + m.unveil.h - vh],
    ["stats", m.stats.top + m.stats.h / 2 - vh / 2],
    ["stormA", m.storm.top],
    ["stormB", m.storm.top + 0.42 * (m.storm.h - vh)],
    ["stormC", m.storm.top + m.storm.h - vh],
    ["themes", m.themes.top + m.themes.h / 2 - vh / 2],
    ["gone", m.calls.top],
    ["footerIn", m.footer.top - vh],
    ["footer", m.max],
  ];
  // Keep them in order whatever the layout does.
  for (let i = 1; i < stops.length; i++) stops[i][1] = Math.max(stops[i][1], stops[i - 1][1] + 1);
}

const fit = (node) => {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
};
const slot = (node) => {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.height };
};
const badge = (win) => {
  const size = Math.min(150, Math.max(52, win.w * 0.15));
  return { x: win.x - win.w / 2 + size * 0.2, y: win.y - (win.w * WINDOW_ASPECT) / 2 + size * 0.05, size };
};

// Where everything sits at each stop. Rects are read live, so a stop moves with its section.
function pose(name) {
  const vh = window.innerHeight;
  const hidden = { opacity: 0, z: -6, rx: 0, ry: 0, rz: 0 };
  let win;
  let tile;
  let storm = 0;
  let rain = 0;
  switch (name) {
    case "hero":
      win = { ...fit(el.stageHero), z: 0.6, rx: 0.16, ry: 0, rz: 0, opacity: 1, aura: 1 };
      tile = { ...slot(el.slotHero), z: 0, rx: 0, ry: 0, rz: 0, glow: 0 };
      break;
    case "unveilA":
      win = { ...fit(el.stageUnveil), z: 0, rx: 0.24, ry: -0.34, rz: 0.03, opacity: 1 };
      tile = { ...badge(win), z: 1.4, rx: 0.15, ry: 0.7, rz: 0.1, glow: 0 };
      break;
    case "unveilB":
      win = { ...fit(el.stageUnveil), z: 0, rx: 0.04, ry: -0.12, rz: 0, opacity: 1 };
      tile = { ...badge(win), z: 1.4, rx: 0.05, ry: TAU - 0.3, rz: 0, glow: 0 };
      break;
    case "stats":
      win = { ...fit(el.stageStats), z: 0, rx: 0.06, ry: -0.44, rz: 0, opacity: 1 };
      tile = { ...badge(win), z: 1.6, rx: 0.1, ry: TAU - 0.5, rz: 0.06, glow: 0 };
      break;
    case "stormA":
      win = { ...fit(el.stageStorm), z: 0, rx: 0.03, ry: -0.08, rz: 0, opacity: 1 };
      tile = { ...badge(win), z: 1.4, rx: 0, ry: TAU, rz: 0, glow: 0 };
      storm = 0.1;
      break;
    case "stormB":
    case "stormC":
      win = { ...fit(el.stageStorm), z: 0, rx: 0.02, ry: -0.04, rz: 0, opacity: 1 };
      tile = { ...badge(win), z: 1.4, rx: 0, ry: TAU, rz: 0, glow: name === "stormB" ? 0.3 : 0.12 };
      storm = 1;
      rain = 1;
      break;
    case "themes":
      win = { ...fit(el.stageThemes), z: 0, rx: 0.05, ry: -0.2, rz: 0, opacity: 1 };
      tile = { ...badge(win), z: 1.4, rx: 0.08, ry: TAU - 0.35, rz: 0.05, glow: 0.08 };
      storm = 1;
      rain = 0.3;
      break;
    case "gone":
      win = { ...fit(el.stageThemes), ...hidden, ry: -0.7, opacity: 0 };
      tile = { ...badge(win), z: -3, rx: 0, ry: TAU - 0.35, rz: 0, glow: 0 };
      tile.y -= vh * 0.2;
      storm = 1;
      rain = 0.2;
      break;
    default:
      // footerIn and footer: dawn, and the tile back in the name.
      win = { x: window.innerWidth / 2, y: vh * 1.5, w: 10, ...hidden };
      tile = { ...slot(el.slotFooter), z: 0, rx: 0, ry: TAU, rz: 0, glow: 0 };
  }
  win.aura ??= 0;
  return { win, tile, storm, rain };
}

const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
function blend(a, b, t) {
  const out = {};
  for (const key in a) out[key] = typeof a[key] === "number" ? mix(a[key], b[key], t) : a[key];
  return out;
}

function stateAt(y) {
  let i = 0;
  while (i < stops.length - 2 && y >= stops[i + 1][1]) i++;
  const [nameA, atA] = stops[i];
  const [nameB, atB] = stops[i + 1];
  const t = ease(Math.min(1, Math.max(0, (y - atA) / (atB - atA))));
  const a = pose(nameA);
  const b = pose(nameB);
  return {
    win: blend(a.win, b.win, t),
    tile: blend(a.tile, b.tile, t),
    storm: mix(a.storm, b.storm, t),
    rain: mix(a.rain, b.rain, t),
  };
}

// Pointer, eased, for a little parallax on desktop.
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
window.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse") return;
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
});

// Theme picker: the app's Appearance card. The mode pill, the accents, the themes
// as discs of their ground with a dot of their accent; the window wears the pick.
const darkScheme = matchMedia("(prefers-color-scheme: dark)");
// Accent stills exist only once shot (public/img/themes/accents/).
const ACCENT_STILLS = true;
const pickState = { theme: THEMES[0], mode: "dark", accent: ACCENTS[0] };
let picked = "zeus-dark";
const themeGroup = $('[data-picker="theme"]');
const accentGroup = $('[data-picker="accent"]');
const modeGroup = $('[data-picker="mode"]');
const status = $(".picker-status");
const resolvedMode = () => (pickState.mode === "auto" ? (darkScheme.matches ? "dark" : "light") : pickState.mode);
for (const theme of THEMES) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("role", "radio");
  button.dataset.theme = theme.id;
  button.title = theme.name;
  button.setAttribute("aria-label", theme.name);
  themeGroup.append(button);
}
if (ACCENT_STILLS) {
  accentGroup.hidden = false;
  for (const accent of ACCENTS) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "radio");
    button.dataset.accent = accent.id;
    button.title = accent.name;
    button.setAttribute("aria-label", accent.name);
    if (accent.rgb) button.style.setProperty("--dot", accent.rgb);
    else button.classList.add("is-own");
    accentGroup.append(button);
  }
}
function pick() {
  const mode = resolvedMode();
  const { theme, accent } = pickState;
  picked = accent.rgb ? `accents/${theme.id}-${mode}-${accent.id}` : `${theme.id}-${mode}`;
  for (const button of $$("button", themeGroup)) {
    const t = THEMES.find((x) => x.id === button.dataset.theme);
    button.style.setProperty("--chat", t[mode].chat);
    button.style.setProperty("--dot", accent.rgb || t[mode].accent);
    button.setAttribute("aria-checked", String(t === theme));
    button.tabIndex = t === theme ? 0 : -1;
  }
  for (const button of $$("button", accentGroup)) {
    const on = button.dataset.accent === accent.id;
    button.setAttribute("aria-checked", String(on));
    button.tabIndex = on ? 0 : -1;
    if (button.classList.contains("is-own")) button.style.setProperty("--dot", theme[mode].accent);
  }
  const modes = $$("button", modeGroup);
  for (const button of modes) {
    const on = button.dataset.mode === pickState.mode;
    button.setAttribute("aria-checked", String(on));
    button.tabIndex = on ? 0 : -1;
  }
  modeGroup.style.setProperty("--at", String(modes.findIndex((b) => b.dataset.mode === pickState.mode)));
  const accentText = accent.rgb ? `, ${accent.name.toLowerCase()} accent` : "";
  status.textContent = `${theme.name}, ${pickState.mode === "auto" ? `auto (${mode} for you)` : mode}${accentText}.`;
  $("[data-theme-still]").src = `/img/themes/${picked}.webp`;
}
themeGroup.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  pickState.theme = THEMES.find((t) => t.id === button.dataset.theme);
  pick();
});
accentGroup.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  pickState.accent = ACCENTS.find((a) => a.id === button.dataset.accent);
  pick();
});
modeGroup.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  pickState.mode = button.dataset.mode;
  pick();
});
darkScheme.addEventListener("change", () => pickState.mode === "auto" && pick());
// Arrow keys move along each row, as radio groups do.
for (const group of [themeGroup, accentGroup, modeGroup]) {
  group.addEventListener("keydown", (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    const buttons = $$("button", group);
    const at = buttons.indexOf(document.activeElement);
    if (at < 0) return;
    event.preventDefault();
    const next = buttons[(at + step + buttons.length) % buttons.length];
    next.focus();
    next.click();
  });
}
pick();

// Load the other themes once the reader gets near them.
if (sky) {
  new IntersectionObserver(
    (entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const queue = THEMES.flatMap((t) => [`${t.id}-dark`, `${t.id}-light`]);
      const next = () => queue.length && sky.texture(queue.shift()).catch(() => {}).finally(() => setTimeout(next, 60));
      next();
    },
    { rootMargin: "100% 0px" },
  ).observe(el.themes);
}

// Calls: three kinds, one plate.
const CALLS = {
  group: {
    src: "/img/call-group.webp",
    alt: "A group video call in Zeus with five people",
    text: "Answer when the group rings and see everyone at once, each on their own tile, with your camera beside them.",
  },
  video: {
    src: "/img/call-video.webp",
    alt: "A one-to-one video call in Zeus, the other person's camera filling the window",
    text: "Video one to one, up to 720p, stepping its quality up and down with your connection as the call goes.",
  },
  voice: {
    src: "/img/call-voice.webp",
    alt: "A voice call in Zeus with Luna Starling, three minutes in",
    text: "Voice through the microphone and speaker you choose. Switch either mid-call and the call carries on.",
  },
};
const callImage = $("[data-call-image]");
const callText = $("[data-call-text]");
for (const button of $$("[data-call]")) {
  button.addEventListener("click", () => {
    const call = CALLS[button.dataset.call];
    for (const other of $$("[data-call]")) other.setAttribute("aria-pressed", String(other === button));
    callImage.style.opacity = 0;
    callText.style.opacity = 0;
    setTimeout(() => {
      callImage.src = call.src;
      callImage.alt = call.alt;
      callText.textContent = call.text;
      callImage.style.opacity = 1;
      callText.style.opacity = 1;
    }, reduced ? 0 : 180);
  });
}
for (const call of Object.values(CALLS)) new Image().src = call.src;

// The tour video: plays, muted, while it is on screen; sound is the reader's choice.
const film = $("[data-film]");
const filmSound = $("[data-film-sound]");
if (film) {
  new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !reduced) film.play().catch(() => {});
        else film.pause();
      }
    },
    { threshold: 0.35 },
  ).observe(film);
  if (reduced) film.controls = true;
  filmSound.addEventListener("click", () => {
    film.muted = !film.muted;
    filmSound.setAttribute("aria-pressed", String(!film.muted));
    filmSound.textContent = film.muted ? "Sound on" : "Sound off";
    if (film.paused) film.play().catch(() => {});
  });
}

// Features: point at a name to read it.
const tip = $(".feature-tip");
for (const button of $$(".feature-col button")) {
  const show = () => {
    for (const other of $$(".feature-col button")) other.classList.toggle("is-on", other === button);
    tip.textContent = button.dataset.tip;
  };
  button.addEventListener("mouseenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("click", show);
}

// Footer: Zeus says goodbye in a chat, and a pile of the demo's stickers to throw about.
const fcLog = $("[data-fc-log]");
const fcStatus = $("[data-fc-status]");
const JOKES = [
  "Why did the browser tab join a gym? To lose a gigabyte.",
  "An Electron app walks into a bar. It orders fourteen processes.",
  "My memory use is so low I sometimes forget I'm running.",
  "What does a bolt of lightning say when it's done? That was quick.",
  "I'd tell you a joke about the borrow checker, but you'd only get to use it once.",
  "How many Zeus windows does it take to change a light bulb? One. It opens in a blink.",
];
let jokeAt = Math.floor(Math.random() * JOKES.length);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduced ? 0 : ms));
function bubble(text, own = false) {
  const node = document.createElement("p");
  node.className = `fc-bubble${own ? " is-own" : ""}`;
  node.textContent = text;
  fcLog.append(node);
  while (fcLog.children.length > 6) fcLog.firstElementChild.remove();
  return node;
}
let typingBusy = false;
async function say(lines) {
  typingBusy = true;
  for (const line of lines) {
    fcStatus.textContent = "typing…";
    const dots = document.createElement("p");
    dots.className = "fc-bubble fc-typing";
    dots.innerHTML = "<i></i><i></i><i></i>";
    dots.setAttribute("aria-label", "Zeus is typing");
    fcLog.append(dots);
    await wait(520 + line.length * 12);
    dots.remove();
    bubble(line);
    await wait(260);
  }
  fcStatus.textContent = "online";
  typingBusy = false;
}
new IntersectionObserver(
  (entries, observer) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    say(["Oh hey, you made it to the bottom.", "Zeus is free, open source and light on memory. Want a copy?"]);
  },
  { threshold: 0.4 },
).observe($("[data-footer-chat]"));
$("[data-joke]").addEventListener("click", async () => {
  if (typingBusy) return;
  bubble("Tell me a joke", true);
  await wait(250);
  jokeAt = (jokeAt + 1) % JOKES.length;
  say([JOKES[jokeAt]]);
});

// The sticker pit: drop them in when it comes into view, then drag and throw.
const pit = $("[data-pit]");
const STICKERS = [
  ["astronaut", "brb, in orbit"],
  ["cat", "5 more minutes"],
  ["frog", "LGTM"],
  ["goat", "nope."],
  ["owl", "who pushed to main?"],
  ["pug", "is it merged yet?"],
  ["raccoon", "found the bug"],
];
const bodies = STICKERS.map(([name, caption], i) => {
  const img = document.createElement("img");
  img.src = `/img/stickers/${name}.webp`;
  img.alt = `Sticker: ${caption}`;
  img.draggable = false;
  img.className = "pit-sticker";
  pit.append(img);
  return { img, x: 0, y: 0, vx: 0, vy: 0, a: (Math.random() - 0.5) * 0.6, va: 0, r: 0, held: false, i };
});
let pitW = 0;
let pitH = 0;
let pitRunning = false;
let pitDropped = false;
function pitSize() {
  pitW = pit.clientWidth;
  pitH = pit.clientHeight;
  const size = Math.min(150, Math.max(84, pitW / 8));
  for (const b of bodies) {
    b.r = size / 2;
    b.img.style.width = b.img.style.height = `${size}px`;
  }
}
function pitDraw() {
  for (const b of bodies) b.img.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px) rotate(${b.a}rad)`;
}
function pitStep(dt) {
  const g = 2400;
  let moving = false;
  for (const b of bodies) {
    if (b.held) {
      moving = true;
      continue;
    }
    b.vy += g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.a += b.va * dt;
    // Walls and floor, with a little bounce and rolling friction.
    if (b.y + b.r > pitH) {
      b.y = pitH - b.r;
      b.vy *= -0.38;
      b.vx *= 0.9;
      b.va = b.vx / b.r;
      if (Math.abs(b.vy) < 40) b.vy = 0;
    }
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx) * 0.5;
    }
    if (b.x + b.r > pitW) {
      b.x = pitW - b.r;
      b.vx = -Math.abs(b.vx) * 0.5;
    }
    b.va *= 0.985;
    if (Math.abs(b.vx) > 4 || Math.abs(b.vy) > 4 || b.y + b.r < pitH - 1) moving = true;
  }
  // Stickers push each other apart as circles.
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const p = bodies[i];
        const q = bodies[j];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const min = (p.r + q.r) * 0.86;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        const pw = p.held ? 0 : q.held ? 2 : 1;
        const qw = q.held ? 0 : p.held ? 2 : 1;
        p.x -= nx * push * pw;
        p.y -= ny * push * pw;
        q.x += nx * push * qw;
        q.y += ny * push * qw;
        const rel = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
        if (rel < 0) {
          const impulse = -rel * 0.6;
          if (!p.held) {
            p.vx -= nx * impulse * 0.5;
            p.vy -= ny * impulse * 0.5;
          }
          if (!q.held) {
            q.vx += nx * impulse * 0.5;
            q.vy += ny * impulse * 0.5;
          }
        }
      }
    }
  }
  return moving;
}
let pitLast = 0;
function pitLoop(now) {
  const dt = Math.min(1 / 30, (now - pitLast) / 1000 || 1 / 60);
  pitLast = now;
  let moving = false;
  for (let s = 0; s < 2; s++) moving = pitStep(dt / 2) || moving;
  pitDraw();
  if (moving) requestAnimationFrame(pitLoop);
  else pitRunning = false;
}
function pitWake() {
  if (pitRunning) return;
  pitRunning = true;
  pitLast = performance.now();
  requestAnimationFrame(pitLoop);
}
function pitDrop() {
  pitSize();
  bodies.forEach((b, i) => {
    if (reduced) {
      b.x = ((i + 0.5) / bodies.length) * pitW;
      b.y = pitH - b.r;
      return;
    }
    b.x = b.r + Math.random() * (pitW - 2 * b.r);
    b.y = -b.r - i * b.r * 1.6;
    b.vx = (Math.random() - 0.5) * 300;
    b.vy = 0;
    b.va = (Math.random() - 0.5) * 4;
  });
  pitDraw();
  pit.classList.add("is-live");
  if (!reduced) pitWake();
}
new IntersectionObserver(
  (entries) => {
    if (!pitDropped && entries.some((entry) => entry.isIntersecting)) {
      pitDropped = true;
      pitDrop();
    }
  },
  { threshold: 0.3 },
).observe(pit);
new ResizeObserver(() => {
  if (!pitDropped) return;
  const before = pitW;
  pitSize();
  for (const b of bodies) b.x = Math.min(pitW - b.r, (b.x / (before || pitW)) * pitW);
  pitDraw();
  if (!reduced) pitWake();
}).observe(pit);
// Drag and throw.
let grab = null;
pit.addEventListener("pointerdown", (event) => {
  const b = bodies.find((x) => x.img === event.target);
  if (!b || reduced) return;
  event.preventDefault();
  const r = pit.getBoundingClientRect();
  grab = { b, id: event.pointerId, ox: event.clientX - r.left - b.x, oy: event.clientY - r.top - b.y, t: performance.now(), px: event.clientX, py: event.clientY };
  b.held = true;
  b.vx = b.vy = 0;
  b.img.classList.add("is-held");
  pit.setPointerCapture(event.pointerId);
  pitWake();
});
pit.addEventListener("pointermove", (event) => {
  if (!grab || event.pointerId !== grab.id) return;
  const r = pit.getBoundingClientRect();
  const now = performance.now();
  const dt = Math.max(1, now - grab.t) / 1000;
  const { b } = grab;
  b.vx = b.vx * 0.5 + ((event.clientX - grab.px) / dt) * 0.5;
  b.vy = b.vy * 0.5 + ((event.clientY - grab.py) / dt) * 0.5;
  b.x = Math.min(pitW - b.r, Math.max(b.r, event.clientX - r.left - grab.ox));
  b.y = Math.min(pitH - b.r, event.clientY - r.top - grab.oy);
  b.a += (event.clientX - grab.px) * 0.004;
  grab.t = now;
  grab.px = event.clientX;
  grab.py = event.clientY;
});
const release = (event) => {
  if (!grab || event.pointerId !== grab.id) return;
  const { b } = grab;
  b.held = false;
  b.vx = Math.max(-2600, Math.min(2600, b.vx));
  b.vy = Math.max(-2600, Math.min(2600, b.vy));
  b.va = b.vx / (b.r * 2);
  b.img.classList.remove("is-held");
  grab = null;
  pitWake();
};
pit.addEventListener("pointerup", release);
pit.addEventListener("pointercancel", release);

// Releases: a list of versions beside the open one, like a chat list beside a chat.
const rb = $("[data-rb]");
const rbList = $(".rb-list", rb);
const rbPanes = $(".rb-panes", rb);
function selectRelease(tag, { focus = false } = {}) {
  const row = $$(".rb-row", rbList).find((node) => node.dataset.tag === tag);
  const pane = $$(".rb-pane", rbPanes).find((node) => node.dataset.tag === tag);
  if (!row || !pane || row.classList.contains("is-selected")) return;
  for (const other of $$(".rb-row", rbList)) {
    const on = other === row;
    other.classList.toggle("is-selected", on);
    other.setAttribute("aria-selected", String(on));
    other.tabIndex = on ? 0 : -1;
  }
  for (const other of $$(".rb-pane", rbPanes)) other.classList.toggle("is-active", other === pane);
  $(".rb-scroll", pane).scrollTop = 0;
  // Bring the row into view inside the list only, never the page.
  const top = row.offsetTop - rbList.offsetTop;
  if (top < rbList.scrollTop || top + row.offsetHeight > rbList.scrollTop + rbList.clientHeight) {
    rbList.scrollTo({ top: top - 8, left: row.offsetLeft - 16, behavior: reduced ? "auto" : "smooth" });
  }
  if (rbList.scrollWidth > rbList.clientWidth) {
    rbList.scrollTo({ left: row.offsetLeft - 16, behavior: reduced ? "auto" : "smooth" });
  }
  if (focus) row.focus();
}
rbList.addEventListener("click", (event) => {
  const row = event.target.closest(".rb-row");
  if (row) selectRelease(row.dataset.tag);
});
rbList.addEventListener("keydown", (event) => {
  const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
  const rows = $$(".rb-row", rbList);
  const at = rows.findIndex((row) => row.classList.contains("is-selected"));
  let next = null;
  if (event.key in keys) next = rows[Math.min(rows.length - 1, Math.max(0, at + keys[event.key]))];
  if (event.key === "Home") next = rows[0];
  if (event.key === "End") next = rows[rows.length - 1];
  if (!next) return;
  event.preventDefault();
  selectRelease(next.dataset.tag, { focus: true });
});

// A link to one release (#release-0-40-0) opens it.
function openFromHash() {
  const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (target?.classList.contains("rb-pane")) selectRelease(target.dataset.tag);
}
window.addEventListener("hashchange", openFromHash);
openFromHash();

// Anything published since this page was built is fetched from GitHub and added on top.
async function freshReleases() {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return;
    const known = new Set($$(".rb-row", rbList).map((node) => node.dataset.tag));
    const fresh = (await response.json())
      .filter((r) => !r.draft && r.published_at && !known.has(r.tag_name))
      .map(fromApi)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!fresh.length) return;
    for (const old of $$(".rb-latest:not(.is-beta), .rb-avatar.is-latest", rbList)) {
      if (old.classList.contains("rb-avatar")) old.classList.remove("is-latest");
      else old.remove();
    }
    fresh.forEach((release, i) => {
      const newest = i === fresh.length - 1;
      rbList.insertAdjacentHTML("afterbegin", renderRow(release, { latest: newest }));
      rbList.firstElementChild.classList.add("is-fresh");
      rbPanes.insertAdjacentHTML("afterbegin", renderPane(release));
    });
    selectRelease(fresh[fresh.length - 1].tag);
    const latest = version(fresh[fresh.length - 1].tag);
    for (const node of $$("[data-latest-version]")) node.textContent = latest;
    const count = $("[data-release-count]");
    if (count) count.textContent = String($$(".rb-row", rbList).length);
  } catch {
    // Offline or rate-limited: the notes built into the page stand.
  }
}
new IntersectionObserver(
  (entries, observer) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    freshReleases();
  },
  { rootMargin: "60% 0px" },
).observe(rb);

// Entrances: each part of a section rises in turn.
const reveal = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-in");
      reveal.unobserve(entry.target);
    }
  },
  { rootMargin: "0px 0px -10% 0px" },
);
for (const node of $$("[data-reveal]")) {
  const siblings = $$(":scope > [data-reveal]", node.parentElement);
  node.style.setProperty("--d", `${siblings.indexOf(node) * 80}ms`);
  reveal.observe(node);
}

// The storm: a strike flips the page from day to night.
let night = false;
let lastScreen = null;
let lastY = 0;
let ambientAt = 4;
let clock = 0;
let started = performance.now();

function flashPage() {
  if (reduced) return;
  el.flash.style.display = "block";
  el.flash
    .animate(
      [{ opacity: 0 }, { opacity: 0.42, offset: 0.08 }, { opacity: 0.05, offset: 0.2 }, { opacity: 0.22, offset: 0.32 }, { opacity: 0 }],
      { duration: 520, easing: "ease-out" },
    )
    .finished.then(() => (el.flash.style.display = "none"));
}

function update(dt) {
  const y = window.scrollY;
  const vh = window.innerHeight;
  const s = stateAt(y);

  // Day or night, decided by where the strike line is.
  const isNight = y >= m.strike;
  if (isNight !== night) {
    const first = lastScreen === null;
    night = isNight;
    root.classList.toggle("is-dark", night);
    root.classList.toggle("is-light", !night);
    el.storm.classList.toggle("is-night", night);
    $('meta[name="theme-color"]').content = night ? "#0b0b0c" : "#f3f3f1";
    if (!first && sky) {
      sky.strike(sky.tileWorld(), { main: true });
      flashPage();
    }
  }
  const screen = y < m.strike ? "zeus-light" : y < m.darkScreenUntil ? "zeus-dark" : picked;
  if (sky && screen !== lastScreen) {
    const crossing = lastScreen !== null && (screen === "zeus-dark") !== (lastScreen === "zeus-dark") && (screen === "zeus-light" || lastScreen === "zeus-light");
    if (crossing && !reduced) setTimeout(() => sky.setScreen(screen, true), 70);
    else sky.setScreen(screen);
  }
  lastScreen = screen;

  // Navigation: solid once the page moves, out of the way while reading down.
  // While a 3D chapter is pinned the bar stays clear, so it never cuts a strip off
  // the sky; nothing scrolls under it there.
  const pinned = (key) => y >= m[key].top && y <= m[key].top + m[key].h - vh;
  el.nav.classList.toggle("is-solid", y > 40 && !(sky && (pinned("unveil") || pinned("storm"))));
  el.nav.classList.toggle("is-hidden", y > vh && y > lastY + 2);
  if (y < lastY - 2) el.nav.classList.remove("is-hidden");
  lastY = y;

  if (!sky) return;
  const showing = y < m.calls.top || y > m.footer.top - vh;
  if (!showing) return;

  // Life: the hero tile drops in, everything breathes, and the pointer leans on it.
  clock += dt;
  pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 4);
  pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 4);
  if (!reduced) {
    const entrance = Math.min(1, (performance.now() - started) / 1600);
    const settle = 1 - Math.pow(1 - entrance, 3);
    // The window rises from below the fold and leans back as the page opens.
    const rise = Math.min(1, Math.max(0, (performance.now() - started - 450) / 1500));
    const lift = 1 - Math.pow(1 - rise, 4);
    s.win.y += (1 - lift) * vh * 0.7;
    s.win.rx += (1 - lift) * 0.55;
    s.win.opacity *= Math.min(1, rise * 3);
    s.win.aura *= Math.min(1, (performance.now() - started) / 900);
    s.tile.y -= (1 - settle) * vh * 0.55;
    s.tile.ry += (1 - settle) * TAU * 1.25;
    s.tile.rx += Math.sin(clock * 0.7) * 0.07 + pointer.sy * 0.28;
    s.tile.ry += Math.sin(clock * 0.5) * 0.16 + pointer.sx * 0.42;
    s.win.rx += pointer.sy * 0.05;
    s.win.ry += pointer.sx * 0.07;
    s.win.y += Math.sin(clock * 0.9) * 3;

    // The storm grumbles on its own while it is overhead.
    if (s.storm > 0.85) {
      ambientAt -= dt;
      if (ambientAt <= 0) {
        ambientAt = 4 + Math.random() * 6;
        if (Math.random() < 0.55) sky.glow(0.15 + Math.random() * 0.7, 0.05 + Math.random() * 0.3);
        else sky.strike(sky.pointToWorld(Math.random() * window.innerWidth, vh * (0.75 + Math.random() * 0.3), -6), { far: true });
      }
    }
  }
  // The window passes in front of the name: hide the letters below its top edge.
  if (y < vh * 1.5) {
    const top = s.win.y - ((s.win.w * WINDOW_ASPECT) / 2) * Math.cos(s.win.rx);
    const r = el.monument.getBoundingClientRect();
    el.monument.style.clipPath = `inset(0 0 ${Math.max(0, r.bottom - top).toFixed(1)}px 0)`;
  }
  el.storm.style.setProperty("--day", String(1 - Math.min(1, Math.max(0, (s.storm - 0.3) / 0.3))));
  sky.frame(dt, s);
}

// Click the storm to call down a bolt where you clicked.
let lastBolt = 0;
document.addEventListener("click", (event) => {
  if (!sky || reduced || !night) return;
  if (event.target.closest("a, button, input, label, img, .nav")) return;
  if (!event.target.closest(".storm, .themes")) return;
  const now = performance.now();
  if (now - lastBolt < 350) return;
  lastBolt = now;
  sky.strike(sky.pointToWorld(event.clientX, event.clientY, 0));
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  lenis?.raf(now);
  update(dt);
  requestAnimationFrame(loop);
}

function resize() {
  measure();
  sky?.resize();
}
window.addEventListener("resize", resize);
new ResizeObserver(() => measure()).observe(document.body);
measure();

document.fonts.ready.then(() => {
  measure();
  started = performance.now();
  requestAnimationFrame(() => root.classList.add("is-loaded"));
});
requestAnimationFrame(loop);
