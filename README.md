# FoodLink — Surplus food → NGOs, matched by expiry

React + Vite frontend, Node/Express API, MySQL. Restaurants list surplus food; **SmartMatch** ranks the NGOs that can actually collect it before it expires; the donation is tracked to completion.

## Run it in VS Code (5 steps)

Requirements: **Node 18+** and **MySQL 8** (or MariaDB) running locally.

1. Open the `foodlink` folder in VS Code, open a terminal (`Ctrl+``).
2. `npm run install:all`
3. Check `backend/.env` → set `DB_PASSWORD` to your MySQL root password (default in the file: `root123`).
4. `npm run db:reset` — creates the `foodlink_db` database, tables and seed data.
   (It **drops** `foodlink_db` first. Needed once because your original project had no schema file.)
5. `npm run dev:all` → open **http://localhost:5173**
   (Or press `Ctrl+Shift+B` — a VS Code task starts both servers.)

Re-run `npm run db:seed` any time to reload fresh data (listing expiry times are relative to "now").

## Logins (7 seeded accounts)

| Role | Email | Password |
|---|---|---|
| Admin (use **/admin/login**) | admin@foodlink.app | `Admin@FoodLink2026` |
| Restaurant | greenbowl@foodlink.app | `FoodLink@2026` |
| Restaurant | spiceroute@foodlink.app | `FoodLink@2026` |
| Restaurant | bakebloom@foodlink.app | `FoodLink@2026` |
| NGO | annapurna@foodlink.app | `FoodLink@2026` |
| NGO | hopeshelter@foodlink.app | `FoodLink@2026` |
| NGO | sevahands@foodlink.app | `FoodLink@2026` |

Verify them automatically (backend running): `npm --prefix backend run test:logins` (19 checks) and `npm --prefix backend run test:workflow` (34 checks).

## Requirement checklist

| # | Requirement | Where |
|---|---|---|
| 1 | OAuth | Google OAuth 2.0 authorisation-code flow, `backend/controllers/authController.js` (`googleStart`, `googleCallback`). Signed-JWT `state` for CSRF. **Needs your Google keys — see below.** |
| 2 | JWT | 15-min access token + 7-day refresh token, rotated on use and revoked on logout (hash stored in `refresh_tokens`). Role-based middleware in `middleware/auth.js`. |
| 3 | ≥5 users | 7 seeded accounts; `tests/loginCheck.js` logs all in and checks wrong password, forged token, RBAC, refresh and logout. |
| 4 | Admin dashboard | `/admin/login` → `/admin`: platform stats, 14-day chart, leaderboards, enable/disable users (takes effect instantly), all donations, audit log. |
| 5 | API access | REST API under `/api/*` (list below), JWT-protected. |
| 6 | Chatbot | Floating assistant; answers from **live DB data** (expiring food, donation status, best match, impact, recents) in en/hi/ta. If `ANTHROPIC_API_KEY` is set it also answers open questions. |
| 7 | Recently accessed | `recently_accessed` table; every food/NGO/donation you open is upserted (latest 10 per user); shown on both dashboards and clickable. |
| 8 | Multilingual | English, Hindi, Tamil (250 keys each, checked for parity), saved to the account; chatbot and AI scanner reply in the chosen language. |
| 9 | No sample data | All hardcoded arrays and the mock scanner are removed; every screen reads MySQL. Seed = realistic organisations, coordinates and history (see note below). |
| 10 | Unique feature | **SmartMatch** (below). |
| 11 | Not just CRUD | SmartMatch ranking, donation state machine, auto-expiry job, AI vision scanner, capacity/reliability tracking, impact metrics. |

## Unique feature — SmartMatch (what to say in an interview)

For each food item it answers *"which NGO can get this to people before it spoils?"*

**Hard filters** (NGO excluded, with a visible reason): location missing · category not accepted · outside service radius · **cannot arrive before expiry** (haversine distance ÷ speed + 20 min handling, vehicle vs on-foot) · daily meal capacity full.
**Score 0–100** for the rest: proximity 35% · time safety 25% (spare minutes before expiry, 2 h = full marks) · capacity headroom 20% · reliability 20% (Laplace-smoothed completed ÷ (completed + declined)).

Surrounding it: a **donation state machine** (Pending → Accepted → Picked Up → Completed, with Declined/Cancelled and who may trigger each move, enforced server-side in transactions with row locks so two NGOs can't claim the same food), a background **expiry job** that updates statuses and cancels stale offers, and an **impact** estimate (0.4 kg/meal, 2.5 kg CO₂e/kg food — shown as estimates). Weights are constants at the top of `backend/services/matchEngine.js`.

## Set up Google OAuth (optional but required for requirement 1 to work)

1. https://console.cloud.google.com → APIs & Services → **Credentials** → Create **OAuth client ID** → *Web application*.
2. Authorised redirect URI: `http://localhost:5000/api/auth/google/callback`
3. Put the client ID/secret in `backend/.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), restart the backend.
4. The "Continue with Google" button on /login and /register becomes active. New Google users join as Restaurant or NGO (chosen next to the button); a Google email matching an existing account is linked to it.

## Set up the AI scanner (optional)

Add `ANTHROPIC_API_KEY` in `backend/.env` (model default `claude-sonnet-5-5`, override with `ANTHROPIC_MODEL`). Without it the scanner shows a clear "key needed" message; nothing else is affected.

## API summary

`POST /api/auth/register|login|refresh|logout` · `GET /api/auth/me` · `PATCH /api/auth/me` · `GET /api/auth/google` ·
`GET|POST /api/food` · `GET|PUT|DELETE /api/food/:id` · `GET /api/food/:id/matches` · `POST /api/food/:id/offer` ·
`GET /api/donations` · `POST /api/donations/claim` · `PATCH /api/donations/:id/status` ·
`GET /api/ngos` · `GET /api/ngos/:id` · `GET /api/dashboard/summary|recent` · `POST /api/chat` · `POST /api/scanner/analyze` ·
`GET /api/admin/stats|users|activity|donations` · `PATCH /api/admin/users/:id/active` · `GET /api/health`
Send `Authorization: Bearer <accessToken>`.

## Notes / honest limits

- The seed organisations, people and coordinates are realistic but **fictional** (Bengaluru neighbourhood-level locations, `@foodlink.app` emails). Replace them with your real data before a demo you must defend as "real".
- Seed passwords are for development only; change `SEED_PASSWORD` / `SEED_ADMIN_PASSWORD` in `.env` before seeding anywhere shared.
- `.env` holds secrets and is git-ignored. `backend/.env.example` shows the shape.
- Google OAuth and the AI scanner are fully implemented but were not exercised against Google/Anthropic's live servers (no keys available); everything else is covered by the two test scripts.

## Structure

```
backend/  server.js · config/ · db/(schema.sql, setup.js, seed.js) · middleware/ · controllers/ · routes/ · services/(matchEngine, chatbot, expiryJob, anthropic) · tests/
src/      api/client.js · i18n/ · context/AuthContext.jsx · components/ · pages/
```


## NGO food requests + priority allocation

- **NGO** dashboard: *Request Food* form and *My Food Requests* (requested / fulfilled / remaining, priority, status, cancel while Pending or Partially Fulfilled).
- **Restaurant** dashboard: *NGO Food Requests* - pick a food item, see open requests (Urgent > High > Normal, oldest first) and press *Allocate Food*. Partial fulfilment is supported; the rest stays open for other restaurants.
- API: `POST /api/requests`, `GET /api/requests/my`, `PATCH /api/requests/:id/cancel`, `GET /api/requests/open[?food_id=]`, `POST /api/allocations {food_id}`.
- Existing databases: run `npm run db:setup` once (idempotent; adds the new columns only if missing). `npm run db:reset` reseeds with three demo requests.
- Verify (backend running): `npm --prefix backend run test:allocation`.
