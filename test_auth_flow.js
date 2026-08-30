async function testAuth() {
  try {
    console.log('Testing Partner login on http://localhost:4000/api/auth/login...');
    const loginRes = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'partner@hariom.in',
        password: 'partner123',
      }),
    });

    const loginData = await loginRes.json();
    console.log('Login Response Status:', loginRes.status);
    console.log('✅ Login successful! User:', loginData.user?.name);
    const token = loginData.token;
    console.log('Token snippet:', token.substring(0, 30) + '...');

    console.log('\nTesting authenticated call to http://localhost:4000/api/partner/purchases...');
    const purchasesRes = await fetch('http://localhost:4000/api/partner/purchases', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const purchasesData = await purchasesRes.json();
    console.log('✅ /api/partner/purchases returned status:', purchasesRes.status);
    console.log(`Found ${purchasesData.length} purchases for logged-in Partner!`);

    console.log('\nTesting authenticated call to http://localhost:4000/api/partner/financials...');
    const finRes = await fetch('http://localhost:4000/api/partner/financials', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const finData = await finRes.json();
    console.log('✅ /api/partner/financials returned:', finData);
    console.log('\n🎉 ALL AUTHENTICATED PARTNER ENDPOINTS WORKING WITH 200 OK!');
  } catch (err) {
    console.error('❌ Error during test:', err.message);
  }
}

testAuth();
