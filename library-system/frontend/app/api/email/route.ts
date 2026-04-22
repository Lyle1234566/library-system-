import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type EmailPayload = {
  // current backend field names
  to?: string | string[];
  text?: string;
  html?: string;
  // legacy field names (kept for compatibility)
  recipient?: string;
  textBody?: string;
  htmlBody?: string;
  subject?: string;
};

const getRequiredEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const buildTransport = () => {
  const user = getRequiredEnv('MAILER_GMAIL_USER');
  const pass = getRequiredEnv('MAILER_GMAIL_APP_PASSWORD').replace(/\s+/g, '');
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
};

const buildFrom = (): string => {
  const email = process.env.MAILER_FROM_EMAIL?.trim() || getRequiredEnv('MAILER_GMAIL_USER');
  const name = process.env.MAILER_FROM_NAME?.trim();
  return name ? `${name} <${email}>` : email;
};

const normalizeRecipients = (value: string | string[] | undefined): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((s) => s.trim()).filter(Boolean);
  return value.split(',').map((s) => s.trim()).filter(Boolean);
};

const formatError = (error: unknown): string => {
  if (!(error instanceof Error)) return 'Failed to send email.';
  const msg = error.message.trim();
  const low = msg.toLowerCase();
  const err = error as Error & { code?: string };
  if (msg.startsWith('Missing required environment variable:')) return msg;
  if (err.code === 'EAUTH' || low.includes('username and password not accepted') || low.includes('invalid login'))
    return 'Gmail authentication failed. Check MAILER_GMAIL_USER and MAILER_GMAIL_APP_PASSWORD.';
  if (low.includes('daily user sending quota exceeded'))
    return 'Gmail sending limit reached. Try again later.';
  return msg || 'Failed to send email.';
};

export async function GET() {
  return NextResponse.json({
    EMAIL_BRIDGE_SECRET: !!process.env.EMAIL_BRIDGE_SECRET,
    MAILER_GMAIL_USER: !!process.env.MAILER_GMAIL_USER,
    MAILER_GMAIL_APP_PASSWORD: !!process.env.MAILER_GMAIL_APP_PASSWORD,
  });
}

export async function POST(request: Request) {
  try {
    const expectedSecret = getRequiredEnv('EMAIL_BRIDGE_SECRET');
    const receivedSecret = request.headers.get('x-email-bridge-secret')?.trim();

    if (!receivedSecret || receivedSecret !== expectedSecret) {
      return NextResponse.json({ detail: 'Unauthorized email bridge request.' }, { status: 401 });
    }

    const body = (await request.json()) as EmailPayload;

    // Accept both current (to/text/html) and legacy (recipient/textBody/htmlBody) field names
    const recipients = normalizeRecipients(body.to ?? body.recipient);
    const subject = body.subject?.trim();
    const text = (body.text ?? body.textBody)?.trim() ?? '';
    const html = (body.html ?? body.htmlBody)?.trim() ?? '';

    if (!recipients.length) {
      return NextResponse.json({ detail: '`to` (or `recipient`) is required.' }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ detail: '`subject` is required.' }, { status: 400 });
    }
    if (!text && !html) {
      return NextResponse.json({ detail: 'Either `text`/`textBody` or `html`/`htmlBody` is required.' }, { status: 400 });
    }

    const transporter = buildTransport();
    await transporter.sendMail({
      from: buildFrom(),
      to: recipients,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
    });

    return NextResponse.json({ message: 'Email sent.' }, { status: 200 });
  } catch (error) {
    const message = formatError(error);
    console.error('Email bridge error:', message);
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
