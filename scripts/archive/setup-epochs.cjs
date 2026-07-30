/**
 * Setup script for epochs + votes collections in Appwrite.
 *
 * Usage: node scripts/setup-epochs.cjs
 *
 * Creates two collections if they don't exist:
 *   - epochs: stores epoch state, board members, results
 *   - votes: stores individual vote submissions
 */

const { Client, Databases, ID } = require("node-appwrite");

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1";
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "6a6621ee003d507796b5";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "6a66718b002cb69a289a";
const API_KEY = process.env.APPWRITE_API_KEY;

if (!API_KEY) {
  console.error("APPWRITE_API_KEY is required.");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID);
client.setKey(API_KEY);

const db = new Databases(client);

async function main() {
  // ─── Epochs Collection ──────────────────────────────────────────────
  console.log("Creating 'epochs' collection...");

  try {
    await db.createCollection(DATABASE_ID, "epochs", "epochs");
    console.log("  ✅ epochs collection created");

    // Attributes (document-level since we use JSON for complex fields)
    await db.createIntegerAttribute(DATABASE_ID, "epochs", "epoch_number", true);
    await db.createStringAttribute(DATABASE_ID, "epochs", "status", 16, true);
    await db.createIntegerAttribute(DATABASE_ID, "epochs", "start_msg_count", true);
    await db.createIntegerAttribute(DATABASE_ID, "epochs", "end_msg_count", true);
    await db.createStringAttribute(DATABASE_ID, "epochs", "board_members", 65000, false); // JSON
    await db.createIntegerAttribute(DATABASE_ID, "epochs", "treasury_amount", true);
    await db.createIntegerAttribute(DATABASE_ID, "epochs", "unique_senders", true);
    await db.createDatetimeAttribute(DATABASE_ID, "epochs", "started_at", true);
    await db.createDatetimeAttribute(DATABASE_ID, "epochs", "voting_started_at", false);
    await db.createDatetimeAttribute(DATABASE_ID, "epochs", "executed_at", false);
    await db.createIntegerAttribute(DATABASE_ID, "epochs", "final_burn", true);
    await db.createIntegerAttribute(DATABASE_ID, "epochs", "final_lottery", true);
    await db.createIntegerAttribute(DATABASE_ID, "epochs", "final_dev", true);
    await db.createIntegerAttribute(DATABASE_ID, "epochs", "final_board", true);
    await db.createStringAttribute(DATABASE_ID, "epochs", "director_fees", 65000, false); // JSON
    await db.createStringAttribute(DATABASE_ID, "epochs", "hypothesis_winner", 16, false);

    console.log("  ✅ epochs attributes created");
  } catch (e) {
    if (e.code === 409) {
      console.log("  ⚠️  epochs collection already exists");
    } else {
      throw e;
    }
  }

  // ─── Votes Collection ────────────────────────────────────────────────
  console.log("Creating 'votes' collection...");

  try {
    await db.createCollection(DATABASE_ID, "votes", "votes");
    console.log("  ✅ votes collection created");

    await db.createStringAttribute(DATABASE_ID, "votes", "epoch_id", 36, true);
    await db.createIntegerAttribute(DATABASE_ID, "votes", "epoch_number", true);
    await db.createStringAttribute(DATABASE_ID, "votes", "voter_wallet", 64, true);
    await db.createStringAttribute(DATABASE_ID, "votes", "voter_user_id", 36, true);
    await db.createIntegerAttribute(DATABASE_ID, "votes", "burn_rate", true);
    await db.createIntegerAttribute(DATABASE_ID, "votes", "lottery_rate", true);
    await db.createIntegerAttribute(DATABASE_ID, "votes", "dev_rate", true);
    await db.createIntegerAttribute(DATABASE_ID, "votes", "board_rate", true);
    await db.createDatetimeAttribute(DATABASE_ID, "votes", "created_at", true);

    console.log("  ✅ votes attributes created");
  } catch (e) {
    if (e.code === 409) {
      console.log("  ⚠️  votes collection already exists");
    } else {
      throw e;
    }
  }

  console.log("\nDone. Collections ready.");
}

main().catch(console.error);
