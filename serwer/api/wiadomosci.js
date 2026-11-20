'use strict';
// Wiadomości z kanałów RSS portali. Pokazujemy tytuł, krótki wstęp, zdjęcie
// i odnośnik do artykułu u źródła. Treści artykułów nie kopiujemy.
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const TEMATY = [
  { id: 'swiat', nazwa: 'Świat' },
  { id: 'polska', nazwa: 'Polska' },
  { id: 'zdarzenia', nazwa: 'Wypadki i zdarzenia' },
  { id: 'nauka', nazwa: 'Technologie, AI i nauka' },
  { id: 'podroze', nazwa: 'Podróże i ciekawostki' },
  { id: 'uroda', nazwa: 'Uroda i styl' },
  { id: 'kultura', nazwa: 'Kultura i rozrywka' },
  { id: 'gospodarka', nazwa: 'Gospodarka' },
  { id: 'sport', nazwa: 'Sport' },
];
// Tematy zaznaczone, dopóki użytkownik sam nie wybierze.
const DOMYSLNE = ['swiat', 'polska', 'zdarzenia', 'nauka', 'podroze', 'kultura'];

// Kanał, który nie odpowiada, jest pomijany i nie psuje reszty.
const KANALY = [
  ['RMF24', 'swiat', 'https://www.rmf24.pl/fakty/swiat/feed'],
  ['RMF24', 'polska', 'https://www.rmf24.pl/fakty/polska/feed'],
  ['RMF24', 'gospodarka', 'https://www.rmf24.pl/ekonomia/feed'],
  ['RMF24', 'nauka', 'https://www.rmf24.pl/nauka/feed'],
  ['RMF24', 'kultura', 'https://www.rmf24.pl/kultura/feed'],
  ['RMF24', 'sport', 'https://www.rmf24.pl/sport/feed'],
  ['Polsat News', 'swiat', 'https://www.polsatnews.pl/rss/swiat.xml'],
  ['Polsat News', 'polska', 'https://www.polsatnews.pl/rss/polska.xml'],
  ['Polsat News', 'gospodarka', 'https://www.polsatnews.pl/rss/biznes.xml'],
  ['Polsat News', 'nauka', 'https://www.polsatnews.pl/rss/technologie.xml'],
  ['Polsat News', 'kultura', 'https://www.polsatnews.pl/rss/kultura.xml'],
  ['Polsat News', 'sport', 'https://www.polsatnews.pl/rss/sport.xml'],
  ['Nauka w Polsce', 'nauka', 'https://naukawpolsce.pl/rss.xml'],
  // Technologie i sztuczna inteligencja.
  ['Antyweb', 'nauka', 'https://antyweb.pl/feed'],
  ['Spider\'s Web', 'nauka', 'https://spidersweb.pl/feed'],
  ['CHIP', 'nauka', 'https://www.chip.pl/feed'],
  ['Kopalnia Wiedzy', 'nauka', 'https://kopalniawiedzy.pl/rss.xml'],
  ['Crazy Nauka', 'nauka', 'https://www.crazynauka.pl/feed/'],
  // Podróże i ciekawostki z ciekawych miejsc.
  ['Focus', 'podroze', 'https://www.focus.pl/feed'],
  ['National Geographic', 'podroze', 'https://www.national-geographic.pl/rss'],
  ['Fly4free', 'podroze', 'https://www.fly4free.pl/feed/'],
  ['Podróże', 'podroze', 'https://www.podroze.pl/rss'],
  // Uroda, kosmetyki i styl.
  ['Hello Zdrowie', 'uroda', 'https://www.hellozdrowie.pl/feed/'],
  ['Elle', 'uroda', 'https://www.elle.pl/rss'],
  ['Glamour', 'uroda', 'https://www.glamour.pl/rss'],
  ['Wizaż', 'uroda', 'https://wizaz.pl/rss'],
  ['Vogue', 'uroda', 'https://www.vogue.pl/rss'],
];

