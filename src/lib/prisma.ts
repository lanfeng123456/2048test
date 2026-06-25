import { PrismaClient } from "@prisma/client";

// When a proxy is configured (HTTP(S)_PROXY / ALL_PROXY — used to route Google
// OAuth and Creem fetch calls), Prisma's query engine also tries to tunnel its
// Postgres TCP connection through that proxy, which fails ("Can't reach
// database server"). Add the database host to NO_PROXY so the engine connects
// directly, while fetch still uses the proxy. Runs before the engine spawns.
function excludeDatabaseFromProxy(): void {
  const url = process.env.DATABASE_URL;
  const hasProxy = Boolean(
    process.env.ALL_PROXY ||
      process.env.all_proxy ||
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy,
  );
  if (!url || !hasProxy) return;

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }
  if (!host) return;

  const existing = process.env.NO_PROXY ?? process.env.no_proxy ?? "";
  const entries = existing
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!entries.includes(host)) entries.push(host);

  const value = entries.join(",");
  process.env.NO_PROXY = value;
  process.env.no_proxy = value;
}

excludeDatabaseFromProxy();

// Reuse a single PrismaClient across hot reloads in development to avoid
// exhausting database connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
