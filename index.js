const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const fetch = require('node-fetch');
const http = require('http');
const https = require('https');
const zlib = require('zlib');

// ─── Manifest ───────────────────────────────────────────────────────────────
const manifest = {
  id: 'ro.regielive.stremio.subtitles',
  version: '1.1.0',
  name: 'RegieLive Subtitrări',
  description: 'Subtitrări în română de pe subtitrari.regielive.ro',
  logo: 'https://subtitrari.regielive.ro/favicon.ico',
  resources: ['subtitles'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [],
};

const builder = new addonBuilder(manifest);

// ─── Constante ───────────────────────────────────────────────────────────────
const API_BASE   = 'https://api.regielive.ro/kodi';
const SEARCH_URL = `${API_BASE}/cauta.php`;
const DL_URL     = `${API_BASE}/descarca.php`;
const API_KEY    = 'YWxleGFuZHJ1LmhlcmN1bGVhbnVAZ21haWwuY29t';
const PORT       = process.env.PORT || 7000;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// Agent care dezactivează verificarea certificatelor (necesar uneori pentru regielive)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const HEADERS = {
  'User-Agent': 'Kodi/21.0 (X11; Linux x86_64) stremio-addon/1.1',
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ro-RO,ro;q=0.9',
};

// ─── Helper: fetch cu timeout ─────────────────────────────────────────────────
function fetchWithTimeout(url, options = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal, agent: httpsAgent })
    .finally(() => clearTimeout(timer));
}

// ─── Căutare subtitrări via API ───────────────────────────────────────────────
async function searchSubtitles({ imdbId, type, season, episode }) {
  const imdbNum = imdbId.replace('tt', '');

  const params = new URLSearchParams({ key: API_KEY, imdb: imdbNum, lang: 'ro' });
  if (type === 'series' && season && episode) {
    params.append('sezon', String(season));
    params.append('episod', String(episode));
  }

  try {
    const res = await fetchWithTimeout(SEARCH_URL, {
      method: 'POST',
      headers: HEADERS,
      body: params.toString(),
    });

    if (!res.ok) {
      console.error(`[RegieLive] HTTP ${res.status} la căutare`);
      return [];
    }

    const text = await res.text();
    if (!text || text.trim() === '' || text.trim().startsWith('<')) {
      console.error('[RegieLive] API a returnat HTML sau răspuns gol (posibil blocat)');
      return [];
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('[RegieLive] JSON invalid:', text.slice(0, 300));
      return [];
    }

    // API poate returna array direct sau obiect cu "subtitrari"
    const lista = Array.isArray(data)
      ? data
      : Array.isArray(data?.subtitrari)
      ? data.subtitrari
      : [];

    console.log(`[RegieLive] API a returnat ${lista.length} subtitrări`);
    return lista;
  } catch (err) {
    console.error('[RegieLive] Eroare căutare:', err.message);
    return [];
  }
}

// ─── Handler subtitrări ───────────────────────────────────────────────────────
builder.defineSubtitlesHandler(async ({ type, id }) => {
  const parts   = id.split(':');
  const imdbId  = parts[0];
  const season  = parts[1] ? parseInt(parts[1]) : null;
  const episode = parts[2] ? parseInt(parts[2]) : null;

  console.log(`\n[RegieLive] >>> ${type} | ${imdbId} | S${season}E${episode}`);

  const lista = await searchSubtitles({ imdbId, type, season, episode });
  if (!lista.length) return { subtitles: [] };

  // Construim URL-urile proxy local — Stremio le accesează prin addon
  const subtitles = lista.map((sub, idx) => {
    const subId = sub.id || idx;
    // URL proxy prin serverul local — addon-ul descarcă și trimite fișierul direct
    const url = `${PUBLIC_URL}/subtitle-proxy/${subId}`;

    const translator  = sub.traducator || sub.user || 'Anonim';
    const releaseInfo = sub.release || '';
    const label       = `🇷🇴 ${translator}${releaseInfo ? ' · ' + releaseInfo : ''}`;

    return {
      id:   `regielive-${subId}`,
      url,
      lang: 'ron',
      name: label,
    };
  });

  console.log(`[RegieLive] Returnez ${subtitles.length} subtitrări`);
  return { subtitles };
});

// ─── Server manual cu endpoint proxy descărcare ───────────────────────────────
// stremio-addon-sdk nu permite adăugarea de rute custom, deci
// construim serverul separat și adăugăm ruta /subtitle-proxy/:id manual.

