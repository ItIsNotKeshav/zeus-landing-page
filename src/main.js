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

function loop(now) {
  lenis?.raf(now);
  update();
  requestAnimationFrame(loop);
}

document.fonts.ready.then(() => {
  requestAnimationFrame(() => root.classList.add("is-loaded"));
});
requestAnimationFrame(loop);
