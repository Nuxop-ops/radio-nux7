'use strict';
// Serwer Radia NUX7: katalog stacji, konta użytkowników i panel admina.
// Nie przesyła dźwięku. Podaje aplikacji adresy stacji: prosto od nadawcy
// albo, dla wybranych kont, przez pośrednika stacji na tym serwerze.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const wszystkieStacje = require('./stacje');
const wiadomosci = require('./wiadomosci');

const PORT = Number(process.env.PORT || 8032);
const DANE = process.env.DANE || path.join(__dirname, 'dane');
const ADRES_PUBLICZNY = (process.env.ADRES_PUBLICZNY || 'https://nux7.com').replace(/\/$/, '');
const POSREDNIK = (process.env.POSREDNIK || 'http://127.0.0.1:8790').replace(/\/$/, '');
// Klucz pośrednika stacji. Zostaje na serwerze, nikt go nie dostaje w adresie.
const KLUCZ_POSREDNIKA = process.env.KLUCZ_POSREDNIKA || process.env.TOKEN || '';
const RMF_ADRESY = process.env.RMF_ADRESY || 'https://www.rmfon.pl/stacje/flash_aac_{id}.xml.txt';
const BEZ_SIECI = process.env.BEZ_SIECI === '1';
// Najwyższa liczba kont. Po jej osiągnięciu rejestracja jest zamknięta.
const LIMIT_KONT = Number(process.env.LIMIT_KONT) || 20;

const PLIK_BAZY = path.join(DANE, 'baza.json');
const PLIK_ADRESOW = path.join(DANE, 'adresy-rmf.json');
const PLIK_KODU = path.join(DANE, 'kod-admina.txt');

const log = (...co) => console.log(new Date().toISOString(), ...co);

// ---------- Baza (plik JSON trzymany też w pamięci) ----------

fs.mkdirSync(DANE, { recursive: true });
let baza = { uzytkownicy: [], stacje: {} };
if (fs.existsSync(PLIK_BAZY)) {
  baza = Object.assign(baza, JSON.parse(fs.readFileSync(PLIK_BAZY, 'utf8')));
}
// Jednorazowo: słuchanie przez serwer włączone wszystkim istniejącym kontom.
// Później można je wyłączać pojedynczo w panelu admina.
if (!baza.serwerDlaWszystkich) {
  baza.uzytkownicy.forEach(u => { u.przezSerwer = true; });
  baza.serwerDlaWszystkich = true;
  zapiszBaze();
}
function zapiszBaze() {
  const tymczasowy = PLIK_BAZY + '.nowy';
  fs.writeFileSync(tymczasowy, JSON.stringify(baza, null, 1), { mode: 0o600 });
  fs.renameSync(tymczasowy, PLIK_BAZY);
}

// Kod do pierwszego nadania uprawnień admina. Znika po użyciu.
let kodAdmina = null;
if (!baza.uzytkownicy.some(u => u.admin)) {
  kodAdmina = fs.existsSync(PLIK_KODU)
    ? fs.readFileSync(PLIK_KODU, 'utf8').trim()
    : crypto.randomBytes(9).toString('base64url');
  fs.writeFileSync(PLIK_KODU, kodAdmina + '\n', { mode: 0o600 });
  log('Kod do aktywacji admina jest w pliku', PLIK_KODU);
} else if (fs.existsSync(PLIK_KODU)) {
  fs.unlinkSync(PLIK_KODU);
}

// ---------- Hasła i klucze logowania ----------