// Wiadomości o polityce, konfliktach i religii w ogóle nie trafiają do radia.
const POLITYKA = /sejm|senat|\bpis\b|\bpis-|koalicj|opozycj|\bpos[eł]{2}\b|posł[aóo]|posłank|sonda[żz]|\bparti|tusk|kaczyński|nawrock|konfederacj|\blewic|\bpsl\b|wotum|komisj[aię] śledcz|\bwet[oa]\b|kampani[aię] wyborcz|rzecznik rządu|\bpolity[ck]|marszał[ek]{2} sejmu|ministe?r|premier|\brząd(?:u|owi|em|zie)?\b|prezydent (?:powoł|podpis|zawetow|odmówi)|ustaw[ayęi]\b|głosowani|prezyden|kancler|parlament|wybor(?:y|ów|ach|cz)|referend|zełensk|putin|trump|biden|macron|merz|orb[aá]n|łukaszenk|netanjahu|erdo[gğ]an|kreml|biały dom|białego domu|\bnato\b|\bue\b|uni[iaę] europejsk|komisj[aię] europejsk|sankcj|rozejm|zawieszeni\S+ broni|rozmow\S+ pokojow|plan\S* pokojow|negocjacj|wojsk|armi[aię]\b|żołnierz|rakiet|dron(?:y|ów|ami)?\b|ostrzał|ofensyw|okupac|inwazj|na froncie|linii frontu|dyploma|ambasad|sojusz|traktat|szczyt\w* (?:nato|ue|g7|g20|klimat)|artykuł 5|hamas|hezbollah|strefie gazy|strefy gazy/i;
// Krótsza lista dla kanałów tematycznych, żeby nie wycinać np. tekstów o dronach.
const POLITYKA_WPROST = /\bsejm|\bsenat\b|\bpis\b|koalicj|opozycj|sonda[żz]|\bparti|tusk|kaczyński|nawrock|konfederacj|\bpolity[ck]|premier|prezyden|ministe?r|\brząd(?:u|owi|em|zie)?\b|wybor(?:y|ów|ach|cz)|zełensk|putin|trump|kreml|sankcj/i;
const RELIGIA = /kości[oó]ł|papie[żs]|bisku|ksi[ąę]d[zż]|ksi[ęe]ż[yaom]|parafi|\bmsz[aęy]\b|watykan|religi|\bwiar[ayęzo]\b|duchowo|duchown|modlitw|pielgrzym|episkopat|zakonn|islam|meczet|synagog|rabin|imam|świętokradz|sekt[ayę]\b|kardyna|proboszcz|katolic|chrześcija|muzułma/i;
const ZDARZENIA = /wypad|zderz|pożar|zgin[ęąe]|nie żyj|ofiar|katastrof|trzęsieni|powód[źz]|podtopie|ewakuac|wybuch|zagin|poszukiwa|uton|tragedi|rann[yaie]|ratown|akcja ratun|policj|zatrzyman|napad|nożownik|strzelanin|huragan|tornado|lawin|wichur|śmierteln|potrąc|dachowa/i;
const SPORT = /\bmecz|ekstraklas|\blig[iaę]\b|piłkar|\btrener|mundial|\bgol[ae]?\b|tenis|świątek|lewandowsk|siatk|żużl|skoki narciarskie|formuł[ay] 1|olimpi|mistrzostw|\bmedal|kolarz|bokser|\bnba\b/i;
const PRZYNETY = /nie uwierzysz|zobacz,? co|\bquiz\b|\[wideo\]|\[zdjęcia\]|sprawdź,? czy|tego nie wiedzia/i;

