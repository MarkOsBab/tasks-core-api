import type { SESv2Client } from '@aws-sdk/client-sesv2';
import { env, optionalEnv } from './env';

// Lazy SES client. The `@aws-sdk/client-sesv2` module (~several MB) is `import()`-ed on first
// send, NOT at module load — so hot paths that only transitively import this file (e.g. task
// routes -> notification.service -> mailer) don't pull the SDK into their cold-start init.
// Credentials are resolved by the AWS SDK default chain: the shared ~/.aws/credentials profile
// locally, or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in production.
let client: SESv2Client | null = null;
async function sesClient(): Promise<SESv2Client> {
  if (!client) {
    const { SESv2Client } = await import('@aws-sdk/client-sesv2');
    client = new SESv2Client({ region: env('AWS_REGION', 'us-east-1') });
  }
  return client;
}

/** Email delivery is opt-in via env, so the feature ships dark until the SES domain is verified. */
export function emailEnabled(): boolean {
  return optionalEnv('NOTIFICATIONS_EMAIL_ENABLED') === 'true';
}

function allowedRecipientDomains(): string[] {
  return (optionalEnv('SES_ALLOWED_RECIPIENT_DOMAINS') ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Sandbox guard: while the SES account is in sandbox it can only deliver to verified identities.
 * We verify the micelium.dev domain, so we cap recipients to it and skip everyone else (their
 * in-app notification still stands). An empty allow-list (once production access is granted) means
 * "no restriction".
 */
export function recipientAllowed(email: string): boolean {
  const domains = allowedRecipientDomains();
  if (domains.length === 0) return true;
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  return domains.includes(email.slice(at + 1).toLowerCase());
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Sends one email through SES. Throws on failure — callers treat delivery as best-effort. */
export async function sendMail({ to, subject, html, text }: MailInput): Promise<void> {
  const from = env('SES_FROM', 'Core Tasks <noreply@micelium.dev>');
  const { SendEmailCommand } = await import('@aws-sdk/client-sesv2');
  const ses = await sesClient();
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: html, Charset: 'UTF-8' },
            Text: { Data: text, Charset: 'UTF-8' },
          },
        },
      },
    }),
  );
}
