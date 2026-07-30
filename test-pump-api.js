fetch('https://frontend-api.pump.fun/coins/6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump', {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "application/json"
  }
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
