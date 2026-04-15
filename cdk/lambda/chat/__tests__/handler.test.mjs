import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handler, __setBedrockClient, __setDdbClient, truncateHistory } from '../index.mjs';

function apiEvent(body, method = 'POST') {
  return { httpMethod: method, body: JSON.stringify(body) };
}

describe('truncateHistory', () => {
  it('returns the array unchanged when <= 20 entries', () => {
    const arr = Array.from({ length: 5 }, (_, i) => ({ role: 'user', content: `${i}` }));
    assert.equal(truncateHistory(arr).length, 5);
  });

  it('keeps only the last 20 entries', () => {
    const arr = Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `${i}` }));
    const out = truncateHistory(arr);
    assert.equal(out.length, 20);
    assert.equal(out[0].content, '10');
    assert.equal(out[19].content, '29');
  });
});

describe('handler — request validation', () => {
  it('handles OPTIONS preflight with 200', async () => {
    const res = await handler(apiEvent({}, 'OPTIONS'));
    assert.equal(res.statusCode, 200);
  });

  it('returns 400 when body is missing', async () => {
    const res = await handler({ httpMethod: 'POST' });
    assert.equal(res.statusCode, 400);
  });

  it('returns 400 when messages array is missing or empty', async () => {
    const res = await handler(apiEvent({ sessionId: 'x', messages: [] }));
    assert.equal(res.statusCode, 400);
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await handler(apiEvent({ messages: [{ role: 'user', content: 'hi' }] }));
    assert.equal(res.statusCode, 400);
  });
});

describe('handler — happy path with mocked Bedrock', () => {
  beforeEach(() => {
    __setDdbClient({ send: async () => ({ Items: [] }) });
  });

  it('returns the model reply when Bedrock stops without tool use', async () => {
    __setBedrockClient({
      send: async () => ({
        stopReason: 'end_turn',
        output: { message: { role: 'assistant', content: [{ text: 'Hello there!' }] } },
      }),
    });
    const res = await handler(apiEvent({
      sessionId: 'abc',
      messages: [{ role: 'user', content: 'hi' }],
    }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.reply, 'Hello there!');
  });
});

describe('handler — tool-use loop', () => {
  it('invokes a tool, feeds the result back, and returns final text', async () => {
    __setDdbClient({ send: async () => ({ Items: [] }) });

    const bedrockCalls = [];
    let call = 0;
    __setBedrockClient({
      send: async (cmd) => {
        bedrockCalls.push(cmd);
        call += 1;
        if (call === 1) {
          return {
            stopReason: 'tool_use',
            output: {
              message: {
                role: 'assistant',
                content: [{ toolUse: { toolUseId: 'u1', name: 'searchTrailers', input: {} } }],
              },
            },
          };
        }
        return {
          stopReason: 'end_turn',
          output: { message: { role: 'assistant', content: [{ text: 'Nothing in stock.' }] } },
        };
      },
    });

    const res = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        sessionId: 'abc',
        messages: [{ role: 'user', content: 'any dump trailers?' }],
      }),
    });

    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).reply, 'Nothing in stock.');
    assert.equal(bedrockCalls.length, 2);

    const secondMessages = bedrockCalls[1].input.messages;
    const lastMsg = secondMessages[secondMessages.length - 1];
    assert.equal(lastMsg.role, 'user');
    assert.ok(lastMsg.content[0].toolResult);
    assert.equal(lastMsg.content[0].toolResult.toolUseId, 'u1');
  });

  it('stops at MAX_TOOL_HOPS to bound cost', async () => {
    __setDdbClient({ send: async () => ({ Items: [] }) });
    let call = 0;
    __setBedrockClient({
      send: async () => {
        call += 1;
        return {
          stopReason: 'tool_use',
          output: {
            message: {
              role: 'assistant',
              content: [
                { text: `thinking ${call}` },
                { toolUse: { toolUseId: `u${call}`, name: 'searchTrailers', input: {} } },
              ],
            },
          },
        };
      },
    });

    const res = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        sessionId: 'abc',
        messages: [{ role: 'user', content: 'loop forever' }],
      }),
    });

    assert.equal(res.statusCode, 200);
    assert.ok(call <= 4, `expected <=4 Bedrock calls, got ${call}`);
  });
});
