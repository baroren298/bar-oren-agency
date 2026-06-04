/*
 * Contact form API route.
 *
 * Required environment variables (add to .env.local):
 *   CONTACT_EMAIL   — address that receives form submissions
 *   RESEND_API_KEY  — Resend.com API key (free tier covers startup volume)
 *
 * Without these variables the form still returns success (submissions
 * are logged server-side). Add them in Vercel → Project → Settings → Environment Variables.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, message } = body;

    /* ── Server-side validation ── */
    const errors = {};
    if (!name?.trim())    errors.name    = 'נא להזין שם מלא';
    if (!email?.trim())   errors.email   = 'נא להזין כתובת אימייל';
    if (!message?.trim()) errors.message = 'נא להזין הודעה';

    if (email?.trim() && !EMAIL_REGEX.test(email.trim())) {
      errors.email = 'כתובת אימייל לא תקינה';
    }

    if (Object.keys(errors).length > 0) {
      return Response.json({ errors }, { status: 400 });
    }

    /* ── Email delivery via Resend ── */
    const apiKey       = process.env.RESEND_API_KEY;
    const contactEmail = process.env.CONTACT_EMAIL;

    if (apiKey && contactEmail) {
      const safeName    = escapeHtml(name.trim());
      const safeEmail   = escapeHtml(email.trim());
      const safePhone   = phone?.trim() ? escapeHtml(phone.trim()) : null;
      const safeMessage = escapeHtml(message.trim()).replace(/\n/g, '<br>');

      const emailPayload = {
        from:    'Bar Oren Agency <noreply@baroren.com>',
        to:      [contactEmail],
        subject: `פנייה חדשה מהאתר — ${safeName}`,
        html: `
          <div dir="rtl" style="font-family:sans-serif;max-width:560px;">
            <h2 style="margin-bottom:24px;">פנייה חדשה מהאתר</h2>
            <p><strong>שם:</strong> ${safeName}</p>
            <p><strong>אימייל:</strong> ${safeEmail}</p>
            ${safePhone ? `<p><strong>טלפון:</strong> ${safePhone}</p>` : ''}
            <hr style="margin:24px 0;border:none;border-top:1px solid #e8e3dc;" />
            <p><strong>הודעה:</strong></p>
            <p style="line-height:1.7;">${safeMessage}</p>
          </div>
        `,
        reply_to: email.trim(),
      };

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!res.ok) {
        /* Log but don't expose internal error to client */
        console.error('[contact] Resend delivery failed:', await res.text());
      }
    } else {
      /* No email config — log to server stdout so nothing is silently lost */
      console.log('[contact] Form submission received (no email config):', {
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || null,
        message: message.trim(),
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[contact] Unexpected error:', err);
    return Response.json(
      { error: 'אירעה שגיאה. אנא נסו שוב או צרו קשר ישירות.' },
      { status: 500 }
    );
  }
}
