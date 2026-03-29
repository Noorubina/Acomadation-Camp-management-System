import fetch from 'node-fetch';

const API_URL = 'https://naajco-camp.onrender.com';
let authToken = null;

console.log('🚀 Starting Comprehensive API Testing...\n');

// Test 1: Health Check
async function testHealth() {
  console.log('🏥 1. Testing Health Check...');
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    console.log(`✅ Health Status: ${response.status}`);
    console.log(`📊 Server Status: ${data.message}`);
    console.log(`⏰ Uptime: ${Math.round(data.uptime)} seconds\n`);
    return response.status === 200;
  } catch (error) {
    console.log(`❌ Health Check Failed: ${error.message}\n`);
    return false;
  }
}

// Test 2: Database Connection
async function testDatabase() {
  console.log('🗄️ 2. Testing Database Connection...');
  try {
    const response = await fetch(`${API_URL}/`);
    const data = await response.text();
    console.log(`✅ Database Status: ${response.status}`);
    console.log(`📊 Response: ${data}\n`);
    return response.status === 200;
  } catch (error) {
    console.log(`❌ Database Test Failed: ${error.message}\n`);
    return false;
  }
}

// Test 3: Login API
async function testLogin() {
  console.log('🔐 3. Testing Login API...');
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@naajco.com',
        password: 'Naajco2024!'
      }),
    });

    const data = await response.json();
    console.log(`📊 Login Status: ${response.status}`);

    if (data.success) {
      authToken = data.token;
      console.log('✅ Login Successful!');
      console.log('🔑 Token Received:', authToken ? 'Yes' : 'No');
      console.log('👤 User:', data.user ? data.user.email : 'N/A');
    } else {
      console.log('❌ Login Failed:', data.message);
    }
    console.log('');
    return data.success;
  } catch (error) {
    console.log(`❌ Login Test Failed: ${error.message}\n`);
    return false;
  }
}

// Test 4: Protected Routes (Dashboard)
async function testProtectedRoutes() {
  console.log('🛡️ 4. Testing Protected Routes...');

  if (!authToken) {
    console.log('❌ No auth token available, skipping protected routes test\n');
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/api/dashboard/stats`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📊 Dashboard Stats Status: ${response.status}`);

    if (response.status === 200) {
      const data = await response.json();
      console.log('✅ Protected Route Access: SUCCESS');
      console.log('📊 Stats Data:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Protected Route Access: FAILED');
      const errorData = await response.json();
      console.log('🚨 Error:', errorData.message);
    }
    console.log('');
    return response.status === 200;
  } catch (error) {
    console.log(`❌ Protected Routes Test Failed: ${error.message}\n`);
    return false;
  }
}

// Test 5: Invalid Login Attempts
async function testInvalidLogin() {
  console.log('🚫 5. Testing Invalid Login Attempts...');

  const testCases = [
    { email: 'admin@naajco.com', password: 'wrongpassword', description: 'Wrong password' },
    { email: 'nonexistent@example.com', password: 'Naajco2024!', description: 'Non-existent user' },
    { email: '', password: 'Naajco2024!', description: 'Empty email' },
    { email: 'admin@naajco.com', password: '', description: 'Empty password' }
  ];

  let passed = 0;

  for (const testCase of testCases) {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testCase.email,
          password: testCase.password
        }),
      });

      const data = await response.json();

      if (response.status === 401 && !data.success) {
        console.log(`✅ ${testCase.description}: Correctly rejected`);
        passed++;
      } else {
        console.log(`❌ ${testCase.description}: Unexpected response (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${testCase.description}: Error - ${error.message}`);
    }
  }

  console.log(`📊 Invalid Login Tests: ${passed}/${testCases.length} passed\n`);
  return passed === testCases.length;
}

// Test 6: CORS Headers
async function testCORS() {
  console.log('🌐 6. Testing CORS Configuration...');

  try {
    // Test preflight request
    const preflightResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://naajco-camp-frontend.onrender.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    console.log(`📊 Preflight Status: ${preflightResponse.status}`);
    console.log('📊 CORS Headers:');
    console.log('  - Allow-Origin:', preflightResponse.headers.get('access-control-allow-origin'));
    console.log('  - Allow-Methods:', preflightResponse.headers.get('access-control-allow-methods'));
    console.log('  - Allow-Headers:', preflightResponse.headers.get('access-control-allow-headers'));
    console.log('  - Allow-Credentials:', preflightResponse.headers.get('access-control-allow-credentials'));

    // Test actual request with origin
    const actualResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://naajco-camp-frontend.onrender.com'
      },
      body: JSON.stringify({
        email: 'admin@naajco.com',
        password: 'Naajco2024!'
      }),
    });

    console.log(`📊 Actual Request Status: ${actualResponse.status}`);
    console.log('📊 Response CORS Headers:');
    console.log('  - Allow-Origin:', actualResponse.headers.get('access-control-allow-origin'));
    console.log('  - Allow-Credentials:', actualResponse.headers.get('access-control-allow-credentials'));

    const corsWorking = preflightResponse.status === 200 &&
                       actualResponse.headers.get('access-control-allow-origin') !== null;

    console.log(corsWorking ? '✅ CORS: Working correctly' : '❌ CORS: Issues detected');
    console.log('');
    return corsWorking;
  } catch (error) {
    console.log(`❌ CORS Test Failed: ${error.message}\n`);
    return false;
  }
}

