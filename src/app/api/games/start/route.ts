import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FREE_GAME_LIMIT, isSubscribed } from "@/lib/entitlement";

// Called by the client before each new game. Subscribers play freely; everyone
// else is allowed up to FREE_GAME_LIMIT games, counted atomically.
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  if (await isSubscribed(userId)) {
    return NextResponse.json({ subscribed: true, freeGamesRemaining: null });
  }

  // Increment only while under the limit — the WHERE clause makes this safe
  // against concurrent requests without a transaction.
  const updated = await prisma.user.updateMany({
    where: { id: userId, freeGamesUsed: { lt: FREE_GAME_LIMIT } },
    data: { freeGamesUsed: { increment: 1 } },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: "free_limit_reached", subscribed: false, freeGamesRemaining: 0 },
      { status: 402 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { freeGamesUsed: true },
  });
  const remaining = Math.max(0, FREE_GAME_LIMIT - (user?.freeGamesUsed ?? FREE_GAME_LIMIT));

  return NextResponse.json({ subscribed: false, freeGamesRemaining: remaining });
}
