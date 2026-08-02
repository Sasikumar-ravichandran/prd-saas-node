const nodemailer = require('nodemailer');

// 1. Configure SMTP Transporter using Environment Variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_PORT == 465, // true for port 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email
 * @param {Object} options - { to, subject, html }
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const senderEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;

    const mailOptions = {
      from: `"KlinicHub" <${senderEmail}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Success] Sent message ID: ${info.messageId} to ${to}`);
    return true;
  } catch (error) {
    console.error('[Email Error] Failed to send email:', error);
    throw new Error('Failed to dispatch verification email. Please check email configurations.');
  }
};

/**
 * Professional SaaS HTML Template for OTPs
 */
const getOtpEmailTemplate = (otp, purpose) => {
  const isSignup = purpose === 'SIGNUP_VERIFY';
  const title = isSignup ? 'Welcome to KlinicHub!' : 'Reset Your Password';
  const actionText = isSignup
    ? 'Thank you for registering your practice. Please use the secure verification code below to complete your clinic workspace setup:'
    : 'You requested a password reset for your KlinicHub account. Use the verification code below to securely set your new password:';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
          background-color: #f1f5f9; 
          margin: 0; 
          padding: 0; 
          color: #334155; 
        }
        .wrapper {
          width: 100%;
          table-layout: fixed;
          background-color: #f1f5f9;
          padding: 40px 0;
        }
        .container { 
          max-width: 480px; 
          margin: 0 auto; 
          background: #ffffff; 
          border-radius: 16px; 
          overflow: hidden; 
          border: 1px solid #e2e8f0; 
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
        }
        .header { 
          background: #0f172a; 
          padding: 32px 24px; 
          text-align: center; 
          border-bottom: 3px solid #1976d2;
        }
        .content { 
          padding: 36px 32px; 
          text-align: center; 
        }
        .heading {
          font-size: 20px; 
          font-weight: 800;
          color: #0f172a; 
          margin-top: 0;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }
        .description {
          font-size: 15px; 
          color: #475569; 
          line-height: 1.6;
          margin-bottom: 28px;
        }
        .otp-box { 
          background: #f8fafc; 
          border: 2px dashed #cbd5e1; 
          border-radius: 12px; 
          font-size: 36px; 
          font-weight: 800; 
          letter-spacing: 8px; 
          color: #1976d2; 
          padding: 20px 10px; 
          margin: 0 auto 28px auto; 
          display: block;
          max-width: 280px;
        }
        .expiry-text {
          font-size: 13px; 
          color: #64748b; 
          line-height: 1.5;
          margin: 0;
          background: #f8fafc;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
        }
        .footer { 
          background: #f8fafc; 
          padding: 20px; 
          text-align: center; 
          font-size: 12px; 
          color: #94a3b8; 
          border-top: 1px solid #e2e8f0; 
        }
      </style>
    </head>
    <body>
      <center class="wrapper">
        <div class="container">
          
          <!-- Brand Header -->
          <div class="header">
            <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">
              <span style="color: #f8fafc !important;">Klinic</span><span style="color: #1976d2 !important;">Hub</span>
            </h1>
          </div>
          
          <!-- Main Body Content -->
          <div class="content">
            <h2 class="heading">${title}</h2>
            <p class="description">${actionText}</p>
            
            <div class="otp-box">${otp}</div>
            
            <div class="expiry-text">
              This code will expire in <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            &copy; ${new Date().getFullYear()} KlinicHub. Secure Clinical Workspace. All rights reserved.
          </div>
          
        </div>
      </center>
    </body>
    </html>
  `;
};

module.exports = { sendEmail, getOtpEmailTemplate };