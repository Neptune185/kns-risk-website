import { Resend } from 'resend';

/**
 * =========================================
 * Resend client
 * -----------------------------------------
 * Uses the API key stored in Vercel environment variables.
 * Never hardcode secrets directly in source code.
 * =========================================
 */
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * =========================================
 * Helper: JSON response builder
 * -----------------------------------------
 * Returns a consistent JSON response with
 * the correct content type and status code.
 * =========================================
 */
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * =========================================
 * Helper: Basic email validation
 * -----------------------------------------
 * Keeps validation simple on the server side.
 * Frontend also validates, but server must
 * validate again because client input cannot
 * be trusted.
 * =========================================
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * =========================================
 * Helper: Escape HTML
 * -----------------------------------------
 * Prevents user-submitted content from being
 * injected into the outbound HTML email.
 * =========================================
 */
function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * =========================================
 * OPTIONS handler
 * -----------------------------------------
 * Supports CORS preflight if needed later.
 * Same-origin form posts from your website
 * usually will not need this, but adding it
 * makes the endpoint more resilient.
 * =========================================
 */
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * =========================================
 * POST /api/contact
 * -----------------------------------------
 * Flow:
 * 1. Parse incoming JSON
 * 2. Validate required fields
 * 3. Send notification email to business inbox
 * 4. Optionally send confirmation email to lead
 * 5. Return JSON success/error response
 * =========================================
 */
export async function POST(request) {
  try {
    /**
     * Ensure required environment variables exist
     */
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.CONTACT_FROM_EMAIL;
    const toEmail = process.env.CONTACT_TO_EMAIL;

    if (!apiKey || !fromEmail || !toEmail) {
      return jsonResponse(
        {
          error: 'Server configuration is incomplete. Check environment variables.',
        },
        500
      );
    }

    /**
     * Parse request body
     */
    const body = await request.json();

    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    const company = (body.company || '').trim();
    const website = (body.website || '').trim();
    const service = (body.service || '').trim();
    const message = (body.message || '').trim();

    /**
     * Server-side validation
     * Required even if frontend validates first
     */
    if (!name) {
      return jsonResponse({ error: 'Name is required.' }, 400);
    }

    if (!email) {
      return jsonResponse({ error: 'Email is required.' }, 400);
    }

    if (!isValidEmail(email)) {
      return jsonResponse({ error: 'Please provide a valid email address.' }, 400);
    }

    if (!website) {
      return jsonResponse({ error: 'Website URL is required.' }, 400);
    }

    if (!service) {
      return jsonResponse({ error: 'Service package is required.' }, 400);
    }

    /**
     * Escape user-provided values before injecting
     * them into HTML email content
     */
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeCompany = escapeHtml(company || 'Not provided');
    const safeWebsite = escapeHtml(website);
    const safeService = escapeHtml(service);
    const safeMessage = escapeHtml(message || 'No additional message provided.');

    /**
     * Internal business notification email
     * Sent to your inbox when a new lead comes in
     */
    const internalEmail = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      replyTo: email,
      subject: `New Website Lead: ${service} - ${name}`,
      html: `
        <h2>New Lead Submission</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Company:</strong> ${safeCompany}</p>
        <p><strong>Website:</strong> ${safeWebsite}</p>
        <p><strong>Service:</strong> ${safeService}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
      text: `
New Lead Submission

Name: ${name}
Email: ${email}
Company: ${company || 'Not provided'}
Website: ${website}
Service: ${service}
Message: ${message || 'No additional message provided.'}
      `.trim(),
    });

    /**
     * Resend returns either data or error.
     * Fail immediately if the notification email
     * was not accepted.
     */
    if (internalEmail.error) {
      console.error('Resend internal email error:', internalEmail.error);
      return jsonResponse(
        { error: 'Unable to send lead notification email.' },
        500
      );
    }

    /**
     * Optional lead confirmation email
     * Good for trust and proof of successful submission
     */
    const confirmationEmail = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'We received your security scan request',
      html: `
        <h2>Thank you for contacting KNS Risk Solutions Group</h2>
        <p>Hi ${safeName},</p>
        <p>We received your request for the <strong>${safeService}</strong>.</p>
        <p>Website submitted: <strong>${safeWebsite}</strong></p>
        <p>We will review your request and contact you with next steps within 24 hours.</p>
        <p>Regards,<br />KNS Risk Solutions Group</p>
      `,
      text: `
Thank you for contacting KNS Risk Solutions Group

Hi ${name},

We received your request for the ${service}.
Website submitted: ${website}

We will review your request and contact you with next steps within 24 hours.

Regards,
KNS Risk Solutions Group
      `.trim(),
    });

    /**
     * If the lead confirmation fails, we still treat
     * the submission as successful because your business
     * notification already went through.
     */
    if (confirmationEmail.error) {
      console.warn('Resend confirmation email warning:', confirmationEmail.error);
    }

    /**
     * Final success response back to frontend
     */
    return jsonResponse({
      success: true,
      message: 'Lead captured and email sent successfully.',
    });
  } catch (error) {
    console.error('API contact error:', error);

    return jsonResponse(
      {
        error: 'An unexpected error occurred while processing your request.',
      },
      500
    );
  }
}