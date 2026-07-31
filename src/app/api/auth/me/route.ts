import { getSessionUserId } from "@/lib/session";
import { getUserById, updateDisplayName } from "@/lib/users";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return Response.json({ user: null });
    }

    const user = getUserById(userId);
    if (!user) {
      return Response.json({ user: null });
    }

    return Response.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        wallet_address: user.wallet_address,
        is_guest: user.is_guest,
      },
    });
  } catch {
    return Response.json({ user: null });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return Response.json({ success: false, error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json();
    const { display_name } = body;

    if (!display_name || typeof display_name !== "string") {
      return Response.json({ success: false, error: "Display name is required." }, { status: 400 });
    }

    updateDisplayName(userId, display_name);

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "Something went wrong." }, { status: 500 });
  }
}
