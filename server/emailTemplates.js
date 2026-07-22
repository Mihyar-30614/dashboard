// Builds subject/text/html for service down/up alert emails.
// Colors and fonts mirror web/src/theme.css so alerts feel like part of the app.

const COLORS = {
  bg: "#f4f1ea",
  panel: "#fffcf5",
  ink: "#15171c",
  muted: "#6c6a62",
  border: "#d9d4c5",
  accent: "#0f6b66",
  ok: "#1f7a3a",
  okSoft: "#e4f2e7",
  bad: "#b1241f",
  badSoft: "#fbe7e6",
};

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return "under a minute";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatTimestamp(date) {
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

// state: { transition: 'down'|'up', label, slug, healthUrl, failCount, threshold, downSince, now, dashboardUrl }
export function buildAlertEmail(state) {
  const {
    transition,
    label,
    slug,
    healthUrl,
    failCount,
    threshold,
    downSince,
    now = new Date(),
    dashboardUrl,
  } = state;

  const isDown = transition === "down";
  const color = isDown ? COLORS.bad : COLORS.ok;
  const colorSoft = isDown ? COLORS.badSoft : COLORS.okSoft;
  const statusWord = isDown ? "DOWN" : "RECOVERED";
  const name = label || slug;

  const subject = isDown
    ? `[dashboard] ${name} is DOWN`
    : `[dashboard] ${name} is back up`;

  const approxDownMin = threshold ? Math.round((threshold * 30) / 60) : null;
  const downtime = !isDown && downSince ? formatDuration(now - downSince) : null;

  const textLines = isDown
    ? [
        `${name} is DOWN`,
        ``,
        `Health checks failed ${failCount}/${threshold} times in a row (~${approxDownMin} min).`,
        healthUrl ? `Health check: ${healthUrl}` : null,
        `Detected: ${formatTimestamp(now)}`,
      ].filter((l) => l !== null)
    : [
        `${name} is back up`,
        ``,
        `Health check succeeded again after being down${downtime ? ` for ~${downtime}` : ""}.`,
        healthUrl ? `Health check: ${healthUrl}` : null,
        `Recovered: ${formatTimestamp(now)}`,
      ].filter((l) => l !== null);
  if (dashboardUrl) textLines.push(``, `Dashboard: ${dashboardUrl}`);
  const text = textLines.join("\n");

  const rows = [
    ["Service", esc(name)],
    ["Status", `<span style="color:${color};font-weight:600;">${statusWord}</span>`],
    isDown
      ? ["Failed checks", `${failCount} / ${threshold} (~${approxDownMin} min)`]
      : downtime
        ? ["Downtime", downtime]
        : null,
    healthUrl ? ["Health check", `<span style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">${esc(healthUrl)}</span>`] : null,
    [isDown ? "Detected" : "Recovered", `<span style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">${formatTimestamp(now)}</span>`],
  ].filter(Boolean);

  const rowsHtml = rows
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.muted};font-size:12px;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;vertical-align:top;">${k}</td>
        <td style="padding:9px 0 9px 16px;border-bottom:1px solid ${COLORS.border};color:${COLORS.ink};font-size:14px;">${v}</td>
      </tr>`,
    )
    .join("");

  const button = dashboardUrl
    ? `
      <tr>
        <td style="padding-top:22px;">
          <a href="${esc(dashboardUrl)}" style="display:inline-block;background:${COLORS.ink};color:${COLORS.bg};text-decoration:none;font-size:13px;font-weight:500;padding:11px 20px;border-radius:8px;">View dashboard</a>
        </td>
      </tr>`
    : "";

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${COLORS.panel};border:1px solid ${COLORS.border};border-radius:14px;overflow:hidden;">
        <tr>
          <td style="height:6px;background:${color};line-height:6px;font-size:0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:${colorSoft};color:${color};font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;">
              ${statusWord}
            </div>
            <h1 style="margin:14px 0 0;font-family:'Fraunces',Georgia,'Times New Roman',serif;font-weight:500;font-size:26px;line-height:1.2;color:${COLORS.ink};">
              ${isDown ? "Service is down" : "Service recovered"}
            </h1>
            <p style="margin:6px 0 0;color:${COLORS.muted};font-size:14px;">
              ${esc(name)} <span style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">(${esc(slug)})</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${rowsHtml}
              ${button}
            </table>
          </td>
        </tr>
      </table>
      <p style="max-width:520px;margin:16px auto 0;color:${COLORS.muted};font-size:11px;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;">
        dashboard health monitor
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
