const fs = require("fs");
const env = {};
fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .forEach((line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });

const { Client, Databases } = require("node-appwrite");

const client = new Client()
  .setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);

const db = new Databases(client);

async function run() {
  // Check existing attributes
  const attrs = await db.listAttributes(
    env.APPWRITE_DATABASE_ID,
    env.APPWRITE_MESSAGES_COLLECTION_ID,
  );
  console.log("Current attributes:");
  attrs.attributes.forEach((a) =>
    console.log(" -", a.key, ":", a.type, a.required ? "(required)" : ""),
  );

  const hasParentId = attrs.attributes.some((a) => a.key === "parent_id");
  if (hasParentId) {
    console.log("\nparent_id already exists");
  } else {
    console.log("\nCreating parent_id attribute...");
    try {
      await db.createStringAttribute(
        env.APPWRITE_DATABASE_ID,
        env.APPWRITE_MESSAGES_COLLECTION_ID,
        "parent_id",
        255,
        false,
      );
      console.log("parent_id attribute created!");
    } catch (err) {
      console.error("Failed to create attribute:", err.message);
    }
  }

  // Create index for parent_id queries
  const indexes = await db.listIndexes(
    env.APPWRITE_DATABASE_ID,
    env.APPWRITE_MESSAGES_COLLECTION_ID,
  );
  const hasIndex = indexes.indexes.some((i) => i.key === "parent_id_index");
  if (!hasIndex) {
    console.log("Creating index for parent_id...");
    try {
      await db.createIndex(
        env.APPWRITE_DATABASE_ID,
        env.APPWRITE_MESSAGES_COLLECTION_ID,
        "parent_id_index",
        "key",
        ["parent_id"],
        ["ASC"],
      );
      console.log("Index created!");
    } catch (err) {
      console.error("Failed to create index:", err.message);
    }
  } else {
    console.log("Index already exists");
  }
}

run().catch(console.error);
