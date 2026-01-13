import { Resend } from 'resend';

// Initialize Resend with API Key (Use environment variable in production)
const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY || 're_123456789');

export const EmailService = {
    async sendWelcome(userEmail: string, userName: string, isPro: boolean) {
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #000;">Welcome to AI Management, ${userName}!</h2>
    <p>We are thrilled to have you on board. At 3DVolt, we believe in <strong>Privacy-First</strong> AI.</p>
    
    <div style="border-left: 4px solid #000; padding-left: 15px; margin: 20px 0; background-color: #f9f9f9; padding: 15px;">
        <h4 style="margin-top: 0;">Our Privacy Pledge</h4>
        <p style="margin-bottom: 0;">Your data stays on your device. We never see your files, camera feed, or logs. You hold the keys to your digital life.</p>
    </div>
    
    ${isPro ? `
    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bae6fd;">
      <h3 style="margin-top: 0; color: #0284c7;">🚀 Pro Member Access</h3>
      <p>As a Pro user, you have unlocked Advanced Business Tools:</p>
      <ul style="color: #0369a1;">
        <li>Automated Invoice Processing</li>
        <li>Multi-Camera Vision Support</li>
        <li>Extended Context Window (128k)</li>
      </ul>
    </div>
    ` : ''}

    <p>Get started by exploring your local dashboard.</p>
    
    <div style="text-align: center; margin-top: 30px;">
        <a href="https://www.3dvolt.com" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Visit 3DVolt.com</a>
    </div>
    
    <p style="font-size: 12px; color: #888; margin-top: 30px; text-align: center;">AI Management by 3dvolt - Local First. Privacy Always.</p>
  </div>
</body>
</html>
        `;

        // In a real client-side app, you would typically call a backend endpoint here
        // to avoid exposing the API key. For this implementation, we use the SDK directly.
        return await resend.emails.send({
            from: 'AI Management <onboarding@3dvolt.com>',
            to: [userEmail],
            subject: 'Welcome to Privacy-First AI Management',
            html: htmlContent
        });
    }
};