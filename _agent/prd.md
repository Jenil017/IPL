# Product Requirements Document (PRD)
## IPL Match Prediction Web App (CricPredict)

**Version:** 1.1.0 (synced with repo)  
**Date:** 2026-04-01  
**Owner:** Jainil (Admin / Super User)

---

## 1. Overview

### 1.1 Product Vision
A private, role-based web application that displays IPL match predictions (structured JSON, e.g. from a Claude skill / 60-parameter style framework). Admins upload prediction JSON, optionally **pin which match appears on the dashboard**, and can stage a **“coming soon”** placeholder. Viewers see rendered dashboards, history, accuracy summaries, and a shared chat room.

### 1.2 Problem Statement
Rich prediction output needs a persistent store, a consistent UI, historical accuracy tracking, and controlled sharing—without relying on ad-hoc file passing.

### 1.3 Solution
- **FastAPI** backend with **PostgreSQL** (via `DATABASE_URL`), **JWT** auth, and **vanilla JS** frontend under `/static/`.
- **Admin:** upload JSON, mark results, manage viewers, control **featured** dashboard match, initialize **coming soon** screens.
- **Viewer:** read-only access to dashboard, history, accuracy, chat.

---

## 2. Users & Roles

| Role   | Example   | Capabilities |
|--------|-----------|--------------|
| Admin  | `jainil`  | Upload, featured match, coming soon, mark results, user admin, full read |
| Viewer | `takshat` | Dashboard, history, accuracy, chat; no mutations |

Seeded on first run if absent (`seed.py`).

---

## 3. Core Features

### F1 — Authentication
- Login at `/static/index.html`; JWT stored in `localStorage`.
- Token TTL **7 days** (current `auth.py`).
- Logout clears token client-side (no logout API).

### F2 — JSON Upload (Admin)
- Validated server-side for required top-level structure (see `upload_router.py`).
- One row per `match_id`; duplicates rejected.

### F2b — Featured Dashboard Match (Admin)
- Admins can pin exactly one prediction as **`is_featured`**; `/api/predictions/latest` serves it. Clearing featured reverts to **latest upload**.

### F2c — Coming Soon (Admin)
- Minimal JSON with `prediction_report.is_coming_soon: true` shows a dashboard placeholder until replaced by a full prediction.

### F3 — Prediction Dashboard
- Full card layout for complete JSON; simplified layout for coming soon.

### F4 — Match History & Accuracy
- History list + accuracy aggregates (only predictions with `is_correct` not null count toward accuracy stats).
- Table sort order is **by match id number** on the client (see `history.js`), not necessarily upload order.

### F5 — Mark Result (Admin)
- **One-time** mark per row; correctness compares **short** winner codes.

### F6 — Admin Panel
- List users, add viewer (password min **4** chars), activate/deactivate viewers.

### F7 — Chat
- HTTP history + WebSocket messaging; optional image uploads stored under `static/uploads/chat/`.

### F8 — Operations
- `GET /api/ping` for health/keep-alive.
- Optional httpx loop using `RENDER_EXTERNAL_URL` to mitigate idle sleep on some hosts.

---

## 4. Non-Functional Requirements

| Area | Spec |
|------|------|
| Database | **PostgreSQL** required; configure with `DATABASE_URL` |
| Security | bcrypt passwords; JWT; admin-only routes |
| Config | `SECRET_KEY`, `DATABASE_URL` in `.env` (see `.env.example`) |
| Portability | Runs locally with uvicorn + Postgres; deployable e.g. Render |

**Note:** Older docs referenced SQLite only. The current app **raises** if `DATABASE_URL` is missing. Legacy `migrate.py` targets a local SQLite file for one-off column adds only.

---

## 5. Out of Scope (v1.0)

- Live cricket APIs / live scores  
- Public self-registration  
- Email notifications  
- PDF/PNG export  
- i18n  

---

## 6. Success Metrics

| Metric | Target |
|--------|--------|
| Results tracked | After each match (admin) |
| Upload → visible | Fast path: single API round-trip |
| History depth | Unlimited subject to DB size |
