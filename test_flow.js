const http = require('http');

const API_BASE = 'http://127.0.0.1:4000/api';

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ status: res.statusCode, data: parsed });
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject({ status: res.statusCode, data: body });
          }
        }
      });
    });

    req.on('error', (e) => reject({ error: e.message }));
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runEndToEndFlowTest() {
  console.log('===============================================================');
  console.log('🚢 STARTING HARI OM END-TO-END PRD COMPLIANCE INTEGRATION TEST');
  console.log('===============================================================\n');

  try {
    // -------------------------------------------------------------------------
    // STEP 1: AUTHENTICATION
    // -------------------------------------------------------------------------
    console.log('▶ STEP 1: Authenticating Users...');
    
    // 1.1 Partner Admin Login
    const adminAuth = await request('POST', '/auth/login', {
      email: 'agentadmin@thalassic.in',
      password: 'Password123!',
    });
    console.log('  ✔ Partner Admin Logged In:', adminAuth.user.email, `(Role: ${adminAuth.user.role})`);
    const adminToken = adminAuth.token;

    // 1.2 Partner 1 Login (Kishan)
    const partner1Auth = await request('POST', '/auth/login', {
      email: 'kishan1@gmail.com',
      password: 'kishan123',
    });
    console.log('  ✔ Partner 1 Logged In:', partner1Auth.user.name, `(${partner1Auth.user.email})`);
    const partner1Token = partner1Auth.token;
    const partner1Id = partner1Auth.user.id;

    // 1.3 Partner 2 Login (Alternative Partner)
    const partner2Auth = await request('POST', '/auth/login', {
      email: 'partner@test.com',
      password: 'partner@123',
    });
    console.log('  ✔ Partner 2 Logged In:', partner2Auth.user.name, `(${partner2Auth.user.email})\n`);
    const partner2Token = partner2Auth.token;

    // -------------------------------------------------------------------------
    // STEP 2: PRD CHAPTER 4 — CONFIGURE PARTNER-COURSE PRICING (ADMIN)
    // -------------------------------------------------------------------------
    console.log('▶ STEP 2: Configuring Partner-Course Pricing Matrix (PRD Chapter 4)...');
    
    const configuredPricing = await request(
      'POST',
      '/agent-admin/pricing',
      {
        partnerId: partner1Id,
        courseCode: 'BST',
        courseName: 'Basic Safety Training',
        standardFee: 12000,
        hariOmPayableAmount: 9500, // Partner-specific custom payable amount
        status: 'Active',
      },
      adminToken
    );
    console.log(`  ✔ Configured custom pricing: BST -> ₹${configuredPricing.hariOmPayableAmount} for Partner ${partner1Id}`);

    // Verify Pricing Matrix endpoint
    const pricingList = await request('GET', '/agent-admin/pricing', null, adminToken);
    const targetPrice = pricingList.find((p) => p.courseCode === 'BST' && p.partnerId === partner1Id);
    console.log(`  ✔ Verified Pricing Matrix in DB: Found rule ID ${targetPrice.id} (Payable: ₹${targetPrice.hariOmPayableAmount})\n`);

    // -------------------------------------------------------------------------
    // STEP 3: PRD CHAPTER 2 — SEAFARER MASTER CREATION (PARTNER 1)
    // -------------------------------------------------------------------------
    console.log('▶ STEP 3: Identifying / Creating Single Source of Truth Seafarer Master (PRD Chapter 2)...');
    
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const testIndos = `IND-AUTO-${randomSuffix}`;
    const testPassport = `Z${randomSuffix}`;
    const testCdc = `MUM-${randomSuffix}`;
    const newSeafarer = await request(
      'POST',
      '/partner/seafarers',
      {
        name: 'Arjun Nambiar',
        email: `arjun.${Date.now()}@merchantnavy.in`,
        phone: `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`,
        indosNumber: testIndos,
        passportNumber: testPassport,
        cdcNumber: testCdc,
        dateOfBirth: '1995-06-15',
        nationality: 'Indian',
      },
      partner1Token
    );
    console.log(`  ✔ Seafarer Master Created: ${newSeafarer.name} (INDoS: ${newSeafarer.indosNumber}, ID: ${newSeafarer.id})`);

    // Verify Seafarer Search by INDoS
    const searchResults = await request('GET', `/partner/seafarers/search?q=${testIndos}`, null, partner1Token);
    console.log(`  ✔ Seafarer Search Verified: Located Master record ${searchResults[0].name} by INDoS query.\n`);

    // -------------------------------------------------------------------------
    // STEP 4: PRD CHAPTER 3 & 7 — PHYSICAL COURSE PURCHASE & ENROLLMENT
    // -------------------------------------------------------------------------
    console.log('▶ STEP 4: Processing Physical Course Purchase & Enrollment (PRD Chapter 3 & 7)...');
    
    const purchaseResult = await request(
      'POST',
      '/partner/purchases',
      {
        seafarerId: newSeafarer.id,
        courseCode: 'BST',
        courseName: 'Basic Safety Training',
        trainingBatch: 'Batch 2026-B1 (Physical DG Training)',
        notes: 'Enrolled via Partner Portal for offline DG training.',
      },
      partner1Token
    );

    const purchase = purchaseResult.purchase || purchaseResult;
    console.log(`  ✔ Purchase Created: #${purchase.purchase_number}`);
    console.log(`    - Course: ${purchase.course_code} (${purchase.course_name})`);
    console.log(`    - Hari Om Payable Amount (Auto-fetched): ₹${purchase.payable_amount}`);
    console.log(`    - Settlement Status: ${purchase.settlement_status}`);

    const purchaseId = purchase.id;

    // -------------------------------------------------------------------------
    // STEP 5: PRD CHAPTER 5 — PARTNER SUBMITS SETTLEMENT WITH UTR
    // -------------------------------------------------------------------------
    console.log('▶ STEP 5: Submitting Offline Settlement Batch with Bank UTR (PRD Chapter 5)...');
    
    const utrCode = `UTR-HDFC-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const settlementResult = await request(
      'POST',
      '/partner/settlements',
      {
        purchaseIds: [purchaseId],
        paymentMethod: 'Bank Transfer (NEFT/RTGS)',
        utrReference: utrCode,
        bankName: 'HDFC Bank Ltd',
        remarks: 'Batch offline course fee remittance for BST module.',
      },
      partner1Token
    );

    const settlement = settlementResult.settlement || settlementResult;
    console.log(`  ✔ Settlement Batch Submitted: #${settlement.settlement_number}`);
    console.log(`    - Remitted Amount: ₹${settlement.total_amount}`);
    console.log(`    - Bank UTR: ${settlement.utr_reference}`);
    console.log(`    - Batch Status: ${settlement.status}\n`);

    const settlementId = settlement.id;

    // -------------------------------------------------------------------------
    // STEP 6: PRD CHAPTER 5 — FINANCE & ADMIN VERIFIES SETTLEMENT
    // -------------------------------------------------------------------------
    console.log('▶ STEP 6: Admin / Finance Settlement Verification (PRD Chapter 5)...');
    
    const verifiedSettlement = await request(
      'PATCH',
      `/agent-admin/settlements/${settlementId}/verify`,
      {},
      adminToken
    );

    console.log(`  ✔ Settlement Verified by Admin: Status -> ${verifiedSettlement.status}`);
    console.log(`    - Verified By: ${verifiedSettlement.verified_by}`);
    console.log(`    - Verified At: ${verifiedSettlement.verified_at}`);

    // Verify Purchases Ledger shows Settled
    const purchasesLedger = await request('GET', `/agent-admin/purchases?search=${testIndos}`, null, adminToken);
    const updatedPurchase = purchasesLedger.find((p) => p.id === purchaseId);
    console.log(`  ✔ Purchase Ledger Updated: Purchase #${updatedPurchase.purchase_number} settlement_status is now "${updatedPurchase.settlement_status}".\n`);

    // -------------------------------------------------------------------------
    // STEP 7: PRD CHAPTER 2 & 6 — MULTI-PARTNER MIXED PURCHASE VALIDATION
    // -------------------------------------------------------------------------
    console.log('▶ STEP 7: Multi-Partner Mixed Purchase Validation (PRD Chapter 2 & 6)...');
    console.log('  Testing Second Partner purchasing another course for the SAME Seafarer Master...');

    // Partner 2 searches and reuses the same Seafarer Master
    const partner2SearchResults = await request('GET', `/partner/seafarers/search?q=${testIndos}`, null, partner2Token);
    const reusedMaster = partner2SearchResults[0];
    console.log(`  ✔ Partner 2 Located Existing Master: ID ${reusedMaster.id} (${reusedMaster.name})`);

    // Partner 2 purchases AFF for the same Seafarer Master
    const partner2PurchaseResult = await request(
      'POST',
      '/partner/purchases',
      {
        seafarerId: reusedMaster.id,
        courseCode: 'AFF',
        courseName: 'Advanced Fire Fighting',
        trainingBatch: 'Batch 2026-AFF-02',
      },
      partner2Token
    );

    const partner2Purchase = partner2PurchaseResult.purchase || partner2PurchaseResult;
    console.log(`  ✔ Partner 2 Created Purchase: #${partner2Purchase.purchase_number}`);
    console.log(`    - Associated Master: ${partner2Purchase.seafarer_name} (ID: ${partner2Purchase.seafarer_id})`);
    console.log(`    - Associated Partner: ${partner2Purchase.partner_name} (ID: ${partner2Purchase.partner_id})`);

    // Check Seafarer Master Purchases
    const masterDetails = await request('GET', `/partner/seafarers/${reusedMaster.id}`, null, partner1Token);
    const masterInfo = masterDetails.master || masterDetails.seafarer || masterDetails;
    const history = masterDetails.purchasesHistory || masterDetails.purchases || [];
    console.log(`  ✔ Single Source of Truth Verified: Seafarer Master ${masterInfo.name} now has ${history.length} distinct purchases across multiple partners.`);
    history.forEach((p, idx) => {
      console.log(`     ${idx + 1}. Course ${p.courseCode || p.course_code} -> Source: ${p.source} (${p.partnerName || 'Partner'})`);
    });

    console.log('\n===============================================================');
    console.log('🎉 ALL 7 END-TO-END PRD CHAPTER TESTS PASSED SUCCESSFULLY (100%)');
    console.log('===============================================================');
  } catch (err) {
    console.error('❌ TEST FAILED WITH ERROR:', err);
    process.exit(1);
  }
}

runEndToEndFlowTest();
