import { prisma } from "@/lib/prisma";

export const FREE_GAME_LIMIT = 3;

// Subscription statuses that grant access. Creem sends these via webhooks.
const ACTIVE_STATUSES = new Set(["active", "trialing", "paid"]);

export interface Entitlement {
  subscribed: boolean;
  freeGamesUsed: number;
  freeGameLimit: number;
  freeGamesRemaining: number;
  /** True when a non-subscriber has games left or the user is subscribed. */
  canPlay: boolean;
}

export async function isSubscribed(userId: string): Promise<boolean> {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    select: { status: true, currentPeriodEnd: true },
  });

  const now = new Date();
  return subscriptions.some((sub) => {
    if (ACTIVE_STATUSES.has(sub.status)) return true;
    // Cancelled-but-not-yet-expired subscriptions keep access until period end.
    return (
      sub.status !== "expired" &&
      sub.currentPeriodEnd != null &&
      sub.currentPeriodEnd > now
    );
  });
}

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const [subscribed, user] = await Promise.all([
    isSubscribed(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { freeGamesUsed: true },
    }),
  ]);

  const freeGamesUsed = user?.freeGamesUsed ?? 0;
  const freeGamesRemaining = Math.max(0, FREE_GAME_LIMIT - freeGamesUsed);

  return {
    subscribed,
    freeGamesUsed,
    freeGameLimit: FREE_GAME_LIMIT,
    freeGamesRemaining,
    canPlay: subscribed || freeGamesRemaining > 0,
  };
}
