# RegieLive Subtitrări — Addon Stremio

Addon Stremio pentru subtitrări românești de pe subtitrari.regielive.ro.

## Rulare locală

```bash
npm install
npm start
```

Addon local:

```text
http://localhost:7000/manifest.json
```

## Rulare online

Pentru Render, Railway, Fly.io sau alt hosting Node.js:

1. Încarcă proiectul pe GitHub.
2. Setează comanda de instalare:

```bash
npm install
```

3. Setează comanda de pornire:

```bash
npm start
```

4. Setează variabila de mediu:

```text
PUBLIC_URL=https://github.com/ioman2/stremio-regielive
```

Exemplu Render:

```text
PUBLIC_URL=https://stremio-regielive.onrender.com
```

Apoi instalezi în Stremio:

```text
https://github.com/ioman2/stremio-regielive/manifest.json
```

## Observații importante

- Nu folosi `localhost` dacă vrei să meargă online.
- Serverul are nevoie de un host Node.js permanent sau semi-permanent.
- Pe planurile gratuite, unele platforme pot adormi serviciul după inactivitate.
