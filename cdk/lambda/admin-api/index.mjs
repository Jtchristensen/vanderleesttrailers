import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { composeTitle } from './trailer-title.mjs';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const s3 = new S3Client({});

const TABLE = process.env.TABLE_NAME;
const IMAGES_BUCKET = process.env.IMAGES_BUCKET;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
};

export const handler = async (event) => {
  const { httpMethod, resource, pathParameters, body } = event;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const parsed = body ? JSON.parse(body) : {};

    // PUT /api/admin/content/{type} — update content
    if (resource === '/api/admin/content/{type}' && httpMethod === 'PUT') {
      const type = pathParameters.type;
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          pk: type,
          sk: parsed.sk || '_',
          data: parsed.data,
          updatedAt: new Date().toISOString(),
        },
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // POST /api/admin/trailers — create trailer
    if (resource === '/api/admin/trailers' && httpMethod === 'POST') {
      const title = applyTitle(parsed.data);
      if (!title) return badTitle();
      const slug = parsed.data?.slug || generateSlug(title);
      parsed.data.slug = slug;
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          pk: 'TRAILER',
          sk: slug,
          data: parsed.data,
          updatedAt: new Date().toISOString(),
        },
      }));
      return { statusCode: 201, headers, body: JSON.stringify({ success: true, slug }) };
    }

    // PUT /api/admin/trailers/{slug} — update trailer
    if (resource === '/api/admin/trailers/{slug}' && httpMethod === 'PUT') {
      const slug = pathParameters.slug;
      if (!applyTitle(parsed.data)) return badTitle();
      parsed.data.slug = slug;
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          pk: 'TRAILER',
          sk: slug,
          data: parsed.data,
          updatedAt: new Date().toISOString(),
        },
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // DELETE /api/admin/trailers/{slug} — delete trailer
    if (resource === '/api/admin/trailers/{slug}' && httpMethod === 'DELETE') {
      const slug = pathParameters.slug;
      await ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { pk: 'TRAILER', sk: slug },
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // POST /api/admin/upload — get pre-signed upload URL
    if (resource === '/api/admin/upload' && httpMethod === 'POST') {
      const { fileName, contentType } = parsed;
      const ext = fileName?.split('.').pop() || 'jpg';
      const key = `uploads/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

      const command = new PutObjectCommand({
        Bucket: IMAGES_BUCKET,
        Key: key,
        ContentType: contentType || 'image/jpeg',
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          uploadUrl,
          imageUrl: `/uploads/${key.replace('uploads/', '')}`,
          key,
        }),
      };
    }

    // PUT /api/admin/trailers — batch update sort order
    if (resource === '/api/admin/trailers' && httpMethod === 'PUT') {
      const { orders } = parsed;
      if (!Array.isArray(orders)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'orders array required' }) };
      }
      await Promise.all(orders.map(({ slug, sortOrder }) =>
        ddb.send(new UpdateCommand({
          TableName: TABLE,
          Key: { pk: 'TRAILER', sk: slug },
          UpdateExpression: 'SET #data.#so = :so, updatedAt = :now',
          ExpressionAttributeNames: { '#data': 'data', '#so': 'sortOrder' },
          ExpressionAttributeValues: { ':so': sortOrder, ':now': new Date().toISOString() },
        }))
      ));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // GET /api/admin/trailers — list all trailers (admin view)
    if (resource === '/api/admin/trailers' && httpMethod === 'GET') {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'TRAILER' },
      }));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(
          (result.Items?.map(i => ({ ...i.data, _sk: i.sk, _updatedAt: i.updatedAt })) || []).sort((a, b) => {
            const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
            const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            // Default order mirrors the source site: newest published first.
            const aDate = a.publishedAt || '';
            const bDate = b.publishedAt || '';
            if (aDate !== bDate) return bDate.localeCompare(aDate);
            // `name` is the pre-title field; records keep it until the migration contracts.
            return (a.title || a.name || '').localeCompare(b.title || b.name || '');
          })
        ),
      };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

/**
 * Stores the derived title on the record and drops the legacy free-text name.
 *
 * Persisting it keeps the read paths simple — the public API, the chat
 * assistant, and the slug all read one string instead of each re-deriving it
 * from six fields. Returns the title so callers can reject an empty one.
 */
function applyTitle(data) {
  if (!data) return '';
  const title = composeTitle(data);
  data.title = title;
  delete data.name;
  return title;
}

function badTitle() {
  return {
    statusCode: 400,
    headers,
    body: JSON.stringify({ error: 'Trailer needs at least a year, make, model, or size — the title is built from those' }),
  };
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
