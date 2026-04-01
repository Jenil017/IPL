# User & System Flow
## IPL Match Prediction Web App (CricPredict)

**Version:** 1.1.0 (synced with repo)  
**Date:** 2026-04-01

---

## 1. Authentication Flows

### 1.1 Login Flow (All Users)

```
[User opens /static/index.html]
        │
        ▼
JWT in localStorage still valid?
  ├── YES → Redirect to /static/dashboard.html
  └── NO  → Show login form

[Login form submit]
  POST /api/login (application/x-www-form-urlencoded: username, password)
        │
  ┌─────┴─────┐
FAIL          SUCCESS
  │             │
Show detail   Store access_token in localStorage
from API            │
              Decode JWT payload (role, exp)
              admin → /static/upload.html
              viewer → /static/dashboard.html
```

**Session length:** Access tokens expire per `auth.py` (currently **7 days**).

### 1.2 Logout Flow

```
User clicks Logout
        │
        ▼
removeToken() → localStorage clear
        │
        ▼
Redirect to /static/index.html
```

(No server-side logout endpoint.)

### 1.3 Protected Pages

`requireAuth(allowedRoles)` in `auth.js`:
- Missing/expired JWT → `/static/index.html`
- Wrong role (e.g. viewer on admin page) → `/static/dashboard.html`
- Else → `setupNavbar` (show admin links if `role === 'admin'`)

---

## 2. Admin Flows

### 2.1 Upload New Prediction JSON

```
Admin on STATIC:/static/upload.html
        │
        ▼
Select .json → Submit
        │
        ▼
POST /api/upload  (Authorization: Bearer …)
  multipart form-data field: file
        │
        ▼
Server: admin role check
  ├── not admin → 403
  └── admin → parse JSON
        ├── missing keys / bad JSON → 400 + detail
        ├── duplicate match_id → 400
        └── INSERT predictions (is_featured defaults false)
              Return { message, id }
        │
        ▼
Frontend redirects to /static/dashboard.html
```

### 2.2 Featured Match (Dashboard Override)

```
Admin on /static/admin.html → “Match Dashboard Control”
        │
        ▼
GET /api/admin/predictions
  → list with is_featured; UI labels “LIVE ON DASHBOARD” vs “AUTO ON DASHBOARD”
        │
        ▼
“Set as Dashboard” → PATCH /api/admin/predictions/{id}/feature
  (clears any other featured row, sets this one)
        │
“Reset to Auto” → DELETE /api/admin/predictions/{id}/feature
        │
        ▼
GET /api/predictions/latest now returns:
  featured row if any, else latest uploaded_at
```

### 2.3 “Coming Soon” Staging

```
Admin on /static/admin.html
  “Initialize Scan: Coming Soon”
        │
        ▼
Builds minimal JSON with prediction_report.is_coming_soon = true
POST /api/upload as synthetic .json file
        │
        ▼
Dashboard loads latest/featured JSON → detects flag → shows coming-soon UI
```

### 2.4 Mark Actual Match Result

```
Admin on /static/history.html
        │
        ▼
Row with is_correct === null → “Mark Result”
        │
        ▼
Modal: two buttons (team A short / team B short)
PATCH /api/predictions/{id}/result
  { actual_winner, actual_winner_short }
        │
        ▼
Server: if already marked → 400
        Compare actual_winner_short to predicted_winner_short
          equal → is_correct = 1, else 0
        Store actual_winner fields + result_marked_at
```

### 2.5 Add / Toggle Viewer User

```
POST /api/admin/users  { username, password }  (password min 4)
PATCH /api/admin/users/{id}  { is_active }
```

---

## 3. Viewer Flows

### 3.1 View Latest Prediction

```
GET /api/predictions/latest
        │
        ▼
If prediction_report.is_coming_soon → simplified “coming soon” screen
Else → renderDashboard(): hero, winner card, dimensions, etc.
Toss null → show toss banner (dashboard.js)
```

### 3.2 View Match History

```
GET /api/predictions  (summaries)
GET /api/accuracy
        │
        ▼
history.js sorts client-side by numeric part of match_id (ascending)
  → table order is match-number order, not strictly “uploaded last first”
```

Row click / modal for full detail: use `GET /api/predictions/{id}` as needed (implementation may vary).

---

## 4. System Flows

### 4.1 Startup

```
uvicorn main:app
        │
        ▼
Startup event:
  init_db()  → SQLModel.metadata.create_all(PostgreSQL)
  seed_users() → jainil (admin), takshat (viewer) if absent
  asyncio.create_task(keep_alive_loop)  # optional self-ping
```

**Requirement:** `DATABASE_URL` must be set (see `database.py`).

### 4.2 Chat

```
/static/chat.html
        │
        ▼
GET /api/chat/history
WebSocket: wss://<host>/api/chat/ws?token=<JWT>
Optional: POST /api/chat/upload for image → include image_url in WS JSON
```

On disconnect, client reconnects after **3 seconds** (`chat.js`).

---

## 5. Page Access Matrix

| Page (under /static/) | No Auth | Viewer | Admin |
|----------------------|---------|---------|-------|
| index.html           | ✅      | use JWT → dashboard | use JWT → dashboard/upload per login |
| dashboard.html       | ❌      | ✅      | ✅    |
| history.html         | ❌      | ✅      | ✅    |
| chat.html            | ❌      | ✅      | ✅    |
| upload.html          | ❌      | ❌ → dashboard | ✅    |
| admin.html           | ❌      | ❌ → dashboard | ✅    |

Root path `/` redirects to `/static/index.html`.

---

## 6. Data Flow Summary

```
Claude / tooling → prediction .json file
        │
        ▼
Admin POST /api/upload
        │
        ├── Dashboard: /api/predictions/latest (featured or latest)
        ├── History summaries + accuracy
        └── Admin can pin featured match or stage “coming soon”
```

---

## 7. Error Handling (Representative)

| Scenario | Typical response |
|----------|------------------|
| Bad login | 401, detail from API |
| Inactive user | 400 |
| Viewer hits admin API | 403 |
| Duplicate match_id | 400 |
| Mark result twice | 400 “Result already marked” |
| No predictions | latest → 404; dashboard shows empty state |
