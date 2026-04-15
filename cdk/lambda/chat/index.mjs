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

function findToolUse(message) {
  return message?.content?.find(p => p.toolUse)?.toolUse;
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

  const { sessionId, messages } = payload || {};
  if (!sessionId || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_request' }) };
  }

  const ctx = {
    sessionId,
    contentTable: CONTENT_TBL,
    leadsTable:   LEADS_TBL,
    ddb: ddbClient,
  };

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
        system: [{ text: SYSTEM_PROMPT }],
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

      const toolUse = findToolUse(res.output?.message);
      console.log(`[CHAT] tool=${toolUse?.name} input=${JSON.stringify(toolUse?.input)}`);
      let toolResult;
      try {
        toolResult = await runTool(toolUse, ctx);
        const summary = JSON.stringify(toolResult).slice(0, 300);
        console.log(`[CHAT] tool=${toolUse?.name} result (first 300 chars): ${summary}`);
      } catch (err) {
        console.error(`[CHAT] Tool "${toolUse?.name}" failed:`, err.message);
        toolResult = { error: err.message };
      }

      convo = [
        ...convo,
        res.output.message,
        {
          role: 'user',
          content: [{
            toolResult: {
              toolUseId: toolUse.toolUseId,
              content: [{ json: toolResult }],
            },
          }],
        },
      ];
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
