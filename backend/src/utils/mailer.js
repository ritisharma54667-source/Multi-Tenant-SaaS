// ============================================================
// MAILER UTILITY
// ============================================================
// Wraps nodemailer behind a single sendMail() call so the rest
// of the app never has to know whether SMTP is configured.
//
// - SMTP_HOST set in .env  → sends a real email via nodemailer
// - SMTP_HOST NOT set      → logs the email to the console instead
//
// This means the project runs out of the box with zero setup —
// invites/notifications still "work" (you'll see them in the
// backend terminal), and swapping in a real SMTP provider later
// is just filling in .env, no code changes.
// ============================================================

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

// ------------------------------------------------------------
// sendMail({ to, subject, text })
// ------------------------------------------------------------
// Returns { delivered, mode } — never throws. A failed real send
// falls back to a console log rather than breaking the caller's
// request (an invite/role-change should still succeed even if
// the notification email fails).
// ------------------------------------------------------------
export async function sendMail({ to, subject, text }) {
  const t = getTransporter();

  if (!t) {
    console.log(
      `\n[mailer] DEV MODE — no SMTP_HOST configured, logging instead of sending:\n` +
      `  To:      ${to}\n  Subject: ${subject}\n  Body:    ${text}\n`
    );
    return { delivered: false, mode: 'console' };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || 'no-reply@example.com',
      to,
      subject,
      text,
    });
    return { delivered: true, mode: 'smtp' };
  } catch (err) {
    console.error('[mailer] SMTP send failed, falling back to console log:', err.message);
    console.log(`[mailer] To: ${to} | Subject: ${subject} | Body: ${text}`);
    return { delivered: false, mode: 'error', error: err.message };
  }
}
