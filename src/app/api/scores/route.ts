import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_REASONABLE_SCORE = 10_000_000;

async function bestScore(userId: string): Promise<number> {
  const agg = await prisma.score.aggregate({
    where: { userId },
    _max: { value: true },
  });
  return agg._max.value ?? 0;
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ best: await bestScore(session.user.id) });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const value = (body as { value?: unknown })?.value;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_REASONABLE_SCORE
  ) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  await prisma.score.create({ data: { value, userId: session.user.id } });
  return NextResponse.json({ best: await bestScore(session.user.id) });
}
