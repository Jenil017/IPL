# System Architecture
## IPL Match Prediction Web App (CricPredict)

**Version:** 1.1.0 (synced with repo)  
**Date:** 2026-04-01

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                    │
│   HTML + CSS + Vanilla JS (served under /static/)    │
│                                                      │
│   index.html  dashboard  history  chat  upload  admin│
└───────────────────┬─────────────────────────────────┘
                    │ HTTP (REST + JWT) + WebSocket (chat)
                    ▼
┌─────────────────────────────────────────────────────┐
│                  FASTAPI BACKEND                     │
│                   (Python 3.11+)                     │
│                                                      │
│  auth │ upload │ predictions │ results │ admin │ chat│
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │     PostgreSQL (DATABASE_URL + SQLModel)     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Deployment extras:** Optional background **keep-alive** loop (httpx) pinging `GET /api/ping` every 14 minutes when `RENDER_EXTERNAL_URL` is set—for hosts like Render that spin down idle services.

---

## 2. Project Directory Structure

```
d:\IPL\
│
├── main.py                  # FastAPI app, CORS, /api/ping, startup (DB init + seed + keep-alive)
├── database.py              # PostgreSQL engine via DATABASE_URL (required); get_session
├── models.py                # SQLModel: User, Prediction, ChatMessage (+ Token DTOs)
├── auth.py                  # JWT (HS256), bcrypt, get_current_user / get_current_admin
├── seed.py                  # Seed admin (jainil) + viewer (takshat) if missing
├── migrate.py               # Legacy SQLite helper: add is_featured (if using old data/ipl.db)
├── websocket_manager.py     # WebSocket ConnectionManager (broadcast)
│
├── routers/
│   ├── auth_router.py       # POST /api/login, GET /api/me
│   ├── upload_router.py     # POST /api/upload (admin)
│   ├── prediction_router.py # GET predictions, latest, by id; GET /api/accuracy
│   ├── result_router.py     # PATCH /api/predictions/{id}/result (admin)
│   ├── admin_router.py      # Users CRUD + featured match APIs
│   └── chat_router.py       # GET history, POST image upload, WS /api/chat/ws
│
├── static/
│   ├── index.html           # Login → /static/upload.html (admin) or dashboard
│   ├── dashboard.html       # Latest OR featured prediction; “coming soon” mode
│   ├── history.html         # History + accuracy + admin mark result
│   ├── upload.html          # JSON upload
│   ├── admin.html           # Users, featured dashboard picker, “coming soon” staging
│   ├── chat.html
│   ├── favicon.png
│   ├── css/style.css
│   ├── js/auth.js, dashboard.js, history.js, upload.js, admin.js, chat.js
│   └── uploads/chat/        # Chat images (UUID filenames)
│
├── _agent/                  # Product/spec samples + deploy helper scripts
│   ├── prd.md, architecture.md, features.md, flow.md
│   ├── sample_match_schema.json, match_*.json
│   ├── upload_to_prod.py, unfeature_prod.py
│
├── .env.example             # DATABASE_URL, SECRET_KEY, RENDER_EXTERNAL_URL
└── requirements.txt
```

---

## 3. Tech Stack

| Layer       | Technology            | Purpose                                      |
|-------------|-----------------------|----------------------------------------------|
| Backend     | FastAPI               | REST, static mount, WebSocket                |
| ORM         | SQLModel / SQLAlchemy | Models + queries                             |
| Database    | **PostgreSQL**        | `DATABASE_URL` required (local or Render)    |
| Auth        | python-jose + passlib/bcrypt | JWT + password hashing                |
| Server      | Uvicorn               | ASGI                                         |
| HTTP client | httpx                 | Keep-alive self-ping (optional)              |
| Frontend    | Vanilla HTML/CSS/JS   | No SPA framework                             |

Pinned versions: see root `requirements.txt` (includes `psycopg2-binary`, `httpx`, `bcrypt==4.0.1`, etc.).

---

## 4. Database Schema

### Table: `users`
- `id`, `username` (unique), `password_hash`, `role` (`admin` | `viewer`), `is_active`, `created_at`

### Table: `predictions`
Same as earlier spec, plus:
- **`is_featured`** (`BOOLEAN`, default false) — at most one should be featured; admin APIs enforce clearing others when setting.

