import { getDb } from "@/lib/local-db";
import crypto from "crypto";

export async function POST() {
  try {
    const challenge = crypto.randomBytes(16).toString("hex");
    const difficulty = 4;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 min TTL

    const db = getDb();
    db.prepare(
      "INSERT INTO pow_challenges (challenge, difficulty, created_at, expires_at) VALUES (?, ?, ?, ?)"
    ).run(challenge, difficulty, now.toISOString(), expiresAt.toISOString());

    return Response.json({ challenge, difficulty });
  } catch {
    return Response.json(
      { success: false, error: "Failed to create challenge." },
      { status: 500 }
    );
  }
}
