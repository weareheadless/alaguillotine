import { verifyLogin } from "@/lib/users";
import { createSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return Response.json(
        { success: false, error: "Username and password are required." },
        { status: 400 }
      );
    }

    const user = verifyLogin(username, password);
    if (!user) {
      return Response.json(
        { success: false, error: "The blade rejects your credentials." },
        { status: 401 }
      );
    }

    await createSession(user.id);

    return Response.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        wallet_address: user.wallet_address,
        is_guest: user.is_guest,
      },
    });
  } catch {
    return Response.json(
      { success: false, error: "Something went wrong." },
      { status: 500 }
    );
  }
}
