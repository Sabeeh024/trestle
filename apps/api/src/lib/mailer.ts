export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Writes mail to the console. Swap in an SMTP or API-backed Mailer in production. */
export const consoleMailer: Mailer = {
  async send({ to, subject, text }) {
    console.log(`[mail] to=${to} subject="${subject}"\n${text}`);
  },
};
