import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from 'resend';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Route for sending invitations
  app.post("/api/invite", async (req, res) => {
    const { email, householdName, inviteLink, invitedBy } = req.body;

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: "Email service not configured. Please add RESEND_API_KEY to environment variables." });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.SENDER_EMAIL || 'onboarding@resend.dev',
        to: email,
        subject: `You've been invited to join ${householdName} on ChoreFlow!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h1 style="color: #4f46e5; font-size: 24px; font-weight: bold; margin-bottom: 16px;">Welcome to ChoreFlow!</h1>
            <p style="color: #475569; font-size: 16px; line-height: 24px;">
              <strong>${invitedBy}</strong> has invited you to join their household, <strong>${householdName}</strong>, on ChoreFlow.
            </p>
            <p style="color: #475569; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
              ChoreFlow helps families and households organize their chores with ease. Click the button below to join the household and start tracking your tasks!
            </p>
            <a href="${inviteLink}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Join Household
            </a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
              This invitation will expire in 3 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `,
      });

      if (error) {
        return res.status(400).json({ error });
      }

      res.status(200).json({ success: true, data });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
