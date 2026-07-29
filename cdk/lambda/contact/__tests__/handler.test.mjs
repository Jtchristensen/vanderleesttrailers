import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  handler,
  validateContactSubmission,
  isHoneypot,
  buildEmail,
  __setSesClient,
  __setDdbClient,
} from '../index.mjs';

function apiEvent(body, method = 'POST') {
  return { httpMethod: method, body: body === undefined ? undefined : JSON.stringify(body) };
}

// Recording fakes
function makeFakes() {
  const calls = { ses: [], ddb: [] };
  __setSesClient({ send: async (cmd) => { calls.ses.push(cmd); return {}; } });
  __setDdbClient({ send: async (cmd) => { calls.ddb.push(cmd); return {}; } });
  return calls;
}

const VALID = { name: 'Jane Doe', email: 'jane@example.com', phone: '920-555-1234', message: 'Hi there' };

describe('validateContactSubmission', () => {
  it('accepts a complete submission', () => {
    const { ok, errors, data } = validateContactSubmission(VALID);
    assert.equal(ok, true);
    assert.deepEqual(errors, []);
    assert.equal(data.message, 'Hi there');
  });

  it('rejects missing required fields', () => {
    const { ok, errors } = validateContactSubmission({ name: '', email: '', phone: '', message: '' });
    assert.equal(ok, false);
    assert.ok(errors.length >= 4);
  });

  it('rejects a malformed email', () => {
    const { ok, errors } = validateContactSubmission({ ...VALID, email: 'not-an-email' });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => e.includes('email')));
  });

  it('trims and length-caps fields', () => {
    const { data } = validateContactSubmission({ ...VALID, name: '  ' + 'x'.repeat(500) + '  ' });
    assert.equal(data.name.length, 200);
  });
});

describe('isHoneypot', () => {
  it('is true when the company field is filled', () => {
    assert.equal(isHoneypot({ company: 'bot' }), true);
  });
  it('is false when the company field is empty/absent', () => {
    assert.equal(isHoneypot({ company: '' }), false);
    assert.equal(isHoneypot({}), false);
  });
});

describe('buildEmail', () => {
  it('includes the sender name in the subject and escapes HTML', () => {
    const { subject, html, text } = buildEmail(
      { name: 'A<b>', email: 'a@b.com', phone: '1', message: 'x' },
      '2026-07-20T00:00:00.000Z',
    );
    assert.ok(subject.includes('A<b>'));
    assert.ok(html.includes('A&lt;b&gt;'));
    assert.ok(text.includes('a@b.com'));
  });
});

describe('handler', () => {
  beforeEach(() => { makeFakes(); });

  it('answers OPTIONS preflight with 200', async () => {
    const res = await handler(apiEvent(undefined, 'OPTIONS'));
    assert.equal(res.statusCode, 200);
  });

  it('returns 400 on malformed JSON', async () => {
    const res = await handler({ httpMethod: 'POST', body: '{not json' });
    assert.equal(res.statusCode, 400);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await handler(apiEvent({ name: '', email: '', phone: '', message: '' }));
    assert.equal(res.statusCode, 400);
  });

  it('honeypot returns 200 without sending email', async () => {
    const calls = makeFakes();
    const res = await handler(apiEvent({ ...VALID, company: 'bot' }));
    assert.equal(res.statusCode, 200);
    assert.equal(calls.ses.length, 0);
  });

  it('valid submission sends via SES and returns 200', async () => {
    const calls = makeFakes();
    const res = await handler(apiEvent(VALID));
    assert.equal(res.statusCode, 200);
    assert.equal(calls.ses.length, 1);
    const input = calls.ses[0].input;
    assert.deepEqual(input.Destination.ToAddresses, ['vanderleesttrailers@gmail.com']);
    assert.deepEqual(input.ReplyToAddresses, ['jane@example.com']);
  });

  it('returns 502 when SES throws', async () => {
    __setSesClient({ send: async () => { throw new Error('SES down'); } });
    __setDdbClient({ send: async () => ({}) });
    const res = await handler(apiEvent(VALID));
    assert.equal(res.statusCode, 502);
  });

  it('still emails and returns 200 when the DynamoDB write throws', async () => {
    process.env.LEADS_TABLE = 'TestLeads'; // force the DDB write path
    try {
      const sesCalls = [];
      const ddbCalls = [];
      __setSesClient({ send: async (cmd) => { sesCalls.push(cmd); return {}; } });
      __setDdbClient({ send: async (cmd) => { ddbCalls.push(cmd); throw new Error('ddb down'); } });
      const res = await handler(apiEvent(VALID));
      assert.equal(res.statusCode, 200);
      assert.equal(ddbCalls.length, 1); // the write was attempted...
      assert.equal(sesCalls.length, 1); // ...and the email still went out
    } finally {
      delete process.env.LEADS_TABLE;
    }
  });
});
