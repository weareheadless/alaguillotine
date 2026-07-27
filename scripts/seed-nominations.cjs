/**
 * Seed the nominations collection with test data.
 * Run: node scripts/seed-nominations.cjs
 */
const { Client, Databases, ID } = require("node-appwrite");
const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.resolve(__dirname, "..", ".env.local");
const env = {};
fs.readFileSync(envPath, "utf8")
  .split("\n")
  .forEach((line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });

const client = new Client()
  .setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);

const databases = new Databases(client);
const databaseId = env.APPWRITE_DATABASE_ID;
const collectionId = env.APPWRITE_NOMINATIONS_COLLECTION_ID || "nominations";

const TARGETS = [
  { name: "Zuck", weight: 142, paid: 0.5 },
  { name: "Bezos", weight: 98, paid: 0.3 },
  { name: "Trump", weight: 256, paid: 1.2 },
  { name: "Zuck", weight: 1, paid: 0 },
  { name: "Bezos", weight: 500, paid: 5.0 },
  { name: "Musk", weight: 1, paid: 0 },
  { name: "Trump", weight: 1000, paid: 10.0 },
  { name: "Gates", weight: 73, paid: 0.2 },
  { name: "Zuck", weight: 1, paid: 0 },
  { name: "Bezos", weight: 1, paid: 0 },
  { name: "Trump", weight: 1, paid: 0 },
  { name: "Gates", weight: 250, paid: 2.5 },
  { name: "Musk", weight: 1, paid: 0 },
  { name: "Musk", weight: 1, paid: 0 },
  { name: "Zuck", weight: 300, paid: 3.0 },
];

async function seed() {
  console.log(`Seeding ${TARGETS.length} nominations...`);

  for (let i = 0; i < TARGETS.length; i++) {
    const t = TARGETS[i];
    const now = new Date();
    now.setMinutes(now.getMinutes() - (TARGETS.length - i) * 2); // spread over time

    await databases.createDocument(databaseId, collectionId, ID.unique(), {
      target_name: t.name,
      voter_id: `seed-voter-${i}`,
      voter_name: `Voter ${i + 1}`,
      message_id: `seed-msg-${i}`,
      weight: t.weight,
      amount_paid: t.paid,
      created_at: now.toISOString(),
    });
    console.log(`  ${i + 1}. "${t.name}" — weight ${t.weight}${t.paid > 0 ? ` (◎${t.paid} paid)` : ""}`);
  }

  console.log("\n✓ Done! Check the leaderboard at /leaderboard");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
