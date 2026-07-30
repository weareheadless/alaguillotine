import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

export function verifyMessageSignature(
  walletAddress: string,
  message: string,
  signatureBase58: string,
): boolean {
  try {
    const pk = new PublicKey(walletAddress);
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signatureBase58);
    return nacl.sign.detached.verify(msgBytes, sigBytes, pk.toBytes());
  } catch {
    return false;
  }
}

export function buildVoteMessage(proposalId: string, title: string): string {
  return `I vote for: ${title} (proposal ${proposalId})`;
}
