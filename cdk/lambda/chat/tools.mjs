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

export async function runTool(toolUse, ctx) {
  switch (toolUse.name) {
    default:
      throw new Error(`Unknown tool: ${toolUse.name}`);
  }
}
