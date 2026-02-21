const http = require('http');

const TOKEN = process.env.TOKEN;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: path,
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
    console.log(`${ok ? 'PASS' : 'FAIL'} [${status}] ${label}: ${method} ${path}`);
    if (!ok) {
      console.log(`  Response: ${JSON.stringify(res.body).substring(0, 500)}`);
    }
    return res;
  } catch(e) {
    console.log(`ERROR ${label}: ${e.message}`);
    return null;
  }
}

module.exports = { makeRequest, test };
