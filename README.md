# Jackie's Profile — SAS (Software-as-a-Service) Profile App

A runnable starting codebase for **Jackie's profile** application: a small,
dependency-free **Software-as-a-Service style** web app that serves a
professional profile/portfolio through a REST API and a single-page frontend.

> Built with the Node.js standard library only — **zero runtime dependencies**,
> so it runs anywhere Node 18+ is installed, with no `npm install` required.

## Quick start

```bash
npm start        # start the server on http://localhost:3000
npm run dev      # start with auto-reload (node --watch)
npm test         # run the test suite (node --test)
```

Then open <http://localhost:3000>.

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Browser (SPA)              │        │  Node.js HTTP server          │
│  public/                    │        │  src/                         │
│  ├─ index.html              │  HTTP  │  ├─ server.js   bootstrap     │
│  ├─ app.js   (fetch + render)│ <────> │  ├─ app.js      router        │
│  └─ styles.css              │  JSON  │  ├─ routes/     HTTP handlers │
└─────────────────────────────┘        │  ├─ services/   business logic│
                                        │  ├─ lib/        helpers       │
                                        │  └─ config.js   configuration │
                                        └───────────────┬──────────────┘
                                                        │ reads
                                                        ▼
                                                 data/profile.json
```

### Layers

| Layer        | Location              | Responsibility                                            |
| ------------ | --------------------- | --------------------------------------------------------- |
| **Bootstrap**| `src/server.js`       | Creates the HTTP server and starts listening.             |
| **Routing**  | `src/app.js`          | Maps `METHOD path` to handlers; serves static files safely.|
| **Routes**   | `src/routes/`         | Translate HTTP ⇄ service calls; map errors to status codes.|
| **Services** | `src/services/`       | Business logic: load, parse, and validate profile data.   |
| **Lib**      | `src/lib/`            | Reusable helpers (JSON responses, MIME types).            |
| **Config**   | `src/config.js`       | Centralized configuration (port, paths) via env vars.     |
| **Data**     | `data/profile.json`   | The profile content — the single source of truth.         |
| **Frontend** | `public/`             | Static SPA that fetches `/api/profile` and renders it.    |

### API

| Method | Path           | Description                          |
| ------ | -------------- | ----------------------------------- |
| `GET`  | `/api/health`  | Health check (`{ status: "ok" }`).  |
| `GET`  | `/api/profile` | Returns the profile as `{ data }`.  |

Errors are returned as `{ "error": { "status", "message" } }`.

### Configuration

| Env var | Default   | Description              |
| ------- | --------- | ------------------------ |
| `PORT`  | `3000`    | Port to listen on.       |
| `HOST`  | `0.0.0.0` | Interface to bind to.    |

## Editing Jackie's profile

All content lives in [`data/profile.json`](data/profile.json). Edit it and
refresh the page — no code changes needed. Required fields: `name`, `title`.

## Testing

Tests use Node's built-in test runner (`node --test`):

- `test/profileService.test.js` — service logic, validation, and error cases.
- `test/api.test.js` — HTTP endpoints, static serving, and path-traversal safety.

## Project layout

```
.
├── data/profile.json     # profile content (source of truth)
├── public/               # frontend SPA (html/css/js + assets)
├── src/                  # backend (server, router, routes, services, lib)
├── test/                 # test suite
└── package.json
```

## Roadmap / collaboration ideas

- Add `PUT /api/profile` with auth to make it a true editable SaaS.
- Persist data in a database (PostgreSQL/SQLite) behind the service layer.
- Multi-tenant profiles (`/api/profiles/:handle`).
- Containerize with a `Dockerfile` and add CI.

## License

MIT