const ZNAKI = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', oacute: 'ó', Oacute: 'Ó', bdquo: '„', rdquo: '”', ldquo: '“', rsquo: '’' };
function tekst(surowy) {
  return String(surowy || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (c, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (c, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (c, n) => (n in ZNAKI ? ZNAKI[n] : c))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function pole(wpis, nazwa) {
  const m = wpis.match(new RegExp('<' + nazwa + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + nazwa + '>', 'i'));
  return m ? m[1] : '';
}
function skroc(napis, dlugosc) {
  if (napis.length <= dlugosc) return napis;
  const ciety = napis.slice(0, dlugosc);
  return ciety.slice(0, Math.max(ciety.lastIndexOf(' '), dlugosc - 30)).replace(/[\s,;:.–-]+$/, '') + '…';
}
function bezpiecznyAdres(adres) {
  const a = tekst(adres);
  return /^https:\/\/[^\s"'<>]+$/i.test(a) ? a : (/^http:\/\/[^\s"'<>]+$/i.test(a) ? a.replace(/^http:/i, 'https:') : '');
}
function obraz(wpis) {
  const proby = [
    /<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i,
    /<enclosure[^>]*type=["']image[^>]*url=["']([^"']+)["']/i,
    /<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["']/i,
    /<enclosure[^>]*url=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/i,
    /<img[^>]*src=["']([^"']+)["']/i,
    /&lt;img[^&]*src=(?:&quot;|["'])([^"'&]+)/i,
  ];
  for (const wzor of proby) {
    const m = wpis.match(wzor);
    if (m) { const a = bezpiecznyAdres(m[1]); if (a) return a; }
  }
  return null;
}

// Kanały tematyczne (technologie, podróże, uroda, sport) zostają w swoim temacie.
const WLASNY_TEMAT = new Set(['sport', 'nauka', 'podroze', 'uroda']);

// Zwraca temat wiadomości albo null, gdy wiadomość ma być pominięta.
function temat(zKanalu, tytul, wstep) {
  const calosc = tytul + ' ' + wstep;
  if (RELIGIA.test(calosc)) return null;
  if (WLASNY_TEMAT.has(zKanalu)) return POLITYKA_WPROST.test(calosc) ? null : zKanalu;
  if (POLITYKA.test(calosc)) return null;
  if (ZDARZENIA.test(calosc)) return 'zdarzenia';
  if (SPORT.test(tytul)) return 'sport';
  return zKanalu;
}

// Zamienia treść kanału RSS albo Atom na listę wiadomości.
function zKanalu(tresc, zrodlo, tematKanalu) {
  const wynik = [];
  const wpisy = tresc.match(/<item[\s>][\s\S]*?<\/item>/gi) || tresc.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const wpis of wpisy) {
    const tytul = tekst(pole(wpis, 'title'));
    let adres = bezpiecznyAdres(pole(wpis, 'link'));
    if (!adres) { const m = wpis.match(/<link[^>]*href=["']([^"']+)["']/i); adres = m ? bezpiecznyAdres(m[1]) : ''; }
    if (!tytul || !adres || PRZYNETY.test(tytul)) continue;
    const czas = Date.parse(tekst(pole(wpis, 'pubDate') || pole(wpis, 'updated') || pole(wpis, 'published') || pole(wpis, 'dc:date')));
    if (!Number.isFinite(czas)) continue;
    let wstep = skroc(tekst(pole(wpis, 'description') || pole(wpis, 'summary')), 200);
    // Część portali powtarza we wstępie sam tytuł.
    const prosto = n => n.toLowerCase().replace(/[^a-ząćęłńóśźż0-9]+/g, '');
    if (prosto(wstep) === prosto(tytul) || prosto(tytul).startsWith(prosto(wstep))) wstep = '';
    const jaki = temat(tematKanalu, tytul, wstep);
    if (!jaki) continue;
    wynik.push({
      id: crypto.createHash('sha1').update(adres).digest('hex').slice(0, 12),
      tytul: skroc(tytul, 160), wstep, obraz: obraz(wpis), zrodlo, adres,
      czas: new Date(czas).toISOString(), temat: jaki,
    });
  }
  return wynik;
}

function pobierz(adres, przekierowania = 0) {
  return new Promise((resolve, reject) => {
    const zadanie = (adres.startsWith('https') ? https : http).get(adres, {
      headers: { 'User-Agent': 'RadioNUX7/1.0 (+https://nux7.com)', Accept: 'application/rss+xml, application/xml, text/xml' },
      timeout: 10000,
    }, odp => {
      if (odp.statusCode >= 300 && odp.statusCode < 400 && odp.headers.location && przekierowania < 3) {
        odp.resume();
        return pobierz(new URL(odp.headers.location, adres).href, przekierowania + 1).then(resolve, reject);
      }
      if (odp.statusCode !== 200) { odp.resume(); return reject(new Error('odpowiedź ' + odp.statusCode)); }
      const kawalki = [];
      let rozmiar = 0;
      odp.on('data', k => { kawalki.push(k); rozmiar += k.length; if (rozmiar > 3e6) zadanie.destroy(new Error('za duży plik')); });
      odp.on('end', () => resolve(Buffer.concat(kawalki).toString('utf8')));
      odp.on('error', reject);
    });
    zadanie.on('timeout', () => zadanie.destroy(new Error('brak odpowiedzi')));
    zadanie.on('error', reject);
  });
}

let stan = { odswiezono: null, wiadomosci: [], kanaly: [] };

async function odswiez(log = () => {}) {
  const zebrane = [];
  const kanaly = [];
  await Promise.all(KANALY.map(async ([zrodlo, tematKanalu, adres]) => {
    try {
      const nowe = zKanalu(await pobierz(adres), zrodlo, tematKanalu);
      zebrane.push(...nowe);
      kanaly.push({ adres, dziala: true, liczba: nowe.length });
    } catch (e) {
      kanaly.push({ adres, dziala: false, blad: e.message });
    }
  }));
  const granica = Date.now() - 48 * 3600 * 1000;
  const widziane = new Set();
  const wynik = [];
  zebrane.sort((a, b) => (a.czas < b.czas ? 1 : -1));
  for (const w of zebrane) {
    const klucz = w.tytul.toLowerCase().replace(/[^a-ząćęłńóśźż0-9]+/g, ' ').trim();
    if (Date.parse(w.czas) < granica || Date.parse(w.czas) > Date.now() + 3600 * 1000) continue;
    if (widziane.has(w.id) || widziane.has(klucz)) continue;
    widziane.add(w.id); widziane.add(klucz);
    wynik.push(w);
  }
  // Gdy żaden kanał nie odpowiedział, zostają poprzednie wiadomości.
  if (wynik.length) stan = { odswiezono: new Date().toISOString(), wiadomosci: wynik.slice(0, 300), kanaly };
  else stan.kanaly = kanaly;
  const dzialajace = kanaly.filter(k => k.dziala).length;
  log('Wiadomości: ' + wynik.length + ' z ' + dzialajace + ' kanałów na ' + KANALY.length);
  kanaly.filter(k => !k.dziala).forEach(k => log('  kanał nie odpowiada: ' + k.adres + ' (' + k.blad + ')'));
  return stan;
}

const odpowiedz = () => ({ tematy: TEMATY, domyslne: DOMYSLNE, odswiezono: stan.odswiezono, wiadomosci: stan.wiadomosci });

module.exports = { odswiez, odpowiedz, zKanalu, temat };

// Uruchomiony osobno wypisuje, które kanały działają: node wiadomosci.js
if (require.main === module) {
  odswiez(console.log).then(s => {
    const ile = {};
    s.wiadomosci.forEach(w => { ile[w.temat] = (ile[w.temat] || 0) + 1; });
    console.log('Podział na tematy:', JSON.stringify(ile));
    console.log('Ze zdjęciem:', s.wiadomosci.filter(w => w.obraz).length, 'z', s.wiadomosci.length);
  });
}
