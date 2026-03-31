# Feature Specifications
## IPL Match Prediction Web App

**Version:** 1.0.0
**Date:** 2026-03-31

---

## F1 — Authentication System

### F1.1 Login Page (`/`)
- Username + password form
- "Invalid credentials" error on failure
- On success: redirect based on role
  - Admin → `/upload`
  - Viewer → `/dashboard`
- JWT stored in `localStorage`
- "Remember me" keeps session for 7 days (default: 24h)

### F1.2 Session Management
- Every protected page checks JWT on load
- Expired or missing token → redirect to login
- Logout button clears token + redirects to login

### F1.3 Pre-seeded Users
| Username | Password | Role   |
|----------|----------|--------|
| jainil   | jainil   | admin  |
| takshat  | takshat  | viewer |

Passwords stored as bcrypt hashes. Created automatically on first server run.

---

## F2 — JSON Upload (Admin Only)

### F2.1 Upload Page (`/upload`)
- Drag-and-drop zone OR click-to-browse file picker
- Accepts `.json` files only
- File size limit: 5 MB
- Live validation feedback before submit

### F2.2 Schema Validation
Checks for required top-level keys:
- `match_info` (match_id, team_a, team_b, venue_city, date, start_time_ist)
- `prediction_report` (winner, confidence_pct, confidence_level)
- `dimension_scoring.final_scores`
- `playing_xi` (team_a.players, team_b.players)

On validation failure: show specific missing fields — do not save to DB.

### F2.3 Duplicate Prevention
- If `match_id` already exists in DB → reject with error: *"Match IPL2026_M04 already uploaded"*
- Admin must delete existing record first (future feature)

### F2.4 Success Behaviour
- Store full raw JSON as string in `predictions.json_data`
- Extract and store structured fields separately for queries
- Show success toast → offer "View Prediction" button

---

## F3 — Prediction Dashboard (`/dashboard`)

### F3.1 Data Source
- Fetches `GET /api/predictions/latest`
- Shows the most recently uploaded match

### F3.2 UI Sections (in order)

#### Match Hero Banner
- Team A name + short code (left, team color)
- Team B name + short code (right, team color)
- Match metadata: Match #, Stage, Venue, Date, Time, Day/Night badge
- Previous season badges (e.g. "2025 Runners-up", "2025 Eliminated")

#### Prediction Winner Card
- "PREDICTED WINNER" label
- Winner team name (large, bold)
- Confidence % + confidence level text
- Animated dual-color probability bar (team A color | team B color)
- Expected score ranges for both teams
- Margin description (e.g. "Win by 15-25 runs if batting first")

#### 60-Parameter Dimension Scorecard
- 4 rows: Team Strength, Venue & Environment, Player Form & H2H, Momentum
- Columns: Dimension name, Team A score/max, Team B score/max, Edge badge
- Dual progress bars per row (team A color ← → team B color)
- Total row with bold styling

#### Match Context Grid (6 cards)
- Avg 1st Innings Score
- Batting First Win %
- H2H Overall (wins split)
- H2H at This Venue
- Weather (temp, conditions)
- Dew Factor

#### Playing XI (Side by Side)
- Two-column layout: Team A | Team B
- Each player row: Name + role badge
- Special badges: `(C)` Captain, `(WK)` Wicketkeeper, `OS` Overseas
- "Confirmed" or "Probable" tag per team

#### Key Player Matchups
- Card per matchup from `head_to_head.key_player_matchups`
- Shows batter ⚔️ bowler
- Advantage badge: `Bowler Edge` / `Batter Edge` / `Unknown`
- Key stat (e.g. "3 dismissals" or "SR 198.24")

#### Top Performers
- Two tabs: **Top Batters** | **Top Bowlers**
- Batter card: Name, role, last 5 scores (small chips), season avg, SR, form badge
- Bowler card: Name, type, last 3 figures, wickets, economy, form badge

#### 3 Reasons Winner Wins
- Numbered cards (1, 2, 3) in winner's team color
- Bold reason heading + supporting data point text

#### Upset Path (Loser's Conditions)
- Title: "[Team B]'s Path to Victory"
- 3 numbered conditions from `team_b_path_to_victory`
- Footer: "If all 3 happen → [X]% upset probability"

#### Key Risks & Flip Factors
- Expandable accordion cards per risk
- Risk title + detail text + probability badge
- Color: amber/yellow for risk tone

#### Recent Form
- Team A last 5: W/L badge chips with tooltip (match detail)
- Team B last 5: W/L badge chips with tooltip
- Side-by-side layout

#### Data Limitations
- Collapsible section at bottom
- Bullet list from `prediction_report.data_limitations`
- Subtitle: "Pre-toss prediction using 60-parameter framework"

