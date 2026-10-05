"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = require("../config");
class EmailService {
    static transporter = null;
    static isTestAccount = false;
    /**
     * Initializes or returns the cached nodemailer transporter
     */
    static async getTransporter() {
        if (this.transporter)
            return this.transporter;
        if (config_1.config.email.user && config_1.config.email.pass) {
            // Production or custom SMTP credentials provided
            this.transporter = nodemailer_1.default.createTransport({
                host: config_1.config.email.host,
                port: config_1.config.email.port,
                secure: config_1.config.email.secure,
                auth: {
                    user: config_1.config.email.user,
                    pass: config_1.config.email.pass,
                },
            });
            console.log(`📧 [EMAIL SERVICE] Connected to SMTP: ${config_1.config.email.host}:${config_1.config.email.port} as ${config_1.config.email.user}`);
        }
        else {
            // Local development fallback: create automatic Ethereal test account
            try {
                const testAccount = await nodemailer_1.default.createTestAccount();
                this.transporter = nodemailer_1.default.createTransport({
                    host: 'smtp.ethereal.email',
                    port: 587,
                    secure: false,
                    auth: {
                        user: testAccount.user,
                        pass: testAccount.pass,
                    },
                });
                this.isTestAccount = true;
                console.log(`📧 [EMAIL SERVICE] Using Ethereal sandbox test account: ${testAccount.user}`);
            }
            catch (err) {
                // Fallback to JSON transport if offline
                this.transporter = nodemailer_1.default.createTransport({ jsonTransport: true });
                console.warn('📧 [EMAIL SERVICE] Running in offline JSON preview mode');
            }
        }
        return this.transporter;
    }
    /**
     * Internal helper to dispatch mail with error resilience
     */
    static async sendMail(options) {
        try {
            const transporter = await this.getTransporter();
            const mailOptions = {
                from: config_1.config.email.from,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            };
            const info = await transporter.sendMail(mailOptions);
            console.log(`📧 [EMAIL SENT] To: ${options.to} | Subject: "${options.subject}" | MessageId: ${info.messageId}`);
            if (this.isTestAccount) {
                const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
                if (previewUrl) {
                    console.log(`🔗 [EMAIL PREVIEW URL] View sent email online: ${previewUrl}`);
                }
            }
            return info;
        }
        catch (error) {
            console.error(`❌ [EMAIL ERROR] Failed to send email to ${options.to}:`, error.message);
            // Return null rather than throwing so banking transactions are not interrupted by mail delivery failure
            return null;
        }
    }
    /**
     * 1. REGISTER - Welcome Email with Account Details
     */
    static async sendWelcomeEmail(to, name, accountNumber, initialBalance) {
        const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0d11; color: #f4f4f5; border: 1px solid #27272a; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #18181b 0%, #09090b 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid #27272a;">
          <h1 style="margin: 0; color: #facc15; font-size: 24px; letter-spacing: 1px;">ZOORICH BANK</h1>
          <p style="margin: 6px 0 0 0; color: #a1a1aa; font-size: 13px;">Private Banking & Secure Vault Ledger</p>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="margin-top: 0; color: #ffffff; font-size: 20px;">Welcome to Zoorich, ${name}!</h2>
          <p style="color: #a1a1aa; line-height: 1.6; font-size: 14px;">
            Your new multi-currency checking account has been successfully provisioned on the immutable core ledger.
          </p>
          <div style="background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0; font-size: 13px;">Account Number:</td>
                <td style="color: #ffffff; font-weight: bold; text-align: right; font-family: monospace; font-size: 15px;">${accountNumber}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0; font-size: 13px;">Currency:</td>
                <td style="color: #ffffff; font-weight: bold; text-align: right; font-size: 13px;">USD ($)</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0; font-size: 13px;">Initial Balance:</td>
                <td style="color: #4ade80; font-weight: bold; text-align: right; font-size: 15px;">+$${initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0; font-size: 13px;">Status:</td>
                <td style="color: #facc15; font-weight: bold; text-align: right; font-size: 13px;">ACTIVE</td>
              </tr>
            </table>
          </div>
          <p style="color: #71717a; font-size: 12px; line-height: 1.5;">
            Security Notice: Never share your 6-digit Transaction PIN or password with anyone. Zoorich Bank officers will never ask for your confidential codes.
          </p>
        </div>
        <div style="background: #121215; padding: 16px 24px; text-align: center; border-top: 1px solid #27272a; color: #71717a; font-size: 11px;">
          &copy; 2026 Zoorich Bank Corp. All rights reserved. Automated security notification.
        </div>
      </div>
    `;
        return this.sendMail({
            to,
            subject: '🏦 Welcome to Zoorich Bank - Your Checking Account is Ready',
            html,
            text: `Welcome to Zoorich Bank, ${name}! Your account ${accountNumber} has been activated with balance $${initialBalance}.`,
        });
    }
    /**
     * 2. LOGIN - New Sign-in Security Notification
     */
    static async sendLoginAlert(to, name, ipAddress, userAgent) {
        const timestamp = new Date().toUTCString();
        const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0d11; color: #f4f4f5; border: 1px solid #27272a; border-radius: 12px; overflow: hidden;">
        <div style="background: #18181b; padding: 24px; border-bottom: 1px solid #27272a; text-align: center;">
          <h2 style="margin: 0; color: #38bdf8; font-size: 18px;">🛡️ Security Alert: New Sign-In Detected</h2>
        </div>
        <div style="padding: 24px;">
          <p style="color: #e4e4e7; font-size: 14px;">Dear ${name},</p>
          <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6;">
            A new login to your Zoorich Bank account was just authorized. Below are the access details:
          </p>
          <div style="background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px;">
            <p style="margin: 4px 0; color: #a1a1aa;"><strong>Timestamp:</strong> <span style="color: #f4f4f5;">${timestamp}</span></p>
            <p style="margin: 4px 0; color: #a1a1aa;"><strong>IP Address:</strong> <span style="color: #f4f4f5;">${ipAddress || '127.0.0.1'}</span></p>
            <p style="margin: 4px 0; color: #a1a1aa;"><strong>Device / Agent:</strong> <span style="color: #f4f4f5;">${userAgent || 'Web Browser'}</span></p>
          </div>
          <p style="color: #ef4444; font-size: 12px; line-height: 1.5;">
            If you did not initiate this login session, please freeze your cards and change your password immediately in your account settings.
          </p>
        </div>
        <div style="background: #121215; padding: 14px 24px; text-align: center; border-top: 1px solid #27272a; color: #71717a; font-size: 11px;">
          Zoorich Automated Security Surveillance Engine
        </div>
      </div>
    `;
        return this.sendMail({
            to,
            subject: '🛡️ Security Alert: New Login to Your Zoorich Account',
            html,
            text: `Hello ${name}, a new login to your Zoorich account occurred at ${timestamp} from IP ${ipAddress}.`,
        });
    }
    /**
     * 3. CREDIT ACCOUNT BALANCE - Notification when funds are deposited or received
     */
    static async sendBalanceCreditedAlert(to, name, amount, currency, newBalance, description, reference) {
        const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0d11; color: #f4f4f5; border: 1px solid #27272a; border-radius: 12px; overflow: hidden;">
        <div style="background: #18181b; padding: 24px; border-bottom: 1px solid #27272a; text-align: center;">
          <h2 style="margin: 0; color: #4ade80; font-size: 20px;">💰 Account Balance Credited</h2>
        </div>
        <div style="padding: 24px;">
          <p style="color: #e4e4e7; font-size: 14px;">Hello ${name},</p>
          <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6;">
            Your account has been credited with incoming funds. The transaction has posted to your ledger.
          </p>
          <div style="background: #18181b; border: 1px solid #166534; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <div style="font-size: 13px; color: #86efac; text-transform: uppercase; letter-spacing: 1px;">Amount Credited</div>
            <div style="font-size: 28px; font-weight: bold; color: #4ade80; margin: 8px 0;">+${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div style="font-size: 13px; color: #a1a1aa;">New Available Balance: <strong style="color: #ffffff;">${currency} ${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></div>
          </div>
          <div style="background: #121215; border: 1px solid #27272a; border-radius: 8px; padding: 14px; font-size: 12px; color: #a1a1aa;">
            <p style="margin: 4px 0;"><strong>Reference:</strong> <span style="font-family: monospace; color: #ffffff;">${reference || 'N/A'}</span></p>
            <p style="margin: 4px 0;"><strong>Description:</strong> ${description || 'Deposit / Inward Transfer'}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date().toUTCString()}</p>
          </div>
        </div>
        <div style="background: #121215; padding: 14px 24px; text-align: center; border-top: 1px solid #27272a; color: #71717a; font-size: 11px;">
          Zoorich Core Banking Ledger Notification
        </div>
      </div>
    `;
        return this.sendMail({
            to,
            subject: `💰 Credit Notice: +${currency} ${amount.toFixed(2)} received in your account`,
            html,
            text: `Hello ${name}, your account was credited +${currency} ${amount.toFixed(2)}. New balance: ${currency} ${newBalance.toFixed(2)}. Ref: ${reference}.`,
        });
    }
    /**
     * 4. DEDUCT ACCOUNT BALANCE - Notification when funds are withdrawn or transferred
     */
    static async sendBalanceDebitedAlert(to, name, amount, currency, newBalance, description, reference, fee) {
        const feeText = fee && fee > 0 ? ` (Includes fee of ${currency} ${fee.toFixed(2)})` : '';
        const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0d11; color: #f4f4f5; border: 1px solid #27272a; border-radius: 12px; overflow: hidden;">
        <div style="background: #18181b; padding: 24px; border-bottom: 1px solid #27272a; text-align: center;">
          <h2 style="margin: 0; color: #f87171; font-size: 20px;">💸 Account Balance Debited</h2>
        </div>
        <div style="padding: 24px;">
          <p style="color: #e4e4e7; font-size: 14px;">Hello ${name},</p>
          <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6;">
            A debit transaction has processed successfully from your Zoorich Bank account.
          </p>
          <div style="background: #18181b; border: 1px solid #991b1b; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <div style="font-size: 13px; color: #fca5a5; text-transform: uppercase; letter-spacing: 1px;">Amount Debited</div>
            <div style="font-size: 28px; font-weight: bold; color: #ef4444; margin: 8px 0;">-${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div style="font-size: 13px; color: #a1a1aa;">New Available Balance: <strong style="color: #ffffff;">${currency} ${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></div>
            ${feeText ? `<div style="font-size: 11px; color: #f87171; margin-top: 4px;">${feeText}</div>` : ''}
          </div>
          <div style="background: #121215; border: 1px solid #27272a; border-radius: 8px; padding: 14px; font-size: 12px; color: #a1a1aa;">
            <p style="margin: 4px 0;"><strong>Reference:</strong> <span style="font-family: monospace; color: #ffffff;">${reference || 'N/A'}</span></p>
            <p style="margin: 4px 0;"><strong>Description:</strong> ${description || 'Transfer / Cash Withdrawal'}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date().toUTCString()}</p>
          </div>
          <p style="color: #71717a; font-size: 12px; margin-top: 20px; line-height: 1.5;">
            If you do not recognize this transaction, please contact banking security or freeze your account immediately.
          </p>
        </div>
        <div style="background: #121215; padding: 14px 24px; text-align: center; border-top: 1px solid #27272a; color: #71717a; font-size: 11px;">
          Zoorich Core Banking Ledger Notification
        </div>
      </div>
    `;
        return this.sendMail({
            to,
            subject: `💸 Debit Notice: -${currency} ${amount.toFixed(2)} deducted from your account`,
            html,
            text: `Hello ${name}, your account was debited -${currency} ${amount.toFixed(2)}. New balance: ${currency} ${newBalance.toFixed(2)}. Ref: ${reference}.`,
        });
    }
    /**
     * 5. RESET PASSWORD - Send 6-digit OTP code to Email
     */
    static async sendPasswordResetOtp(to, name, otp) {
        const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0d11; color: #f4f4f5; border: 1px solid #27272a; border-radius: 12px; overflow: hidden;">
        <div style="background: #18181b; padding: 24px; border-bottom: 1px solid #27272a; text-align: center;">
          <h2 style="margin: 0; color: #facc15; font-size: 20px;">🔑 Password Reset Verification Code</h2>
        </div>
        <div style="padding: 32px 24px; text-align: center;">
          <p style="color: #e4e4e7; font-size: 15px; margin-bottom: 12px;">Hello ${name},</p>
          <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            We received a request to reset your Zoorich Bank online access password. Use the verification code below to proceed:
          </p>
          <div style="display: inline-block; background: #18181b; border: 2px dashed #facc15; border-radius: 10px; padding: 16px 36px; margin: 12px 0;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #facc15;">
              ${otp}
            </span>
          </div>
          <p style="color: #ef4444; font-size: 13px; margin-top: 20px;">
            ⏱️ This code will expire in <strong>10 minutes</strong>.
          </p>
          <p style="color: #71717a; font-size: 12px; margin-top: 20px; line-height: 1.5; text-align: left; background: #18181b; padding: 12px; border-radius: 6px;">
            ⚠️ If you did not request this password reset, please ignore this email or contact bank support immediately. Your password remains unchanged.
          </p>
        </div>
        <div style="background: #121215; padding: 14px 24px; text-align: center; border-top: 1px solid #27272a; color: #71717a; font-size: 11px;">
          Zoorich Identity & Access Security System
        </div>
      </div>
    `;
        return this.sendMail({
            to,
            subject: `🔑 Your Zoorich Bank Password Reset Code: ${otp}`,
            html,
            text: `Hello ${name}, your password reset verification code is: ${otp}. It expires in 10 minutes.`,
        });
    }
}
exports.EmailService = EmailService;
