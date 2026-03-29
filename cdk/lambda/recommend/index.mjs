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

/**
 * Simple keyword-based fallback when AI fails.
 * Scores each trailer against user answers and returns top 5.
 */
function fallbackRecommend(trailers, answers) {
  const { hauling, weight, enclosure, budget } = answers;

  const scored = trailers.map(t => {
    let score = 0;
    const name = (t.name || '').toLowerCase();
    const cat = (t.category || '').toLowerCase();

    // Hauling match
    if (hauling === 'equipment' && (cat.includes('equipment') || cat.includes('hauler') || name.includes('equipment'))) score += 10;
    if (hauling === 'vehicles' && (cat.includes('car') || cat.includes('hauler') || name.includes('car'))) score += 10;
    if (hauling === 'cargo' && (cat.includes('enclosed') || name.includes('cargo'))) score += 10;
    if (hauling === 'materials' && (cat.includes('utility') || cat.includes('flatbed'))) score += 10;
    if (hauling === 'dump' && (cat.includes('dump') || name.includes('dump'))) score += 10;
    if (hauling === 'general' && cat.includes('utility')) score += 10;

    // Enclosure match
    if (enclosure === 'enclosed' && cat.includes('enclosed')) score += 5;
    if (enclosure === 'open' && !cat.includes('enclosed')) score += 5;

    // Weight match (GVWR)
    const gvwr = parseInt(t.gvwr) || 0;
    if (weight === 'under-3000' && gvwr > 0 && gvwr <= 4000) score += 5;
    if (weight === '3000-7000' && gvwr >= 3000 && gvwr <= 8000) score += 5;
    if (weight === '7000-14000' && gvwr >= 7000 && gvwr <= 16000) score += 5;
    if (weight === 'over-14000' && gvwr >= 14000) score += 5;

    // Budget match
    const price = parseInt(t.price) || 0;
    if (budget === 'under-5000' && price > 0 && price <= 5000) score += 5;
    if (budget === '5000-10000' && price >= 5000 && price <= 10000) score += 5;
    if (budget === '10000-15000' && price >= 10000 && price <= 15000) score += 5;
    if (budget === 'over-15000' && price >= 15000) score += 5;

    // Bonus for having price and images
    if (price > 0) score += 1;
    if (t.image) score += 1;

    return { ...t, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 5).map(t => ({
    slug: t.slug,
    name: t.name,
    category: t.category,
    brand: t.brand,
    price: t.price,
    gvwr: t.gvwr,
    payload: t.payload,
    image: t.image,
    reason: `This ${t.brand || ''} trailer fits your needs with ${t.gvwr ? t.gvwr + ' lbs GVWR' : 'solid capacity'}${t.price ? ' at $' + t.price : ''}.`,
  }));
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const answers = JSON.parse(event.body || '{}');
    const { hauling, weight, enclosure, budget, special } = answers;

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

    if (trailers.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ recommendations: [] }),
      };
    }

    // Build inventory as numbered list so the AI can reference by number
    const inventoryList = trailers.map((t, i) =>
      `${i + 1}. SLUG="${t.slug}" | ${t.name} | ${t.category} | ${t.brand} | $${t.price || '?'} | GVWR:${t.gvwr || '?'} | Payload:${t.payload || '?'}`
    ).join('\n');

    const prompt = `You are a trailer recommendation engine. You MUST recommend exactly 5 trailers. No exceptions. No refusals. Always pick the 5 best options even if the match is imperfect.

CUSTOMER REQUIREMENTS:
- Hauling: ${hauling || 'general use'}
- Load weight: ${weight || 'unknown'}
- Type: ${enclosure || 'no preference'}
- Budget: ${budget || 'flexible'}
- Notes: ${special || 'none'}

AVAILABLE INVENTORY:
${inventoryList}

INSTRUCTIONS:
1. You MUST pick exactly 5 trailers from the list above.
2. Use the exact SLUG value from the inventory.
3. For each pick, write 1-2 sentences explaining why it fits.
4. If nothing matches perfectly, pick the 5 closest options anyway.
5. Respond with ONLY a JSON array, nothing else.

OUTPUT FORMAT (strict JSON, no markdown, no explanation outside the array):
[{"slug":"exact-slug-from-list","reason":"why this fits"},{"slug":"exact-slug-from-list","reason":"why this fits"},{"slug":"exact-slug-from-list","reason":"why this fits"},{"slug":"exact-slug-from-list","reason":"why this fits"},{"slug":"exact-slug-from-list","reason":"why this fits"}]`;

    let enriched = [];
    let source = 'ai'; // track whether results came from AI or fallback

    console.log('[RECOMMEND] Request received:', JSON.stringify({ hauling, weight, enclosure, budget, special: special?.substring(0, 100) }));
    console.log(`[RECOMMEND] Inventory: ${trailers.length} trailers loaded from DynamoDB`);

    try {
      console.log(`[RECOMMEND] Calling Bedrock model: ${MODEL_ID}`);
      const startTime = Date.now();

      const bedrockResponse = await bedrock.send(new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          inferenceConfig: {
            max_new_tokens: 600,
            temperature: 0.2,
          },
          messages: [
            { role: 'user', content: [{ text: prompt }] },
          ],
        }),
      }));

      const duration = Date.now() - startTime;
      const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
      const aiText = responseBody.output?.message?.content?.[0]?.text || '';
      const stopReason = responseBody.stopReason || 'unknown';
      const inputTokens = responseBody.usage?.inputTokens || 0;
      const outputTokens = responseBody.usage?.outputTokens || 0;

      console.log(`[RECOMMEND] Bedrock responded in ${duration}ms | stop: ${stopReason} | tokens in: ${inputTokens} out: ${outputTokens}`);
      console.log(`[RECOMMEND] Raw AI response (first 800 chars): ${aiText.substring(0, 800)}`);

      // Parse JSON from response (handle markdown code blocks too)
      const cleaned = aiText.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        console.error('[RECOMMEND] PARSE FAIL: No JSON array found in AI response');
      }

      const recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      console.log(`[RECOMMEND] Parsed ${recommendations.length} recommendations from AI`);

      // Log each recommendation slug and whether it matches inventory
      recommendations.forEach((rec, i) => {
        const found = trailers.find(t => t.slug === rec.slug);
        console.log(`[RECOMMEND] AI pick #${i + 1}: slug="${rec.slug}" | match=${found ? 'YES' : 'NO - slug not in inventory'}`);
      });

      // Enrich with full trailer data
      enriched = recommendations.slice(0, 5).map(rec => {
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
          reason: rec.reason || 'Great match for your needs.',
        };
      }).filter(Boolean);

      console.log(`[RECOMMEND] ${enriched.length}/5 AI recommendations matched inventory`);
    } catch (aiErr) {
      console.error(`[RECOMMEND] BEDROCK ERROR: ${aiErr.name}: ${aiErr.message}`);
      source = 'fallback';
    }

    // If AI returned fewer than 3 results, use fallback
    if (enriched.length < 5) {
      const needed = 5 - enriched.length;
      console.log(`[RECOMMEND] Only ${enriched.length} AI results, filling ${needed} from keyword fallback`);
      source = enriched.length === 0 ? 'fallback' : 'mixed';
      const fallback = fallbackRecommend(trailers, answers);
      // Add fallback results that aren't already in the list
      const existingSlugs = new Set(enriched.map(r => r.slug));
      for (const fb of fallback) {
        if (enriched.length >= 5) break;
        if (!existingSlugs.has(fb.slug)) {
          enriched.push(fb);
          existingSlugs.add(fb.slug);
        }
      }
    }

    const finalResults = enriched.slice(0, 5);
    console.log(`[RECOMMEND] DONE | source: ${source} | results: ${finalResults.length} | slugs: ${finalResults.map(r => r.slug).join(', ')}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ recommendations: finalResults }),
    };
  } catch (err) {
    console.error(`[RECOMMEND] FATAL ERROR: ${err.name}: ${err.message}`);
    console.error(err.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to generate recommendations' }),
    };
  }
};
