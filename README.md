# Real Web Hacking Lab

A deliberately vulnerable write-up/article publishing platform for hands-on Burp Suite training.

> **FOR LOCAL / LAB USE ONLY. Do NOT deploy to a public server.**

---

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 19 + TypeScript + Tailwind CSS v4 + Vite |
| Backend  | Node.js + TypeScript + Express 5 |
| Database | PostgreSQL (hosted on Supabase, connected via `pg`) |
| Auth     | JWT (Bearer token) |

---

## Quick Start

### 1. Database

Run `schema.sql` in your Supabase SQL editor (or any Postgres client) to create the tables and seed accounts.

Seeded accounts:

| Email              | Username    | Role    | Password      |
|--------------------|-------------|---------|---------------|
| admin@lab.local    | admin_user  | admin   | `Password123` |
| alice@lab.local    | alice       | user    | `Password123` |
| bob@lab.local      | bob         | user    | `Password123` |
| charlie@lab.local  | charlie     | user    | `Password123` |
| analyst@lab.local  | soc_analyst | analyst | `Password123` |

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET in .env
npm install
npm run dev
```

Backend runs on **http://localhost:3001**.

`.env` variables:

| Variable       | Description |
|----------------|-------------|
| `PORT`         | Port to listen on (default 3001) |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET`   | Random secret for signing JWTs |
| `FRONTEND_URL` | Allowed CORS origin (default http://localhost:5173) |

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**.

---

## Routes

| Path           | Access   | Purpose |
|----------------|----------|---------|
| `/login`       | public   | Shared login form |
| `/register`    | public   | Registration form |
| `/dashboard`   | auth     | Public article feed |
| `/articles/new`| auth     | Rich-text editor to create articles |
| `/articles/:id`| auth     | View a single article |
| `/users`       | auth     | Member list (exposes BAC) |
| `/admin`       | admin    | Win screen |
| `/siem`        | admin, analyst | SIEM dashboard — log monitoring, detection & response |

---

## SIEM Dashboard (`/siem`)

A built-in SIEM sits on top of the lab: every HTTP request and every exploit against the vulnerabilities above is captured as a structured log event, correlated by detection rules, and surfaced as an alert — so trainees (or trainers) can watch an attack happen from the defender's side while it happens from the attacker's side.

Accessible to `admin` and the new `analyst` role, both via the normal `/login` form. Analysts get investigate/respond access (logs, alerts, cases, threat intel view, reports); only `admin` can toggle detection rules, manage threat intel entries, and change log retention.

Tabs:

| Tab | Purpose |
|-----|---------|
| Overview | Stat tiles, events-over-time chart, severity breakdown, top event types / source IPs / users |
| Logs | Full-text + field search across all captured events, CSV export, per-event detail |
| Alerts | Rule-generated alerts with acknowledge/resolve workflow, linked raw events |
| Cases | Group alerts into an investigation, assign, add notes, open → investigating → closed |
| Threat Intel | Known-bad IP/pattern indicators; matches auto-tag and escalate matching events |
| Rules | Enable/disable each detection rule (admin only) |
| Reports | Date-range summary report, printable / exportable as PDF via the browser, plus raw CSV export |
| Settings | Log retention policy + purge, and the SIEM's own admin action audit trail |

Detection rules ship pre-wired to this lab's intentional vulnerabilities: brute-force login, the mass-assignment privilege-escalation payload (`{"role":"admin"}`), IDOR profile edit/delete, private-article exposure, stored-XSS payload signatures, and full user-directory enumeration. Exploiting any of the six vulnerabilities in `VULNS.md` should produce a matching alert in the SIEM.

---

## Vulnerability Overview (Trainer Use)

See `VULNS.md` for the full answer key with exploit requests.

1. **Mass assignment** — `PUT /api/user/:id` accepts `{"role":"admin"}`
2. **IDOR edit** — any user can edit any other user's profile
3. **Excessive data exposure** — `GET /api/users` leaks all accounts with no role check
4. **IDOR delete** — any user can delete any account
5. **Broken object-level auth on articles** — `?public=false` returns all private articles
6. **Stored XSS** — article bodies stored as raw HTML, rendered via `dangerouslySetInnerHTML`

---

## Burp Setup

1. Open Burp Suite. Go to **Proxy → Options**, confirm it listens on `127.0.0.1:8080`.
2. Configure your browser to use `127.0.0.1:8080` as HTTP proxy.
3. Browse to `http://localhost:5173`, log in, and start intercepting.
4. Use **Repeater** to craft the exploit requests in `VULNS.md`.
