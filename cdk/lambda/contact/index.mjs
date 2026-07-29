// Contact-form intake: validates a short message, records it to the leads
// table (best-effort), and emails it to the shop via SES. The send-to
// address is server-controlled (CONTACT_TO_EMAIL) — never taken from the client.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Read env at call time (not module load) so tests can vary it per-invocation.
function config() {
  return {
    leadsTable: process.env.LEADS_TABLE || '',
    toEmail: process.env.CONTACT_TO_EMAIL || 'vanderleesttrailers@gmail.com',
    fromEmail: process.env.CONTACT_FROM_EMAIL || 'vanderleesttrailers@gmail.com',
  };
}

let ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
let sesClient = new SESClient({});

export function __setDdbClient(client) { ddbClient = client; }
export function __setSesClient(client) { sesClient = client; }

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS = { name: 200, email: 200, phone: 200, message: 2000 };

function clampStr(v, max) {
  return String(v ?? '').trim().slice(0, max);
}

export function isHoneypot(body) {
  return typeof body?.company === 'string' && body.company.trim().length > 0;
}

export function validateContactSubmission(body) {
  const data = {
    name: clampStr(body?.name, LIMITS.name),
    email: clampStr(body?.email, LIMITS.email),
    phone: clampStr(body?.phone, LIMITS.phone),
    message: clampStr(body?.message, LIMITS.message),
  };
  const errors = [];
  if (!data.name) errors.push('name is required');
  if (!data.email) errors.push('email is required');
  else if (!EMAIL_RE.test(data.email)) errors.push('email is invalid');
  if (!data.phone) errors.push('phone is required');
  if (!data.message) errors.push('message is required');
  return { ok: errors.length === 0, errors, data };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildEmail(data, submittedAt) {
  const subject = `New contact form message — ${data.name}`;
  const rows = [
    ['Name', data.name],
    ['Email', data.email],
    ['Phone', data.phone],
    ['Message', data.message || '(none)'],
    ['Submitted', submittedAt],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html =
    '<h2>New contact form message</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="vertical-align:top"><strong>${escapeHtml(k)}</strong></td>` +
          `<td>${escapeHtml(v)}</td></tr>`,
      )
      .join('') +
    '</table>';
  return { subject, text, html };
}

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, errors: ['invalid JSON'] }) };
  }

  // Silent bot trap — pretend success, send nothing.
  if (isHoneypot(body)) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  const { ok, errors, data } = validateContactSubmission(body);
  if (!ok) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, errors }) };
  }

  const { leadsTable, toEmail, fromEmail } = config();
  const submittedAt = new Date().toISOString();

  // Durable backup — never blocks the email.
  if (leadsTable) {
    try {
      await ddbClient.send(
        new PutCommand({
          TableName: leadsTable,
          Item: {
            pk: 'CONTACT',
            sk: `${submittedAt}#${Math.random().toString(36).slice(2, 10)}`,
            data,
            createdAt: submittedAt,
          },
        }),
      );
    } catch (err) {
      console.error('Failed to record contact lead:', err);
    }
  }

  const { subject, text, html } = buildEmail(data, submittedAt);
  try {
    await sesClient.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [toEmail] },
        ReplyToAddresses: data.email ? [data.email] : [],
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: text, Charset: 'UTF-8' },
            Html: { Data: html, Charset: 'UTF-8' },
          },
        },
      }),
    );
  } catch (err) {
    console.error('SES send failed:', err);
    return { statusCode: 502, headers, body: JSON.stringify({ ok: false, errors: ['email delivery failed'] }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};