### Table: `chat_messages`
- `id`, `sender`, `content`, `image_url`, `timestamp`

---

## 5. API Endpoints

### Auth
| Method | Endpoint     | Auth | Description |
|--------|--------------|------|-------------|
| POST   | `/api/login` | None | OAuth2 form: `username`, `password` → JWT |
| GET    | `/api/me`    | JWT  | Current username + role |

Logout is **client-only** (remove token from `localStorage`); there is no `/api/logout` route.

### Predictions & accuracy
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET    | `/api/predictions` | JWT | Any | Summary list (all rows, order from DB) |
| GET    | `/api/predictions/latest` | JWT | Any | Full JSON: **featured** row if `is_featured`, else **most recent** `uploaded_at` |
| GET    | `/api/predictions/{id}` | JWT | Any | Full JSON + `_meta.actual_winner_short`, `_meta.is_correct` |
| POST   | `/api/upload` | JWT | Admin | Multipart file field `file` (`.json`) |
| GET    | `/api/accuracy` | JWT | Any | Totals + `high_` / `medium_` / `low_` confidence accuracy % |

### Results
| Method | Endpoint | Auth | Admin | Description |
|--------|----------|------|-------|-------------|
| PATCH  | `/api/predictions/{id}/result` | JWT | Yes | Body: `actual_winner`, `actual_winner_short`. Sets `is_correct` by comparing **short codes**. Fails if already marked. |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/admin/users` | List users |
| POST   | `/api/admin/users` | Create viewer (`username`, `password`; min length **4**) |
| PATCH  | `/api/admin/users/{id}` | Toggle `is_active` (cannot deactivate self) |
| GET    | `/api/admin/predictions` | List uploads + `is_featured` (dashboard control UI) |
| PATCH  | `/api/admin/predictions/{id}/feature` | Clear other featured flags; set this row featured |
| DELETE | `/api/admin/predictions/{id}/feature` | Clear featured state (dashboard falls back to latest upload) |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/chat/history` | Last 50 messages, chronological |
| POST   | `/api/chat/upload` | Image for chat → URL under `/static/uploads/chat/` |
| WS     | `/api/chat/ws?token=<JWT>` | Text + optional `image_url` in JSON messages |

### Ops
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/ping` | `{"status":"alive",...}` for keep-alive |

---

## 6. Authentication

- JWT **HS256**, payload: `sub` (username), `role`, `exp`.
- **Expiry:** `ACCESS_TOKEN_EXPIRE_MINUTES = 7 * 24 * 60` (7 days) in `auth.py`.
- `SECRET_KEY` from environment (see `.env.example`); dev fallback exists—override in production.

---

## 7. Upload Validation (Server)

Required keys (see `upload_router.py`):
- `match_info` (must include `match_id`)
- `prediction_report`
- `dimension_scoring.final_scores`

Duplicate `match_id` → 400. File must end with `.json`.

**“Coming soon” mode:** Admin UI can upload a minimal JSON with `prediction_report.is_coming_soon: true` (see `admin.js`). Dashboard renders placeholder UI when that flag is set.

---

## 8. Security Notes

| Topic | Implementation |
|-------|----------------|
| Passwords | bcrypt via passlib |
| JWT secret | `SECRET_KEY` env |
| Roles | `get_current_admin` on upload, results, admin routes |
| CORS | `allow_origins=["*"]` in `main.py` (tighten for public deployments if needed) |
| WebSocket | JWT in query param; invalid token → close |

---

## 9. Running Locally

1. Create `.env` with `DATABASE_URL=postgresql://...` and `SECRET_KEY=...`.
2. `pip install -r requirements.txt`
3. `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
4. Open `http://localhost:8000/static/index.html` (root `/` redirects to static login).

---

## 10. Frontend Routes (actual URLs)

| Page | Path |
|------|------|
| Login | `/static/index.html` |
| Dashboard | `/static/dashboard.html` |
| History | `/static/history.html` |
| Chat | `/static/chat.html` |
| Upload | `/static/upload.html` |
| Admin | `/static/admin.html` |

API calls use `fetch('/api/...')` with `Authorization: Bearer <token>`.
