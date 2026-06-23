# Real Web Hacking Lab - API Documentation

This backend is a deliberately vulnerable REST API built with Node.js, Express, TypeScript, and PostgreSQL. It exposes authentication, user profile management, and article sharing functionality.

## Table of Contents
1. [Authentication (`/api/auth`)](#1-authentication-apiauth)
2. [User Management (`/api/user` & `/api/users`)](#2-user-management-apiuser--apiusers)
3. [Articles (`/api/article` & `/api/articles`)](#3-articles-apiarticle--apiarticles)
4. [Security & Vulnerability Overview](#4-security--vulnerability-overview)

---

## Global Headers & Authentication

For all authenticated routes, the request must include the following header:
```http
Authorization: Bearer <JWT_TOKEN>
```
If the token is missing or invalid, the API returns:
* **Status**: `401 Unauthorized` / `401 Invalid token`
* **Body**: `{"error": "Unauthorized"}` or `{"error": "Invalid token"}`

---

## 1. Authentication (`/api/auth`)

### POST `/api/auth/register`
Creates a new user account.

* **Access**: Public
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "username": "username",
    "password": "securepassword"
  }
  ```
* **Success Response (`201 Created`)**:
  ```json
  {
    "user": {
      "id": "uuid-v4-string",
      "email": "user@example.com",
      "username": "username",
      "role": "user"
    }
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: `{"error": "All fields are required"}` (Missing required fields)
  * `409 Conflict`: `{"error": "Email already registered"}` (Email already exists in database)
  * `500 Internal Server Error`: `{"error": "Server error"}`

---

### POST `/api/auth/login`
Authenticates a user and returns a JSON Web Token (JWT).

* **Access**: Public
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "token": "jwt-token-string",
    "user": {
      "id": "uuid-v4-string",
      "email": "user@example.com",
      "username": "username",
      "role": "user"
    }
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: `{"error": "All fields are required"}`
  * `401 Unauthorized`: `{"error": "Invalid credentials"}`
  * `500 Internal Server Error`: `{"error": "Server error"}`

---

### GET `/api/auth/me`
Retrieves details of the currently authenticated user session.

* **Access**: Authenticated
* **Success Response (`200 OK`)**:
  ```json
  {
    "id": "uuid-v4-string",
    "email": "user@example.com",
    "username": "username",
    "role": "user",
    "created_at": "timestamp"
  }
  ```
* **Error Responses**:
  * `404 Not Found`: `{"error": "User not found"}`
  * `500 Internal Server Error`: `{"error": "Server error"}`

---

## 2. User Management (`/api/user` & `/api/users`)

### GET `/api/users`
Lists all users registered in the system.

* **Access**: Authenticated *(Vulnerable: missing admin role check)*
* **Success Response (`200 OK`)**:
  ```json
  [
    {
      "id": "uuid-v4-1",
      "email": "admin@lab.local",
      "username": "admin_user",
      "role": "admin",
      "created_at": "2026-06-21T14:00:00.000Z"
    },
    {
      "id": "uuid-v4-2",
      "email": "alice@lab.local",
      "username": "alice",
      "role": "user",
      "created_at": "2026-06-21T14:05:00.000Z"
    }
  ]
  ```
* **Error Responses**:
  * `500 Internal Server Error`: `{"error": "Server error"}`

---

### GET `/api/user/:id`
Retrieves a specific user profile by user ID.

* **Access**: Authenticated *(Vulnerable: missing ownership/authorization checks)*
* **Path Parameters**:
  * `id`: User UUID
* **Success Response (`200 OK`)**:
  ```json
  {
    "id": "uuid-v4-2",
    "email": "alice@lab.local",
    "username": "alice",
    "role": "user",
    "created_at": "2026-06-21T14:05:00.000Z"
  }
  ```
* **Error Responses**:
  * `404 Not Found`: `{"error": "User not found"}`
  * `500 Internal Server Error`: `{"error": "Server error"}`

---

### PUT `/api/user/:id`
Updates a user profile.

* **Access**: Authenticated *(Vulnerable: missing ownership checks & allows Role Mass Assignment)*
* **Path Parameters**:
  * `id`: User UUID
* **Request Body** (All fields optional):
  ```json
  {
    "email": "newemail@example.com",
    "username": "newusername",
    "password": "newpassword",
    "role": "admin"
  }
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "id": "uuid-v4-2",
    "email": "newemail@example.com",
    "username": "newusername",
    "role": "admin"
  }
  ```
* **Error Responses**:
  * `404 Not Found`: `{"error": "User not found"}`
  * `500 Internal Server Error`: `{"error": "Server error"}`

---

### DELETE `/api/user/:id`
Deletes a user account.

* **Access**: Authenticated *(Vulnerable: missing ownership/authorization checks)*
* **Path Parameters**:
  * `id`: User UUID
* **Success Response (`200 OK`)**:
  ```json
  {
    "success": true
  }
  ```
* **Error Responses**:
  * `404 Not Found`: `{"error": "User not found"}`
  * `500 Internal Server Error`: `{"error": "Server error"}`

---

## 3. Articles (`/api/article` & `/api/articles`)

### GET `/api/articles`
Lists articles. Supports filtering by public status via query parameter.

* **Access**: Authenticated *(Vulnerable: trusts the `public` filter from client without verifying ownership)*
* **Query Parameters**:
  * `public` (optional): `"true"` (fetch only public articles) or `"false"` (fetch only private articles)
* **Success Response (`200 OK`)**:
  ```json
  [
    {
      "id": "article-uuid",
      "title": "My Article Title",
      "body": "<p>Article body content</p>",
      "is_public": true,
      "created_at": "2026-06-21T14:10:00.000Z",
      "author": "alice",
      "author_id": "user-uuid"
    }
  ]
  ```
* **Error Responses**:
  * `500 Internal Server Error`: `{"error": "Server error"}`

---

### GET `/api/article/:id`
Retrieves a specific article.

* **Access**: Authenticated
* **Path Parameters**:
  * `id`: Article UUID
* **Success Response (`200 OK`)**:
  ```json
  {
    "id": "article-uuid",
    "title": "My Article Title",
    "body": "<p>Article body content</p>",
    "is_public": true,
    "created_at": "2026-06-21T14:10:00.000Z",
    "author": "alice",
    "author_id": "user-uuid"
  }
  ```
* **Error Responses**:
  * `404 Not Found`: `{"error": "Article not found"}`
  * `500 Internal Server Error`: `{"error": "Server error"}`

---

### POST `/api/articles`
Creates a new article.

* **Access**: Authenticated *(Vulnerable: does not sanitize HTML inputs - Stored XSS)*
* **Request Body**:
  ```json
  {
    "title": "My Article Title",
    "body": "<p>Article body HTML content</p>",
    "is_public": true
  }
  ```
* **Success Response (`21 Created`)**:
  ```json
  {
    "id": "article-uuid",
    "author_id": "user-uuid",
    "title": "My Article Title",
    "body": "<p>Article body HTML content</p>",
    "is_public": true,
    "created_at": "2026-06-21T14:10:00.000Z"
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: `{"error": "Title and body are required"}`
  * `500 Internal Server Error`: `{"error": "Server error"}`

---

### PUT `/api/article/:id`
Updates an existing article.

* **Access**: Authenticated *(Vulnerable: no ownership verification)*
* **Path Parameters**:
  * `id`: Article UUID
* **Request Body** (All fields optional):
  ```json
  {
    "title": "Updated Title",
    "body": "Updated Body",
    "is_public": false
  }
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "id": "article-uuid",
    "author_id": "user-uuid",
    "title": "Updated Title",
    "body": "Updated Body",
    "is_public": false,
    "created_at": "2026-06-21T14:10:00.000Z"
  }
  ```
* **Error Responses**:
  * `404 Not Found`: `{"error": "Article not found"}`
  * `500 Internal Server Error`: `{"error": "Server error"}`

---

### DELETE `/api/article/:id`
Deletes an article.

* **Access**: Authenticated *(Vulnerable: no ownership/authorization checks)*
* **Path Parameters**:
  * `id`: Article UUID
* **Success Response (`200 OK`)**:
  ```json
  {
    "success": true
  }
  ```
* **Error Responses**:
  * `500 Internal Server Error`: `{"error": "Server error"}`

---

## 4. Security & Vulnerability Overview

This API contains the following critical security flaws by design to support training:
1. **Broken Object-Level Authorization (IDOR) on User Management**: `PUT`, `GET`, and `DELETE` on `/api/user/:id` do not verify that the requester owns the target resource.
2. **Mass Assignment (Privilege Escalation)**: `PUT /api/user/:id` accepts `{"role": "admin"}` and updates the user's role without validation.
3. **Broken Function-Level Authorization**: `GET /api/users` retrieves administrative metadata and user accounts for all registered users without validating that the requester has administrative privileges.
4. **Broken Object-Level Authorization on Articles**: 
   * `GET /api/articles?public=false` returns all private articles in the system, bypassing ownership checks.
   * `PUT` / `DELETE` on `/api/article/:id` lack ownership checks, allowing any authenticated user to modify or delete any article.
5. **Stored Cross-Site Scripting (XSS)**: `POST /api/articles` stores the unescaped `body` parameter as HTML.
