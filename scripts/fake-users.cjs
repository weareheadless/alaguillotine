// Simulate fake users posting messages to test gamification effects
const fs = require("fs");
const env = {};
fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .forEach((line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });

const { Client, Account, Databases, ID } = require("node-appwrite");

const users = [
  { name: "CryptoWhale", text: "Just dropped $500 on $DOGE, no regrets 💸" },
  { name: "TeslaBull", text: "Cybertruck delivery pushed to 2027. Shocking." },
  { name: "MemeLord", text: "Elon renamed Twitter to X and my brain to 🤯" },
  { name: "Futurist99", text: "Mars colony by 2030? I'll believe it when I see it." },
  { name: "SkepticalSam", text: "Full self-driving is still in beta after 8 years" },
  { name: "RocketFan42", text: "Starship blew up again but at least it looked cool" },
  { name: "AI_Debater", text: "Grok is just ChatGPT with extra smugness" },
  { name: "DiamondHands", text: "HODLing TSLA since 2020, send help" },
  { name: "NeuroLinker", text: "Still waiting for my brain chip. No rush." },
  { name: "BoringCo", text: "The Las Vegas tunnel is just a subway with extra steps" },
];

async function run() {
  const adminClient = new Client()
    .setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(env.APPWRITE_API_KEY);

  const db = new Databases(adminClient);

  console.log("🚀 Creating fake messages...\n");
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const paid = i < 3;

    await db.createDocument(
      env.APPWRITE_DATABASE_ID,
      env.APPWRITE_MESSAGES_COLLECTION_ID,
      ID.unique(),
      {
        text: u.text,
        author_name: u.name,
        author_id: null,
        amount_paid: paid ? Math.floor(Math.random() * 80) + 5 : 0,
        is_shadowbanned: false,
        parent_id: null,
        created_at: new Date().toISOString(),
      },
    );

    console.log(`✅ ${u.name}: "${u.text}"`);
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log("\n✨ Done! Refresh the site and post a message yourself to see the blade react.");
}

run().catch(console.error);
