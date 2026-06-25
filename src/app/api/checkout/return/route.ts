import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { creem, CREEM_API_KEY } from "@/lib/creem";
import {
  asId,
  parseDate,
  periodEndForPlan,
  upsertSubscription,
} from "@/lib/subscriptions";

// Creem redirects here after checkout (success_url). Because webhooks cannot
// reach localhost in development, we confirm the payment directly via the API
// and grant access, then send the user back to the game.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = process.env.BETTER_AUTH_URL ?? url.origin;
  const checkoutId = url.searchParams.get("checkout_id");

  try {
    if (checkoutId && CREEM_API_KEY) {
      const checkout = await creem.checkouts.retrieve(checkoutId);

      const metadata = checkout.metadata as
        | { userId?: unknown; plan?: unknown }
        | undefined;
      const plan =
        typeof metadata?.plan === "string" ? metadata.plan : undefined;

      const session = await auth.api.getSession({ headers: await headers() });
      const userId =
        (typeof metadata?.userId === "string" ? metadata.userId : undefined) ??
        checkout.requestId ??
        session?.user.id;

      const subField = checkout.subscription;
      const subscription =
        subField && typeof subField === "object" ? subField : undefined;
      const subscriptionId = asId(subField);

      const completed = checkout.status === "completed";

      if (subscriptionId) {
        // Recurring subscription product.
        await upsertSubscription({
          creemSubscriptionId: subscriptionId,
          userId,
          creemCustomerId: asId(checkout.customer ?? subscription?.customer),
          product: asId(checkout.product ?? subscription?.product),
          currentPeriodEnd: parseDate(
            (subscription as Record<string, unknown> | undefined)
              ?.currentPeriodEndDate,
          ),
          status: "active",
        });
      } else if (completed) {
        // One-time payment product → grant timed access based on the plan.
        const orderId = asId(checkout.order) ?? checkout.id;
        await upsertSubscription({
          creemSubscriptionId: orderId,
          userId,
          creemCustomerId: asId(checkout.customer),
          product: asId(checkout.product),
          currentPeriodEnd: periodEndForPlan(plan),
          status: "onetime",
        });
      }
    }
  } catch (error) {
    console.error("[checkout/return] confirmation failed", error);
    // Fall through — the webhook remains a backup path.
  }

  return NextResponse.redirect(`${baseUrl}/?checkout=success`);
}
