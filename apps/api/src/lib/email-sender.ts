import { createTransport } from 'nodemailer';

const SMTP_TIMEOUT_MS = 10_000;

export interface Email {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(email: Email): Promise<void>;
}

export function smtpEmailSender({ url, from }: { url: string; from: string }): EmailSender {
  const transport = createTransport({
    url,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
  return {
    async send(email) {
      await transport.sendMail({ from, ...email });
    },
  };
}
