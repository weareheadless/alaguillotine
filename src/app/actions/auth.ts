"use server";

import { getSessionUserId } from "@/lib/session";
import { updateDisplayName, getUserById } from "@/lib/users";

export async function updateDisplayNameAction(name: string) {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("Not authenticated");
  updateDisplayName(userId, name.trim().slice(0, 30));
}

export async function getCurrentUserAction() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = getUserById(userId);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    wallet_address: user.wallet_address,
  };
}
