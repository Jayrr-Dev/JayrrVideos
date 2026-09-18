# JayrrVideos

Free and open source virtual whiteboard. MIT licensed.

JayrrVideos is based on [Excalidraw](https://github.com/excalidraw/excalidraw). Same editor. Same MIT license. Independent public repo under [Jayrr-Dev](https://github.com/Jayrr-Dev).

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## License

MIT. Keep both copyright lines from [`LICENSE`](./LICENSE):

- Copyright (c) 2020 Excalidraw
- Copyright (c) 2026 Jayrr-Dev / JayrrVideos

This is **not** Excalidraw+. That product is separate and not included.

## Run locally

```bash
yarn
yarn start
```

Needs Node 18+.

## Google Drive (personal big files)

Scene JSON stays in the browser. When you connect Google Drive, files over 512KB go to a `JayrrVideos` folder in your Drive. Convex is the wrong locker for that; you already have 5TB there.

1. Google Cloud Console: create (or pick) a project.
2. Enable **Google Drive API**.
3. Credentials: **OAuth client ID**, type **Web application**.
4. Authorized JavaScript origins: `http://localhost:3001` (and your deployed origin later).
5. Put the client ID in `.env.development.local`:

```
VITE_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

6. Restart `yarn start`.
7. Hamburger menu: **Connect Google Drive**. Sign in with the Google account that has the 5TB.

The browser still has to hold the open image in RAM, so a single drop is capped at 512MB, not 5TB. Drive is for keeping many large files without filling IndexedDB.

## Quick start (embed the editor)

```bash
npm install react react-dom @excalidraw/excalidraw
```

Package name stays `@excalidraw/excalidraw` until this fork publishes its own npm package.

## Source

Upstream: https://github.com/excalidraw/excalidraw

GitHub one-fork-per-account already used by [jayrr-draw](https://github.com/Jayrr-Dev/jayrr-draw), so this repo is a public MIT copy with history, not a GitHub-network fork badge.
