-- ============================================================
--  Real Web Hacking Lab  –  Schema + Seed
--  Run this in your Supabase SQL editor (or any Postgres client)
-- ============================================================

-- --------------------
--  Tables
-- --------------------

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  username    text not null,
  password    text not null,            -- bcrypt hash
  role        text not null default 'user',  -- 'user' | 'admin'
  created_at  timestamptz default now()
);

create table if not exists articles (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references users(id) on delete cascade,
  title       text not null,
  body        text not null,            -- raw HTML, intentionally unsanitized
  is_public   boolean not null default true,
  created_at  timestamptz default now()
);

-- --------------------
--  Seed data
--  All passwords are:  Password123
--  bcrypt hash (cost 10) for "Password123":
--  $2b$10$6P/O.tw/C3gqwj9bwXMOjOj/nmFPJyb43v7IcM5WtKyW6VfidgDJW
-- --------------------

insert into users (email, username, password, role) values
  ('admin@lab.local',  'admin_user',  '$2b$10$6P/O.tw/C3gqwj9bwXMOjOj/nmFPJyb43v7IcM5WtKyW6VfidgDJW', 'admin'),
  ('alice@lab.local',  'alice',       '$2b$10$6P/O.tw/C3gqwj9bwXMOjOj/nmFPJyb43v7IcM5WtKyW6VfidgDJW', 'user'),
  ('bob@lab.local',    'bob',         '$2b$10$6P/O.tw/C3gqwj9bwXMOjOj/nmFPJyb43v7IcM5WtKyW6VfidgDJW', 'user'),
  ('charlie@lab.local','charlie',     '$2b$10$6P/O.tw/C3gqwj9bwXMOjOj/nmFPJyb43v7IcM5WtKyW6VfidgDJW', 'user'),
  ('analyst@lab.local','soc_analyst', '$2b$10$6P/O.tw/C3gqwj9bwXMOjOj/nmFPJyb43v7IcM5WtKyW6VfidgDJW', 'analyst')
on conflict (email) do nothing;

-- Public articles (visible via ?public=true)
insert into articles (author_id, title, body, is_public)
select id, 'Getting Started with Burp Suite',
  '<h1>Getting Started with Burp Suite</h1><p>Burp Suite is an integrated platform for web application security testing. In this write-up we walk through the basics of setting up your proxy and intercepting traffic.</p><p>Start by configuring your browser to route traffic through <strong>127.0.0.1:8080</strong>. Once Burp is running, navigate to any HTTP site and watch the requests appear in the Proxy tab.</p>',
  true
from users where username = 'alice'
on conflict do nothing;

insert into articles (author_id, title, body, is_public)
select id, 'Understanding HTTP Methods',
  '<h1>HTTP Methods</h1><p>Web applications rely on a handful of HTTP verbs: <strong>GET</strong>, <strong>POST</strong>, <strong>PUT</strong>, <strong>PATCH</strong>, and <strong>DELETE</strong>. Understanding these is essential for any penetration tester.</p><p>A <em>GET</em> request fetches a resource, while a <em>PUT</em> replaces it entirely. Mishandled PUT endpoints are a classic source of privilege escalation bugs.</p>',
  true
from users where username = 'bob'
on conflict do nothing;

insert into articles (author_id, title, body, is_public)
select id, 'OWASP Top 10 — A Quick Reference',
  '<h1>OWASP Top 10</h1><p>The OWASP Top 10 is a standard awareness document for developers and web application security. It lists the ten most critical web application security risks.</p><ul style="margin-left:1.2em;list-style:disc"><li>Broken Access Control</li><li>Cryptographic Failures</li><li>Injection</li><li>Insecure Design</li><li>Security Misconfiguration</li></ul><p>Each item represents a class of vulnerability that attackers actively exploit in the wild.</p>',
  true
from users where username = 'charlie'
on conflict do nothing;

-- Private articles (NOT visible via ?public=true — only via ?public=false or no filter)
insert into articles (author_id, title, body, is_public)
select id, 'My Private Lab Notes',
  '<h1>Private Notes</h1><p>This article is marked <strong>private</strong>. If you can read this, you have successfully exploited the broken object-level access control on the articles endpoint.</p><p>Try: <code>GET /api/articles?public=false</code> in Burp Repeater.</p>',
  false
