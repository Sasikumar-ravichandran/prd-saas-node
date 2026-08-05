const nodemailer = require('nodemailer');

// 1. Configure SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_PORT == 465, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Core Send Function
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
    throw new Error('Failed to dispatch email. Please check email configurations.');
  }
};

/**
 * BASE HTML TEMPLATE (Reused for all emails to maintain branding)
 */
const getBaseEmailTemplate = (title, contentHtml) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #334155; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding: 40px 0; }
        .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05); }
        .header { background: #0f172a; padding: 32px 24px; text-align: center; border-bottom: 3px solid #1976d2; }
        .content { padding: 36px 32px; text-align: center; }
        .heading { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 12px; letter-spacing: -0.5px; }
        .description { font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 28px; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        /* Utility classes */
        .btn { display: inline-block; background-color: #1976d2; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px; font-size: 15px; }
        .alert-box { background: #f8fafc; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.5; color: #475569; border: 1px solid #e2e8f0; margin-bottom: 20px; text-align: left;}
        .otp-box { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1976d2; padding: 20px 10px; margin: 0 auto 28px auto; display: block; max-width: 280px; }
      </style>
    </head>
    <body>
      <center class="wrapper">
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">
              <span style="color: #f8fafc !important;">Klinic</span><span style="color: #1976d2 !important;">Hub</span>
            </h1>
          </div>
          <div class="content">
            <h2 class="heading">${title}</h2>
            ${contentHtml}
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} KlinicHub. Secure Clinical Workspace. All rights reserved.
          </div>
        </div>
      </center>
    </body>
    </html>
  `;
};

/**
 * 1. OTP Email
 */
const getOtpEmailTemplate = (otp, purpose) => {
  const isSignup = purpose === 'SIGNUP_VERIFY';
  const title = isSignup ? 'Welcome to KlinicHub!' : 'Reset Your Password';
  const actionText = isSignup
    ? 'Thank you for registering your practice. Please use the secure verification code below to complete your clinic workspace setup:'
    : 'You requested a password reset for your KlinicHub account. Use the verification code below to securely set your new password:';

  const content = `
    <p class="description">${actionText}</p>
    <div class="otp-box">${otp}</div>
    <div class="alert-box" style="text-align: center;">
      This code will expire in <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.
    </div>
  `;

  return getBaseEmailTemplate(title, content);
};

/**
 * 2. Account Approved Email
 */
const sendAccountApprovedEmail = async (email, clinicName) => {
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
  
  const content = `
    <p class="description">
      Great news! Your workspace for <strong>${clinicName}</strong> has been successfully reviewed and approved by our admin team.
    </p>
    <p class="description" style="margin-bottom: 30px;">
      You can now log in, set up your branches, and start managing your clinical operations securely.
    </p>
    <a href="${loginUrl}" class="btn">Log In to Your Workspace</a>
  `;

  return sendEmail({
    to: email,
    subject: '🎉 Your KlinicHub Account is Approved!',
    html: getBaseEmailTemplate('Account Approved', content)
  });
};

/**
 * 3. Account Suspended Email
 */
const sendAccountSuspendedEmail = async (email, clinicName, reason = 'Pending review or terms violation') => {
  const content = `
    <p class="description">
      We are writing to inform you that the KlinicHub workspace for <strong>${clinicName}</strong> has been temporarily suspended.
    </p>
    <div class="alert-box" style="border-left: 4px solid #dc2626;">
      <strong>Reason for suspension:</strong><br/>
      ${reason}
    </div>
    <p class="description">
      While your account is suspended, your team will not be able to log in or access patient records. Please reply directly to this email to reach our support team and resolve this issue.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: '⚠️ Action Required: Account Suspended',
    html: getBaseEmailTemplate('<span style="color: #dc2626;">Account Suspended</span>', content)
  });
};

/**
 * 4. Account Deleted Email
 */
const sendAccountDeletedEmail = async (email, clinicName) => {
  const content = `
    <p class="description">
      This email is to confirm that the KlinicHub workspace for <strong>${clinicName}</strong> has been permanently closed and deleted from our system.
    </p>
    <div class="alert-box">
      All associated data, patient records, and billing histories have been securely erased in accordance with our data privacy and HIPAA compliance policies.
    </div>
    <p class="description">
      We are sorry to see you go. If this deletion was requested in error, please contact support immediately.
    </p>
  `;

  return sendEmail({
    to: email,
    subject: 'Your KlinicHub Account has been Closed',
    html: getBaseEmailTemplate('Account Closed', content)
  });
};

module.exports = { 
  sendEmail, 
  getOtpEmailTemplate,
  sendAccountApprovedEmail,
  sendAccountSuspendedEmail,
  sendAccountDeletedEmail
};