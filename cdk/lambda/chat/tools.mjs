import { QueryCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

export const TOOL_SPECS = [
  {
    toolSpec: {
      name: 'searchTrailers',
      description: 'Search the VanderLeest live inventory. Returns up to 10 matching trailers plus a total count. OMIT any filter you do not need — do NOT send placeholder values like 0, ".", or empty strings.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Optional. Category slug, e.g. "dump-trailers", "utility-trailers". Omit if no preference.' },
            make:     { type: 'string', description: 'Optional. Trailer make/manufacturer, e.g. "Maxx-D", "Retco". Omit if no preference.' },
            model:    { type: 'string', description: 'Optional. Model designation, e.g. "H8X", "EXS", "Elite Tandem". Omit if no preference.' },
            maxPrice: { type: 'number', description: 'Optional. Max price in USD (positive number). Omit if no budget limit.' },
            query:    { type: 'string', description: 'Optional. Free-text search over name, model and features. Omit for unfiltered listing.' },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'getSiteContent',
      description: 'Fetch a section of static site content. Use the right type for the question:\n- SITE_INFO: business hours, address, phone number, social links (USE THIS for "what are your hours", "where are you located", "phone number")\n- SERVICES: list of services offered (welding, painting, custom work)\n- FINANCING: financing partners and credit requirements\n- FAQ: frequently asked questions and answers\n- BRANDS: list of trailer brands carried\n- CATEGORIES: list of trailer categories\n- CONTACT: contact form labels only — do NOT use this for hours/address (use SITE_INFO instead)',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['SITE_INFO', 'SERVICES', 'FINANCING', 'CONTACT', 'FAQ', 'BRANDS', 'CATEGORIES'],
              description: 'Content type key',
            },
          },
          required: ['type'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'submitLead',
      description: 'Submit a lead for Matt to follow up. Requires at minimum a name and phone. Email and message are optional.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            name:    { type: 'string' },
            phone:   { type: 'string' },
            email:   { type: 'string' },
            message: { type: 'string' },
          },
          required: ['name', 'phone'],
        },
      },
    },
  },
];

const MAX_SEARCH_RESULTS = 10;

function slim(trailer) {
  const d = trailer.data || trailer;
  return {
    slug:     d.slug,
    name:     d.name,
    category: d.category,
    make:     d.make,
    model:    d.model,
    price:    d.price,
    gvwr:     d.gvwr,
    image:    d.images?.[0] || d.image || '',
  };
}

function cleanFilter(s) {
  // Strings shorter than 2 chars (after trim) are sentinel/placeholder values
  // the model occasionally sends — treat them as "no filter".
  if (typeof s !== 'string') return '';
  const trimmed = s.trim();
  return trimmed.length >= 2 ? trimmed.toLowerCase() : '';
}

async function searchTrailers(input, ctx) {
  const { category, make, model, maxPrice, query } = input || {};
  const result = await ctx.ddb.send(new QueryCommand({
    TableName: ctx.contentTable,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'TRAILER' },
  }));
  const all = (result.Items || []).map(i => i.data || i);

  const cat = cleanFilter(category);
  const mk  = cleanFilter(make);
  const mdl = cleanFilter(model);
  const q   = cleanFilter(query);
  // 0 / negative values mean "no budget" (the model sometimes sends 0 when it means "no filter").
  const useMaxPrice = typeof maxPrice === 'number' && maxPrice > 0;

  const filtered = all.filter(t => {
    if (cat && (t.category || '').toLowerCase() !== cat) return false;
    if (mk  && (t.make || '').toLowerCase() !== mk) return false;
    if (mdl && !(t.model || '').toLowerCase().includes(mdl)) return false;
    if (useMaxPrice && Number(t.price) > maxPrice) return false;
    if (q) {
      const hay = `${t.name || ''} ${t.model || ''} ${(t.features || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return {
    count: filtered.length,
    trailers: filtered.slice(0, MAX_SEARCH_RESULTS).map(slim),
  };
}

const ALLOWED_CONTENT_TYPES = new Set([
  'SITE_INFO', 'SERVICES', 'FINANCING', 'CONTACT', 'FAQ', 'BRANDS', 'CATEGORIES',
]);

async function getSiteContent(input, ctx) {
  if (!input?.type) throw new Error('getSiteContent: type is required');
  if (!ALLOWED_CONTENT_TYPES.has(input.type)) {
    throw new Error(`getSiteContent: type "${input.type}" is not allowed`);
  }
  const res = await ctx.ddb.send(new GetCommand({
    TableName: ctx.contentTable,
    Key: { pk: input.type, sk: '_' },
  }));
  const data = res.Item?.data ?? {};
  // Bedrock Converse requires toolResult.content[].json to be a JSON object,
  // not an array. Some content types (BRANDS, CATEGORIES, FAQ, REVIEWS) are
  // arrays at the top level — wrap them so the call doesn't crash.
  return Array.isArray(data) ? { items: data } : data;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

async function submitLead(input, ctx) {
  const { name, phone, email, message } = input || {};
  if (!name || !phone) {
    throw new Error('submitLead: name and phone are required');
  }
  const now = new Date().toISOString();
  const leadId = randomId();
  const item = {
    // leadId keeps the sort key unique even when the model fires two submitLead
    // calls in the same turn (parallel tool use) at the same millisecond —
    // without it the second Put would silently clobber the first.
    pk: 'LEAD',
    sk: `${now}#${ctx.sessionId}#${leadId}`,
    leadId,
    name,
    phone,
    sessionId: ctx.sessionId,
    createdAt: now,
  };
  if (email)   item.email = email;
  if (message) item.message = message;

  await ctx.ddb.send(new PutCommand({
    TableName: ctx.leadsTable,
    Item: item,
  }));
  return { ok: true, leadId };
}

export async function runTool(toolUse, ctx) {
  switch (toolUse.name) {
    case 'searchTrailers':
      return searchTrailers(toolUse.input, ctx);
    case 'getSiteContent':
      return getSiteContent(toolUse.input, ctx);
    case 'submitLead':
      return submitLead(toolUse.input, ctx);
    default:
      throw new Error(`Unknown tool: ${toolUse.name}`);
  }
}
