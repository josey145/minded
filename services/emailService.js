const { Resend } = require('resend');
const db = require('../config/db');
const { DEFAULT_SITE_NAME, normalizeSiteName } = require('../utils/siteName');

// Cache site name to avoid DB hits
let cachedSiteName = null;
let cacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getSiteName() {
    const now = Date.now();
    if (cachedSiteName && cacheTime && (now - cacheTime) < CACHE_DURATION) {
        return cachedSiteName;
    }
    try {
        const [settings] = await db.execute(
            "SELECT setting_value FROM site_settings WHERE setting_key = 'site_name'"
        );
        cachedSiteName = normalizeSiteName(settings[0]?.setting_value);
        cacheTime = now;
        return cachedSiteName;
    } catch (e) {
        return DEFAULT_SITE_NAME;
    }
}

function clearSiteNameCache() {
    cachedSiteName = null;
    cacheTime = null;
}

// ===== FIXED - WON'T CRASH IF NO API KEY =====
let resend;
if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith('re_')) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('✅ Resend email service initialized');
} else {
  console.log('⚠️ RESEND_API_KEY missing - emails disabled, app will still run');
  resend = {
    emails: {
      send: async (data) => {
        console.log(`📧 Dummy email to ${data.to} - subject: ${data.subject}`);
        return { data: { id: 'dummy-no-key' }, error: null };
      }
    }
  };
}

const sendEmail = async ({ to, subject, html }) => {
    try {
        const siteName = await getSiteName();
        let processedHtml = html;
        processedHtml = html
          .replace(/CUE-ACTION/gi, siteName)
          .replace(/TadawulX/gi, siteName)
          .replace(/Maximum Platform/g, siteName)
          .replace(/\bMaximum\b/g, siteName);

        const { data, error } = await resend.emails.send({
            from: `${siteName} <support@tadawulx.org>`,
            to: to,
            subject: subject
              .replace(/CUE-ACTION/gi, siteName)
              .replace(/TadawulX/gi, siteName)
              .replace(/Maximum Platform/g, siteName)
              .replace(/\bMaximum\b/g, siteName),
            html: processedHtml
        });

        if (error) {
            throw new Error(error.message);
        }

        console.log(`✅ Email sent to ${to}: ${data?.id || 'success'}`);
        return { success: true, id: data?.id };
    } catch (error) {
        console.error(`❌ Failed to send email to ${to}:`, error.message);
        // Don't throw - don't crash app for email failure
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail, clearSiteNameCache, getSiteName };