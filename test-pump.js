const https = require('https');
fetch('https://frontend-api-v2.pump.fun/coins/6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
