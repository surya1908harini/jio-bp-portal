const https = require('https');
https.get('https://assets.mixkit.co/videos/preview/mixkit-construction-crane-in-a-city-4071-large.mp4', (res) => {
  console.log(res.statusCode);
}).on('error', (e) => {
  console.error(e);
});
