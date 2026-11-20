'use strict';
// Sprawdza z serwera, które stacje faktycznie nadają. Niczego nie zmienia.
// Uruchomienie: docker exec nux7-api node sprawdz.js
const fs = require('fs');
const http = require('http');
const https = require('https');
const stacje = require('./stacje');

function gra(adres, przekierowania = 0) {
  return new Promise(resolve => {
    let koniec = false;
    const wynik = w => { if (!koniec) { koniec = true; resolve(w); } };
    let zadanie;
    try {
      zadanie = (adres.startsWith('https') ? https : http).get(adres, { headers: { 'User-Agent': 'RadioNUX7/1.0' }, timeout: 6000 }, odp => {
        const kod = odp.statusCode;
        if (kod >= 300 && kod < 400 && odp.headers.location && przekierowania < 3) {
          zadanie.destroy();
          return gra(new URL(odp.headers.location, adres).href, przekierowania + 1).then(wynik);
        }
        const typ = String(odp.headers['content-type'] || '');
        wynik(kod === 200 && /audio|mpeg|aac|ogg|octet-stream/i.test(typ) ? 'gra' : 'odpowiedź ' + kod + ' ' + typ);
        zadanie.destroy();
      });
    } catch (e) { return wynik('zły adres'); }
    zadanie.on('timeout', () => { zadanie.destroy(); wynik('brak odpowiedzi'); });
    zadanie.on('error', e => wynik('błąd: ' + e.code));
  });
}

(async () => {
  let adresyRmf = {};
  try { adresyRmf = JSON.parse(fs.readFileSync((process.env.DANE || './dane') + '/adresy-rmf.json', 'utf8')); } catch (e) { /* jeszcze nie sprawdzone */ }
  const rmf = stacje.filter(s => s.rmfId);
  const rmfBez = rmf.filter(s => !adresyRmf[s.id]);
  console.log('RMF: nadaje ' + (rmf.length - rmfBez.length) + ' z ' + rmf.length);
  rmfBez.forEach(s => console.log('  nie nadaje: ' + s.nazwa));

  const inne = stacje.filter(s => !s.rmfId);
  let dobre = 0;
  const zle = [];
  for (const s of inne) {
    let stan = 'brak adresu';
    for (const adres of s.adresy || []) { stan = await gra(adres); if (stan === 'gra') break; }
    if (stan === 'gra') dobre++; else zle.push('  nie nadaje: ' + (s.nazwa || s.id) + ' (' + stan + ')');
  }
  console.log('Pozostałe: nadaje ' + dobre + ' z ' + inne.length);
  zle.forEach(w => console.log(w));

  // Adresy do sprawdzenia przed dodaniem nowych stacji (podane jako argumenty).
  for (const adres of process.argv.slice(2)) console.log('Próba ' + adres + ': ' + await gra(adres));
})();
