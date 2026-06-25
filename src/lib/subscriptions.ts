import { prisma } from "@/lib/prisma";

// Shared subscription persistence used by the Creem webhook and the
// post-checkout return handler (which confirms payment directly via the API,
// so access is granted even when webhooks can't reach the server, e.g. in
// local development).
//
// Two access models are supported:
//  - Recurring subscription products → status "active" (auto-renew).
//  - One-time payment products       → status "onetime" with a computed
//    currentPeriodEnd (monthly = +1 month, yearly = +1 year).

export function asId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

export function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// Access duration for one-time purchases, derived from the checkout plan.
export function periodEndForPlan(
  plan: string | undefined,
  from: Date = new Date(),
): Date | undefined {
  const d = new Date(from);
  if (plan === "monthly") {
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  if (plan === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  return undefined;
}

interface UpsertInput {
  creemSubscriptionId: string;
  userId?: string;
  creemCustomerId?: string;
  product?: string;
  currentPeriodEnd?: Date;
  status?: string;
}

export async function upsertSubscription({
  creemSubscriptionId,
  userId,
  creemCustomerId,
  product,
  currentPeriodEnd,
  status = "active",
}: UpsertInput): Promise<void> {
  if (!creemSubscriptionId) return;

  const existing = await prisma.subscription.findUnique({
    where: { creemSubscriptionId },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { creemSubscriptionId },
      data: {
        status,
        creemCustomerId: creemCustomerId ?? existing.creemCustomerId,
        product: product ?? existing.product,
        currentPeriodEnd: currentPeriodEnd ?? existing.currentPeriodEnd,
      },
    });
    return;
  }

  if (!userId) {
    console.error("[subscriptions] cannot create subscription without userId");
    return;
  }

  await prisma.subscription.create({
    data: {
      creemSubscriptionId,
      userId,
      creemCustomerId,
      product,
      status,
      currentPeriodEnd,
    },
  });
}

export async function setSubscriptionStatus(
  creemSubscriptionId: string,
  status: string,
): Promise<void> {
  await prisma.subscription.updateMany({
    where: { creemSubscriptionId },
    data: { status },
  });
}
