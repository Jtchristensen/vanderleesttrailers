import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

export const handler = async (event) => {
  const { httpMethod, resource, pathParameters } = event;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // GET /api/content/{type}
    if (resource === '/api/content/{type}') {
      const type = pathParameters.type;
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': type },
      }));

      // If single item (sk = '_'), return the item directly
      const items = result.Items || [];
      if (items.length === 1 && items[0].sk === '_') {
        return { statusCode: 200, headers, body: JSON.stringify(items[0].data) };
      }
      // Otherwise return array of items
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(items.map(i => i.data)),
      };
    }

    // GET /api/trailers
    if (resource === '/api/trailers') {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'TRAILER' },
      }));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(
          (result.Items?.map(i => i.data) || []).sort((a, b) => {
            const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
            const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return (a.name || '').localeCompare(b.name || '');
          })
        ),
      };
    }

    // GET /api/trailers/{slug}
    if (resource === '/api/trailers/{slug}') {
      const slug = pathParameters.slug;
      const result = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { pk: 'TRAILER', sk: slug },
      }));

      if (!result.Item) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Trailer not found' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(result.Item.data) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
