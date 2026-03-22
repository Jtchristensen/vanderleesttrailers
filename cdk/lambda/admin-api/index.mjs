import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

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
      const slug = parsed.data?.slug || generateSlug(parsed.data?.name || 'trailer');
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
        body: JSON.stringify(result.Items?.map(i => ({ ...i.data, _sk: i.sk, _updatedAt: i.updatedAt })) || []),
      };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
