import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  creem,
  isCheckoutConfigured,
  productIdForPlan,
  type Plan,
} from "@/lib/creem";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let plan: unknown;
  try {
    plan = (await request.json())?.plan;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (plan !== "monthly" && plan !== "yearly") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  if (!isCheckoutConfigured(plan as Plan)) {
    return NextResponse.json(
      { error: "支付尚未配置，请在 .env 中填写 Creem 凭据与产品 ID" },
      { status: 503 },
    );
  }

  const productId = productIdForPlan(plan as Plan)!;
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  try {
    const checkout = await creem.checkouts.create({
      productId,
      requestId: session.user.id,
      successUrl: `${baseUrl}/?checkout=success`,
      metadata: {
        userId: session.user.id,
        email: session.user.email,
        plan: plan as string,
      },
    });

    if (!checkout.checkoutUrl) {
      return NextResponse.json(
        { error: "Checkout URL missing in Creem response" },
        { status: 502 },
      );
    }

    return NextResponse.json({ checkoutUrl: checkout.checkoutUrl });
  } catch (error) {
    console.error("[checkout] create failed", error);
    return NextResponse.json({ error: "创建支付会话失败" }, { status: 502 });
  }
}
