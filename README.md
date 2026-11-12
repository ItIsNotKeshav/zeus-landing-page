# Zeus landing page

The website for [Zeus](https://github.com/ItIsNotKeshav/Zeus), a native WhatsApp client for Windows, macOS and Linux. Vite, three.js and Lenis, no framework.

```sh
npm install
npm run dev       # local preview
npm run build     # refreshes the release notes from GitHub, then builds to dist/
```

## Release notes

`src/releases.json` holds every Zeus release from GitHub. `npm run build` refreshes it first (`scripts/fetch-releases.mjs`), and the build writes the notes into the page, so each deploy carries the latest ones. If GitHub can't be reached, the build keeps the file it has. In the browser, the page also asks GitHub for anything published after it was built and adds it on top.

To refresh by hand: `npm run releases`.

## Deploys

Pushes to `main` deploy to Vercel (project `landing`).
