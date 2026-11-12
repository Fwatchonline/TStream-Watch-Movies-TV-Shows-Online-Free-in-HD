# TStream — Watch Movies & TV Shows Online in HD & 4K

[![Live Demo](https://img.shields.io/badge/LIVE_DEMO-tstream.online-F5C400?style=for-the-badge&logo=google-chrome&logoColor=black)](https://tstream.online)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Google Analytics](https://img.shields.io/badge/Google_Analytics-GA4_G--ZD66WMB19X-E37400?style=flat-square&logo=google-analytics&logoColor=white)](https://analytics.google.com/)

A modern, high-performance, dark-themed streaming web application for discovering and watching thousands of movies and TV series in **4K UHD and 1080p Full HD**. Features fast multi-server HLS playback, multilingual subtitles (Serbian, Croatian, Bosnian, English, and more), customizable embed providers via an Admin Console, zero advertisements, and complete Google Search Engine Optimization (SEO).

👉 **Live Production URL:** [https://tstream.online](https://tstream.online)

---

## 📑 Sadržaj / Table of Contents
1. [Glavne Karakteristike / Features](#glavne-karakteristike--features)
2. [Instalacija na VPS (Ubuntu / Debian Linux)](#1-instalacija-na-vps-server-ubuntu--debian)
3. [Ažuriranje na VPS Serveru (Update Guide)](#2-ažuriranje-koda-na-vps-serveru-update-guide)
4. [Instalacija i Ažuriranje na Vercel-u](#3-instalacija-i-update-na-vercel)
5. [Docker & Ostali Serveri (Netlify, Cloudflare)](#4-docker--ostale-platforme)
6. [Google Analitika & Google Search Console SEO](#5-google-analitika--google-search-console-seo)
7. [Admin Panel & Upravljanje Plejerima](#6-admin-panel--upravljanje-serverima)

---

## Glavne Karakteristike / Features

- 🎬 **Katalog Filmova i Serija**: Hiljade naslova, trending filmovi, najbolje ocenjeni, franšize, kolekcije, A-Z pretraga i platforme (Netflix, HBO, Disney+, Prime, Apple TV).
- ⚡ **Multi-Server HLS Plejer**: Izbor između direktnog HLS video plejera i podesivih Embed servera (HD, Ultra, Backup).
- 💬 **Višejezični Titlovi**: Automatska sinhronizacija i pretraga titlova (srpski, hrvatski, bosanski, engleski...).
- 📊 **Google Analitika (GA4)**: Unapred konfigurisana Google Analytics integracija (`G-ZD66WMB19X`) sa real-time praćenjem svakog klika i rute u SPA okruženju.
- 🔍 **SEO & XML Mape Sajta**: Automatizovani sitemap generator (`/sitemap.xml`, `/sitemap-movies.xml`, `/sitemap-tv.xml`), kanonski linkovi i Schema.org JSON-LD structured data.
- 🛡️ **Zaštićeni Admin Panel**: Dostupan isključivo administratoru (`miroslav87@gmail.com`) za dodavanje novih video servera i rešavanje korisničkih prijava.

---

## 1. Instalacija na VPS Server (Ubuntu / Debian)

Ovo uputstvo opisuje kompletnu instalaciju na čistom **Ubuntu 22.04 / 24.04 LTS** ili **Debian 12** VPS serveru koristeći **Node.js 22**, **Nginx** i besplatan **Let's Encrypt SSL sertifikat**.

### Korak 1: Priprema VPS servera i instalacija Node.js 22
Prijavite se na vaš VPS putem SSH-a:
```bash
ssh root@tvoja_vps_ip_adresa
```

Ažurirajte pakete i instalirajte neophodne alate:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx build-essential
```

Instalirajte **Node.js 22 LTS**:
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v   # Treba da ispise v22.x.x
npm -v
```

---

### Korak 2: Kloniranje repozitorijuma
Klonirajte projekat u preporučeni direktorijum `/var/www/tstream`:
```bash
sudo mkdir -p /var/www/tstream
sudo chown -R $USER:$USER /var/www/tstream
cd /var/www/tstream

git clone https://github.com/Fwatchonline/TStream-Watch-Movies-TV-Shows-Online-Free-in-HD.git .
```

---

### Korak 3: Instalacija paketa i kreiranje konfiguracije
Instalirajte sve zavisnosti:
```bash
npm install
```

Kreirajte `.env` datoteku:
```bash
nano .env
```
Upišite sledeće promenljive (prilagodite ukoliko imate sopstveni TMDB ključ):
```dotenv
TMDB_API_KEY=your_tmdb_api_key_here
VITE_TMDB_API_KEY=your_tmdb_api_key_here
APP_URL=https://tstream.online
PORT=3000
HOST=0.0.0.0
```
*(Sačuvajte pritiskom na `Ctrl + O`, `Enter`, pa izađite sa `Ctrl + X`)*.

---

### Korak 4: Build aplikacije (Sitemap, Vite, Prerender i Node.js Produkcijski Server)
Pokrenite automatizovani build:
```bash
npm run build
```
Ova komanda automatski:
1. Pokreće `scripts/generate-sitemaps.ts` i pravi sveže XML mape sajta u `/public` i `/dist`.
2. Kompajlira TypeScript i Tailwind CSS u `/dist`.
3. Pokreće `scripts/prerender.ts` za pre-rendering i strogu SEO validaciju statičkih stranica.
4. Pakuje `server.ts` u produkcijski Node.js server `dist/server.mjs`.

---

### Korak 5: Pokretanje servisa u pozadini preko PM2
Pokrenite produkcijski Node.js SEO + API server kao trajni sistemski proces:
```bash
pm2 start npm --name "tstream" -- start
pm2 save
pm2 startup
```
*(Kopirajte i pokrenite komandu koju vam PM2 izbaci da bi se aplikacija automatski dizala nakon restarta VPS-a).*

---

### Korak 6: Konfiguracija Nginx Web Servera
Kreirajte Nginx konfiguracioni fajl za vaš domen:
```bash
sudo nano /etc/nginx/sites-available/tstream.online
```
Pogledajte kompletnu produkcijsku Nginx konfiguraciju u fajlu [`nginx.conf.example`](./nginx.conf.example) koja pravilno prosleđuje nepoznate rute ka Node.js SSR/SEO serveru (`@seo_runtime` na portu 3000) tako da nepostojeće stranice vraćaju pravi HTTP 404 umesto lažnog 200 OK.

Aktivirajte sajt i testirajte Nginx:
```bash
sudo ln -sf /etc/nginx/sites-available/tstream.online /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### Korak 7: Instalacija besplatnog SSL Sertifikata (HTTPS)
Instalirajte Certbot i povucite automatski SSL sertifikat za vaš domen:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tstream.online -d www.tstream.online
```
Pratite uputstva na ekranu (unesite vaš email i izaberite opciju 2 za automatski HTTPS redirect).

Čestitamo! Vaš sajt je sada aktivan na **`https://tstream.online`**! 🎉

---

## 2. Ažuriranje Koda na VPS Serveru (Update Guide)

Kada na GitHub izbacite nove izmene ili ažurirate kôd, ažuriranje na vašem VPS-u možete uraditi na dva načina:

### Opcija A: Automatsko ažuriranje jednom komandom (Preporučeno)
U repozitorijumu se nalazi skripta `update-vps.sh`. Dovoljno je ući u folder i pokrenuti:
```bash
cd /var/www/tstream
chmod +x scripts/update-vps.sh
./scripts/update-vps.sh
```

### Opcija B: Ručno ažuriranje korak po korak
Ako želite da ručno ispratite svaki korak:
```bash
# 1. Ulazak u folder projekta
cd /var/www/tstream

# 2. Preuzimanje najnovijeg koda sa GitHub-a
git pull origin main

# 3. Instalacija eventualno novih npm paketa
npm install

# 4. Ponovni build i regeneracija sitemap-a
npm run build

# 5. Restartovanje PM2 procesa bez prekida u radu (Zero-downtime)
pm2 reload tstream

# 6. Osvežavanje Nginx-a
sudo systemctl reload nginx
```

---

## 3. Instalacija i Update na Vercel

Ako želite da hostujete frontend na **Vercel** platformi sa globalnim CDN-om:

### Korak 1: Povezivanje na Vercel
1. Otvorite [Vercel Dashboard](https://vercel.com/) i kliknite na **Add New Project**.
2. Povežite vaš GitHub repozitorijum `TStream-Watch-Movies-TV-Shows-Online-Free-in-HD`.
3. Vercel će automatski prepoznati **Vite** radni okvir.
4. Podešavanja projekta:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. U sekciji **Environment Variables** dodajte:
   - `TMDB_API_KEY`: `<your_tmdb_api_key>`
   - `VITE_TMDB_API_KEY`: `<your_tmdb_api_key>`
   - `APP_URL`: `https://tstream.online` (ili vaš Vercel domen)
6. Kliknite **Deploy**.

Repozitorijum već sadrži `vercel.json` datoteku koja automatski konfiguriše SPA rewrites (tako da sve rute poput `/watch/movie/:slug` i `/tv-shows` rade bez 404 grešaka).

### Ažuriranje na Vercel-u (Automatski CD/CI)
Svaki put kada uradite `git push` na granu `main`, Vercel automatski pokreće build, generiše nove sitemape i plasira osveženu verziju sajta u roku od 60 sekundi.

---

## 4. Docker & Ostale Platforme

### Pokretanje preko Docker-a
Kreirajte kontejner lokalno ili na serveru:
```bash
# Izgradnja slike
docker build -t tstream:latest .

# Pokretanje kontejnera na portu 3000
docker run -d -p 3000:3000 --name tstream-app tstream:latest
```

### Netlify
Za Netlify, `dist` folder sadrži sve potrebne datoteke. U folderu `public/` kreirajte datoteku `_redirects` sa sadržajem:
```text
/*    /index.html   200
```

---

## 5. Google Analitika & Google Search Console SEO

### Google Analitika (GA4)
U aplikaciju je integrisan zvanični Google tag:
- **Measurement ID**: **`G-ZD66WMB19X`**
- Tag je ugrađen u `<head>` sekciju `index.html`.
- Zahvaljujući rešenju u `src/utils/seo.ts`, Google Analitika beleži preglede stranica u realnom vremenu pri svakoj navigaciji u okviru Single Page Aplikacije (`page_view` događaji).

### XML Sitemaps za Google Search Console
Aplikacija automatski generiše validne mape sajta usklađene sa Google standardima:
- **`https://tstream.online/sitemap.xml`** (Glavni Sitemap Indeks)
- **`https://tstream.online/sitemap-main.xml`** (Sve stranice, kategorije, OTT platforme i A-Z)
- **`https://tstream.online/sitemap-movies.xml`** (Svi popularni filmovi sa direktnim watch linkovima)
- **`https://tstream.online/sitemap-tv.xml`** (Sve TV serije)

U **Google Search Console** idite na sekciju **Sitemaps**, unesite `sitemap.xml` i kliknite **Submit**.

---

## 6. Admin Panel & Upravljanje Serverima

TStream poseduje integrisan administrativni panel za upravljanje video plejerima i praćenje korisničkih prijava.

- **Pristup**: `/admin` (ili preko dugmeta u meniju).
- **Zaštita pristupa**: Pristup je dozvoljen **isključivo** administratoru sa e-mail adresom **`miroslav87@gmail.com`**. Svi ostali korisnici dobijaju bezbednosni ekran sa obaveštenjem o restrikciji.
- **Opcije u Admin Panelu**:
  1. **Playback Reports**: Prikaz korisničkih prijava za probleme sa zvukom, seckanjem, crnim ekranom ili netačnom epizodom, uz mogućnost označavanja statusa (*Open*, *Investigating*, *Resolved*).
  2. **Embed Players & Servers**: Dodavanje novih embed plejera, uključivanje/isključivanje postojećih servera (Server 1 Direct HLS, Server 2 HD, Server 3 Backup, Server 4 Ultra), promena redosleda i podešavanje URL šablona sa `{id}`, `{season}` i `{episode}` varijablama.
  3. **Real Views Counter**: Pregled baze stvarnih pregleda i korisničkih ocena sačuvanih u Firestore bazi.
  4. **Diagnostics**: Provera statusa eksternih CDN čvorova i TMDB API konekcije.

---

## 📜 Licenca i Pravno Obaveštenje (DMCA)

TStream koristi TMDB API za metapodatke, postere i opise filmova, ali nije podržan niti sertifikovan od strane TMDB-a. Striming provajderi i izvori titlova su eksterni servisi trećih strana. Korisnici i administratori su dužni da poštuju autorska prava i zakonske propise u svojoj jurisdikciji.

© 2026 [TStream.online](https://tstream.online). Sva prava zadržana.
