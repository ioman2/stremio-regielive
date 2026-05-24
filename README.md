# Stremio RegieLive Subtitrări

Addon Stremio pentru subtitrări românești de pe RegieLive.

## Instalare online pe Render

1. Urcă acest proiect pe GitHub.
2. Intră pe https://render.com și conectează-te cu GitHub.
3. New → Web Service → alege repository-ul.
4. Setări:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. După primul deploy, copiază linkul Render, de exemplu:
   `https://stremio-regielive.onrender.com`
6. În Render → Environment adaugă:
   `PUBLIC_URL=https://stremio-regielive.onrender.com`
7. Redeploy.
8. În Stremio instalează:
   `https://stremio-regielive.onrender.com/manifest.json`

## Local, pentru test

```bash
npm install
npm start
```

Deschide:

```text
http://localhost:7000/manifest.json
```
