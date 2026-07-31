import { getSessionUserId } from "@/lib/session";
import { createSession } from "@/lib/session";
import { getUserByWallet, createUser } from "@/lib/users";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet_address, signature, message } = body;

    if (!wallet_address || !signature || !message) {
      return Response.json(
        { success: false, error: "wallet_address, signature, and message are required." },
        { status: 400 }
      );
    }

    // Verify the Ed25519 signature
    try {
      const publicKey = new PublicKey(wallet_address);
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const verified = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes()
      );

      if (!verified) {
        return Response.json(
          { success: false, error: "Signature verification failed. The blade rejects you." },
          { status: 400 }
        );
      }
    } catch {
      return Response.json(
        { success: false, error: "Invalid signature or wallet address." },
        { status: 400 }
      );
    }

    // Look up user by wallet address
    let user = getUserByWallet(wallet_address);

    // Auto-register if no account exists for this wallet
    if (!user) {
      // Derive a username from the wallet address (first 8 chars)
      const walletUsername = wallet_address.slice(0, 8);
      // Generate a random password the user will never use (login is via wallet)
      const randomPassword =
        require("crypto").randomBytes(24).toString("base64url");

      try {
        user = createUser(walletUsername, randomPassword);
      } catch {
        // If username collision (extremely unlikely with 8-char base58),
        // append last 4 chars of wallet
        const altUsername = wallet_address.slice(0, 6) + wallet_address.slice(-4);
        user = createUser(altUsername, randomPassword);
      }
    }

    // Also link wallet if not already linked (covers case where user registered
    // via username/password and is now logging in with wallet for the first time)
    if (!user.wallet_address) {
      const { linkWalletAddress } = await import("@/lib/users");
      linkWalletAddress(user.id, wallet_address);
    }

    // If already logged in with a different account, that's fine — wallet login
    // always creates a session for the wallet-linked account.

    // Create session
    await createSession(user.id);

    return Response.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        wallet_address: wallet_address,
        is_guest: false,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
