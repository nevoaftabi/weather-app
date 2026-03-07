import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_APP_PASSWORD,
  },
});

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: "Verify your Weather App account",
    text: `Your verification code is ${code}. It expires in ${env.VERIFICATION_CODE_TTL_MINUTES} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Verify your Weather App account</h2>
        <p>Your verification code is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>This code expires in ${env.VERIFICATION_CODE_TTL_MINUTES} minutes.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: "Reset your Weather App password",
    text: `Your password reset code is ${code}. It expires in ${env.VERIFICATION_CODE_TTL_MINUTES} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Reset your Weather App password</h2>
        <p>Your password reset code is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>This code expires in ${env.VERIFICATION_CODE_TTL_MINUTES} minutes.</p>
      </div>
    `,
  });
}

export async function sendFeedbackEmail(fromEmail: string, subject: string, body: string): Promise<void> {
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to: env.GMAIL_USER,
    replyTo: fromEmail,
    subject: `[Weather App Feedback] ${subject}`,
    text: `From: ${fromEmail}\n\n${body}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p><strong>From:</strong> ${fromEmail}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr />
        <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${body}</pre>
      </div>
    `,
  });
}
