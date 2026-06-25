// Route Node's global fetch (undici) through an HTTP/HTTPS proxy when one is
// configured via env vars. Server-side calls to Google OAuth and the Creem API
// use fetch, which does NOT honour HTTP(S)_PROXY by default — without this the
// requests fail with ConnectTimeoutError in proxied networks. No-op in
// production environments where no proxy variable is set.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;

  if (!proxyUrl) return;

  // Non-analyzable specifier + webpackIgnore so webpack does not try to bundle
  // undici (it imports node: built-ins); Node resolves it at runtime instead.
  const moduleName = "undici";
  const undici = await import(/* webpackIgnore: true */ moduleName);
  undici.setGlobalDispatcher(new undici.ProxyAgent(proxyUrl));
  // eslint-disable-next-line no-console
  console.log(`[instrumentation] fetch proxy enabled -> ${proxyUrl}`);
}
