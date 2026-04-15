import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

export const TOOL_SPECS = [
  {
    toolSpec: {
      name: 'searchTrailers',
      description: 'Search the VanderLeest live inventory. Filter by optional category slug, brand, maxPrice, or free-text query over name and description. Returns up to 10 matching trailers.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Category slug, e.g. "dump-trailers"' },
            brand:    { type: 'string', description: 'Brand name, e.g. "Maxx-D"' },
            maxPrice: { type: 'number', description: 'Max price in USD' },
            query:    { type: 'string', description: 'Free-text search over name and description' },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'getSiteContent',
      description: 'Fetch a section of static site content. Allowed types: SITE_INFO, SERVICES, FINANCING, CONTACT, FAQ, BRANDS, CATEGORIES.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Content type key' },
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
    brand:    d.brand,
    price:    d.price,
    gvwr:     d.gvwr,
    image:    d.images?.[0] || d.image || '',
  };
}

async function searchTrailers(input, ctx) {
  const { category, brand, maxPrice, query } = input || {};
  const result = await ctx.ddb.send(new QueryCommand({
    TableName: ctx.contentTable,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'TRAILER' },
  }));
  const all = (result.Items || []).map(i => i.data || i);

  const cat = category?.toLowerCase();
  const br  = brand?.toLowerCase();
  const q   = query?.toLowerCase();

  const filtered = all.filter(t => {
    if (cat && (t.category || '').toLowerCase() !== cat) return false;
    if (br  && (t.brand || '').toLowerCase() !== br) return false;
    if (typeof maxPrice === 'number' && Number(t.price) > maxPrice) return false;
    if (q) {
      const hay = `${t.name || ''} ${t.description || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return {
    count: filtered.length,
    trailers: filtered.slice(0, MAX_SEARCH_RESULTS).map(slim),
  };
}

export async function runTool(toolUse, ctx) {
  switch (toolUse.name) {
    case 'searchTrailers':
      return searchTrailers(toolUse.input, ctx);
    default:
      throw new Error(`Unknown tool: ${toolUse.name}`);
  }
}
