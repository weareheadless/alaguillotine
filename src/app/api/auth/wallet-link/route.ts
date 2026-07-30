import { getSessionUserId } from "@/lib/session";
import { linkWalletAddress } from "@/lib/users";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return Response.json({ success: false, error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json();
    const { wallet_address, signature, message } = body;

    if (!wallet_address || !signature || !message) {
      return Response.json(
        { success: false, error: "wallet_address, signature, and message are required." },
        { status: 400 }
      );
    }

    // Verify the signature
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
          { success: false, error: "Signature verification failed." },
          { status: 400 }
        );
      }
    } catch {
      return Response.json(
        { success: false, error: "Invalid signature or wallet address." },
        { status: 400 }
      );
    }

    linkWalletAddress(userId, wallet_address);

    return Response.json({ success: true });
  } catch {
    return Response.json(
      { success: false, error: "Something went wrong." },
      { status: 500 }
    );
  }
}