### F3.3 Toss Update Banner
- If `toss.winner` is null → show amber banner: *"Toss not yet decided — prediction may shift ±8% post-toss"*
- If toss is filled → show toss result prominently in match hero

---

## F4 — Match History (`/history`)

### F4.1 Accuracy Summary Bar
At top of page:
- **Total Predictions:** N
- **Correct:** N (shown in green)
- **Incorrect:** N (shown in red)
- **Accuracy %:** shown as large number + circular progress ring
- Breakdown by confidence:
  - HIGH confidence accuracy %
  - MEDIUM confidence accuracy %
  - LOW confidence accuracy %

### F4.2 History Table
Columns:
| Match | Date | Teams | Predicted Winner | Confidence | Actual Result | Correct? |
|---|---|---|---|---|---|---|

- Reverse chronological order (latest first)
- "Pending" badge if result not yet marked
- ✅ / ❌ icon for correct/incorrect
- Click row → opens full prediction card in modal

### F4.3 Admin: Mark Result Button
- Visible only to admin users
- Per row: "Mark Result" button (if result is pending)
- Opens a small modal: "Who won? [Team A] / [Team B]"
- On confirm: PATCH `/api/predictions/{id}/result`
- Row updates immediately with result + correct/incorrect badge

---

## F5 — Admin Panel (`/admin`)

### F5.1 User List
- Table: Username, Role, Status (Active/Inactive), Created At, Actions
- Actions: Toggle Active/Inactive

### F5.2 Add New User
- Form: Username, Password, Role (viewer only — cannot create new admin via UI)
- Validation: username must be unique, password min 6 chars
- On success: user appears in list immediately

---

## F6 — Navigation

### Navbar (All pages)
- Logo / App name: **CricPredict** (or chosen name)
- Links:
    - Dashboard
    - History
    - Chat
    - Upload *(admin only — hidden for viewers)*
    - Admin Panel *(admin only — hidden for viewers)*
- Right side: Logged-in username + role badge + Logout button

---

## F7 — Responsive Design

| Breakpoint | Behaviour                                    |
|------------|----------------------------------------------|
| Desktop (>1024px) | Full multi-column layout              |
| Tablet (768–1024px) | Single column, condensed cards      |
| Mobile (<768px) | Stacked layout, hamburger nav menu    |

Key responsive adjustments:
- Playing XI: stacked vertically on mobile (not side-by-side)
- Dimension scorecard: horizontal scroll on small screens
- History table: horizontal scroll on mobile

---

## F8 — Visual Design System

### Color Palette
| Token              | Value       | Usage                        |
|--------------------|-------------|------------------------------|
| `--bg-base`        | `#0A0A0F`   | Page background              |
| `--bg-card`        | `#111118`   | Card backgrounds             |
| `--bg-glass`       | `rgba(255,255,255,0.04)` | Glassmorphism cards |
| `--border`         | `rgba(255,255,255,0.08)` | Card borders         |
| `--text-primary`   | `#F0F0F5`   | Main text                    |
| `--text-muted`     | `#6B7280`   | Secondary text               |
| `--pbks`           | `#E8175D`   | Punjab Kings accent          |
| `--gt`             | `#1B4FD8`   | Gujarat Titans accent        |
| `--success`        | `#10B981`   | Correct prediction           |
| `--danger`         | `#EF4444`   | Wrong prediction             |
| `--warning`        | `#F59E0B`   | Pending / risk               |

### Typography
- Font: **Outfit** (Google Fonts)
- Weights: 400 (body), 600 (labels), 700 (headings), 800 (hero numbers)

### Animations
- Probability bar: slide in on page load (CSS `@keyframes`)
- Dimension score bars: animate from 0 on scroll into view (`IntersectionObserver`)
- Cards: subtle fade-up on load (`opacity 0 → 1, translateY 20px → 0`)
- Hover effects: card lift (`transform: translateY(-2px)`) + glow shadow

---

## F9 — Real-time Chat Room (`/chat`)

### F9.1 Chat Interface
- Premium, glassmorphism-inspired UI
- Scrollable message area with auto-scroll to latest
- Connection status indicator (Connecting/Connected/Reconnecting)
- Navbar integration for all users

### F9.2 Messaging Features
- Real-time broadcasting via WebSockets
- Support for text messages and image attachments
- Message bubbles with sender name, text, and timestamp
- Color-coded senders (PBKS accent for received, GT accent for sent)
- XSS sanitization for all message content

### F9.3 Media Support
- Image upload (JPG, PNG, GIF, WEBP)
- Max file size: 5 MB
- Real-time image preview before sending
- Click image to open in new tab

### F9.4 Connection Logic
- JWT authentication required on WebSocket handshake
- Persistent history (fetches last 50 messages on load)
- Automatic reconnection logic with exponential backoff placeholder (3s)
