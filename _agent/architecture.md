# System Architecture
## IPL Match Prediction Web App

**Version:** 1.0.0
**Date:** 2026-03-31

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                    │
│   HTML + CSS + Vanilla JS (served by FastAPI)        │
│                                                      │
│   /login   /dashboard   /history   /upload   /admin  │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP (REST API + JWT)
                    ▼
┌─────────────────────────────────────────────────────┐
│                  FASTAPI BACKEND                     │
│                   (Python 3.11+)                     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  ┌──────────┐  │
│  │   auth   │  │  upload  │  │  predictions API │  │   chat   │  │
│  │  router  │  │  router  │  │     router       │  │  manager │  │
│  └──────────┘  └──────────┘  └──────────────────┘  └──────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │            SQLite (via SQLModel)              │   │
│  │            data/ipl.db                        │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 2. Project Directory Structure

```
d:\IPL\
│
├── main.py                  # FastAPI app entry point
├── database.py              # DB engine + session setup
├── models.py                # SQLModel table definitions
├── auth.py                  # JWT logic + bcrypt hashing
├── seed.py                  # Pre-seed admin + viewer users
│
├── routers/
│   ├── auth_router.py       # POST /login, POST /logout
│   ├── upload_router.py     # POST /api/upload (admin only)
│   ├── prediction_router.py # GET /api/predictions, GET /api/predictions/{id}
│   ├── result_router.py     # PATCH /api/predictions/{id}/result (admin only)
│   ├── admin_router.py      # GET/POST /api/admin/users (admin only)
│   └── chat_router.py       # WebSocket + HTTP chat endpoints
│
├── websocket_manager.py     # WebSocket logic & connection storage
│
├── static/
│   ├── index.html           # Login page
│   ├── dashboard.html       # Latest prediction display
│   ├── history.html         # Match history + accuracy table
│   ├── upload.html          # Admin JSON upload page
│   ├── admin.html           # Admin user management page
│   ├── chat.html            # Real-time chat interface
│   ├── css/
│   │   └── style.css        # Global styles (dark theme, glassmorphism)
│   └── js/
│       ├── auth.js          # Login/logout, JWT storage
│       ├── dashboard.js     # Fetch + render prediction card
│       ├── history.js       # Fetch + render history table
│       ├── upload.js        # File upload handler
│       ├── admin.js         # Admin panel logic
│       └── chat.js          # Chat WebSocket client logic
│
├── data/
│   └── ipl.db               # SQLite database (auto-created on first run)
│
├── _agent/
│   ├── prd.md
│   ├── architecture.md
│   ├── features.md
│   └── flow.md
│
└── requirements.txt
```

---

## 3. Tech Stack

| Layer       | Technology          | Version  | Purpose                              |
|-------------|---------------------|----------|--------------------------------------|
| Backend     | FastAPI             | 0.110+   | REST API, file serving, routing      |
| ORM         | SQLModel            | 0.0.16+  | SQLite ORM (Pydantic + SQLAlchemy)   |
| Database    | SQLite              | Built-in | Persistent file-based storage        |
| Auth        | python-jose + bcrypt| Latest   | JWT tokens + password hashing        |
| Server      | Uvicorn             | 0.29+    | ASGI server for FastAPI              |
| Frontend    | HTML + CSS + JS     | Vanilla  | No framework, served as static files |
| Fonts       | Google Fonts        | CDN      | Outfit font family                   |

---

## 4. Database Schema

