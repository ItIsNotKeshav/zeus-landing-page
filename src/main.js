import Lenis from "lenis";
import { Sky } from "./scene.js";
import { THEMES } from "./themes.js";
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
const lenis = reduced ? null : new Lenis({ lerp: 0.085, anchors: true });

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

// Theme picker: the one live thing.
let picked = "zeus-dark";
let pickedTheme = THEMES[0];
let pickedMode = "dark";
const themeGroup = $('[data-picker="theme"]');
const status = $(".picker-status");
for (const theme of THEMES) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.theme = theme.id;
  button.setAttribute("aria-pressed", String(theme === pickedTheme));
  button.innerHTML = `<span class="swatch" aria-hidden="true"><i></i><i></i></span><span></span>`;
  button.lastChild.textContent = theme.name;
  themeGroup.append(button);
}
function paintSwatches() {
  for (const button of $$("button", themeGroup)) {
    const theme = THEMES.find((t) => t.id === button.dataset.theme);
    const colours = theme[pickedMode];
    button.style.setProperty("--sw-bg", colours.bg);
    button.style.setProperty("--sw-accent", colours.accent);
  }
}
function pick() {
  picked = `${pickedTheme.id}-${pickedMode}`;
  for (const button of $$("button", themeGroup)) button.setAttribute("aria-pressed", String(button.dataset.theme === pickedTheme.id));
  for (const button of $$("[data-mode]")) button.setAttribute("aria-pressed", String(button.dataset.mode === pickedMode));
  paintSwatches();
  status.textContent = `Showing ${pickedTheme.name}, ${pickedMode}.`;
  $("[data-theme-still]").src = `/img/themes/${picked}.webp`;
}
themeGroup.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  pickedTheme = THEMES.find((t) => t.id === button.dataset.theme);
  pick();
});
for (const button of $$("[data-mode]")) {
  button.addEventListener("click", () => {
    pickedMode = button.dataset.mode;
    pick();
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
      const next = () => queue.length && sky.texture(queue.shift()).finally(() => setTimeout(next, 60));
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
