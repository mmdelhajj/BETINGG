const http = require('http');

let TOKEN = '';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = {
      'Authorization': `Bearer ${TOKEN}`,
    };
    if (bodyStr) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1' + path,
      method: method,
      headers: headers
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch(e) { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function test(label, method, path, body) {
  try {
    const res = await makeRequest(method, path, body);
    const status = res.status;
    const ok = status >= 200 && status < 300;
    const msg = `${ok ? 'PASS' : 'FAIL'} [${status}] ${label}: ${method} ${path}`;
    console.log(msg);
    if (!ok) {
      const resp = JSON.stringify(res.body).substring(0, 300);
      console.log(`  => ${resp}`);
    }
    return res;
  } catch(e) {
    console.log(`ERROR ${label}: ${e.message}`);
    return null;
  }
}

async function login() {
  const data = JSON.stringify({email:'admin@cryptobet.com',password:'Admin123!'});
  return new Promise((resolve) => {
    const req = http.request({hostname:'localhost',port:3001,path:'/api/v1/auth/login',method:'POST',headers:{'Content-Type':'application/json','Content-Length':data.length}}, res => {
      let body='';
      res.on('data',c=>body+=c);
      res.on('end',()=>{
        const j=JSON.parse(body);
        TOKEN = j.data.tokens.accessToken;
        resolve(TOKEN);
      });
    });
    req.write(data);
    req.end();
  });
}

async function main() {
  await login();
  console.log('=== TOKEN ACQUIRED ===\n');

  const failures = [];
  const track = async (label, method, path, body) => {
    const res = await test(label, method, path, body);
    if (res && res.status >= 400) failures.push({ label, method, path, status: res.status, response: JSON.stringify(res.body).substring(0, 200) });
    return res;
  };

  // ========================================================================
  // 1. /admin/users - ban user, unban user
  // ========================================================================
  console.log('\n=== 1. ADMIN USERS ===');
  const userRes = await makeRequest('GET', '/admin/users?page=1&limit=5');
  const users = userRes.body?.data?.data || userRes.body?.data || [];
  const testUser = users.find(u => u.role !== 'SUPER_ADMIN' && u.role !== 'ADMIN') || users[1];
  const testUserId = testUser?.id || 'test-user-id';
  console.log(`Using test user: ${testUser?.username || 'unknown'} (${testUserId})`);

  await track('Ban user', 'PUT', `/admin/users/${testUserId}/ban`, {reason: 'Test ban'});
  await track('Unban user', 'PUT', `/admin/users/${testUserId}/unban`, {});

  // ========================================================================
  // 2. /admin/users/[id] - adjust balance, add note, set VIP, reset password
  // ========================================================================
  console.log('\n=== 2. ADMIN USER DETAIL ===');
  await track('Adjust balance', 'POST', `/admin/users/${testUserId}/adjust-balance`, { amount: 10, currency: 'USDT', reason: 'Test adjustment' });
  await track('Set VIP tier', 'PUT', `/admin/users/${testUserId}/vip`, { tier: 'Gold' });
  await track('Add note', 'POST', `/admin/users/${testUserId}/notes`, { content: 'Test admin note' });
  await track('Reset password', 'POST', `/admin/users/${testUserId}/reset-password`, {});

  // ========================================================================
  // 3. /admin/finance - approve/reject withdrawal, toggle currency, update currency
  // ========================================================================
  console.log('\n=== 3. ADMIN FINANCE ===');
  // Get real currency
  const currRes = await makeRequest('GET', '/admin/currencies');
  const currencies = currRes.body?.data || [];
  const testCurrency = currencies[0];
  const testCurrId = testCurrency?.id || 'currency-fake';
  console.log(`Using currency: ${testCurrency?.symbol || 'unknown'} (${testCurrId})`);

  await track('Update currency', 'PUT', `/admin/currencies/${testCurrId}`, { minWithdrawal: 0.01, withdrawalFee: 0.005 });
  await track('Toggle currency', 'PUT', `/admin/currencies/${testCurrId}/toggle`, { enabled: testCurrency?.isActive ?? true });

  // Withdrawal tests with fake ID — expect 404 (which is correct behavior for non-existent ID)
  const wdRes = await test('Approve withdrawal (fake ID)', 'PUT', '/admin/withdrawals/wd-fake-test/approve', {});
  if (wdRes && wdRes.status === 404) console.log('  (404 expected for fake ID - OK)');
  const wdRes2 = await test('Reject withdrawal (fake ID)', 'PUT', '/admin/withdrawals/wd-fake-test/reject', { reason: 'Test rejection' });
  if (wdRes2 && wdRes2.status === 404) console.log('  (404 expected for fake ID - OK)');

  // ========================================================================
  // 4. /admin/sports - CRUD sport, competition, event, market; settle market
  // ========================================================================
  console.log('\n=== 4. ADMIN SPORTS ===');
  // Create sport
  const ts = Date.now();
  const sportRes = await track('Create sport', 'POST', '/admin/sports', { name: 'TestSport' + ts, slug: 'test-sport-' + ts, isActive: true });
  const sportId = sportRes?.body?.data?.sport?.id || sportRes?.body?.data?.id || 'sport-fake';
  console.log(`  Created sport: ${sportId}`);

  // Update sport
  await track('Update sport', 'PUT', `/admin/sports/${sportId}`, { name: 'TestSport' + ts + 'Updated', active: false });

  // Create competition (need slug)
  const compRes = await track('Create competition', 'POST', '/admin/competitions', { name: 'Test League ' + ts, sportId: sportId, slug: 'test-league-' + ts, country: 'Test', isActive: true });
  const compId = compRes?.body?.data?.competition?.id || compRes?.body?.data?.id || 'comp-fake';
  console.log(`  Created competition: ${compId}`);

  // Create event (need name and competitionId, not sportId)
  const eventRes = await track('Create event', 'POST', '/admin/events', { name: 'Team A vs Team B', competitionId: compId, homeTeam: 'Team A', awayTeam: 'Team B', startTime: new Date(Date.now() + 86400000).toISOString() });
  const eventId = eventRes?.body?.data?.event?.id || eventRes?.body?.data?.id || 'event-fake';
  console.log(`  Created event: ${eventId}`);

  // Update event
  await track('Update event', 'PUT', `/admin/events/${eventId}`, { homeTeam: 'Team A Updated', awayTeam: 'Team B Updated' });
  await track('Update event status', 'PUT', `/admin/events/${eventId}/status`, { status: 'live' });

  // Create market (need proper type and marketKey)
  const marketRes = await track('Create market', 'POST', '/admin/markets', { eventId: eventId, name: 'Match Winner', marketKey: 'match_winner', type: 'MONEYLINE' });
  const marketId = marketRes?.body?.data?.market?.id || marketRes?.body?.data?.id || 'market-fake';
  console.log(`  Created market: ${marketId}`);

  // Settle market
  await track('Settle market', 'PUT', `/admin/markets/${marketId}/settle`, { winnerSelectionId: 'sel-fake' });

  // Delete sport (cleanup) - sport has competitions so 400 is expected behavior
  const delSportRes = await track('Delete sport (has comps)', 'DELETE', `/admin/sports/${sportId}`);
  if (delSportRes?.status === 400) {
    console.log('  (400 expected - sport has competitions)');
  }

  // ========================================================================
  // 5. /admin/casino - update game config
  // ========================================================================
  console.log('\n=== 5. ADMIN CASINO ===');
  const gamesRes = await makeRequest('GET', '/admin/casino/games');
  const games = gamesRes.body?.data || [];
  const gameId = games[0]?.id || 'game-fake';
  console.log(`Using game: ${games[0]?.name || 'unknown'} (${gameId})`);

  await track('Update casino game config', 'PUT', `/admin/casino/games/${gameId}`, { enabled: true, houseEdge: 3.0, minBet: 0.10, maxBet: 10000 });
  await track('Toggle casino game (disable)', 'PUT', `/admin/casino/games/${gameId}`, { enabled: false });
  await track('Toggle casino game (enable)', 'PUT', `/admin/casino/games/${gameId}`, { enabled: true });

  // ========================================================================
  // 6. /admin/promotions - create/update/delete promotion
  // ========================================================================
  console.log('\n=== 6. ADMIN PROMOTIONS ===');
  const promoRes = await track('Create promotion', 'POST', '/admin/promotions', {
    title: 'Test Promo ' + ts, type: 'deposit_bonus', description: 'Test description',
    conditions: 'Min deposit $20', rewardType: 'percentage', rewardValue: 100,
    maxBonus: 500, wageringRequirement: 5,
    startDate: new Date().toISOString(), endDate: new Date(Date.now() + 86400000 * 30).toISOString()
  });
  const promoId = promoRes?.body?.data?.promotion?.id || promoRes?.body?.data?.id || 'promo-fake';
  console.log(`  Created promotion: ${promoId}`);

  await track('Update promotion', 'PUT', `/admin/promotions/${promoId}`, { title: 'Test Promo Updated', active: false });
  await track('Toggle promotion active', 'PUT', `/admin/promotions/${promoId}`, { active: true });
  await track('Delete promotion', 'DELETE', `/admin/promotions/${promoId}`);

  // Promo codes
  await track('Create promo code', 'POST', '/admin/promo-codes', { code: 'TESTCODE' + Date.now(), promotionId: promoId, maxUses: 100, expiresAt: new Date(Date.now() + 86400000 * 30).toISOString() });

  // ========================================================================
  // 7. /admin/odds - create/update/delete provider, trigger sync, update config
  // ========================================================================
  console.log('\n=== 7. ADMIN ODDS ===');
  const provRes = await track('Create odds provider', 'POST', '/admin/odds/providers', {
    name: 'Test Provider ' + ts, type: 'REST', apiKey: 'test_key_123',
    apiUrl: 'https://test.example.com', priority: 10, syncInterval: 120
  });
  const provId = provRes?.body?.data?.id || 'prov-fake';
  console.log(`  Created provider: ${provId}`);

  await track('Update odds provider', 'PUT', `/admin/odds/providers/${provId}`, { name: 'Test Provider ' + ts + ' Updated', active: false });
  await track('Delete odds provider', 'DELETE', `/admin/odds/providers/${provId}`);
  await track('Trigger odds sync', 'POST', '/admin/odds/sync/trigger', {});
  await track('Update odds config', 'PUT', '/admin/odds/config', { globalSyncInterval: 60, autoSyncEnabled: true, preMatchMargin: 5.5, liveMargin: 8.0 });

  // ========================================================================
  // 8. /admin/settings - update site settings, geo restrictions, API keys
  // ========================================================================
  console.log('\n=== 8. ADMIN SETTINGS ===');
  await track('Update site settings', 'PUT', '/admin/settings', {
    siteName: 'CryptoBet', siteDescription: 'Premium Crypto Betting Platform',
    maintenanceMode: false, registrationEnabled: true,
    minDepositAmount: '10', maxWithdrawalAmount: '50000',
    kycRequired: true, defaultCurrency: 'USDT'
  });
  // Use a unique country code for each test run (XX + last 2 chars of timestamp)
  const geoCode = 'X' + String(ts).slice(-1);
  await track('Add geo restriction', 'POST', '/admin/settings/geo-restrictions', { countryCode: geoCode, countryName: 'Test Country ' + ts });

  // Get geo restrictions to find our test entry
  const geoRes = await makeRequest('GET', '/admin/settings/geo-restrictions');
  const geos = geoRes.body?.data || [];
  const testGeo = Array.isArray(geos) ? geos.find(g => g.countryCode === geoCode) : null;
  if (testGeo) {
    await track('Delete geo restriction', 'DELETE', `/admin/settings/geo-restrictions/${testGeo.id}`);
  } else {
    console.log('  (No test geo restriction found to delete)');
  }

  // API Keys
  const apiKeyRes = await track('Create API key', 'POST', '/admin/settings/api-keys', { name: 'Test Key', permissions: ['read:users'] });
  const apiKeyId = apiKeyRes?.body?.data?.id || 'key-fake';
  console.log(`  Created API key: ${apiKeyId}`);

  await track('Toggle API key', 'PUT', `/admin/settings/api-keys/${apiKeyId}/toggle`, {});
  await track('Delete API key', 'DELETE', `/admin/settings/api-keys/${apiKeyId}`);

  // ========================================================================
  // 9. /admin/content - create/update/delete blog posts, help articles, academy courses
  // ========================================================================
  console.log('\n=== 9. ADMIN CONTENT ===');
  const blogRes = await track('Create blog post', 'POST', '/admin/content/blog-posts', { title: 'Test Blog Post', category: 'Test' });
  const blogId = blogRes?.body?.data?.post?.id || blogRes?.body?.data?.id || 'blog-fake';
  console.log(`  Created blog post: ${blogId}`);
  await track('Update blog post', 'PUT', `/admin/content/blog-posts/${blogId}`, { title: 'Test Blog Updated', status: 'published' });
  await track('Delete blog post', 'DELETE', `/admin/content/blog-posts/${blogId}`);

  const helpRes = await track('Create help article', 'POST', '/admin/content/help-articles', { title: 'Test Help Article', category: 'Getting Started' });
  const helpId = helpRes?.body?.data?.article?.id || helpRes?.body?.data?.id || 'help-fake';
  console.log(`  Created help article: ${helpId}`);
  await track('Update help article', 'PUT', `/admin/content/help-articles/${helpId}`, { title: 'Test Help Updated', status: 'published' });
  await track('Delete help article', 'DELETE', `/admin/content/help-articles/${helpId}`);

  const courseRes = await track('Create academy course', 'POST', '/admin/content/academy-courses', { title: 'Test Course' });
  const courseId = courseRes?.body?.data?.course?.id || courseRes?.body?.data?.id || 'course-fake';
  console.log(`  Created academy course: ${courseId}`);
  await track('Update academy course', 'PUT', `/admin/content/academy-courses/${courseId}`, { title: 'Test Course Updated', status: 'published' });
  await track('Delete academy course', 'DELETE', `/admin/content/academy-courses/${courseId}`);

  // ========================================================================
  // 10. /admin/rewards - update VIP tier, welcome package, calendar, grant bonus
  // ========================================================================
  console.log('\n=== 10. ADMIN REWARDS ===');
  const tiersRes = await makeRequest('GET', '/admin/rewards/vip-tiers');
  const tiers = tiersRes.body?.data || [];
  const tierId = (Array.isArray(tiers) && tiers[0]?.id) || 'tier-fake';
  console.log(`Using tier: ${(Array.isArray(tiers) && tiers[0]?.name) || 'unknown'} (${tierId})`);

  await track('Update VIP tier', 'PUT', `/admin/rewards/vip-tiers/${tierId}`, {
    minWagered: 0, rakebackPercent: 0.5, turboBoostPercent: 5, turboDurationMin: 90, calendarSplitPercent: 0.50
  });

  // Also test with frontend field names
  await track('Update VIP tier (frontend names)', 'PUT', `/admin/rewards/vip-tiers/${tierId}`, {
    wageringThreshold: 0, rakebackPercent: 0.5, turboBoostPercent: 5, turboDurationMinutes: 90, calendarBaseReward: 0.50
  });

  // Welcome package
  const wpRes = await makeRequest('GET', '/admin/rewards/welcome-package');
  const wpId = wpRes.body?.data?.id || 'wp-fake';
  await track('Update welcome package', 'PUT', `/admin/rewards/welcome-package/${wpId}`, {
    totalBonusValue: 2500, rakebackPercent: 10, durationDays: 30, dailyDropMin: 5, dailyDropMax: 50, cashVaultAmount: 500
  });

  // Calendar settings
  const calRes = await makeRequest('GET', '/admin/rewards/calendar-settings');
  const calId = calRes.body?.data?.id || 'cal-fake';
  await track('Update calendar settings', 'PUT', `/admin/rewards/calendar-settings/${calId}`, {
    claimWindowHours: 12, claimsPerDay: 3, baseRewardMultiplier: 1.0, turboActivationEnabled: true
  });

  // Grant bonus
  await track('Grant manual bonus', 'POST', '/admin/rewards/grant-bonus', {
    userId: testUserId, amount: 10, currency: 'USDT', reason: 'Test bonus'
  });

  // ========================================================================
  // 11. /admin/kyc - approve/reject KYC (fake IDs - expect 404)
  // ========================================================================
  console.log('\n=== 11. ADMIN KYC ===');
  const kycApproveRes = await test('Approve KYC (fake)', 'POST', '/admin/kyc/kyc-fake/approve', {});
  if (kycApproveRes && kycApproveRes.status === 404) console.log('  (404 expected for fake ID - OK)');
  const kycRejectRes = await test('Reject KYC (fake)', 'POST', '/admin/kyc/kyc-fake/reject', { reason: 'Test rejection' });
  if (kycRejectRes && kycRejectRes.status === 404) console.log('  (404 expected for fake ID - OK)');

  // ========================================================================
  // 12. /admin/betting - settle/void bet (fake IDs - expect 404)
  // ========================================================================
  console.log('\n=== 12. ADMIN BETTING ===');
  const settleRes = await test('Settle bet (fake)', 'PUT', '/admin/bets/bet-fake/settle', { result: 'WON', reason: 'Test settle' });
  if (settleRes && settleRes.status === 404) console.log('  (404 expected for fake ID - OK)');
  const voidRes = await test('Void bet (fake)', 'PUT', '/admin/bets/bet-fake/void', { reason: 'Test void' });
  if (voidRes && voidRes.status === 404) console.log('  (404 expected for fake ID - OK)');

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('\n========================================');
  console.log('FAILURES SUMMARY');
  console.log('========================================');
  if (failures.length === 0) {
    console.log('ALL TESTS PASSED!');
  } else {
    failures.forEach(f => {
      console.log(`\nFAIL [${f.status}] ${f.label}`);
      console.log(`  ${f.method} ${f.path}`);
      console.log(`  ${f.response}`);
    });
    console.log(`\nTotal failures: ${failures.length}`);
  }
}

main().catch(console.error);
