import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "false") === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM = {
  address: process.env.FROM_EMAIL || "no-reply@mihyarmas.com",
  name: process.env.FROM_EMAIL_NAME || "Dashboard",
};

let mailer = null;

function getMailer() {
  if (mailer) return mailer;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return mailer;
}

export function alertRecipient() {
  return process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL || null;
}

export async function sendAlertEmail(subject, text, html) {
  const to = alertRecipient();
  const transport = getMailer();
  if (!transport || !to) {
    console.warn(`alert_email_skipped (smtp or recipient unconfigured): ${subject}`);
    return;
  }
  await transport.sendMail({ from: FROM, to, subject, text, ...(html ? { html } : {}) });
  console.info(`alert_email_sent to=${to} subject=${JSON.stringify(subject)}`);
}
