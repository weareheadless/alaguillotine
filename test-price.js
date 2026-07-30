const fetchChopPrice = async () => {
    const url = `https://frontend-api-v2.pump.fun/coins/6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    const text = await resp.text();
    console.log(text.substring(0, 200));
};
fetchChopPrice();
