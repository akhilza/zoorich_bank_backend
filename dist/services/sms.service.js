"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsService = void 0;
const twilio_1 = __importDefault(require("twilio"));
const config_1 = require("../config");
const { accountSid, authToken, phoneNumber } = config_1.config.twilio;
let twilioClient = null;
if (accountSid && authToken && !authToken.includes('PASTE_')) {
    try {
        twilioClient = (0, twilio_1.default)(accountSid, authToken);
        console.log('📱 Twilio SMS client initialized successfully');
    }
    catch (err) {
        console.error('Failed to initialize Twilio client:', err.message);
    }
}
/**
 * Normalizes a phone number to standard E.164 format.
 * Defaults to India (+91) if a 10-digit number is provided.
 */
function formatE164(phone) {
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('+'))
        return cleaned;
    if (cleaned.length === 10)
        return `+91${cleaned}`;
    if (cleaned.startsWith('91') && cleaned.length === 12)
        return `+${cleaned}`;
    return `+${cleaned}`;
}
class SmsService {
    /**
     * Sends an SMS message to a phone number.
     * Handles Twilio trial template requirements (code 572006) automatically.
     */
    static async sendSms(to, message) {
        const formattedTo = formatE164(to);
        if (twilioClient && phoneNumber && !phoneNumber.includes('xxxx')) {
            try {
                // Attempt sending customized SMS body
                const res = await twilioClient.messages.create({
                    body: message,
                    from: phoneNumber,
                    to: formattedTo,
                });
                console.log(`📱 [Twilio SMS Delivered] To: ${formattedTo} | SID: ${res.sid}`);
                return { success: true, sid: res.sid, simulated: false };
            }
            catch (err) {
                // Handle Twilio Trial Template enforcement error (572006)
                if (err.code === 572006 || (err.message && err.message.includes('predefined SMS templates'))) {
                    console.log(`ℹ️ [Twilio Trial Account] Using approved template 'sms_appointment_reminders' for ${formattedTo}`);
                    try {
                        const templateRes = await twilioClient.messages.create({
                            body: 'sms_appointment_reminders',
                            from: phoneNumber,
                            to: formattedTo,
                        });
                        console.log(`📱 [Twilio Template SMS Delivered] To: ${formattedTo} | SID: ${templateRes.sid}`);
                        return { success: true, sid: templateRes.sid, simulated: false };
                    }
                    catch (tplErr) {
                        console.error(`⚠️ [Twilio Template SMS Failed]:`, tplErr.message);
                    }
                }
                else {
                    console.error(`⚠️ [Twilio SMS Error] Failed to send to ${formattedTo}:`, err.message);
                }
                // Simulated fallback so user is never blocked
                console.log(`📱 [SIMULATED SMS FALLBACK] To: ${formattedTo} | Message: ${message}`);
                return { success: true, simulated: true, message: err.message };
            }
        }
        else {
            console.log(`📱 [SIMULATED SMS] To: ${formattedTo} | Message: ${message}`);
            return { success: true, simulated: true };
        }
    }
    /**
     * Sends a 6-digit banking OTP for transactions or password reset.
     */
    static async sendOtp(to, otp) {
        const text = `🏦 Nova Bank: Your one-time verification code is ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;
        return this.sendSms(to, text);
    }
    /**
     * Sends a transaction alert SMS
     */
    static async sendTransferAlert(to, amount, counterparty, type) {
        const text = type === 'SENT'
            ? `🏦 Nova Bank Alert: $${amount.toFixed(2)} debited from your account to ${counterparty}.`
            : `🏦 Nova Bank Alert: $${amount.toFixed(2)} credited to your account from ${counterparty}.`;
        return this.sendSms(to, text);
    }
}
exports.SmsService = SmsService;