function skrotHasla(haslo, sol = crypto.randomBytes(16).toString('hex')) {
  return sol + ':' + crypto.scryptSync(haslo, sol, 64).toString('hex');
}
function hasloPasuje(haslo, zapisane) {
  const [sol, skrot] = String(zapisane).split(':');
  if (!sol || !skrot) return false;
  const a = Buffer.from(skrot, 'hex');
  const b = crypto.scryptSync(haslo, sol, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const skrotKlucza = klucz => crypto.createHash('sha256').update(klucz).digest('hex');

function nowyKlucz(uzytkownik) {
  const klucz = crypto.randomBytes(32).toString('base64url');
  uzytkownik.klucze = [skrotKlucza(klucz), ...(uzytkownik.klucze || [])].slice(0, 10);
  return klucz;
}
function uzytkownikZZapytania(req) {
  const naglowek = req.headers.authorization || '';
  if (!naglowek.startsWith('Bearer ')) return null;
  const skrot = skrotKlucza(naglowek.slice(7).trim());
  return baza.uzytkownicy.find(u => (u.klucze || []).includes(skrot)) || null;
}

// Ograniczenie prób logowania i rejestracji z jednego adresu.
const proby = new Map();
function zaDuzoProb(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const teraz = Date.now();
  const lista = (proby.get(ip) || []).filter(t => teraz - t < 10 * 60 * 1000);
  lista.push(teraz);
  proby.set(ip, lista);
  return lista.length > 20;
}
setInterval(() => proby.clear(), 60 * 60 * 1000).unref();

// ---------- Stacje ----------

let adresyRmf = {};
if (fs.existsSync(PLIK_ADRESOW)) {
  try { adresyRmf = JSON.parse(fs.readFileSync(PLIK_ADRESOW, 'utf8')); } catch (e) { adresyRmf = {}; }
}
let nazwyZPosrednika = null; // id -> nazwa; null, gdy pośrednik nie odpowiedział

function pobierz(adres, limitCzasu = 10000) {
  return new Promise((resolve, reject) => {
    const lib = adres.startsWith('https') ? https : http;
    const zadanie = lib.get(adres, { headers: { 'User-Agent': 'RadioNUX7/1.0' }, timeout: limitCzasu }, odp => {
      if (odp.statusCode !== 200) { odp.resume(); return reject(new Error('odpowiedź ' + odp.statusCode)); }
      let tresc = '';
      odp.setEncoding('utf8');
      odp.on('data', kawalek => { tresc += kawalek; if (tresc.length > 2e6) zadanie.destroy(); });
      odp.on('end', () => resolve(tresc));
    });
    zadanie.on('timeout', () => zadanie.destroy(new Error('brak odpowiedzi')));
    zadanie.on('error', reject);
  });
}

const doPosrednika = () => (KLUCZ_POSREDNIKA ? '?k=' + encodeURIComponent(KLUCZ_POSREDNIKA) : '');

// Sprawdza, czy pod adresem faktycznie nadaje stacja (odpowiedź 200 z dźwiękiem).
function adresGra(adres, limitCzasu = 5000) {
  return new Promise(resolve => {
    const lib = adres.startsWith('https') ? https : http;
    let koniec = false;
    const wynik = ok => { if (!koniec) { koniec = true; resolve(ok); } };
    const zadanie = lib.get(adres, { headers: { 'User-Agent': 'RadioNUX7/1.0' }, timeout: limitCzasu }, odp => {
      const typ = String(odp.headers['content-type'] || '');
      wynik(odp.statusCode === 200 && /audio|mpeg|aac|ogg|octet-stream/i.test(typ));
      zadanie.destroy();
    });
    zadanie.on('timeout', () => { zadanie.destroy(); wynik(false); });
    // Starsze serwery radiowe odpowiadają „ICY 200 OK", czego Node nie rozumie, ale stacja gra.
    zadanie.on('error', e => wynik(e.code === 'HPE_INVALID_CONSTANT'));
  });
}

// RMF podaje dla każdej stacji kilka adresów na różnych serwerach i nie wszystkie
// działają. Wybieramy pierwszy, który naprawdę nadaje.
async function znajdzAdresRmf(stacja) {
  const tresc = await pobierz(RMF_ADRESY.replace('{id}', stacja.rmfId));
  const wszystkie = (tresc.match(/https?:\/\/[^\s<>"']+/g) || []).filter(a => !/\.(xml|txt|png|jpg)(\?|$)/i.test(a));
  const kandydaci = [...new Set(wszystkie)].sort((x, y) => Number(y.startsWith('https://')) - Number(x.startsWith('https://')));
  for (const adres of kandydaci.slice(0, 8)) {
    if (await adresGra(adres)) return adres;
  }
  return null;
}

// Stacje spoza RMF, u których żaden adres nie nadaje. Sprawdzane razem z adresami RMF.
let martweStacje = new Set();
async function sprawdzPozostale() {
  const martwe = new Set();
  const kolejka = wszystkieStacje.filter(s => !s.rmfId && (s.adresy || []).length);
  const pracownik = async () => {
    for (let stacja = kolejka.shift(); stacja; stacja = kolejka.shift()) {
      let gra = false;
      for (const adres of stacja.adresy) { if (await adresGra(adres, 7000)) { gra = true; break; } }
      if (!gra) martwe.add(stacja.id);
    }
  };
  await Promise.all([1, 2, 3, 4].map(pracownik));
  // Gdyby padło prawie wszystko, to raczej kłopot z siecią serwera niż ze stacjami.
  if (martwe.size <= 15) martweStacje = martwe;
  log('Pozostałe stacje: nie nadaje', martwe.size, martwe.size ? '(' + [...martwe].join(', ') + ')' : '');
}

let odswiezanieTrwa = false;
async function odswiezAdresyRmf() {
  if (BEZ_SIECI || odswiezanieTrwa) return;
  odswiezanieTrwa = true;
  try {
    const kolejka = wszystkieStacje.filter(s => s.rmfId);
    let dzialajace = 0;
    const pracownik = async () => {
      for (let stacja = kolejka.shift(); stacja; stacja = kolejka.shift()) {
        try {
          const adres = await znajdzAdresRmf(stacja);
          if (adres) { adresyRmf[stacja.id] = adres; dzialajace++; } else { delete adresyRmf[stacja.id]; }
        } catch (e) { /* strona RMF nie odpowiedziała: zostaje poprzedni adres, jeśli był */ }
      }
    };
    await Promise.all([1, 2, 3, 4, 5, 6].map(pracownik));
    fs.writeFileSync(PLIK_ADRESOW, JSON.stringify(adresyRmf));
    log('Adresy RMF: działa', dzialajace, 'z', wszystkieStacje.filter(s => s.rmfId).length);
    await sprawdzPozostale();
  } finally {
    odswiezanieTrwa = false;
  }
}

async function odswiezNazwyZPosrednika() {
  if (BEZ_SIECI) return;
  try {
    const lista = JSON.parse(await pobierz(POSREDNIK + '/api/stations' + doPosrednika(), 8000));
    nazwyZPosrednika = Object.fromEntries(lista.map(s => [s.id, s.name]));
    log('Pośrednik stacji podał', lista.length, 'działających stacji');
  } catch (e) {
    log('Pośrednik stacji nie odpowiedział:', e.message);
  }
}

function opisStacji(stacja) {
  const czesci = [];
  if (stacja.bezGadania) czesci.push('bez prowadzących');
  if (stacja.jezyk === 'polski') czesci.push('po polsku');
  if (stacja.jezyk === 'angielski') czesci.push('po angielsku');
  return czesci.join(' · ') || stacja.grupa;
}

function listaStacji(uzytkownik, dlaAdmina = false) {
  const przezSerwer = !!(uzytkownik && uzytkownik.przezSerwer);
  const wynik = [];
  for (const wzor of wszystkieStacje) {
    const zmiany = baza.stacje[wzor.id] || {};
    const stacja = Object.assign({}, wzor, zmiany);
    if (nazwyZPosrednika && nazwyZPosrednika[wzor.id] && !zmiany.nazwa && !wzor.nazwa) {
      stacja.nazwa = nazwyZPosrednika[wzor.id];
    }
    // Stacja, której pośrednik nie widzi jako działającej, jest ukryta.
    const nieDziala = martweStacje.has(wzor.id) || (!wzor.wlasna && nazwyZPosrednika && !(wzor.id in nazwyZPosrednika));
    const adresNadawcy = wzor.rmfId ? adresyRmf[wzor.id] : (wzor.adresy || [])[0];
    if (dlaAdmina) {
      wynik.push({
        id: stacja.id, nazwa: stacja.nazwa || stacja.id, grupa: stacja.grupa, jezyk: stacja.jezyk,
        bezGadania: !!stacja.bezGadania, ukryta: !!stacja.ukryta, bezLogo: !!stacja.bezLogo,
        dziala: !nieDziala, maAdres: !!adresNadawcy,
      });
      continue;
    }
    if (stacja.ukryta || nieDziala || !stacja.nazwa) continue;
    // Stacja RMF, dla której żaden adres nie nadaje, nie zagra także przez serwer.
    // Wraca na listę sama, gdy przy kolejnym sprawdzeniu znów zacznie nadawać.
    if (wzor.rmfId && !adresNadawcy && Object.keys(adresyRmf).length > 20) continue;
    const adres = przezSerwer
      ? ADRES_PUBLICZNY + '/api/strumien/' + stacja.id + '?s=' + kluczStrumienia(uzytkownik)
      : adresNadawcy;
    if (!adres) continue;
    wynik.push({
      id: stacja.id, nazwa: stacja.nazwa, grupa: stacja.grupa, opis: opisStacji(stacja),
      jezyk: stacja.jezyk, bezGadania: !!stacja.bezGadania,
      logo: stacja.bezLogo || wzor.wlasna ? null : ADRES_PUBLICZNY + '/api/logo/' + stacja.id,
      adres,
    });
  }
  return wynik;
}

// Osobny klucz użytkownika tylko do słuchania przez serwer. Wyłączenie przełącznika
// w panelu admina od razu przestaje go honorować.
function kluczStrumienia(uzytkownik) {
  if (!uzytkownik.kluczStrumienia) {
    uzytkownik.kluczStrumienia = crypto.randomBytes(18).toString('base64url');
    zapiszBaze();
  }
  return uzytkownik.kluczStrumienia;
}

// Przekazanie odpowiedzi pośrednika stacji (logo albo dźwięk) do słuchacza.
function zPosrednika(req, res, sciezka, naglowkiOdpowiedzi) {
  const zadanie = http.get(POSREDNIK + sciezka + doPosrednika(), odp => {
    if (odp.statusCode !== 200) {
      odp.resume();
      return blad(res, odp.statusCode === 404 ? 404 : 502, 'Stacja nie odpowiada.');
    }
    const naglowki = Object.assign({ 'Content-Type': odp.headers['content-type'] || 'application/octet-stream' }, naglowkiOdpowiedzi);
    for (const nazwa of ['icy-name', 'icy-br', 'icy-metaint']) {
      if (odp.headers[nazwa]) naglowki[nazwa] = odp.headers[nazwa];
    }
    res.writeHead(200, naglowki);
    odp.pipe(res);
  });
  zadanie.on('error', () => { if (!res.headersSent) blad(res, 502, 'Stacja nie odpowiada.'); else res.destroy(); });
  res.on('close', () => zadanie.destroy());
}

// Przekazanie dźwięku prosto z adresu nadawcy, który przy sprawdzaniu faktycznie grał.
function zAdresu(req, res, adres, zapasowo, przekierowania = 0) {
  const lib = adres.startsWith('https') ? https : http;
  const zadanie = lib.get(adres, { headers: { 'User-Agent': 'RadioNUX7/1.0' }, timeout: 8000 }, odp => {
    const kod = odp.statusCode;
    if (kod >= 300 && kod < 400 && odp.headers.location && przekierowania < 3) {
      odp.resume();
      return zAdresu(req, res, new URL(odp.headers.location, adres).href, zapasowo, przekierowania + 1);
    }
    if (kod !== 200) { odp.resume(); return zapasowo(); }
    zadanie.setTimeout(0);
    res.writeHead(200, {
      'Content-Type': odp.headers['content-type'] || 'audio/aac',
      'Cache-Control': 'no-store',
    });
    odp.pipe(res);
  });
  zadanie.on('timeout', () => zadanie.destroy(new Error('brak odpowiedzi')));
  zadanie.on('error', () => { if (!res.headersSent) zapasowo(); else res.destroy(); });
  res.on('close', () => zadanie.destroy());
}

// ---------- Co teraz gra ----------

// Pośrednik stacji zna tytuł utworu tylko dla części stacji (głównie RMF).
// Odpowiedź trzymamy kilkanaście sekund i zapamiętujemy ostatnie utwory każdej stacji.
const teraz = new Map(); // id stacji -> { kiedy, utwor, ostatnie: [] }
function rozdziel(napis) {
  const czysty = String(napis || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!czysty) return null;
  const gdzie = czysty.indexOf(' - ');
  return gdzie > 0
    ? { wykonawca: czysty.slice(0, gdzie), tytul: czysty.slice(gdzie + 3) }
    : { wykonawca: '', tytul: czysty };
}
async function coGra(id) {
  let wpis = teraz.get(id);
  if (!wpis) { wpis = { kiedy: 0, utwor: null, ostatnie: [] }; teraz.set(id, wpis); }
  if (Date.now() - wpis.kiedy > 15000 && !BEZ_SIECI) {
    wpis.kiedy = Date.now();
    try {
      const klucz = doPosrednika();
      const dane = JSON.parse(await pobierz(POSREDNIK + '/api/now?id=' + encodeURIComponent(id) + (klucz ? '&' + klucz.slice(1) : ''), 6000));
      const utwor = rozdziel(dane.title);
      const poprzedni = wpis.utwor;
      if (utwor && (!poprzedni || poprzedni.tytul !== utwor.tytul || poprzedni.wykonawca !== utwor.wykonawca)) {
        wpis.ostatnie.unshift(Object.assign({ czas: new Date().toISOString() }, utwor));
        wpis.ostatnie = wpis.ostatnie.slice(0, 12);
      }
      wpis.utwor = utwor;
    } catch (e) { /* brak odpowiedzi: zostaje poprzedni utwór */ }
  }
  return { utwor: wpis.utwor, ostatnie: wpis.ostatnie };
}

// ---------- Odpowiedzi ----------

function json(res, kod, tresc) {
  const dane = JSON.stringify(tresc);
  res.writeHead(kod, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(dane);
}
const blad = (res, kod, komunikat) => json(res, kod, { blad: komunikat });

function cialo(req) {
  return new Promise((resolve, reject) => {
    let tresc = '';
    req.setEncoding('utf8');
    req.on('data', kawalek => {
      tresc += kawalek;
      if (tresc.length > 20000) { reject(new Error('za duże')); req.destroy(); }
    });
    req.on('end', () => {
      if (!tresc) return resolve({});
      try { resolve(JSON.parse(tresc)); } catch (e) { reject(new Error('zły format')); }
    });
    req.on('error', reject);
  });
}

const publicznie = u => ({
  email: u.email, imie: u.imie || '', przezSerwer: !!u.przezSerwer, premium: !!u.premium,
  admin: !!u.admin, ulubione: u.ulubione || [],
});
const poprawnyEmail = e => typeof e === 'string' && e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ---------- Obsługa adresów ----------

async function obsluz(req, res) {
  const adres = new URL(req.url, 'http://x');
  const sciezka = adres.pathname.replace(/\/$/, '');
  const metoda = req.method;

  if (sciezka === '/api/zdrowie') return json(res, 200, { ok: true });

  const logo = sciezka.match(/^\/api\/logo\/([a-z0-9-]{1,40})$/);
  if (logo && metoda === 'GET') {
    const zmiany = baza.stacje[logo[1]] || {};
    if (zmiany.bezLogo || zmiany.ukryta) return blad(res, 404, 'Brak logo.');
    return zPosrednika(req, res, '/logo/' + logo[1], { 'Cache-Control': 'public, max-age=604800' });
  }

  const strumien = sciezka.match(/^\/api\/strumien\/([a-z0-9-]{1,40})$/);
  if (strumien && metoda === 'GET') {
    const podany = adres.searchParams.get('s') || '';
    const sluchacz = podany && baza.uzytkownicy.find(u => u.kluczStrumienia === podany);
    if (!sluchacz || !sluchacz.przezSerwer) return blad(res, 403, 'Brak dostępu.');
    const przezPosrednika = () => zPosrednika(req, res, '/stream/' + strumien[1], { 'Cache-Control': 'no-store' });
    // Stacje RMF: pośrednik bierze pierwszy adres z listy RMF, który bywa martwy,
    // więc podajemy dźwięk z adresu sprawdzonego przez nas.
    if (adresyRmf[strumien[1]]) return zAdresu(req, res, adresyRmf[strumien[1]], przezPosrednika);
    const wlasna = wszystkieStacje.find(s => s.id === strumien[1] && s.wlasna);
    if (wlasna) return zAdresu(req, res, wlasna.adresy[0], () => blad(res, 502, 'Stacja nie odpowiada.'));
    return przezPosrednika();
  }

  const gra = sciezka.match(/^\/api\/teraz\/([a-z0-9-]{1,40})$/);
  if (gra && metoda === 'GET') {
    if (!wszystkieStacje.some(s => s.id === gra[1])) return blad(res, 404, 'Nie ma takiej stacji.');
    return json(res, 200, await coGra(gra[1]));
  }

  if (sciezka === '/api/wiadomosci' && metoda === 'GET') {
    const dane = JSON.stringify(wiadomosci.odpowiedz());
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=120', 'X-Content-Type-Options': 'nosniff' });
    return res.end(dane);
  }

  if (sciezka === '/api/stacje' && metoda === 'GET') {
    return json(res, 200, { stacje: listaStacji(uzytkownikZZapytania(req)) });
  }

  if (sciezka === '/api/konto/rejestracja' && metoda === 'POST') {
    if (zaDuzoProb(req)) return blad(res, 429, 'Za dużo prób. Spróbuj za kilka minut.');
    const dane = await cialo(req);
    const email = String(dane.email || '').trim().toLowerCase();
    const haslo = String(dane.haslo || '');
    if (!poprawnyEmail(email)) return blad(res, 400, 'Podaj poprawny adres e-mail.');
    if (haslo.length < 8 || haslo.length > 200) return blad(res, 400, 'Hasło musi mieć co najmniej 8 znaków.');
    if (baza.uzytkownicy.some(u => u.email === email)) return blad(res, 409, 'Konto z tym adresem już istnieje.');
    if (baza.uzytkownicy.length >= LIMIT_KONT) return blad(res, 403, 'Rejestracja jest zamknięta. Wszystkie miejsca są już zajęte.');
    const uzytkownik = {
      id: crypto.randomBytes(8).toString('hex'), email, haslo: skrotHasla(haslo),
      imie: String(dane.imie || '').trim().slice(0, 30), przezSerwer: true, premium: false, admin: false,
      ulubione: [], utworzono: new Date().toISOString(), klucze: [],
    };
    const klucz = nowyKlucz(uzytkownik);
    baza.uzytkownicy.push(uzytkownik);
    zapiszBaze();
    return json(res, 201, { klucz, konto: publicznie(uzytkownik) });
  }

  if (sciezka === '/api/konto/logowanie' && metoda === 'POST') {
    if (zaDuzoProb(req)) return blad(res, 429, 'Za dużo prób. Spróbuj za kilka minut.');
    const dane = await cialo(req);
    const email = String(dane.email || '').trim().toLowerCase();
    const uzytkownik = baza.uzytkownicy.find(u => u.email === email);
    if (!uzytkownik || !hasloPasuje(String(dane.haslo || ''), uzytkownik.haslo)) {
      return blad(res, 401, 'Zły adres e-mail lub hasło.');
    }
    const klucz = nowyKlucz(uzytkownik);
    zapiszBaze();
    return json(res, 200, { klucz, konto: publicznie(uzytkownik) });
  }

  if (sciezka.startsWith('/api/konto') || sciezka.startsWith('/api/admin')) {
    const ja = uzytkownikZZapytania(req);
    if (!ja) return blad(res, 401, 'Zaloguj się.');

    if (sciezka === '/api/konto' && metoda === 'GET') return json(res, 200, { konto: publicznie(ja) });

    if (sciezka === '/api/konto' && metoda === 'PUT') {
      const dane = await cialo(req);
      if (typeof dane.imie === 'string') ja.imie = dane.imie.trim().slice(0, 30);
      if (Array.isArray(dane.ulubione)) {
        ja.ulubione = dane.ulubione.filter(x => typeof x === 'string' && /^[a-z0-9-]{1,40}$/.test(x)).slice(0, 300);
      }
      zapiszBaze();
      return json(res, 200, { konto: publicznie(ja) });
    }

    if (sciezka === '/api/konto/wyloguj' && metoda === 'POST') {
      const skrot = skrotKlucza((req.headers.authorization || '').slice(7).trim());
      ja.klucze = (ja.klucze || []).filter(k => k !== skrot);
      zapiszBaze();
      return json(res, 200, { ok: true });
    }

    if (sciezka === '/api/konto' && metoda === 'DELETE') {
      baza.uzytkownicy = baza.uzytkownicy.filter(u => u.id !== ja.id);
      zapiszBaze();
      return json(res, 200, { ok: true });
    }

    if (sciezka === '/api/admin/aktywuj' && metoda === 'POST') {
      if (zaDuzoProb(req)) return blad(res, 429, 'Za dużo prób. Spróbuj za kilka minut.');
      const dane = await cialo(req);
      const podany = Buffer.from(String(dane.kod || '').trim());
      const wlasciwy = Buffer.from(kodAdmina || '');
      if (!kodAdmina || podany.length !== wlasciwy.length || !crypto.timingSafeEqual(podany, wlasciwy)) {
        return blad(res, 403, 'Zły kod.');
      }
      ja.admin = true;
      kodAdmina = null;
      if (fs.existsSync(PLIK_KODU)) fs.unlinkSync(PLIK_KODU);
      zapiszBaze();
      return json(res, 200, { konto: publicznie(ja) });
    }

    if (sciezka.startsWith('/api/admin')) {
      if (!ja.admin) return blad(res, 403, 'Tylko dla admina.');

      if (sciezka === '/api/admin/uzytkownicy' && metoda === 'GET') {
        return json(res, 200, {
          uzytkownicy: baza.uzytkownicy.map(u => Object.assign({ id: u.id, utworzono: u.utworzono }, publicznie(u), { ulubione: undefined })),
        });
      }

      const u = sciezka.match(/^\/api\/admin\/uzytkownicy\/([a-f0-9]{16})$/);
      if (u && metoda === 'PATCH') {
        const cel = baza.uzytkownicy.find(x => x.id === u[1]);
        if (!cel) return blad(res, 404, 'Nie ma takiego użytkownika.');
        const dane = await cialo(req);
        if (typeof dane.przezSerwer === 'boolean') cel.przezSerwer = dane.przezSerwer;
        if (typeof dane.premium === 'boolean') cel.premium = dane.premium;
        zapiszBaze();
        return json(res, 200, { ok: true });
      }
      if (u && metoda === 'DELETE') {
        if (u[1] === ja.id) return blad(res, 400, 'Nie można usunąć własnego konta admina z panelu.');
        baza.uzytkownicy = baza.uzytkownicy.filter(x => x.id !== u[1]);
        zapiszBaze();
        return json(res, 200, { ok: true });
      }

      if (sciezka === '/api/admin/stacje' && metoda === 'GET') {
        return json(res, 200, { stacje: listaStacji(null, true) });
      }
      const s = sciezka.match(/^\/api\/admin\/stacje\/([a-z0-9-]{1,40})$/);
      if (s && metoda === 'PATCH') {
        if (!wszystkieStacje.some(x => x.id === s[1])) return blad(res, 404, 'Nie ma takiej stacji.');
        const dane = await cialo(req);
        const zmiany = baza.stacje[s[1]] || {};
        for (const pole of ['ukryta', 'bezLogo', 'bezGadania']) {
          if (typeof dane[pole] === 'boolean') zmiany[pole] = dane[pole];
        }
        if (['polski', 'angielski', 'mieszany'].includes(dane.jezyk)) zmiany.jezyk = dane.jezyk;
        if (typeof dane.nazwa === 'string' && dane.nazwa.trim()) zmiany.nazwa = dane.nazwa.trim().slice(0, 60);
        baza.stacje[s[1]] = zmiany;
        zapiszBaze();
        return json(res, 200, { ok: true });
      }
    }
  }

  return blad(res, 404, 'Nie znaleziono.');
}

const serwer = http.createServer((req, res) => {
  obsluz(req, res).catch(e => {
    if (!res.headersSent) blad(res, e.message === 'za duże' || e.message === 'zły format' ? 400 : 500, 'Nie udało się obsłużyć zapytania.');
    if (e.message !== 'za duże' && e.message !== 'zły format') log('błąd', req.method, req.url, e.message);
  });
});

serwer.listen(PORT, '127.0.0.1', () => {
  log('Serwer Radia NUX7 działa na porcie', PORT, '| stacji na liście:', wszystkieStacje.length);
  odswiezNazwyZPosrednika().then(odswiezAdresyRmf);
  setInterval(() => odswiezNazwyZPosrednika().then(odswiezAdresyRmf), 6 * 3600 * 1000).unref();
  if (!BEZ_SIECI) {
    wiadomosci.odswiez(log).catch(() => {});
    setInterval(() => wiadomosci.odswiez(log).catch(() => {}), 15 * 60 * 1000).unref();
  }
});
