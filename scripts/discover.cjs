const { Client, Databases } = require("appwrite");
const fs = require("fs");

// Parse .env.local
const env = {};
fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .forEach((line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });

const client = new Client()
  .setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

// Set API key if available
if (env.APPWRITE_API_KEY) {
  client.setKey(env.APPWRITE_API_KEY);
}

const db = new Databases(client);

(async () => {
  try {
    const dbs = await db.list();
    console.log("Databases:", dbs.total);
    for (const d of dbs.databases) {
      console.log("  -", d.name, ":", d.$id);
      const cols = await db.listCollections(d.$id);
      console.log("    Collections:", cols.total);
      for (const c of cols.collections) {
        console.log("      -", c.name, ":", c.$id);
      }
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
})();
