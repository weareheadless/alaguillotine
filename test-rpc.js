const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const CHOP_MINT = process.env.NEXT_PUBLIC_CHOP_MINT || "6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump";

async function fetchSupply() {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenSupply",
    params: [CHOP_MINT],
  };
  const resp = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  console.log(await resp.json());
}
fetchSupply();
