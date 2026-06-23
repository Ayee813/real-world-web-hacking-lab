# Trainer Answer Key — Vulnerability Map

> **Lab-only document. Do not distribute to trainees before exercises.**

All seeded accounts use password: `Password123`

---

## Vuln 1 — Privilege Escalation via Mass Assignment (OWASP A01)

**UI path:** Log in → click your username in the navbar → `/profile/<your-id>` → hit **Save changes** in Burp Intercept → add `"role":"admin"` to the request body.

**What:** `PUT /api/user/:id` accepts a `role` field and writes it directly to the DB with no validation.

**Exploit in Burp Repeater:**
1. Log in as any user. Note your user ID from the Members page (`/users`).
2. Send this request:
```
PUT /api/user/<YOUR-USER-ID> HTTP/1.1
Authorization: Bearer <your-token>
Content-Type: application/json

{"role":"admin"}
```
3. Log out and back in. Your JWT now contains `role: admin`.
4. Navigate to `/admin` — you reach the win screen.

**Root cause:** `backend/src/routes/users.ts` line `const newRole = role ?? u.role;` — no role check, no field whitelist.

---

## Vuln 2 — IDOR: Edit Any User (OWASP A01)

**What:** `PUT /api/user/:id` has no ownership check. Any authenticated user can modify any other user's profile.

**Exploit in Burp Repeater:**
1. From `/users`, note another user's UUID.
2. Send:
```
PUT /api/user/<VICTIM-USER-ID> HTTP/1.1
Authorization: Bearer <your-token>
Content-Type: application/json

{"username":"hacked"}
```
3. The victim's username is now changed.

**Root cause:** No `req.user.id === req.params.id` check in the PUT handler.

---

## Vuln 3 — Excessive Data Exposure / Broken Function-Level Auth (OWASP A01)

**What:** `GET /api/users` returns every account (including admins, emails, roles) with no role check. Any authenticated user can call it.

**Exploit:** The `/users` frontend page calls this automatically. In Burp, observe `GET /api/users` — it leaks IDs, emails, and roles for all accounts.

**Root cause:** No `if (req.user.role !== 'admin')` guard in the GET /users handler.

---

## Vuln 4 — IDOR: Delete Any User (OWASP A01)

**What:** `DELETE /api/user/:id` has no authorization check.

**Exploit in Burp Repeater:**
1. Note a victim UUID from `/api/users`.
2. Send:
```
DELETE /api/user/<VICTIM-USER-ID> HTTP/1.1
Authorization: Bearer <your-token>
```
3. The account is permanently deleted.

**Root cause:** No auth check in the DELETE handler.

---

## Vuln 5 — IDOR on Private Articles (OWASP A01)

**What:** `GET /api/articles?public=true|false` trusts the client-supplied filter and performs no ownership check. Changing `?public=true` to `?public=false` exposes all private articles from all users.

**Exploit in Burp Proxy/Repeater:**
1. Intercept `GET /api/articles?public=true` in the Proxy.
2. Change to `?public=false` and forward (or use Repeater).
3. Response contains private articles from other users including their full body.

**Root cause:** `backend/src/routes/articles.ts` — the query switches branch on `req.query.public` with no server-side ownership filter.

---

## Vuln 6 — Stored XSS in Article Body (OWASP A03)

**What:** Article bodies are stored as raw HTML with no sanitization and rendered via `dangerouslySetInnerHTML` in React.

**Exploit:**
1. Log in as any user. Go to `/articles/new`.
2. Intercept the `POST /api/articles` request in Burp.
3. Replace the `body` field with:
```json
{"title":"XSS Demo","body":"<img src=x onerror=alert(document.cookie)>","is_public":true}
```
4. Forward the request. Navigate to the new article.
5. The `onerror` handler fires and `document.cookie` is alerted.

**Root cause:** No HTML sanitization on the backend (`POST /api/articles`) and `dangerouslySetInnerHTML` on `ArticleView.tsx`.

---

## Chaining Vulns 3 → 1 → Admin

A realistic attack path:
1. Register an account.
2. Use Vuln 3 (`GET /api/users`) to enumerate all UUIDs and identify your own.
3. Use Vuln 1 (mass assignment `PUT /api/user/<your-id>` with `{"role":"admin"}`) to escalate.
4. Re-login, reach `/admin`.
