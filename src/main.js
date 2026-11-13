import Lenis from "lenis";
import { ACCENTS, THEMES } from "./themes.js";
import { REPO, fromApi, renderPane, renderRow, version } from "./releases.js";

const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  button.innerHTML = '<span class="tc-disc" aria-hidden="true"></span><span class="tc-name"></span>';
  button.lastChild.textContent = theme.name;
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
  // Swap the window's picture once the next one is decoded, with a soft fade.
  const still = $("[data-theme-still]");
  const next = `/img/themes/${picked}.webp`;
  if (still.getAttribute("src") !== next) {
    const want = picked;
    const pre = new Image();
    pre.src = next;
    pre
      .decode()
      .catch(() => {})
      .then(() => {
        if (want !== picked) return;
        still.src = next;
        if (!reduced) still.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 280, easing: "cubic-bezier(0.33, 1, 0.68, 1)" });
      });
  }
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

// Light or dark: the visitor's system, unless they pick with the nav switch.
const modeSwitch = $("[data-mode-switch]");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
let chosen = null;
try {
  chosen = localStorage.getItem("zeus-site-mode");
} catch {
  // Storage off: follow the system.
}
function applyMode() {
  const dark = chosen ? chosen === "dark" : systemDark.matches;
  root.classList.toggle("is-dark", dark);
  root.classList.toggle("is-light", !dark);
  $('meta[name="theme-color"]').content = dark ? "#080808" : "#f7f7f7";
  modeSwitch?.setAttribute("aria-pressed", String(dark));
  const shot = $("[data-hero-shot]");
  const source = $("[data-hero-dark]");
  if (shot && source) {
    source.media = dark ? "all" : "not all";
  }
}
systemDark.addEventListener("change", applyMode);
modeSwitch?.addEventListener("click", () => {
  chosen = root.classList.contains("is-dark") ? "light" : "dark";
  try {
    localStorage.setItem("zeus-site-mode", chosen);
  } catch {
    // Not remembered: fine for this visit.
  }
  root.classList.add("is-switching");
  applyMode();
  if (chosen === "dark") strike({ big: true });
  setTimeout(() => root.classList.remove("is-switching"), 500);
});
applyMode();

// Light and dark side by side: drag (or use the arrow keys) to move the split.
const compare = $("[data-compare]");
const compareRange = $("[data-compare-range]");
if (compare && compareRange) {
  compareRange.addEventListener("input", () => compare.style.setProperty("--s", String(compareRange.value / 100)));
  // A gentle nudge the first time it comes into view, so the split reads as movable.
  if (!reduced) {
    new IntersectionObserver(
      (entries, observer) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const sway = (now) => {
          const t = Math.min(1, (now - start) / 1600);
          const v = 0.5 + Math.sin(t * Math.PI * 2) * 0.14 * (1 - t);
          compare.style.setProperty("--s", String(v));
          if (t < 1) requestAnimationFrame(sway);
        };
        setTimeout(() => requestAnimationFrame(sway), 500);
      },
      { threshold: 0.6 },
    ).observe(compare);
  }
}

// Figures count up when they arrive.
const counters = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      counters.unobserve(entry.target);
      const node = entry.target;
      const to = Number(node.dataset.count);
      const decimals = Number(node.dataset.decimals || 0);
      if (reduced || to <= 1) continue;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / 1200);
        const eased = 1 - Math.pow(1 - t, 4);
        node.textContent = (to * eased).toFixed(decimals);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  },
  { threshold: 0.6 },
);
for (const node of $$("[data-count]")) counters.observe(node);

