import { Creem } from "creem";

// Use Creem's sandbox API unless CREEM_TEST_MODE is explicitly "false".
const testMode = process.env.CREEM_TEST_MODE !== "false";

export const CREEM_API_KEY = process.env.CREEM_API_KEY ?? "";

export const creem = new Creem({
  apiKey: CREEM_API_KEY,
  server: testMode ? "test" : "prod",
});

export type Plan = "monthly" | "yearly";

export function productIdForPlan(plan: Plan): string | undefined {
  return plan === "monthly"
    ? process.env.CREEM_PRODUCT_ID_MONTHLY
    : process.env.CREEM_PRODUCT_ID_YEARLY;
}

// Payments are usable only when both an API key and the requested product exist.
export function isCheckoutConfigured(plan: Plan): boolean {
  return Boolean(CREEM_API_KEY && productIdForPlan(plan));
}
