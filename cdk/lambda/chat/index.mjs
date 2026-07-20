import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { SYSTEM_PROMPT } from './system-prompt.mjs';
import { TOOL_SPECS, runTool } from './tools.mjs';

const MODEL_ID     = process.env.MODEL_ID     || 'amazon.nova-micro-v1:0';
const CONTENT_TBL  = process.env.TABLE_NAME   || '';
const LEADS_TBL    = process.env.LEADS_TABLE  || '';
const MAX_TOKENS   = 500;
const MAX_HISTORY  = 20;
const MAX_TOOL_HOPS = 3;

let ddbClient   = DynamoDBDocumentClient.from(new DynamoDBClient({}));
let bedrock     = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

export function __setDdbClient(client)     { ddbClient = client; }
export function __setBedrockClient(client) { bedrock = client; }

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

export function truncateHistory(messages) {
  const trimmed = messages.length <= MAX_HISTORY ? messages : messages.slice(-MAX_HISTORY);
  // Bedrock Converse requires the first message to be a user turn.
  let start = 0;
  while (start < trimmed.length && trimmed[start].role !== 'user') start++;
  return trimmed.slice(start);
}

function toBedrockMessages(messages) {
  return messages.map(m => ({
    role: m.role,
    content: Array.isArray(m.content) ? m.content : [{ text: String(m.content) }],
  }));
}

function extractText(res) {
  const parts = res.output?.message?.content || [];
  const raw = parts.map(p => p.text).filter(Boolean).join('\n');
  // Nova sometimes emits chain-of-thought wrapped in <thinking>...</thinking>.
  // Strip these so the user only sees the final answer.
  return raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
}

/** Builds an extra system block telling the model the shopper's saved tow
 * vehicle, so it can factor towing fit into recommendations from
 * searchTrailers results (which already include each trailer's gvwr) without
 * a dedicated tool round-trip. Returns null when the vehicle is missing or
 * malformed — never trust client-supplied shape blindly. */
export function vehicleContextBlock(vehicle) {
  if (!vehicle || typeof vehicle.name !== 'string' || !vehicle.name.trim()) return null;
  const capacity = Number(vehicle.capacity);
  if (!isFinite(capacity) || capacity <= 0) return null;
  const name = vehicle.name.trim().slice(0, 80);
  return {
    text: `# Shopper's tow vehicle\nThis visitor has told us they drive a ${name} with a maximum tow rating of ${Math.round(capacity).toLocaleString()} lbs. When discussing or recommending trailers, compare each trailer's GVWR (from searchTrailers results) against this rating: at or under 80% is a comfortable match, 80-100% is towable but tight, and over 100% exceeds the rating. Proactively mention fit when relevant, but don't refuse to discuss heavier trailers if asked directly — just flag the concern and suggest lighter alternatives when it's an easy swap.`,
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_json' }) };
  }

  const { sessionId, messages, vehicle } = payload || {};
  if (!sessionId || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_request' }) };
  }

  const ctx = {
    sessionId,
    contentTable: CONTENT_TBL,
    leadsTable:   LEADS_TBL,
    ddb: ddbClient,
  };

  const system = [{ text: SYSTEM_PROMPT }];
  const vehicleBlock = vehicleContextBlock(vehicle);
  if (vehicleBlock) system.push(vehicleBlock);

  let convo = toBedrockMessages(truncateHistory(messages));

  const lastUserText = (() => {
    const last = [...convo].reverse().find(m => m.role === 'user');
    return last?.content?.[0]?.text?.slice(0, 500) || '';
  })();
  console.log(`[CHAT] sessionId=${sessionId} turn=${convo.length} userMsg="${lastUserText}"`);

  try {
    for (let hop = 0; hop <= MAX_TOOL_HOPS; hop++) {
      const start = Date.now();
      const res = await bedrock.send(new ConverseCommand({
        modelId: MODEL_ID,
        system,
        messages: convo,
        toolConfig: { tools: TOOL_SPECS },
        inferenceConfig: { maxTokens: MAX_TOKENS, temperature: 0.4 },
      }));
      const dur = Date.now() - start;
      const inTok = res.usage?.inputTokens || 0;
      const outTok = res.usage?.outputTokens || 0;
      console.log(`[CHAT] hop=${hop} stop=${res.stopReason} dur=${dur}ms in=${inTok} out=${outTok}`);

      if (res.stopReason !== 'tool_use') {
        const reply = extractText(res) || "Sorry — I didn't catch that. Could you try again?";
        console.log(`[CHAT] reply (first 400 chars): ${reply.slice(0, 400)}`);
        return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
      }

      if (hop === MAX_TOOL_HOPS) {
        const reply = extractText(res) || "I'm having trouble digging that up right now — give me another try?";
        console.log(`[CHAT] hop ceiling — reply (first 400 chars): ${reply.slice(0, 400)}`);
        return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
      }

      // Claude Haiku uses parallel tool calls: one assistant turn can request
      // several tools at once. Bedrock's Converse API requires that EVERY
      // toolUse id in that turn have a matching toolResult in the immediately
      // following user message — answering only the first (as we did for Nova
      // Micro) makes the next Converse call fail with "Expected toolResult
      // blocks…". So run all of them and return one toolResult per id.
      const toolUses = (res.output?.message?.content || [])
        .map(p => p.toolUse)
        .filter(Boolean);
      console.log(`[CHAT] tools requested (${toolUses.length}): ${toolUses.map(t => t.name).join(', ')}`);

      if (toolUses.length === 0) {
        // stopReason was tool_use but no toolUse block was present — bail out
        // gracefully rather than sending an empty (invalid) user turn.
        const reply = extractText(res) || "Sorry — I didn't catch that. Could you try again?";
        return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
      }

      // Tools are independent, so run them concurrently. Each id gets exactly
      // one toolResult; a tool failure becomes an { error } payload so the
      // model can recover instead of the whole request 500ing.
      const toolResults = await Promise.all(toolUses.map(async (tu) => {
        let result;
        try {
          result = await runTool(tu, ctx);
          console.log(`[CHAT] tool=${tu.name} result (first 300 chars): ${JSON.stringify(result).slice(0, 300)}`);
        } catch (err) {
          console.error(`[CHAT] Tool "${tu?.name}" failed:`, err.message);
          result = { error: err.message };
        }
        return {
          toolResult: {
            toolUseId: tu.toolUseId,
            content: [{ json: result }],
          },
        };
      }));

      convo = [...convo, res.output.message, { role: 'user', content: toolResults }];
    }
  } catch (err) {
    console.error('[CHAT] Fatal error:', err.name, err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'internal' }),
    };
  }
};
