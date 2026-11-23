const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=60',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };

  const params = event.queryStringParameters || {};
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const radius = Number(params.radius);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || !Number.isFinite(radius) || radius < 500 || radius > 30000) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Position ou distance invalide.' }) };
  }

  const around = `around:${Math.round(radius)},${lat.toFixed(6)},${lng.toFixed(6)}`;
  const query = `[out:json][timeout:25];(nwr(${around})[name][amenity];nwr(${around})[name][leisure];nwr(${around})[name][tourism];nwr(${around})[name][sport];nwr(${around})[name][historic];nwr(${around})[name][natural];nwr(${around})[name][shop];);out center tags;`;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
  ];
  let lastStatus = 502;
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': 'SORTIR-app/0.1 (nearby places search)' },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal
      });
      if (!response.ok) { lastStatus = response.status; continue; }
      const data = await response.json();
      if (!Array.isArray(data.elements)) { lastStatus = 502; continue; }
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    } catch (error) {
      lastStatus = error.name === 'AbortError' ? 504 : 502;
    } finally {
      clearTimeout(timer);
    }
  }
  return { statusCode: lastStatus, headers: { ...headers, 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'Les serveurs cartographiques ne répondent pas pour le moment. Réessaie dans un instant.' }) };
};
