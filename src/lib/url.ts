/**
 * Turns what someone types ("example.com", "https://Example.com/pricing?x=1")
 * into a URL PageSpeed Insights can test, or explains why it can't.
 */
export function normalizeSiteUrl(input: string): { url: string; name: string } | { error: string } {
  const raw = input.trim();
  if (!raw) return { error: "Enter the address of a page." };

  let parsed: URL;
  try {
    parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { error: "That doesn't look like a web address." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { error: "Use an http:// or https:// address." };
  if (parsed.username || parsed.password) return { error: "Remove the username and password from the address." };

  const host = parsed.hostname.toLowerCase();
  // Google's servers run the test, so they must be able to reach the page.
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127|10|0)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.startsWith("[")
  ) {
    return { error: "This page isn't on the public internet, so Google can't test it." };
  }
  if (!host.includes(".") || host.endsWith(".")) return { error: "Include the full domain, like example.com." };

  parsed.hash = "";
  return { url: parsed.toString(), name: host.replace(/^www\./, "") };
}