from users where username = 'alice'
on conflict do nothing;

insert into articles (author_id, title, body, is_public)
select id, 'Draft: Unreleased Research',
  '<h1>Unreleased Research</h1><p>This draft was never meant to be public. You are seeing it because the backend trusts the <code>?public=</code> query parameter sent by the client without any server-side ownership check.</p>',
  false
from users where username = 'bob'
on conflict do nothing;

-- ============================================================
--  SIEM module – log monitoring, detection, alerting, cases
-- ============================================================

create table if not exists siem_logs (
  id           uuid primary key default gen_random_uuid(),
  ts           timestamptz not null default now(),
  event_type   text not null,
  severity     text not null default 'info',
  source_ip    text,
  method       text,
  path         text,
  status_code  int,
  user_id      uuid references users(id) on delete set null,
  username     text,
  message      text not null,
  metadata     jsonb not null default '{}'::jsonb
);

create index if not exists idx_siem_logs_ts          on siem_logs (ts desc);
create index if not exists idx_siem_logs_event_type  on siem_logs (event_type);
create index if not exists idx_siem_logs_severity    on siem_logs (severity);
create index if not exists idx_siem_logs_source_ip   on siem_logs (source_ip);
create index if not exists idx_siem_logs_user_id     on siem_logs (user_id);

create table if not exists siem_detection_rules (
  id           text primary key,
  name         text not null,
  description  text not null,
  severity     text not null default 'medium',
  enabled      boolean not null default true,
  created_at   timestamptz default now()
);

create table if not exists siem_alerts (
  id           uuid primary key default gen_random_uuid(),
  rule_id      text references siem_detection_rules(id),
  title        text not null,
  description  text not null,
  severity     text not null default 'medium',
  status       text not null default 'open',
  source_ip    text,
  user_id      uuid references users(id) on delete set null,
  log_ids      uuid[] not null default '{}',
  case_id      uuid,
  created_at   timestamptz default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references users(id)
);

create index if not exists idx_siem_alerts_status     on siem_alerts (status);
create index if not exists idx_siem_alerts_created_at on siem_alerts (created_at desc);
create index if not exists idx_siem_alerts_case_id    on siem_alerts (case_id);

create table if not exists siem_cases (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  status       text not null default 'open',
  severity     text not null default 'medium',
  assigned_to  uuid references users(id),
  created_by   uuid references users(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  closed_at    timestamptz
);

create table if not exists siem_case_notes (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references siem_cases(id) on delete cascade,
  author_id   uuid references users(id),
  note        text not null,
  created_at  timestamptz default now()
);

create table if not exists siem_threat_intel (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  value       text not null,
  description text,
  severity    text not null default 'medium',
  created_at  timestamptz default now(),
  unique (type, value)
);

create table if not exists siem_settings (
  key   text primary key,
  value text not null
);

insert into siem_settings (key, value) values ('retention_days', '30')
on conflict (key) do nothing;

insert into siem_detection_rules (id, name, description, severity) values
  ('auth_brute_force',        'Brute-force login',              '5 or more failed logins from the same IP or against the same email within 5 minutes.', 'high'),
  ('privilege_escalation_attempt', 'Mass-assignment privilege escalation attempt', 'A profile update request included a role field.', 'critical'),
  ('idor_user_delete',        'Unauthorized account deletion',  'A user deleted an account that was not their own.', 'high'),
  ('idor_user_edit',          'Unauthorized profile edit',      'A user edited a profile that was not their own.', 'medium'),
  ('idor_private_article',    'Private article exposure',       'Private articles were retrieved via a client-controlled filter or without ownership.', 'medium'),
  ('stored_xss_attempt',      'Stored XSS payload submitted',   'An article body contained a script/event-handler XSS signature.', 'high'),
  ('user_enumeration',        'Full user directory access',     'The full member/user list was retrieved.', 'low'),
  ('threat_intel_match',      'Known-bad indicator seen',       'Traffic matched an entry in the threat intel list.', 'high')
on conflict (id) do nothing;
