import { createUser } from "@/lib/users";
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

    const user = createUser(username, password);
    await createSession(user.id);

    return Response.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    const status = message.includes("already taken") ? 409 : 400;
    return Response.json({ success: false, error: message }, { status });
  }
}
