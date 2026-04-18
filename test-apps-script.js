const https = require('https');

function testAppsScript() {
  const url = 'https://script.google.com/macros/s/AKfycbyPqSKxFlD-6aU-DXXU_9DuJfMuuFQH3S4neTndmlQEuOef3rC7AhSTSoVMTzHbCwPtFA/exec';

  const postData = 'action=createSheet&data=' + encodeURIComponent(JSON.stringify({
    databaseName: 'Test Database',
    subDatabases: ['M1', 'M2', 'M3']
  }));

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
    followAllRedirects: true,
  };

  const req = https.request(url, options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => { console.log('Response:', data); });
  });

  req.on('error', (error) => { console.error('Error:', error.message); });
  req.write(postData);
  req.end();
}

testAppsScript();
