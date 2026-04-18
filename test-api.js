const http = require('http');

const options = {
  hostname: '192.168.18.165',
  port: 3000,
  path: '/api/sheets',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('RESPONSE:', data);
  });
});

req.on('error', (e) => console.error('ERROR:', e.message));
req.write('{"action":"createSheet","databaseName":"Test DB","subDatabases":["M1","M2"]}');
req.end();

setTimeout(() => process.exit(0), 10000);
