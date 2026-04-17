const https = require('https');

https.get('https://hackit-room.onrender.com/messages', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Body:', data.substring(0, 500));
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
