/**
 * Script to create the "nominations" collection in Appwrite.
 * Run: node scripts/setup-nominations.cjs
 */
const { Client, Databases, ID } = require("node-appwrite");
const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.resolve(__dirname, "..", ".env.local");
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    });
}

const endpoint = env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = env.APPWRITE_API_KEY;
const databaseId = env.APPWRITE_DATABASE_ID;
const collectionId = env.APPWRITE_NOMINATIONS_COLLECTION_ID || "nominations";

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error("Missing required environment variables. Check .env.local");
  process.exit(1);
}

async function setup() {
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(client);

  console.log(`Creating collection "${collectionId}" in database "${databaseId}"...`);

  try {
    const collection = await databases.createCollection(
      databaseId,
      collectionId,
      "Nominations (Guillotine Leaderboard)",
    );
    console.log("✓ Collection created:", collection.$id);
  } catch (err) {
    if (err.message?.includes("already exists")) {
      console.log("✓ Collection already exists, continuing...");
    } else {
      console.error("Failed to create collection:", err.message);
      process.exit(1);
    }
  }

  // Define attributes
  const attributes = [
    { key: "target_name", type: "string", size: 100, required: true },
    { key: "voter_id", type: "string", size: 100, required: false },
    { key: "voter_name", type: "string", size: 100, required: true },
    { key: "message_id", type: "string", size: 100, required: true },
    { key: "weight", type: "integer", required: true, min: 1, max: 10000000 },
    { key: "amount_paid", type: "double", required: true, min: 0, max: 1000000 },
    { key: "created_at", type: "string", size: 50, required: true },
  ];

  for (const attr of attributes) {
    try {
      if (attr.type === "string") {
        await databases.createStringAttribute(
          databaseId,
          collectionId,
          attr.key,
          attr.size,
          attr.required,
        );
      } else if (attr.type === "integer") {
        await databases.createIntegerAttribute(
          databaseId,
          collectionId,
          attr.key,
          attr.required,
          attr.min,
          attr.max,
        );
      } else if (attr.type === "double") {
        await databases.createFloatAttribute(
          databaseId,
          collectionId,
          attr.key,
          attr.required,
          attr.min,
          attr.max,
        );
      }
      console.log(`  ✓ Attribute "${attr.key}" created`);
    } catch (err) {
      if (err.message?.includes("already exists")) {
        console.log(`  ✓ Attribute "${attr.key}" already exists`);
      } else {
        console.error(`  ✗ Failed to create attribute "${attr.key}":`, err.message);
      }
    }
  }

  // Create index on target_name for fast lookups
  try {
    await databases.createIndex(
      databaseId,
      collectionId,
      "target_name_idx",
      "key",
      ["target_name"],
    );
    console.log("  ✓ Index 'target_name_idx' created");
  } catch (err) {
    if (err.message?.includes("already exists")) {
      console.log("  ✓ Index 'target_name_idx' already exists");
    } else {
      console.error("  ✗ Failed to create index:", err.message);
    }
  }

  // Create index on created_at for sorting
  try {
    await databases.createIndex(
      databaseId,
      collectionId,
      "created_at_idx",
      "key",
      ["created_at"],
    );
    console.log("  ✓ Index 'created_at_idx' created");
  } catch (err) {
    if (err.message?.includes("already exists")) {
      console.log("  ✓ Index 'created_at_idx' already exists");
    } else {
      console.error("  ✗ Failed to create index:", err.message);
    }
  }

  // Create index on voter_id for dedup
  try {
    await databases.createIndex(
      databaseId,
      collectionId,
      "voter_id_idx",
      "key",
      ["voter_id"],
    );
    console.log("  ✓ Index 'voter_id_idx' created");
  } catch (err) {
    if (err.message?.includes("already exists")) {
      console.log("  ✓ Index 'voter_id_idx' already exists");
    } else {
      console.error("  ✗ Failed to create index:", err.message);
    }
  }

  console.log("\n✓ Nominations collection setup complete!");
}

setup().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
