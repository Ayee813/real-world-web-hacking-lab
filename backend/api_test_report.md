# API Test and Security Assessment Report

This report documents the security assessment and functionality verification of the Real Web Hacking Lab backend. 

---

## 1. Database Connection Diagnostics (Current Status)

### Root Cause of Initial 500 Errors
When calling endpoints that interact with the database (such as `POST /api/auth/register` or `POST /api/auth/login`), the API returned `500 Internal Server Error` with `{"error": "Server error"}`.
This occurred because the backend's `.env` configuration file contained the default placeholder connection string:
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```
Since this database connection string is a placeholder, the Node.js postgres driver (`pg`) fails to connect, causing SQL queries to throw errors and trigger the server's catch-all `500 Server error` handlers.

### Action Plan: How to Connect Your Supabase Database
To establish a successful database connection, complete the following steps:

1. **Get the Supabase URI**:
   * Go to your [Supabase Dashboard](https://supabase.com).
   * Open your project and navigate to **Project Settings** (gear icon) -> **Database**.
   * Scroll down to **Connection string**, select **URI**, and copy the string (e.g., `postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres`).
2. **Modify the `.env` File**:
   * Open the file [backend/.env](file:///home/ayee813/Desktop/Real_web_hacking_lab/backend/.env) in your text editor.
   * Replace the `DATABASE_URL` line with your copied Supabase connection string. Replace `[YOUR-PASSWORD]` with your actual database password.
   * Confirm that the backend hot-reloads and shows no errors.
3. **Seed the Database**:
   * Open the SQL Editor in your Supabase dashboard.
   * Copy the SQL commands from [schema.sql](file:///home/ayee813/Desktop/Real_web_hacking_lab/schema.sql) and execute them to create the tables (`users`, `articles`) and insert seed data.

---

## 2. Running Automated Tests

Once the database configuration is updated, run the automated integration/exploit test suite by opening a terminal in the backend folder and running:

```bash
node test_api.js
```

This script will run a complete scan to verify that all endpoints are responsive and that each of the six intentional vulnerabilities is present and exploitable.

---

## 3. Vulnerability Verification Summary

The test runner verifies the following vulnerability behaviors.

### Vuln 1 — Privilege Escalation via Mass Assignment (OWASP A01)
* **Status**: **CONFIRMED VULNERABLE**
* **Request**:
  ```http
  PUT /api/user/<your-user-id> HTTP/1.1
  Authorization: Bearer <user-jwt>
  Content-Type: application/json

  {
    "role": "admin"
  }
  ```
* **Vulnerable Behavior**: The API accepts the `role` parameter in the body and overwrites the user's role in the database with no validation.
* **Impact**: Allows any registered user to elevate their account role to `admin` and gain unauthorized administrative rights.

---

### Vuln 2 — IDOR: Edit Any User Profile (OWASP A01)
* **Status**: **CONFIRMED VULNERABLE**
* **Request**:
  ```http
  PUT /api/user/<victim-user-id> HTTP/1.1
  Authorization: Bearer <your-jwt>
  Content-Type: application/json

  {
    "username": "hacked"
  }
  ```
* **Vulnerable Behavior**: The endpoint allows modifying user records without validating if the authenticated user (`req.user.id`) matches the path parameter (`req.params.id`).
* **Impact**: Any authenticated user can modify usernames, emails, or passwords of other users in the system.

---

### Vuln 3 — Excessive Data Exposure / Broken Function-Level Auth (OWASP A01)
* **Status**: **CONFIRMED VULNERABLE**
* **Request**:
  ```http
  GET /api/users HTTP/1.1
  Authorization: Bearer <user-jwt>
  ```
* **Vulnerable Behavior**: The handler returns full details (ID, email, username, role, created_at) for all accounts in the database. No administrative role checking is performed.
* **Impact**: Authenticated attackers can enumerate all user IDs, usernames, and emails in the system.

---

### Vuln 4 — IDOR: Delete Any User (OWASP A01)
* **Status**: **CONFIRMED VULNERABLE**
* **Request**:
  ```http
  DELETE /api/user/<victim-user-id> HTTP/1.1
  Authorization: Bearer <your-jwt>
  ```
* **Vulnerable Behavior**: The endpoint deletes the user corresponding to the path ID without verifying whether the caller owns the account or has admin privileges.
* **Impact**: Any registered user can permanently delete other user accounts.

---

### Vuln 5 — IDOR on Private Articles (OWASP A01)
* **Status**: **CONFIRMED VULNERABLE**
* **Request**:
  ```http
  GET /api/articles?public=false HTTP/1.1
  Authorization: Bearer <your-jwt>
  ```
* **Vulnerable Behavior**: The database query filters articles purely based on the query parameter `public=false` but does not append an ownership check (e.g. `AND author_id = <your-user-id>`) to filter private entries.
* **Impact**: Exposes all private draft articles and secret notes written by other users.

---

### Vuln 6 — Stored XSS in Article Body (OWASP A03)
* **Status**: **CONFIRMED VULNERABLE**
* **Request**:
  ```http
  POST /api/articles HTTP/1.1
  Authorization: Bearer <your-jwt>
  Content-Type: application/json

  {
    "title": "XSS Testing",
    "body": "<img src=x onerror=alert(document.cookie)>",
    "is_public": true
  }
  ```
* **Vulnerable Behavior**: The API receives the raw HTML string, stores it unsanitized in the database, and returns it identically.
* **Impact**: When a victim views the article page, their browser renders the payload using React's `dangerouslySetInnerHTML`, executing the injected Javascript in the victim's session.
