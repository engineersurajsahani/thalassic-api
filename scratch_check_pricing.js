const http = require('http');

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://127.0.0.1:4000/api' + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function check() {
  const kishan = await request('POST', '/auth/login', {
    email: 'kishan1@gmail.com',
    password: 'kishan123',
  });
  console.log('Kishan Logged In. ID:', kishan.user.id);
  
  const courses = await request('GET', '/partner/courses', null, kishan.token);
  const bst = courses.find((c) => c.code === 'BST');
  console.log('BST for Kishan:', JSON.stringify(bst, null, 2));

  const partner2 = await request('POST', '/auth/login', {
    email: 'partner@test.com',
    password: 'partner@123',
  });
  const courses2 = await request('GET', '/partner/courses', null, partner2.token);
  const bst2 = courses2.find((c) => c.code === 'BST');
  console.log('BST for Partner 2 (Global Default):', JSON.stringify(bst2, null, 2));
}

check();
