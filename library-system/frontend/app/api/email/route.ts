import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type EmailBridgePayload = {
  to?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
};

const getRequiredEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is not configured.`);
  }
  return value;
};

const normalizeRecipients = (value: string | string[] | undefined): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildTransport = () => {
  const user = getRequiredEnv('MAILER_GMAIL_USER');
  const pass = getRequiredEnv('MAILER_GMAIL_APP_PASSWORD').replace(/\s+/g, '');

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });
};

export async function POST(request: Request) {
  const expectedSecret = process.env.EMAIL_BRIDGE_SECRET?.trim();
  const actualSecret = request.headers.get('x-email-bridge-secret')?.trim();

  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'EMAIL_BRIDGE_SECRET is not configured.' },
      { status: 500 },
    );
  }

  if (!actualSecret || actualSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let payload: EmailBridgePayload;
  try {
    payload = (await request.json()) as EmailBridgePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const recipients = normalizeRecipients(payload.to);
  if (!recipients.length) {
    return NextResponse.json({ error: '`to` is required.' }, { status: 400 });
  }

  const subject = payload.subject?.trim();
  if (!subject) {
    return NextResponse.json({ error: '`subject` is required.' }, { status: 400 });
  }

  const text = payload.text?.trim() ?? '';
  const html = payload.html?.trim() ?? '';
  if (!text && !html) {
    return NextResponse.json(
      { error: 'Either `text` or `html` content is required.' },
      { status: 400 },
    );
  }

  try {
    const transport = buildTransport();
    const fromEmail = process.env.MAILER_FROM_EMAIL?.trim() || getRequiredEnv('MAILER_GMAIL_USER');
    const fromName = process.env.MAILER_FROM_NAME?.trim() || 'Salazar Library';

    const info = await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipients,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
    });

    return NextResponse.json(
      {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Email bridge failed', error);
    return NextResponse.json(
      { error: 'Failed to send email.' },
      { status: 502 },
    );
  }
}
