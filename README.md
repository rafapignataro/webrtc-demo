# WebRTC Meet POC

A Google Meet–style proof of concept for small group video calls, built as a **pnpm workspace** with two projects:

- [`api/`](./api) — Hono + `@hono/node-ws` signaling server (port `8787`).
- [`app/`](./app) — Vite + React + TS client (port `5173`).

All audio/video flows peer-to-peer via **mesh WebRTC**. The backend is only a JSON relay used by peers to find each other and exchange SDP/ICE.

For an in-depth walkthrough of the architecture, signaling protocol and sequence diagrams, see [`DOCUMENTATION.md`](./DOCUMENTATION.md).

---

## Requirements

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+

## Install

From the repository root, install dependencies for both projects at once:

```bash
pnpm -r install
```

## Run (dev)

Still from the root, start the signaling server and the client in parallel:

```bash
pnpm -r dev
```

This will boot:

- `api/` → `http://localhost:8787` (WebSocket signaling at `ws://localhost:8787/ws`)
- `app/` → `http://localhost:5173`

Open `http://localhost:5173` in your browser, click **Start meeting**, and share the generated room URL with another tab/browser to test.

### Environment

`app/.env` is pre-configured to derive the signaling URL from `window.location.hostname`, so it works on both `localhost` and LAN IPs out of the box. Override only if the signaling server lives on a different host:

```bash
VITE_SIGNALING_URL=ws://localhost:8787/ws
```

---

## Testing with two peers

You need two separate browser sessions (different profiles or different browsers) joining the same room so each one has its own camera/mic stream.

### macOS

macOS lets multiple browser tabs share the same physical camera, so you can simply:

1. Open `http://localhost:5173` in one tab and click **Start meeting**.
2. Copy the room URL and open it in a second tab (or a different browser / private window).
3. Grant camera & microphone permissions in each.

No extra flags needed.

### Windows

On Windows the OS typically locks the camera to a single process, so opening the app twice will fail on the second tab. The easiest workaround is to spawn a second Chrome instance with a **separate user profile** and Chrome's **fake media stream** flags — this feeds a synthetic video/audio track so the real camera stays available to the first tab.

Open a new `cmd` / PowerShell window and run:

```bat
start chrome "http://localhost:3000" --use-fake-device-for-media-stream --use-fake-ui-for-media-stream --user-data-dir="C:\temp\profile2"
```

> Replace `http://localhost:3000` with your actual app URL (for Vite dev this is usually `http://localhost:5173`) and adjust the room path as needed.

Flag reference:

- `--use-fake-device-for-media-stream` — replaces the real webcam/mic with a synthetic feed.
- `--use-fake-ui-for-media-stream` — auto-accepts the camera/mic permission prompt.
- `--user-data-dir="C:\temp\profile2"` — isolates this Chrome instance in its own profile so it doesn't collide with your main browser session.

You can now use your first browser (real camera) as Peer A and this second Chrome window (fake camera) as Peer B.

---

## Useful scripts

Run scripts across the whole workspace with `pnpm -r <script>`, or target one project with `pnpm --filter <app|api> <script>`.

| Script | Location | What it does |
| --- | --- | --- |
| `dev` | `api/`, `app/` | Starts dev server with hot reload. |
| `build` | `api/`, `app/` | Type-checks and builds for production. |
| `start` | `api/` | Runs the built signaling server from `dist/`. |
| `preview` | `app/` | Serves the production build locally. |
| `lint` | `app/` | Runs ESLint. |

Examples:

```bash
pnpm --filter api dev
pnpm --filter app build
```
