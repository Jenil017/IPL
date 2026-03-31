# User & System Flow
## IPL Match Prediction Web App

**Version:** 1.0.0
**Date:** 2026-03-31

---

## 1. Authentication Flows

### 1.1 Login Flow (All Users)

```
[User visits any URL]
        │
        ▼
JWT in localStorage?
  ├── NO  → Redirect to /login
  └── YES → Validate JWT (not expired + valid signature)
              ├── INVALID → Clear token → Redirect to /login
              └── VALID   → Decode role
                              ├── admin  → Proceed to requested page
                              └── viewer → Proceed (if route allowed for viewers)
                                           └── Upload/Admin route? → Redirect to /dashboard

[Login Page]
  User enters username + password → Submit
        │
        ▼
  POST /api/login
        │
  ┌─────┴─────┐
FAIL (wrong creds)  SUCCESS
  │                   │
Show error msg     Receive JWT token
                   Store in localStorage
                        │
                   Decode role from JWT
                        │
                   ┌────┴────┐
                 admin      viewer
                   │           │
              /upload      /dashboard
```

### 1.2 Logout Flow

```
User clicks "Logout" button (any page)
        │
        ▼
Remove JWT from localStorage
        │
        ▼
Redirect to /login
```

---

## 2. Admin Flows

### 2.1 Upload New Prediction JSON

```
Admin on /upload page
        │
        ▼
Drags JSON file onto drop zone  (OR clicks and selects file)
        │
        ▼
FileReader reads file as text
        │
        ▼
Frontend preview: show match_info summary
(team names, venue, date)
        │
        ▼
Admin clicks "Upload Prediction"
        │
        ▼
POST /api/upload
  Headers: Authorization: Bearer <token>
  Body: multipart form-data with JSON file
        │
        ▼
FastAPI: Check role = admin
  ├── NOT admin → 403 Forbidden
  └── IS admin  → Parse JSON
                    │
              Schema valid?
          ┌────────┴────────┐
         NO                YES
          │                 │
  Return error         match_id unique?
  (missing fields)   ┌──────┴──────┐
                     NO            YES
                     │              │
             Return error       Extract fields
             ("Already         INSERT into predictions
              uploaded")              │
                                Return 201 Created
                                      │
                                Frontend shows success
                                      │
                                "View Prediction" button
                                → Redirect to /dashboard
```

### 2.2 Mark Actual Match Result

```
Admin on /history page
        │
        ▼
Sees match row with "Pending" status
        │
        ▼
Clicks "Mark Result" button
        │
        ▼
Modal opens: "Who won?"
  [Team A Name]   [Team B Name]
        │
Admin clicks winner
        │
        ▼
PATCH /api/predictions/{id}/result
  Body: { "actual_winner": "Punjab Kings", "actual_winner_short": "PBKS" }
        │
        ▼
Server computes is_correct:
  predicted_winner == actual_winner → is_correct = 1
  else → is_correct = 0
        │
        ▼
UPDATE predictions table
        │
        ▼
History table row updates live
Accuracy summary recalculates
```

### 2.3 Add New Viewer User

```
Admin on /admin page
        │
        ▼
Fills "Add User" form:
  Username: [input]
  Password: [input]
  Role: Viewer (fixed — cannot create admin via UI)
        │
        ▼
POST /api/admin/users
        │
        ▼
Server checks: username unique?
  ├── NO  → Error: "Username already taken"
  └── YES → Hash password (bcrypt)
              INSERT into users (role='viewer')
              Return 201 Created
                    │
              User appears in users list
```

---

## 3. Viewer Flows

### 3.1 View Latest Prediction

```
Viewer logs in → /dashboard
        │
        ▼
GET /api/predictions/latest
  Headers: Authorization: Bearer <token>
        │
        ▼
Response: full prediction JSON
        │
        ▼
JavaScript renders all sections:
  1. Match hero banner
  2. Winner prediction card (probability bar animates)
  3. Dimension scorecard (bars animate on scroll)
  4. Match context grid
  5. Playing XI
  6. Key matchups
  7. Top performers (tab: Batters / Bowlers)
  8. 3 Reasons Winner Wins
  9. Upset path
 10. Key risks (accordion)
 11. Recent form chips
 12. Data limitations

        │
        ▼
Toss null? → Show amber banner at top
Toss filled? → Show toss result in hero
```

### 3.2 View Match History

```
Viewer navigates to /history
        │
        ▼
GET /api/predictions  (all predictions, summary fields only)
GET /api/accuracy     (overall + by-confidence stats)
        │
        ▼
Render accuracy summary banner at top:
  Total: N | Correct: N | Wrong: N | Accuracy: N%
  By confidence: HIGH: N% | MEDIUM: N% | LOW: N%

Render history table (latest first):
  | Match | Date | Teams | Predicted | Confidence | Result | ✅/❌ |
        │
        ▼
User clicks any row
        │
        ▼
GET /api/predictions/{id}  (full JSON)
        │
        ▼
Full prediction card opens in modal
(same sections as /dashboard but for that specific match)
```