// Each frame: the nav's glass, and the hero window leaning back then settling flat.
const nav = $(".nav");
const hero = $("[data-hero]");
let lastY = 0;
let frameTilt = -1;
function update() {
  const y = window.scrollY;
  const vh = window.innerHeight;
  nav.classList.toggle("is-solid", y > 24 && (!hero || y > hero.offsetHeight - vh * 0.9));
  nav.classList.toggle("is-hidden", y > vh && y > lastY + 2);
  if (y < lastY - 2) nav.classList.remove("is-hidden");
  lastY = y;
  // The hero's scroll: 0 at the top, 1 when its pinned stretch ends, eased.
  if (hero && y < hero.offsetHeight + vh) {
    const run = Math.max(1, hero.offsetHeight - vh);
    const t = Math.min(1, Math.max(0, y / run));
    const eased = t * t * (3 - 2 * t);
    if (Math.abs(eased - frameTilt) > 0.0005) {
      frameTilt = eased;
      hero.style.setProperty("--p", eased.toFixed(4));
    }
  }
}

// The gallery rail: pinned while the page scrolls past it, sliding sideways
// by exactly as far as the cards run past the screen. Cards near the middle
// stand up straight; the rest lean back and dim a little.
const rail = $("[data-rail]");
const railTrack = $("[data-rail-track]");
const railBar = $("[data-rail-bar]");
let railRun = 0;
// The rail moves a little faster than the page, so nine themes take fewer screens of scrolling.
const RAIL_PACE = 0.7;
let railCards = [];
let railLast = -1;
function railMeasure() {
  if (!rail || reduced) return;
  railTrack.style.transform = "";
  railRun = Math.max(0, railTrack.scrollWidth - railTrack.clientWidth);
  rail.style.height = `${innerHeight + railRun * RAIL_PACE}px`;
  railCards = $$(".rail-card", railTrack).map((card) => ({ card, mid: card.offsetLeft + card.offsetWidth / 2 }));
  railLast = -1;
}
function railUpdate() {
  if (!rail || reduced || !railRun) return;
  const top = rail.offsetTop;
  const y = window.scrollY;
  if (y < top - innerHeight || y > top + railRun * RAIL_PACE + innerHeight) return;
  const p = Math.min(1, Math.max(0, (y - top) / (railRun * RAIL_PACE)));
  if (Math.abs(p - railLast) < 0.0002) return;
  railLast = p;
  const x = p * railRun;
  railTrack.style.transform = `translate3d(${-x}px, 0, 0)`;
  if (railBar) railBar.style.transform = `scaleX(${0.08 + p * 0.92})`;
  const centre = x + railTrack.clientWidth / 2;
  const half = railTrack.clientWidth / 2 || 1;
  for (const { card, mid } of railCards) {
    const d = Math.max(-1.5, Math.min(1.5, (mid - centre) / half));
    card.style.setProperty("--d", d.toFixed(3));
  }
}
if (rail && !reduced) {
  document.documentElement.classList.add("has-rail");
  railMeasure();
  addEventListener("resize", railMeasure);
  addEventListener("load", railMeasure);
}

function loop(now) {
  lenis?.raf(now);
  update();
  railUpdate();
  requestAnimationFrame(loop);
}

document.fonts.ready.then(() => {
  requestAnimationFrame(() => root.classList.add("is-loaded"));
  // Zeus announces himself: one strike on the name once it has settled,
  // then now and then a distant one in the clouds while the sky is in view.
  if (!reduced) {
    setTimeout(() => strike({ big: true }), 2100);
    const distant = () => {
      setTimeout(() => {
        const p = parseFloat(hero?.style.getPropertyValue("--p") || "0");
        if (!document.hidden && p < 0.4 && window.scrollY < innerHeight) strike({ big: Math.random() < 0.25 });
        distant();
      }, 6000 + Math.random() * 9000);
    };
    distant();
  }
});
requestAnimationFrame(loop);

// Thunder: Zeus's bolt. A jagged path grown by midpoint displacement, drawn in
// a blink behind the name, with a flash over the sky. Big strikes hit the name;
// small ones flicker far off in the clouds.
function boltPoints(x0, y0, x1, y1, rough, depth) {
  let pts = [[x0, y0], [x1, y1]];
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay);
      const off = (Math.random() - 0.5) * len * rough;
      // Push the midpoint sideways from the segment.
      const nx = -(by - ay) / (len || 1);
      const ny = (bx - ax) / (len || 1);
      next.push([(ax + bx) / 2 + nx * off, (ay + by) / 2 + ny * off], pts[i]);
    }
    pts = next;
  }
  return pts;
}