### Table: `users`
```sql
CREATE TABLE users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'viewer',  -- 'admin' | 'viewer'
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Table: `predictions`
```sql
CREATE TABLE predictions (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id             TEXT UNIQUE NOT NULL,    -- e.g. IPL2026_M04
    season               INTEGER NOT NULL,
    match_number         INTEGER NOT NULL,
    stage                TEXT NOT NULL,
    team_a               TEXT NOT NULL,
    team_b               TEXT NOT NULL,
    team_a_short         TEXT NOT NULL,
    team_b_short         TEXT NOT NULL,
    venue_name           TEXT NOT NULL,
    venue_city           TEXT NOT NULL,
    match_date           TEXT NOT NULL,
    start_time_ist       TEXT NOT NULL,
    predicted_winner     TEXT NOT NULL,
    predicted_winner_short TEXT NOT NULL,
    confidence_pct       INTEGER NOT NULL,
    confidence_level     TEXT NOT NULL,
    json_data            TEXT NOT NULL,           -- full raw JSON stored as string
    actual_winner        TEXT DEFAULT NULL,        -- filled after match
    actual_winner_short  TEXT DEFAULT NULL,
    is_correct           INTEGER DEFAULT NULL,     -- 1=correct, 0=wrong, NULL=pending
    uploaded_by          TEXT NOT NULL,
    uploaded_at          TEXT NOT NULL DEFAULT (datetime('now')),
    result_marked_at     TEXT DEFAULT NULL
);
```

### Table: `chat_messages`
```sql
CREATE TABLE chat_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sender      TEXT NOT NULL,
    content     TEXT NOT NULL,
    image_url   TEXT DEFAULT NULL,
    timestamp   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 5. API Endpoints

### Auth
| Method | Endpoint      | Auth     | Description              |
|--------|---------------|----------|--------------------------|
| POST   | `/api/login`  | None     | Returns JWT access token |
| POST   | `/api/logout` | JWT      | Clears session           |

### Predictions
| Method | Endpoint                          | Auth    | Role   | Description                     |
|--------|-----------------------------------|---------|--------|---------------------------------|
| GET    | `/api/predictions`                | JWT     | Any    | List all predictions (summary)  |
| GET    | `/api/predictions/latest`         | JWT     | Any    | Latest prediction full JSON     |
| GET    | `/api/predictions/{id}`           | JWT     | Any    | Single prediction full JSON     |
| POST   | `/api/upload`                     | JWT     | Admin  | Upload new prediction JSON      |
| PATCH  | `/api/predictions/{id}/result`    | JWT     | Admin  | Mark actual result              |

### Accuracy
| Method | Endpoint         | Auth | Role | Description               |
|--------|------------------|------|------|---------------------------|
| GET    | `/api/accuracy`  | JWT  | Any  | Overall + by-confidence % |

### Admin
| Method | Endpoint            | Auth | Role  | Description         |
|--------|---------------------|------|-------|---------------------|
| GET    | `/api/admin/users`  | JWT  | Admin | List all users      |
| POST   | `/api/admin/users`  | JWT  | Admin | Add new viewer      |
| PATCH  | `/api/admin/users/{id}` | JWT | Admin | Toggle active status |

---

## 6. Authentication Flow

```
User submits login form
        │
        ▼
POST /api/login → verify username + bcrypt hash
        │
   ┌────┴────┐
  Fail      Pass
   │         │
403 Error   Generate JWT (HS256, 24h expiry)
              │
              ▼
        Store JWT in localStorage
              │
              ▼
All API requests: Authorization: Bearer <token>
              │
              ▼
FastAPI dependency: verify_token() checks role
              │
         ┌───┴───┐
       Admin    Viewer
         │         │
    All routes   Read-only routes only
```

---

## 7. JSON Upload Flow

```
Admin drags JSON file onto upload page
        │
        ▼
Frontend reads file via FileReader API
        │
        ▼
POST /api/upload (multipart/form-data)
        │
        ▼
FastAPI: validate JSON schema
  - Required fields present?
  - match_id unique?
        │
   ┌────┴────┐
  Fail      Pass
   │         │
Error msg   Extract key fields → INSERT into predictions table
              │
              ▼
        Return success + new prediction id
              │
              ▼
        Frontend redirects to /dashboard
```

---

## 8. Security Considerations

| Concern            | Solution                                               |
|--------------------|--------------------------------------------------------|
| Password storage   | bcrypt hash with salt (never plain text)               |
| JWT secret         | Stored in `.env` file (not in source code)             |
| Role enforcement   | FastAPI dependency injection checks role on every route |
| SQL injection      | SQLModel ORM prevents raw SQL injection                |
| File upload safety | Validate JSON schema server-side before saving         |
| CORS               | Restricted to localhost only (no public API exposure)  |

---

## 9. Running the Application

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server (seeds DB + users on first run)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Access the app
http://localhost:8000
```

---

## 10. requirements.txt

```
fastapi==0.110.0
uvicorn==0.29.0
sqlmodel==0.0.16
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
python-dotenv==1.0.1
```
