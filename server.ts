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
    const { email, groupName, inviteLink, invitedBy } = req.body;

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: "Email service not configured. Please add RESEND_API_KEY to environment variables." });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.SENDER_EMAIL || 'onboarding@resend.dev',
        to: email,
        subject: `You've been invited to join ${groupName} on ChoreFlow!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h1 style="color: #4f46e5; font-size: 24px; font-weight: bold; margin-bottom: 16px;">Welcome to ChoreFlow!</h1>
            <p style="color: #475569; font-size: 16px; line-height: 24px;">
              <strong>${invitedBy}</strong> has invited you to join their group, <strong>${groupName}</strong>, on ChoreFlow.
            </p>
            <p style="color: #475569; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
              ChoreFlow helps families and groups organize their chores with ease. Click the button below to join the group and start tracking your tasks!
            </p>
            <a href="${inviteLink}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Join Group
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

  // Auth Callback route for OAuth popups
  app.get(['/auth/callback', '/auth/callback/'], (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authenticating...</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #1e293b; }
            .spinner { border: 4px solid #e2e8f0; border-top: 4px solid #4f46e5; border-radius: 50%; width: 40px; height: 40px; animate: spin 1s linear infinite; margin-bottom: 20px; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <p>Authentication successful. Closing this window...</p>
          <script>
            // Notify the main application window
            if (window.opener) {
              window.opener.postMessage({ type: 'AUTH_COMPLETE' }, window.location.origin);
              // Small delay to ensure message is sent before closing
              setTimeout(() => window.close(), 500);
            } else {
              // Fallback if not opened as popup
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
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
