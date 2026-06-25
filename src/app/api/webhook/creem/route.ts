import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

function asId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

function resolveUserId(obj: CreemObject): string | undefined {
  const metadata = obj.metadata as { userId?: unknown } | undefined;
  if (metadata && typeof metadata.userId === "string") return metadata.userId;
  const requestId = obj.requestId ?? obj.request_id;
  return typeof requestId === "string" ? requestId : undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// Find the subscription object whether the event carries it directly
// (subscription.*) or nests it inside a checkout (checkout.completed).
function extractSubscription(eventType: string, obj: CreemObject): CreemObject | undefined {
  if (eventType.startsWith("subscription.")) return obj;
  const nested = obj.subscription;
  return nested && typeof nested === "object" ? (nested as CreemObject) : undefined;
}

async function markActive(sub: CreemObject, fallbackUserId?: string): Promise<void> {
  const creemSubscriptionId = asId(sub.id) ?? asId(sub);
  if (!creemSubscriptionId) return;

  const userId = resolveUserId(sub) ?? fallbackUserId;
  const creemCustomerId = asId(sub.customer);
  const product = asId(sub.product);
  const currentPeriodEnd =
    parseDate(sub.currentPeriodEndDate) ??
    parseDate((sub as Record<string, unknown>).current_period_end_date);

  const existing = await prisma.subscription.findUnique({
    where: { creemSubscriptionId },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { creemSubscriptionId },
      data: {
        status: "active",
        creemCustomerId: creemCustomerId ?? existing.creemCustomerId,
        product: product ?? existing.product,
        currentPeriodEnd: currentPeriodEnd ?? existing.currentPeriodEnd,
      },
    });
    return;
  }

  if (!userId) {
    console.error("[webhook] cannot create subscription without userId");
    return;
  }

  await prisma.subscription.create({
    data: {
      creemSubscriptionId,
      userId,
      creemCustomerId,
      product,
      status: "active",
      currentPeriodEnd,
    },
  });
}

async function markStatus(sub: CreemObject, status: string): Promise<void> {
  const creemSubscriptionId = asId(sub.id) ?? asId(sub);
  if (!creemSubscriptionId) return;
  await prisma.subscription.updateMany({
    where: { creemSubscriptionId },
    data: { status },
  });
}

async function handleEvent(eventType: string, obj: CreemObject): Promise<void> {
  switch (eventType) {
    case "checkout.completed":
    case "subscription.active":
    case "subscription.paid": {
      const sub = extractSubscription(eventType, obj);
      if (sub) await markActive(sub, resolveUserId(obj));
      break;
    }
    case "subscription.canceled":
      await markStatus(obj, "canceled");
      break;
    case "subscription.expired":
      await markStatus(obj, "expired");
      break;
    default:
      // Unhandled event types are acknowledged but ignored.
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
