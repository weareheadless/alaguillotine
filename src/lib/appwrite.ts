/**
 * @deprecated Appwrite auth is being replaced by local session-based auth.
 * This file is kept temporarily until full migration is complete.
 * DO NOT add new Appwrite-dependent code.
 */

import { Client, Account, Databases } from "appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "";

function createClient() {
  return new Client().setEndpoint(endpoint).setProject(projectId);
}

const browserClient = createClient();
const browserAccount = new Account(browserClient);
const browserDatabases = new Databases(browserClient);

export { browserClient as client, browserAccount as account, browserDatabases as databases };

// Database constants
export const DATABASE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ||
  process.env.APPWRITE_DATABASE_ID ||
  "";
export const MESSAGES_COLLECTION_ID =
  process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID ||
  process.env.APPWRITE_MESSAGES_COLLECTION_ID ||
  "";
export const NOMINATIONS_COLLECTION_ID =
  process.env.NEXT_PUBLIC_APPWRITE_NOMINATIONS_COLLECTION_ID ||
  process.env.APPWRITE_NOMINATIONS_COLLECTION_ID ||
  "nominations";
export const EPOCHS_COLLECTION_ID =
  process.env.NEXT_PUBLIC_APPWRITE_EPOCHS_COLLECTION_ID ||
  process.env.APPWRITE_EPOCHS_COLLECTION_ID ||
  "epochs";
export const VOTES_COLLECTION_ID =
  process.env.NEXT_PUBLIC_APPWRITE_VOTES_COLLECTION_ID ||
  process.env.APPWRITE_VOTES_COLLECTION_ID ||
  "votes";

