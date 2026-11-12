// The themes the app's Appearance card offers (ChatTheme::ALL in the Zeus repo),
// in its order: the three looks, then six ready-made themes. Each is shot from the
// app's demo in both modes (public/img/themes/<id>-<mode>.webp). `chat` is the
// window's ground and `accent` its own accent, as the app's swatches draw them:
// a disc of the one with a dot of the other.
export const THEMES = [
  { id: "zeus", name: "Zeus", light: { chat: "#f7f7f7", accent: "#1a1a1a" }, dark: { chat: "#0d0d0d", accent: "#f4f4f4" } },
  { id: "whatsapp", name: "WhatsApp", light: { chat: "#efeae2", accent: "#25d366" }, dark: { chat: "#0b141a", accent: "#21c063" } },
  { id: "messages", name: "Messages", light: { chat: "#ffffff", accent: "#0a84ff" }, dark: { chat: "#1e1e1e", accent: "#0a84ff" } },
  { id: "vercel", name: "Vercel", light: { chat: "#f8f8f8", accent: "#171717" }, dark: { chat: "#030303", accent: "#ededed" } },
  { id: "catppuccin", name: "Catppuccin", light: { chat: "#e7eaf0", accent: "#8839ef" }, dark: { chat: "#1b1b2a", accent: "#cba6f7" } },
  { id: "dracula", name: "Dracula", light: { chat: "#f7f4e4", accent: "#a87de0" }, dark: { chat: "#252531", accent: "#bd93f9" } },
  { id: "nord", name: "Nord", light: { chat: "#e4e8f0", accent: "#5e81ac" }, dark: { chat: "#2b303a", accent: "#88c0d0" } },
  { id: "gruvbox", name: "Gruvbox", light: { chat: "#f5e8bf", accent: "#af3a03" }, dark: { chat: "#232425", accent: "#fe8019" } },
  { id: "solarized", name: "Solarized", light: { chat: "#f7f0dd", accent: "#268bd2" }, dark: { chat: "#002531", accent: "#2aa198" } },
];

// The app's named accents (Accent::ALL), macOS's system colours in Dark Aqua.
// "Theme" keeps the theme's own.
export const ACCENTS = [
  { id: "theme", name: "Theme's own", rgb: null },
  { id: "red", name: "Red", rgb: "#ff453a" },
  { id: "orange", name: "Orange", rgb: "#ff9f0a" },
  { id: "yellow", name: "Yellow", rgb: "#ffd60a" },
  { id: "green", name: "Green", rgb: "#30d158" },
  { id: "teal", name: "Teal", rgb: "#40c8e0" },
  { id: "blue", name: "Blue", rgb: "#0a84ff" },
  { id: "purple", name: "Purple", rgb: "#bf5af2" },
  { id: "pink", name: "Pink", rgb: "#ff378f" },
];
