const https = require('https');
https.get('https://raw.githubusercontent.com/deldersveld/topojson/master/countries/slovenia/slovenia-municipalities.json', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data.substring(0, 100)));
});
