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

Seeded accounts (all use password `Password123`):

| Email              | Username    | Role  |
|--------------------|-------------|-------|
| admin@lab.local    | admin_user  | admin |
| alice@lab.local    | alice       | user  |
| bob@lab.local      | bob         | user  |
| charlie@lab.local  | charlie     | user  |

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
