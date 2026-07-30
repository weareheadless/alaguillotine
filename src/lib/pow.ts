/**
 * Proof of Work utilities — shared between client and server.
 *
 * Server-side: uses Node crypto (createChallenge)
 * Client-side: uses Web Crypto API (solveChallenge)
 * Both sides: verifySolution (pure computation, works everywhere)
 *
 * ⚠️ crypto.subtle only works on localhost and HTTPS.
 * ⚠️ Do NOT import Node-only modules in this file.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PowChallenge {
  challenge: string;  // hex
  difficulty: number; // number of leading zeros in hex
}

export interface PowSolution {
  challenge: string;
  nonce: string;      // hex
}

// ─── Server: Create Challenge ──────────────────────────────────────────────────

export function createChallenge(difficulty: number = 4): PowChallenge {
  // Uses Node.js crypto — only call from server
  const crypto = require("crypto");
  const challenge = crypto.randomBytes(16).toString("hex");
  return { challenge, difficulty };
}

// ─── Client: Solve Challenge ───────────────────────────────────────────────────

export async function solveChallenge(
  challenge: string,
  difficulty: number,
  onProgress?: (attempts: number) => void
): Promise<PowSolution> {
  let nonce = 0;
  const prefix = "0".repeat(difficulty);

  while (true) {
    const nonceHex = nonce.toString(16);
    const input = challenge + nonceHex;
    const hash = await sha256(input);
    if (hash.startsWith(prefix)) {
      return { challenge, nonce: nonceHex };
    }
    nonce++;
    if (nonce % 10000 === 0 && onProgress) {
      onProgress(nonce);
      // Yield to event loop so UI doesn't freeze
      await new Promise(r => setTimeout(r, 1));
    }
  }
}

// ─── Shared: Verify Solution ───────────────────────────────────────────────────

export async function verifySolution(
  challenge: string,
  nonce: string,
  difficulty: number
): Promise<boolean> {
  const input = challenge + nonce;
  const hash = await sha256(input);
  return hash.startsWith("0".repeat(difficulty));
}

// ─── Helper ────────────────────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  // Try Web Crypto API first (browser + Node.js 19+)
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    try {
      const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fall through to Node fallback
    }
  }

  // Fallback: Node.js crypto module (server-side, Node < 19)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHash } = require("crypto");
  return createHash("sha256").update(input).digest("hex");
}