const toPath = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");

const bolts = $("[data-bolts]");
const flash = $("[data-flash]");
const heroWord = $(".hero-word");
let striking = false;

function strike({ big = false } = {}) {
  if (reduced || !bolts || striking) return;
  const box = bolts.getBoundingClientRect();
  if (!box.width || box.bottom < 0) return;
  striking = true;
  const w = box.width;
  const h = box.height;
  bolts.setAttribute("viewBox", `0 0 ${w} ${h}`);
  bolts.replaceChildren();

  let x0, y0, x1, y1;
  if (big && heroWord) {
    // Down from the top of the sky onto the name.
    const r = heroWord.getBoundingClientRect();
    x1 = r.left - box.left + r.width * (0.25 + Math.random() * 0.5);
    y1 = r.top - box.top + r.height * 0.42;
    x0 = x1 + (Math.random() - 0.5) * w * 0.35;
    y0 = -20;
  } else {
    // Far off: short, thin, high in the clouds at one side.
    const side = Math.random() < 0.5 ? 0.12 + Math.random() * 0.2 : 0.68 + Math.random() * 0.2;
    x0 = w * side;
    y0 = h * (0.04 + Math.random() * 0.1);
    x1 = x0 + (Math.random() - 0.5) * w * 0.12;
    y1 = y0 + h * (0.22 + Math.random() * 0.18);
  }

  const ns = "http://www.w3.org/2000/svg";
  const add = (d, cls) => {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", cls);
    bolts.append(path);
    return path;
  };
  const main = boltPoints(x0, y0, x1, y1, 0.42, big ? 6 : 5);
  const paths = [add(toPath(main), big ? "bolt bolt-big" : "bolt")];
  // A few forks off the main channel.
  const forks = big ? 3 : 1;
  for (let f = 0; f < forks; f++) {
    const i = Math.floor(main.length * (0.2 + Math.random() * 0.5));
    const [fx, fy] = main[i];
    const reach = (y1 - y0) * (0.18 + Math.random() * 0.22);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const fork = boltPoints(fx, fy, fx + dir * reach * 0.7, fy + reach, 0.5, 4);
    paths.push(add(toPath(fork), "bolt bolt-fork"));
  }

  bolts.classList.toggle("is-far", !big);
  // Grow each channel downwards in a blink.
  for (const path of paths) {
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: big ? 110 : 90, easing: "cubic-bezier(0.2, 0, 0.4, 1)", fill: "both" });
  }
  // The flicker: lit, dims, lit again, gone.
  const glow = big ? [1, 0.25, 1, 0.55, 0.85, 0] : [0.7, 0.15, 0.6, 0];
  bolts.animate(
    glow.map((opacity) => ({ opacity })),
    { duration: big ? 900 : 600, easing: "linear", fill: "both" },
  ).finished.then(() => {
    bolts.replaceChildren();
    striking = false;
  });
  if (flash) {
    flash.style.setProperty("--fx", `${((x1 / w) * 100).toFixed(1)}%`);
    flash.style.setProperty("--fy", `${((y1 / h) * 100).toFixed(1)}%`);
    const peak = big ? 1 : 0.35;
    flash.animate(
      [{ opacity: 0 }, { opacity: peak, offset: 0.06 }, { opacity: peak * 0.2, offset: 0.2 }, { opacity: peak * 0.7, offset: 0.3 }, { opacity: 0 }],
      { duration: big ? 1100 : 700, easing: "ease-out" },
    );
  }
  if (big && heroWord) {
    heroWord.classList.remove("is-struck");
    void heroWord.offsetWidth;
    heroWord.classList.add("is-struck");
  }
}
