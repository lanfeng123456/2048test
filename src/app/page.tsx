import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Game from "@/components/Game";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const agg = await prisma.score.aggregate({
    where: { userId: session.user.id },
    _max: { value: true },
  });

  return (
    <Game
      userName={session.user.name || session.user.email}
      initialBest={agg._max.value ?? 0}
    />
  );
}