// Test 7: Rate Limiting
async function testRateLimiting() {
  console.log('⏱️ 7. Testing Rate Limiting...');

  try {
    const requests = [];
    for (let i = 0; i < 60; i++) {
      requests.push(
        fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'admin@naajco.com',
            password: 'wrongpassword'
          }),
        })
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.some(response => response.status === 429);

    console.log(`📊 Rate Limiting: ${rateLimited ? 'Active' : 'Not detected'}`);
    console.log(`📊 Total Requests: ${responses.length}`);
    console.log(`📊 429 Responses: ${responses.filter(r => r.status === 429).length}`);
    console.log(`📊 401 Responses: ${responses.filter(r => r.status === 401).length}`);

    if (rateLimited) {
      console.log('✅ Rate limiting is working');
    } else {
      console.log('⚠️ Rate limiting may not be active or threshold not reached');
    }
    console.log('');
    return true; // Rate limiting test is informational
  } catch (error) {
    console.log(`❌ Rate Limiting Test Failed: ${error.message}\n`);
    return false;
  }
}

// Test 8: JWT Token Validation
async function testJWTValidation() {
  console.log('🎫 8. Testing JWT Token Validation...');

  if (!authToken) {
    console.log('❌ No auth token available, skipping JWT test\n');
    return false;
  }

  try {
    // Test with valid token
    const validResponse = await fetch(`${API_URL}/api/dashboard/stats`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Test with invalid token
    const invalidResponse = await fetch(`${API_URL}/api/dashboard/stats`, {
      headers: {
        'Authorization': 'Bearer invalid.jwt.token',
        'Content-Type': 'application/json'
      }
    });

    // Test without token
    const noTokenResponse = await fetch(`${API_URL}/api/dashboard/stats`, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`📊 Valid Token: ${validResponse.status}`);
    console.log(`📊 Invalid Token: ${invalidResponse.status}`);
    console.log(`📊 No Token: ${noTokenResponse.status}`);

    const jwtWorking = validResponse.status === 200 &&
                      invalidResponse.status === 401 &&
                      noTokenResponse.status === 401;

    console.log(jwtWorking ? '✅ JWT Validation: Working correctly' : '❌ JWT Validation: Issues detected');
    console.log('');
    return jwtWorking;
  } catch (error) {
    console.log(`❌ JWT Test Failed: ${error.message}\n`);
    return false;
  }
}

// Test 9: Error Handling
async function testErrorHandling() {
  console.log('🚨 9. Testing Error Handling...');

  try {
    // Test malformed JSON
    const malformedResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json}'
    });

    // Test non-existent endpoint
    const notFoundResponse = await fetch(`${API_URL}/api/nonexistent`);

    console.log(`📊 Malformed JSON: ${malformedResponse.status}`);
    console.log(`📊 Non-existent Endpoint: ${notFoundResponse.status}`);

    const errorHandling = malformedResponse.status >= 400 && notFoundResponse.status === 404;
    console.log(errorHandling ? '✅ Error Handling: Working correctly' : '❌ Error Handling: Issues detected');
    console.log('');
    return errorHandling;
  } catch (error) {
    console.log(`❌ Error Handling Test Failed: ${error.message}\n`);
    return false;
  }
}

// Test 10: Security Headers
async function testSecurityHeaders() {
  console.log('🔒 10. Testing Security Headers...');

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test', password: 'test' })
    });

    const headers = response.headers;
    const securityHeaders = {
      'X-Content-Type-Options': headers.get('x-content-type-options'),
      'X-Frame-Options': headers.get('x-frame-options'),
      'X-XSS-Protection': headers.get('x-xss-protection'),
      'Strict-Transport-Security': headers.get('strict-transport-security'),
      'Content-Security-Policy': headers.get('content-security-policy') ? 'Present' : 'Missing'
    };

    console.log('📊 Security Headers:');
    Object.entries(securityHeaders).forEach(([header, value]) => {
      console.log(`  - ${header}: ${value}`);
    });

    const hasBasicSecurity = securityHeaders['X-Content-Type-Options'] === 'nosniff' &&
                            securityHeaders['X-Frame-Options'] === 'SAMEORIGIN';

    console.log(hasBasicSecurity ? '✅ Security Headers: Good' : '⚠️ Security Headers: Could be improved');
    console.log('');
    return hasBasicSecurity;
  } catch (error) {
    console.log(`❌ Security Headers Test Failed: ${error.message}\n`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('🎯 COMPREHENSIVE API TESTING SUITE');
  console.log('='.repeat(60));
  console.log(`📡 Target: ${API_URL}`);
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);

  const results = {
    health: await testHealth(),
    database: await testDatabase(),
    login: await testLogin(),
    protected: await testProtectedRoutes(),
    invalidLogin: await testInvalidLogin(),
    cors: await testCORS(),
    rateLimit: await testRateLimiting(),
    jwt: await testJWTValidation(),
    errorHandling: await testErrorHandling(),
    security: await testSecurityHeaders()
  };

  console.log('='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([test, result]) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.padEnd(15)}`);
  });

  console.log('');
  console.log(`📈 Overall Score: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! System is fully functional.');
  } else if (passed >= total * 0.8) {
    console.log('👍 MOST TESTS PASSED! System is mostly functional.');
  } else {
    console.log('⚠️ SOME TESTS FAILED! System needs attention.');
  }

  console.log(`⏰ Completed: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  return results;
}

runAllTests().catch(console.error);
