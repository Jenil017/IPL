# Feature Specifications
## IPL Match Prediction Web App (CricPredict)

**Version:** 1.1.0 (synced with repo)  
**Date:** 2026-04-01

---

## F1 — Authentication System

### F1.1 Login Page (`/static/index.html`)
- Username + password; OAuth2-style `POST /api/login` (form urlencoded).
- On success: JWT in `localStorage`; redirect **admin** → `/static/upload.html`, **viewer** → `/static/dashboard.html`.
- If already logged in (valid JWT), opening login redirects to dashboard.
- Errors: show API `detail` or generic network message.

### F1.2 Session Management
- JWT validated client-side via `exp`; 401 from API clears token and sends user to login.
- **Token lifetime:** 7 days (server `ACCESS_TOKEN_EXPIRE_MINUTES` in `auth.py`). There is no separate “remember me” toggle in the UI—the spec previously described 24h vs 7d; the code uses a single 7-day expiry.

### F1.3 Pre-seeded Users
| Username | Password | Role   |
|----------|----------|--------|
| jainil   | jainil   | admin  |
| takshat  | takshat  | viewer |

Created on first startup if missing (`seed.py`).

---

## F2 — JSON Upload (Admin Only)

### F2.1 Upload Page (`/static/upload.html`)
- File input + submit; `POST /api/upload` with `FormData` field `file`.
- Must be `.json` (server checks extension).

### F2.2 Server Schema Validation
Validated keys in `upload_router.py`:
- `match_info` (must include `match_id`)
- `prediction_report`
- `dimension_scoring.final_scores`

**Note:** The older spec also listed `playing_xi` as required—the **current server does not** require it for upload to succeed.

### F2.3 Duplicate Prevention
- Duplicate `match_id` → 400 with message like `Match <id> already exists`.

### F2.4 Success Behaviour
- Full JSON stored in `predictions.json_data`; scalar fields denormalized for listing/accuracy.
- Frontend shows success + id, then redirects to dashboard.

---

## F2b — Featured Dashboard Match (Admin)

- On `/static/admin.html`, **Match Dashboard Control** lists uploads from `GET /api/admin/predictions`.
- **Set as Dashboard:** `PATCH /api/admin/predictions/{id}/feature` — only one featured row; others cleared.
- **Reset to Auto:** `DELETE /api/admin/predictions/{id}/feature` — dashboard uses latest upload by `uploaded_at` when nothing is featured.
- `GET /api/predictions/latest` respects this order: featured first, else newest upload.

---

## F2c — “Coming Soon” Placeholder (Admin)

- Admin form builds a minimal JSON with `prediction_report.is_coming_soon: true` and uploads it.
- `dashboard.js` detects the flag and shows a **coming soon** screen instead of the full prediction layout.

---

## F3 — Prediction Dashboard (`/static/dashboard.html`)

### F3.1 Data Source
- `GET /api/predictions/latest` (featured or latest—see F2b).

### F3.2 UI Sections
Same conceptual sections as the original spec (hero, winner card, dimension scorecard, context, playing XI, matchups, top performers, reasons, upset path, risks, recent form, data limitations) **when** the payload is a full prediction JSON. Partial or “coming soon” payloads intentionally show reduced UI.

### F3.3 Toss Banner
- If `toss.winner` is falsy, show pre-toss banner (`dashboard.js`).

---

## F4 — Match History (`/static/history.html`)

### F4.1 Accuracy Summary
- From `GET /api/accuracy`: total, correct, incorrect, overall %, high/medium/low breakdown.

### F4.2 History Table
- Data from `GET /api/predictions`; **client sorts by numeric part of `match_id`** (ascending)—not strictly reverse chronological by upload time.
- Pending results: badge + admin **Mark Result**; PATCH result uses short codes for winner fields in the current UI.

### F4.3 Admin: Mark Result
- Modal chooses winner; **result cannot be changed** after `is_correct` is set (server returns 400).

---

## F5 — Admin Panel (`/static/admin.html`)

### F5.1 User List
- Table with role badge, active/inactive, deactivate/activate for non-admin users.

### F5.2 Add New User
- Username + password; **minimum 4 characters** (server + form).
- New accounts are always **viewer** role.

### F5.3 Match Dashboard Control
- See F2b.

### F5.4 Coming Soon Stager
- See F2c.

---

## F6 — Navigation

- Brand: **CricPredict**; links under `/static/*.html`.
- Admin-only nav items use `.admin-only` + `setupNavbar` in `auth.js`.

---

## F7 — Responsive Design

Original breakpoint guidance still applies as design intent; verify against `style.css` for exact behavior.

---

## F8 — Visual Design System

Dark theme, glassmorphism, team accent tokens as in `style.css` (`--pbks`, `--gt`, etc.).

---

## F9 — Real-time Chat (`/static/chat.html`)

- `GET /api/chat/history` then WebSocket `ws(s)://<host>/api/chat/ws?token=<JWT>`.
- Optional `POST /api/chat/upload` for images; messages broadcast to all connections.
- Reconnect **3s** after close (`chat.js`).

---

## F10 — Deploy / Keep-Alive (Backend)

- If `RENDER_EXTERNAL_URL` is set, background task pings `GET /api/ping` every ~14 minutes to reduce idle spin-down (host-dependent).
