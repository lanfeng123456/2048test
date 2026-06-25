import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  asId,
  parseDate,
  periodEndForPlan,
  setSubscriptionStatus,
  upsertSubscription,
} from "@/lib/subscriptions";

// Verify the creem-signature header: HMAC-SHA256(rawBody, webhookSecret) in hex.
function verifySignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(computed);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type CreemObject = Record<string, unknown>;

interface CreemWebhook {
  eventType?: string;
  object?: CreemObject;
}

function resolveUserId(obj: CreemObject): string | undefined {
  const metadata = obj.metadata as { userId?: unknown } | undefined;
  if (metadata && typeof metadata.userId === "string") return metadata.userId;
  const requestId = obj.requestId ?? obj.request_id;
  return typeof requestId === "string" ? requestId : undefined;
}

// The subscription object is carried directly on subscription.* events or
// nested inside the checkout on checkout.completed.
function extractSubscription(
  eventType: string,
  obj: CreemObject,
): CreemObject | undefined {
  if (eventType.startsWith("subscription.")) return obj;
  const nested = obj.subscription;
  return nested && typeof nested === "object"
    ? (nested as CreemObject)
    : undefined;
}

async function handleEvent(eventType: string, obj: CreemObject): Promise<void> {
  switch (eventType) {
    case "subscription.active":
    case "subscription.paid": {
      const sub = extractSubscription(eventType, obj);
      if (!sub) break;
      await upsertSubscription({
        creemSubscriptionId: asId(sub.id) ?? "",
        userId: resolveUserId(sub) ?? resolveUserId(obj),
        creemCustomerId: asId(sub.customer),
        product: asId(sub.product),
        currentPeriodEnd:
          parseDate(sub.currentPeriodEndDate) ??
          parseDate((sub as Record<string, unknown>).current_period_end_date),
        status: "active",
      });
      break;
    }
    case "checkout.completed": {
      const sub = extractSubscription(eventType, obj);
      if (sub) {
        // Recurring subscription product.
        await upsertSubscription({
          creemSubscriptionId: asId(sub.id) ?? "",
          userId: resolveUserId(sub) ?? resolveUserId(obj),
          creemCustomerId: asId(sub.customer),
          product: asId(sub.product),
          currentPeriodEnd:
            parseDate(sub.currentPeriodEndDate) ??
            parseDate((sub as Record<string, unknown>).current_period_end_date),
          status: "active",
        });
        break;
      }
      // One-time payment product → grant timed access based on the plan.
      const metadata = obj.metadata as { plan?: unknown } | undefined;
      const plan = typeof metadata?.plan === "string" ? metadata.plan : undefined;
      const orderId = asId(obj.order) ?? asId(obj.id);
      if (orderId) {
        await upsertSubscription({
          creemSubscriptionId: orderId,
          userId: resolveUserId(obj),
          creemCustomerId: asId(obj.customer),
          product: asId(obj.product),
          currentPeriodEnd: periodEndForPlan(plan),
          status: "onetime",
        });
      }
      break;
    }
    case "subscription.canceled": {
      const id = asId(obj.id);
      if (id) await setSubscriptionStatus(id, "canceled");
      break;
    }
    case "subscription.expired": {
      const id = asId(obj.id);
      if (id) await setSubscriptionStatus(id, "expired");
      break;
    }
    default:
      break;
  }
}

export async function POST(request: Request) {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] CREEM_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("creem-signature");

  if (!verifySignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: CreemWebhook;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!event.eventType || !event.object) {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  try {
    await handleEvent(event.eventType, event.object);
  } catch (error) {
    console.error("[webhook] handler failed for", event.eventType, error);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