const addonInterface = builder.getInterface();

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ── Proxy descărcare subtitrare ──────────────────────────────────────────
  const proxyMatch = req.url.match(/^\/subtitle-proxy\/(\d+)/);
  if (proxyMatch) {
    const subId = proxyMatch[1];
    const dlLink = `${DL_URL}?key=${API_KEY}&id=${subId}`;
    console.log(`[ProxyDL] Descărcare id=${subId}`);

    try {
      const dlRes = await fetchWithTimeout(dlLink, {
        headers: {
          ...HEADERS,
          'Referer': 'https://subtitrari.regielive.ro/',
        },
        redirect: 'follow',
      });

      if (!dlRes.ok) {
        console.error(`[ProxyDL] HTTP ${dlRes.status}`);
        res.writeHead(502);
        res.end('Eroare descărcare subtitrare');
        return;
      }

      const contentType = dlRes.headers.get('content-type') || '';
      const buffer = await dlRes.buffer();

      // Dacă e zip, extragem primul .srt
      if (
        contentType.includes('zip') ||
        buffer.slice(0, 4).toString('hex') === '504b0304'
      ) {
        console.log('[ProxyDL] Fișier ZIP detectat, extrag SRT...');
        try {
          const srt = extractSrtFromZip(buffer);
          if (srt) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="subtitle.srt"`);
            res.writeHead(200);
            res.end(srt);
            return;
          }
        } catch (e) {
          console.error('[ProxyDL] Eroare extragere ZIP:', e.message);
        }
      }

      // Altfel trimitem direct
      res.setHeader('Content-Type', contentType || 'text/plain');
      res.writeHead(200);
      res.end(buffer);
    } catch (err) {
      console.error('[ProxyDL] Eroare:', err.message);
      res.writeHead(504);
      res.end('Timeout descărcare');
    }
    return;
  }

  // ── Restul requesturilor: addon SDK ──────────────────────────────────────
  // Simulăm express-like handling prin SDK
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;

  if (pathname === '/manifest.json') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(addonInterface.manifest));
    return;
  }

  // Rute SDK standard
  const routeHandled = handleAddonRoute(addonInterface, pathname, urlObj.searchParams, res);
  if (!routeHandled) {
    res.writeHead(404);
    res.end('Not found');
  }
});

// ─── Router simplu pentru SDK ────────────────────────────────────────────────
function handleAddonRoute(iface, pathname, params, res) {
  // /subtitles/{type}/{id}.json
  const subMatch = pathname.match(/^\/subtitles\/([^/]+)\/(.+)\.json$/);
  if (subMatch) {
    const [, type, id] = subMatch;
    const decodedId = decodeURIComponent(id);
    iface.get({ resource: 'subtitles', type, id: decodedId }, (err, result) => {
      res.setHeader('Content-Type', 'application/json');
      if (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ subtitles: [] }));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(result));
      }
    });
    return true;
  }
  return false;
}

// ─── Extragere SRT din ZIP (minimal, fără dependențe externe) ────────────────
function extractSrtFromZip(buffer) {
  // Căutăm Local File Headers (PK\x03\x04) și extragem primul .srt
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (
      buffer[offset] === 0x50 &&
      buffer[offset + 1] === 0x4b &&
      buffer[offset + 2] === 0x03 &&
      buffer[offset + 3] === 0x04
    ) {
      const compression    = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const nameLen        = buffer.readUInt16LE(offset + 26);
      const extraLen       = buffer.readUInt16LE(offset + 28);
      const fileName       = buffer.slice(offset + 30, offset + 30 + nameLen).toString('utf8');
      const dataOffset     = offset + 30 + nameLen + extraLen;
      const compData       = buffer.slice(dataOffset, dataOffset + compressedSize);

      if (fileName.toLowerCase().endsWith('.srt') || fileName.toLowerCase().endsWith('.txt')) {
        console.log(`[ZIP] Extrag: ${fileName} (compression=${compression})`);
        if (compression === 0) {
          return compData; // Stored, fără compresie
        } else if (compression === 8) {
          return zlib.inflateRawSync(compData); // Deflate
        }
      }

      offset = dataOffset + compressedSize;
    } else {
      offset++;
    }
  }
  return null;
}

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n✅ RegieLive Stremio Addon pornit pe http://localhost:${PORT}`);
  console.log(`🌐 URL public setat: ${PUBLIC_URL}`);
  console.log(`📌 Adaugă în Stremio: ${PUBLIC_URL}/manifest.json\n`);
});
