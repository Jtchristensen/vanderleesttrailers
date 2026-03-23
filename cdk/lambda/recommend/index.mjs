import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const TABLE = process.env.TABLE_NAME;
const MODEL_ID = 'amazon.nova-micro-v1:0';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { hauling, weight, enclosure, budget, special } = JSON.parse(event.body || '{}');

    // Fetch all trailers from DynamoDB
    const result = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': 'TRAILER' },
    }));

    const trailers = (result.Items || []).map(item => {
      const d = item.data;
      return {
        slug: d.slug,
        name: d.name,
        category: d.category,
        brand: d.brand,
        price: d.price,
        gvwr: d.gvwr,
        payload: d.payload,
        features: (d.features || []).slice(0, 5).join(', '),
        image: d.images?.[0] || '',
      };
    });

    // Build inventory summary (compact to save tokens)
    const inventorySummary = trailers.map(t =>
      `${t.slug}|${t.name}|${t.category}|${t.brand}|$${t.price || '?'}|GVWR:${t.gvwr || '?'}|Payload:${t.payload || '?'}`
    ).join('\n');

    const prompt = `You are a trailer sales expert at VanderLeest Trailer Sales in Oconto Falls, Wisconsin.

A customer needs help finding the right trailer. Here are their requirements:
- Hauling: ${hauling || 'Not specified'}
- Estimated load weight: ${weight || 'Not specified'}
- Enclosed or open: ${enclosure || 'No preference'}
- Budget: ${budget || 'Not specified'}
- Special requirements: ${special || 'None'}

Here is our current inventory (format: slug|name|category|brand|price|GVWR|payload):
${inventorySummary}

Recommend exactly 3 trailers from the inventory that best match the customer's needs. For each recommendation, explain WHY it's a good fit in 1-2 sentences.

Respond ONLY with valid JSON in this exact format, no other text:
[
  {"slug": "trailer-slug-here", "reason": "Why this trailer is recommended"},
  {"slug": "trailer-slug-here", "reason": "Why this trailer is recommended"},
  {"slug": "trailer-slug-here", "reason": "Why this trailer is recommended"}
]`;

    // Call Bedrock Nova Micro
    const bedrockResponse = await bedrock.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inferenceConfig: {
          max_new_tokens: 500,
          temperature: 0.3,
        },
        messages: [
          { role: 'user', content: [{ text: prompt }] },
        ],
      }),
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    const aiText = responseBody.output?.message?.content?.[0]?.text || '[]';

    // Parse AI response — extract JSON from the response
    let recommendations;
    try {
      const jsonMatch = aiText.match(/\[[\s\S]*\]/);
      recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      recommendations = [];
    }

    // Enrich recommendations with full trailer data
    const enriched = recommendations.slice(0, 3).map(rec => {
      const trailer = trailers.find(t => t.slug === rec.slug);
      if (!trailer) return null;
      return {
        slug: trailer.slug,
        name: trailer.name,
        category: trailer.category,
        brand: trailer.brand,
        price: trailer.price,
        gvwr: trailer.gvwr,
        payload: trailer.payload,
        image: trailer.image,
        reason: rec.reason,
      };
    }).filter(Boolean);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ recommendations: enriched }),
    };
  } catch (err) {
    console.error('Recommend error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to generate recommendations' }),
    };
  }
};
