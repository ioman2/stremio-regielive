const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const fetch = require('node-fetch');

// ─── Manifest ───────────────────────────────────────────────────────────────
const manifest = {
  id: 'ro.regielive.stremio.subtitles',
  version: '1.0.0',
  name: 'RegieLive Subtitrări',
  description: 'Subtitrări în română de pe subtitrari.regielive.ro',
  logo: 'https://subtitrari.regielive.ro/favicon.ico',
  resources: ['subtitles'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [],
};

const builder = new addonBuilder(manifest);

// ─── Constante API ───────────────────────────────────────────────────────────
const API_BASE = 'https://api.regielive.ro/kodi';
const SEARCH_URL = `${API_BASE}/cauta.php`;
const DOWNLOAD_URL = `${API_BASE}/descarca.php`;
const API_KEY = 'YWxleGFuZHJ1LmhlcmN1bGVhbnVAZ21haWwuY29t'; // cheie publică din addon-ul Kodi

const HEADERS = {
  'User-Agent': 'Kodi/19.0 (X11; Linux x86_64) stremio-addon/1.0',
  'Content-Type': 'application/x-www-form-urlencoded',
};

// ─── Căutare subtitrări ───────────────────────────────────────────────────────
async function searchSubtitles({ imdbId, type, season, episode }) {
  const imdbNum = imdbId.replace('tt', '');

  const params = new URLSearchParams({
    key: API_KEY,
    imdb: imdbNum,
    lang: 'ro',
  });

  if (type === 'series' && season && episode) {
    params.append('sezon', String(season));
    params.append('episod', String(episode));
  }

  try {
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: HEADERS,
      body: params.toString(),
      timeout: 10000,
    });

    if (!res.ok) {
      console.error(`[RegieLive] HTTP ${res.status} la căutare`);
      return [];
    }

    const text = await res.text();
    if (!text || text.trim() === '') return [];

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('[RegieLive] Răspuns JSON invalid:', text.slice(0, 200));
      return [];
    }

    // API-ul poate returna un array sau un obiect cu proprietatea "subtitrari"
    const lista = Array.isArray(data)
      ? data
      : Array.isArray(data?.subtitrari)
      ? data.subtitrari
      : [];

    return lista;
  } catch (err) {
    console.error('[RegieLive] Eroare la fetch:', err.message);
    return [];
  }
}

// ─── Handler subtitrări ───────────────────────────────────────────────────────
builder.defineSubtitlesHandler(async ({ type, id, extra }) => {
  // id format: "tt1234567" pentru filme, "tt1234567:1:1" pentru seriale
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1] ? parseInt(parts[1]) : null;
  const episode = parts[2] ? parseInt(parts[2]) : null;

  console.log(`[RegieLive] Căutare ${type} | ${imdbId} | S${season}E${episode}`);

  const lista = await searchSubtitles({ imdbId, type, season, episode });

  if (!lista.length) {
    console.log('[RegieLive] Nicio subtitrare găsită');
    return { subtitles: [] };
  }

  const subtitles = lista.map((sub, idx) => {
    // Construim URL-ul de descărcare
    const dlParams = new URLSearchParams({
      key: API_KEY,
      id: sub.id,
    });
    const url = `${DOWNLOAD_URL}?${dlParams.toString()}`;

    const translator = sub.traducator || sub.user || 'Anonim';
    const releaseInfo = sub.release || '';
    const label = `🇷🇴 ${translator}${releaseInfo ? ' · ' + releaseInfo : ''}`;

    return {
      id: `regielive-${sub.id || idx}`,
      url,
      lang: 'ron', // ISO 639-2 pentru română
      name: label,
    };
  });

  console.log(`[RegieLive] Găsite ${subtitles.length} subtitrări`);
  return { subtitles };
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), { port: PORT });
console.log(`✅ RegieLive Stremio Addon pornit pe http://localhost:${PORT}`);
console.log(`📌 Adaugă în Stremio: http://localhost:${PORT}/manifest.json`);