---

## 4. System Flows

### 4.1 First Run / Initialization

```
Server starts (uvicorn main:app)
        │
        ▼
database.py: create_all() → Creates SQLite tables if not exist
        │
        ▼
seed.py: check users table
  users count == 0?
  ├── YES → Insert jainil (admin) + takshat (viewer)
  │         passwords bcrypt-hashed
  └── NO  → Skip seeding (already initialized)
        │
        ▼
FastAPI mounts /static → serves HTML, CSS, JS files
        │
        ▼
App ready at http://localhost:8000
```

### 4.2 JWT Token Lifecycle

```
Login → JWT generated (HS256)
  Payload: { "sub": "jainil", "role": "admin", "exp": <24h from now> }
  Signed with SECRET_KEY from .env
        │
        ▼
Stored in client localStorage
        │
        ▼
Each API call: Authorization: Bearer <token>
        │
        ▼
FastAPI dependency: verify_token(token)
  1. Decode token (raises if invalid signature)
  2. Check exp (raises if expired)
  3. Return { username, role }
        │
        ▼
Route proceeds with user context
```

### 4.3 Accuracy Calculation

```
GET /api/accuracy
        │
        ▼
Query predictions table:
  SELECT
    COUNT(*)              AS total,
    SUM(is_correct)       AS correct,
    COUNT(*) - SUM(is_correct)  AS incorrect
  WHERE is_correct IS NOT NULL  -- only decided matches

  ALSO GROUP BY confidence_level
        │
        ▼
Compute:
  overall_accuracy = correct / total * 100

  high_accuracy   = correct(HIGH) / total(HIGH) * 100
  medium_accuracy = correct(MEDIUM) / total(MEDIUM) * 100
  low_accuracy    = correct(LOW) / total(LOW) * 100
        │
        ▼
Return JSON response to frontend
```

---

## 5. Page Access Matrix

| Route       | No Auth | Viewer | Admin |
|-------------|---------|--------|-------|
| `/`         | ✅ Login page | Redirect → /dashboard | Redirect → /upload |
| `/dashboard`| ❌ → /login | ✅ | ✅ |
| `/history`  | ❌ → /login | ✅ | ✅ |
| `/chat`     | ❌ → /login | ✅ | ✅ |
| `/upload`   | ❌ → /login | ❌ → /dashboard | ✅ |
| `/admin`    | ❌ → /login | ❌ → /dashboard | ✅ |

---

## 7. Chat Room Flows

### 7.1 WebSocket Connection Flow
```
User navigates to /chat
        │
        ▼
requireAuth() checks valid token
        │
        ▼
GET /api/chat/history (HTTP)
Render last 50 messages
        │
        ▼
WebSocket Handshake:
ws://host/api/chat/ws?token=<JWT>
        │
        ▼
Server (FastAPI):
1. Decode JWT from query param
2. Verify signature & expiry
3. Manager: connect(websocket)
        │
        ▼
Status Change: "Connected"
```

### 7.2 Real-time Messaging Flow
```
User types message + (optional) image
        │
        ▼
Image present?
  ├── YES → POST /api/chat/upload
  │         Store temp URL
  └── NO  → Proceed
        │
        ▼
Socket sends JSON:
{ "content": "text", "image_url": "url" }
        │
        ▼
Server processes:
1. Save to SQLite chat_messages
2. Broadcast to ALL active sockets
        │
        ▼
Client: Render new bubble
Auto-scroll to bottom
```

---

## 6. Error Handling

| Scenario                          | User-Facing Response                              |
|-----------------------------------|---------------------------------------------------|
| Wrong login credentials           | "Invalid username or password"                    |
| JWT expired                       | Auto-redirect to /login with "Session expired"   |
| Viewer accesses admin route       | Redirect to /dashboard silently                   |
| Upload invalid JSON               | Inline error list of missing required fields      |
| Duplicate match_id upload         | "Match already exists in database"                |
| No predictions in DB yet          | Dashboard shows empty state: "No predictions yet" |
| API server down                   | Frontend shows "Unable to connect" banner         |

---

## 7. Data Flow Summary

```
Claude AI Skill
     │
     │ (User copies JSON output)
     ▼
Admin pastes/saves as .json file
     │
     ▼
Upload via /upload page
     │
     ▼
FastAPI validates + stores in SQLite
     │
     ├──► Dashboard renders latest prediction (all users)
     │
     ├──► History table shows new row (pending result)
     │
     └──► Admin marks result after match
              │
              ▼
         Accuracy tracker updates
```
