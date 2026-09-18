const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

function isConfigured() {
  return !!(client && verifyServiceSid);
}

async function sendOtp(phone) {
  if (!isConfigured()) {
    return { success: true, demo: true };
  }
  const verification = await client.verify.v2
    .services(verifyServiceSid)
    .verifications.create({ to: phone, channel: 'sms' });
  return { success: verification.status === 'pending', status: verification.status };
}

async function verifyOtp(phone, code) {
  if (!isConfigured()) {
    return { success: true, demo: true };
  }
  const check = await client.verify.v2
    .services(verifyServiceSid)
    .verificationChecks.create({ to: phone, code });
  return { success: check.status === 'approved', status: check.status };
}

module.exports = { sendOtp, verifyOtp, isConfigured };
