// Live Google reviews proxy.
//
// Calls the Google Places API (New) Place Details endpoint server-side so the
// API key never reaches the browser, normalizes the response to the same shape
// the frontend already uses for static reviews ({ name, rating, text, ... }),
// and caches the result in the warm Lambda container to stay well within
// Google's free tier. CloudFront adds a second, edge-level cache on top.
//
// Google's Places API only returns up to 5 "most relevant" reviews per place —
// there is no official way to page through all of them. The frontend keeps its
// hand-written reviews as a fallback whenever this endpoint is unavailable.

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// Config comes from a Secrets Manager secret holding JSON:
//   { "GOOGLE_MAPS_API_KEY": "...", "GOOGLE_PLACE_ID": "ChIJ..." }
// Plain env vars are honored as a fallback (handy for local testing).
const SECRET_ARN = process.env.REVIEWS_SECRET_ARN;

const secretsClient = new SecretsManagerClient({});
let configPromise = null; // cached across warm invocations

async function loadConfig() {
  if (configPromise) return configPromise;
  configPromise = (async () => {
    let fromSecret = {};
    if (SECRET_ARN) {
      try {
        const res = await secretsClient.send(
          new GetSecretValueCommand({ SecretId: SECRET_ARN })
        );
        fromSecret = JSON.parse(res.SecretString || '{}');
      } catch (err) {
        console.error('Failed to read reviews secret:', err);
      }
    }
    return {
      apiKey: fromSecret.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY,
      placeId: fromSecret.GOOGLE_PLACE_ID || process.env.GOOGLE_PLACE_ID,
    };
  })();
  return configPromise;
}

// How long a warm container may reuse a fetched result. 6h keeps us far under
// any quota concern while still surfacing new reviews the same day.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

// Module-scope cache — survives across invocations on a warm container.
let cache = null; // { data, timestamp }

function normalize(place) {
  const reviews = (place.reviews || []).map((r) => ({
    name: r.authorAttribution?.displayName || 'Google Reviewer',
    rating: r.rating ?? 5,
    text: r.originalText?.text || r.text?.text || '',
    relativeTime: r.relativePublishTimeDescription || '',
    authorPhoto: r.authorAttribution?.photoUri || '',
    authorUrl: r.authorAttribution?.uri || '',
  }));

  return {
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    googleMapsUri: place.googleMapsUri || '',
    reviews,
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { apiKey, placeId } = await loadConfig();
  if (!apiKey || !placeId) {
    console.error('Missing Google API key or place id (secret + env both empty)');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Reviews not configured' }),
    };
  }

  // Serve from the warm-container cache when fresh.
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return { statusCode: 200, headers, body: JSON.stringify(cache.data) };
  }

  try {
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        // Only pull the fields we render — keeps us on the cheapest SKU.
        'X-Goog-FieldMask':
          'rating,userRatingCount,googleMapsUri,reviews.rating,reviews.text,reviews.originalText,reviews.relativePublishTimeDescription,reviews.authorAttribution',
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Places API error', res.status, body);
      // Fall back to a stale cache if we have one, else signal failure so the
      // frontend uses its own static reviews.
      if (cache) {
        return { statusCode: 200, headers, body: JSON.stringify(cache.data) };
      }
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Upstream reviews unavailable' }),
      };
    }

    const place = await res.json();
    const data = normalize(place);
    cache = { data, timestamp: Date.now() };
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    console.error('Error fetching reviews:', err);
    if (cache) {
      return { statusCode: 200, headers, body: JSON.stringify(cache.data) };
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
