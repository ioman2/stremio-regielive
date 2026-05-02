# 🎬 RegieLive Subtitrări — Addon Stremio

Addon pentru Stremio care aduce subtitrări românești direct de pe **subtitrari.regielive.ro**.

## ✅ Funcționalități

- Subtitrări în **limba română** pentru filme și seriale
- Căutare automată după **IMDb ID**
- Suport complet pentru **filme** și **seriale** (sezon + episod)
- Afișează traducătorul și release-ul subtitrării

---

## 🚀 Instalare

### Cerințe
- [Node.js](https://nodejs.org/) v14 sau mai nou
- [Stremio](https://www.stremio.com/) instalat

### Pași

1. **Clonează sau descarcă** proiectul:
   ```bash
   # Dacă ai git:
   git clone <url-proiect>
   cd stremio-regielive

   # Sau extrage arhiva ZIP descărcată
   ```

2. **Instalează dependențele:**
   ```bash
   npm install
   ```

3. **Pornește addon-ul:**
   ```bash
   npm start
   ```
   Vei vedea:
   ```
   ✅ RegieLive Stremio Addon pornit pe http://localhost:7000
   📌 Adaugă în Stremio: http://localhost:7000/manifest.json
   ```

4. **Adaugă în Stremio:**
   - Deschide Stremio
   - Mergi la **Addon-uri** (iconița puzzle 🧩)
   - Click pe **+ Instalare addon comunitar**
   - Introdu URL-ul: `http://localhost:7000/manifest.json`
   - Click **Instalare**

---

## 🔧 Configurare port diferit

Dacă portul 7000 e ocupat, poți schimba:
```bash
PORT=8080 npm start
```

---

## ℹ️ Cum funcționează

Addon-ul trimite cereri către API-ul public al RegieLive (`api.regielive.ro`) folosind aceeași interfață ca addon-ul Kodi oficial. Subtitrările sunt returnate direct în Stremio și se pot selecta în playerul de video.

---

## 🐛 Probleme cunoscute

- RegieLive API poate fi instabil uneori (returnează erori JSON) — addon-ul gestionează aceste erori elegant
- Dacă nu apar subtitrări, verifică că serverul rulează și că Stremio poate accesa `localhost`

---

## 📜 Licență

MIT
