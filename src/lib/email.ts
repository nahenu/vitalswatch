import "server-only";

interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends email through Resend when RESEND_API_KEY is set. Without it,
 * development prints the message to the server console so password reset and
 * slowdown alerts can still be tested. In production nothing sensitive is
 * logged: a reset link is as good as a password.
 */
export async function sendEmail(email: Email): Promise<void> {
  // End-to-end tests read emails from a file instead of an inbox. Set only by the test server.
  const outbox = process.env.EMAIL_OUTBOX_FILE;
  if (outbox) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(outbox, `${JSON.stringify({ to: email.to, subject: email.subject, text: email.text })}\n`);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n[email] To: ${email.to}\n[email] Subject: ${email.subject}\n${email.text}\n`);
    } else {
      console.error("[email] RESEND_API_KEY is not set; an email could not be sent.");
    }
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "VitalsWatch <onboarding@resend.dev>",
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (!response.ok) console.error(`[email] Resend responded ${response.status}`);
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const wrap = (body: string) =>
  `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;color:#18181b">${body}</div>`;
const button = (href: string, label: string) =>
  `<p><a href="${escapeHtml(href)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${label}</a></p>`;
const note = (text: string) => `<p style="color:#71717a;font-size:13px">${text}</p>`;

export function resetPasswordEmail(name: string, url: string): Omit<Email, "to"> {
  return {
    subject: "Reset your VitalsWatch password",
    text: `Hi ${name || "there"},\n\nSomeone asked to reset the password for your VitalsWatch account. If it was you, open this link within an hour:\n\n${url}\n\nIf it wasn't, you can ignore this email. Your password won't change.`,
    html: wrap(
      `<p style="font-size:18px;font-weight:600">Reset your password</p>
  <p>Hi ${escapeHtml(name || "there")}, someone asked to reset the password for your VitalsWatch account. If it was you, use the button below within an hour.</p>
  ${button(url, "Choose a new password")}
  ${note("If it wasn't you, ignore this email. Your password won't change.")}`,
    ),
  };
}

export function regressionEmail(p: {
  name: string;
  siteName: string;
  siteUrl: string;
  baseline: number;
  latest: number;
  link: string;
}): Omit<Email, "to"> {
  const baseline = Math.round(p.baseline);
  const drop = baseline - p.latest;
  return {
    subject: `${p.siteName} got slower: mobile score ${baseline} → ${p.latest}`,
    text: `Hi ${p.name || "there"},\n\nThe mobile Lighthouse score for ${p.siteUrl} dropped ${drop} points, from a recent median of ${baseline} to ${p.latest}.\n\nSee what changed: ${p.link}\n\nYou get this email when a score falls past the threshold you set for this site.`,
    html: wrap(
      `<p style="font-size:18px;font-weight:600">${escapeHtml(p.siteName)} got slower</p>
  <p>The mobile Lighthouse score for ${escapeHtml(p.siteUrl)} dropped <b>${drop} points</b>, from a recent median of ${baseline} to <b style="color:#c93434">${p.latest}</b>.</p>
  ${button(p.link, "See what changed")}
  ${note("You get this email when a score falls past the threshold you set for this site.")}`,
    ),
  };
}
