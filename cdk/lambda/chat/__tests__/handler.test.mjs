import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handler, __setBedrockClient, __setDdbClient, truncateHistory, vehicleContextBlock } from '../index.mjs';

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

describe('truncateHistory — leading assistant stripping', () => {
  it('drops leading assistant messages so the conversation starts with user', () => {
    const out = truncateHistory([
      { role: 'assistant', content: 'greeting' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
    assert.equal(out.length, 2);
    assert.equal(out[0].role, 'user');
  });

  it('returns an empty array when there is no user message', () => {
    const out = truncateHistory([
      { role: 'assistant', content: 'only greeting' },
    ]);
    assert.deepEqual(out, []);
  });
});

describe('vehicleContextBlock', () => {
  it('returns null when vehicle is missing or malformed', () => {
    assert.equal(vehicleContextBlock(undefined), null);
    assert.equal(vehicleContextBlock(null), null);
    assert.equal(vehicleContextBlock({}), null);
    assert.equal(vehicleContextBlock({ name: '', capacity: 10000 }), null);
    assert.equal(vehicleContextBlock({ name: 'Truck', capacity: 0 }), null);
    assert.equal(vehicleContextBlock({ name: 'Truck', capacity: -5 }), null);
    assert.equal(vehicleContextBlock({ name: 'Truck', capacity: 'nope' }), null);
  });

  it('builds a system block with the vehicle name and capacity', () => {
    const block = vehicleContextBlock({ name: 'Ford F-150', capacity: 13500 });
    assert.ok(block.text.includes('Ford F-150'));
    assert.ok(block.text.includes('13,500'));
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

describe('handler — strips <thinking> tags', () => {
  it('removes chain-of-thought blocks from the visible reply', async () => {
    __setDdbClient({ send: async () => ({ Items: [] }) });
    __setBedrockClient({
      send: async () => ({
        stopReason: 'end_turn',
        output: {
          message: {
            role: 'assistant',
            content: [{ text: '<thinking>The user is asking about hours.</thinking>\nWe are open Monday-Friday 8-5.' }],
          },
        },
      }),
    });
    const res = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        sessionId: 'abc',
        messages: [{ role: 'user', content: 'when are you open?' }],
      }),
    });
    const reply = JSON.parse(res.body).reply;
    assert.ok(!reply.includes('<thinking>'), `reply leaked thinking tag: ${reply}`);
    assert.ok(reply.includes('Monday-Friday'));
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

describe('handler — vehicle context', () => {
  beforeEach(() => {
    __setDdbClient({ send: async () => ({ Items: [] }) });
  });

  it('adds a vehicle system block when a valid vehicle is supplied', async () => {
    let capturedSystem;
    __setBedrockClient({
      send: async (cmd) => {
        capturedSystem = cmd.input.system;
        return {
          stopReason: 'end_turn',
          output: { message: { role: 'assistant', content: [{ text: 'Sure!' }] } },
        };
      },
    });

    await handler(apiEvent({
      sessionId: 'abc',
      messages: [{ role: 'user', content: 'what fits my truck?' }],
      vehicle: { name: 'Ford F-150', capacity: 13500 },
    }));

    assert.equal(capturedSystem.length, 2);
    assert.ok(capturedSystem[1].text.includes('Ford F-150'));
  });

  it('omits the vehicle system block when no vehicle is supplied', async () => {
    let capturedSystem;
    __setBedrockClient({
      send: async (cmd) => {
        capturedSystem = cmd.input.system;
        return {
          stopReason: 'end_turn',
          output: { message: { role: 'assistant', content: [{ text: 'Sure!' }] } },
        };
      },
    });

    await handler(apiEvent({
      sessionId: 'abc',
      messages: [{ role: 'user', content: 'hi' }],
    }));

    assert.equal(capturedSystem.length, 1);
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

describe('handler — parallel tool use (Claude Haiku)', () => {
  it('answers every toolUse id when the assistant requests multiple tools at once', async () => {
    // Reads (searchTrailers) and the getSiteContent lookup both hit DDB.
    __setDdbClient({ send: async () => ({ Items: [] }) });

    const bedrockCalls = [];
    let call = 0;
    __setBedrockClient({
      send: async (cmd) => {
        bedrockCalls.push(cmd);
        call += 1;
        if (call === 1) {
          // Claude Haiku routinely emits multiple tool calls in one turn.
          return {
            stopReason: 'tool_use',
            output: {
              message: {
                role: 'assistant',
                content: [
                  { toolUse: { toolUseId: 'u1', name: 'searchTrailers', input: { query: 'skidsteer' } } },
                  { toolUse: { toolUseId: 'u2', name: 'getSiteContent', input: { type: 'FINANCING' } } },
                ],
              },
            },
          };
        }
        return {
          stopReason: 'end_turn',
          output: { message: { role: 'assistant', content: [{ text: 'Here you go.' }] } },
        };
      },
    });

    const res = await handler(apiEvent({
      sessionId: 'abc',
      messages: [{ role: 'user', content: 'haul my kubota skidsteer, and do you finance?' }],
    }));

    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).reply, 'Here you go.');
    assert.equal(bedrockCalls.length, 2);

    // Bedrock rejects the next Converse call unless EVERY toolUse id in the
    // assistant turn has a matching toolResult in the following user message.
    const secondMessages = bedrockCalls[1].input.messages;
    const lastMsg = secondMessages[secondMessages.length - 1];
    assert.equal(lastMsg.role, 'user');
    const ids = lastMsg.content.map(c => c.toolResult?.toolUseId).sort();
    assert.deepEqual(ids, ['u1', 'u2']);
    // Each toolResult must carry a json payload (Bedrock requirement).
    assert.ok(lastMsg.content.every(c => c.toolResult?.content?.[0]?.json !== undefined));
  });

  it('runs each requested tool once (one toolResult per toolUse id)', async () => {
    const toolInputs = [];
    __setDdbClient({
      send: async (cmd) => {
        toolInputs.push(cmd.constructor?.name || 'cmd');
        return { Items: [] };
      },
    });

    let call = 0;
    __setBedrockClient({
      send: async () => {
        call += 1;
        if (call === 1) {
          return {
            stopReason: 'tool_use',
            output: {
              message: {
                role: 'assistant',
                content: [
                  { toolUse: { toolUseId: 'a', name: 'searchTrailers', input: {} } },
                  { toolUse: { toolUseId: 'b', name: 'searchTrailers', input: { query: 'dump' } } },
                ],
              },
            },
          };
        }
        return { stopReason: 'end_turn', output: { message: { role: 'assistant', content: [{ text: 'done' }] } } };
      },
    });

    const res = await handler(apiEvent({ sessionId: 'abc', messages: [{ role: 'user', content: 'two searches' }] }));
    assert.equal(res.statusCode, 200);
    // Both searchTrailers calls executed (each does one DDB Query).
    assert.equal(toolInputs.length, 2);
  });

  it('returns immediately (no loop) when stopReason=tool_use but no toolUse block is present', async () => {
    __setDdbClient({ send: async () => ({ Items: [] }) });
    let calls = 0;
    __setBedrockClient({
      send: async () => {
        calls += 1;
        // Malformed: model signalled tool_use but emitted only text, no toolUse.
        return {
          stopReason: 'tool_use',
          output: { message: { role: 'assistant', content: [{ text: 'here is your answer' }] } },
        };
      },
    });

    const res = await handler(apiEvent({ sessionId: 'abc', messages: [{ role: 'user', content: 'x' }] }));
    assert.equal(res.statusCode, 200);
    // The guard bails out on the first hop instead of looping to MAX_TOOL_HOPS.
    assert.equal(calls, 1);
    assert.equal(JSON.parse(res.body).reply, 'here is your answer');
  });
});
