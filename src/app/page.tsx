import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/entitlement";
import Game from "@/components/Game";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const { checkout } = await searchParams;

  const [agg, entitlement] = await Promise.all([
    prisma.score.aggregate({
      where: { userId: session.user.id },
      _max: { value: true },
    }),
    getEntitlement(session.user.id),
  ]);

  return (
    <Game
      userName={session.user.name || session.user.email}
      initialBest={agg._max.value ?? 0}
      entitlement={{
        subscribed: entitlement.subscribed,
        freeGamesRemaining: entitlement.subscribed
          ? null
          : entitlement.freeGamesRemaining,
      }}
      checkoutSuccess={checkout === "success"}
    />
  );
}
