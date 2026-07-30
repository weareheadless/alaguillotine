fetch('https://api.jup.ag/price/v2?ids=6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump')
  .then(r => r.text())
  .then(console.log)
  .catch(console.error);
