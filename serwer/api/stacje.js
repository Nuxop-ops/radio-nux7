'use strict';
// Lista stacji Radia NUX7.
// RMF: numer = ID stacji w RMF ON (adres strumienia serwer pobiera sam).
// ESKA: numer = kod strumienia.

const rmfGlowne = [
  [5, 'RMF FM'], [6, 'RMF MAXX'], [7, 'RMF Classic'], [190, 'Radio RMF24'],
  [82, '36 lat RMF FM'], [112, 'Best of RMF ON'], [148, 'Sizeer FM'],
  [152, 'Radio Gra Toruń'], [162, 'Radio Gra Wrocław'], [241, 'Dodaphone'],
];

const rmfTematyczne = [
  [1, 'RMF Rock'], [2, 'RMF Classic Rock'], [3, 'RMF Dance'], [4, 'RMF R&B'],
  [8, 'RMF Poplista'], [9, 'RMF Polskie przeboje'], [10, 'RMF Słoneczne przeboje'],
  [11, 'RMF Chillout'], [12, 'RMF Viral'], [14, 'RMF Love'], [15, 'RMF Gold'],
  [16, 'RMF Smooth Jazz'], [17, 'RMF Święta'], [19, 'RMF Przebój roku 2025'],
  [23, 'RMF Party'], [25, 'RMF 80s'], [27, 'RMF Hot New'], [28, 'RMF Alternatywa'],
  [30, 'RMF Lady Pank'], [31, 'RMF Depeche Mode'], [32, 'RMF Hard & Heavy'],
  [33, 'RMF Muzyka filmowa'], [36, 'RMF Polski rock'], [37, 'RMF Hip Hop'],
  [38, 'RMF PRL'], [39, 'RMF Blues'], [40, 'RMF Reggae'], [43, 'RMF Dla dzieci'],
  [44, 'RMF 60s'], [45, 'RMF 70s'], [46, 'RMF 90s'], [48, 'RMF 50s'],
  [49, 'RMF Szanty'], [52, 'RMF Klasyka polskiego hip hopu'], [53, 'RMF Cuba'],
  [61, 'RMF Queen'], [65, 'RMF Piosenka literacka'], [67, 'RMF Celtic'],
  [68, 'RMF Grunge'], [73, 'RMF Michael Jackson'], [77, 'RMF Beatlemania'],
  [79, 'RMF Styl'], [80, 'RMF Kolędy'], [81, 'RMF 2000'],
  [84, 'RMF Rock progresywny'], [86, 'RMF Muzyka klasyczna'], [93, 'RMF Ballady'],
  [94, 'RMF 2 Pop'], [95, 'RMF 3 Pop-Rock'], [96, 'RMF 4 Dance & R&B'],
  [97, 'RMF 5 Łagodne przeboje'], [109, 'RMF 80s Disco'], [110, 'RMF Disco polo'],
  [111, 'RMF Niezapomniane melodie'], [115, 'RMF W pracy'], [116, 'RMF Relaks'],
  [117, 'RMF Fitness'], [118, 'RMF Fitness Rock'], [119, 'RMF Top 30 Dance'],
  [120, 'RMF Top 30 PL'], [121, 'RMF Top 30 Pop'], [122, 'RMF Top 30 Disco Polo'],
  [127, 'RMF Największe polskie przeboje'], [128, 'RMF Top 30 Święta'],
  [130, 'RMF 90s Dance'], [153, 'RMF Disco'], [156, 'RMF K-Pop'],
  [158, 'RMF Polski hip hop'], [159, 'RMF 10s'], [161, 'RMF Latino'],
  [163, 'RMF Cafe'], [164, 'RMF Polska prywatka'], [165, 'RMF Pobudka'],
  [166, 'RMF Piosenka filmowa'], [168, 'RMF Świąteczne nowości 2025'],
  [171, 'RMF Top 2026 Disco Polo'], [172, 'RMF Przebój lata 2025'],
  [173, 'RMF Wakacyjne Top 100'], [174, 'Euro Hits: The Best Of'],
  [234, 'RMF Vibe'], [235, 'RMF Polska alternatywa'], [236, 'RMF 20s'],
  [237, 'RMF Leniwa niedziela'], [238, 'RMF W kuchni'], [239, 'RMF Ladies'],
  [240, 'RMF Nu Metal'], [242, 'RMF Jesienny vibe'], [243, 'RMF Crush'],
  [248, 'RMF Na wiosnę'], [266, 'RMF True Crime'],
];

const rmfMaxx = [
  [22, 'RMF MAXX Hop Bęc'], [29, 'RMF MAXX Club'], [194, 'RMF MAXX Bydgoszcz'],
  [195, 'RMF MAXX Mazowsze'], [196, 'RMF MAXX Częstochowa'],
  [197, 'RMF MAXX Trójmiasto'], [198, 'RMF MAXX Inowrocław'],
  [199, 'RMF MAXX Świętokrzyskie'], [200, 'RMF MAXX Konin'],
  [201, 'RMF MAXX Kraków'], [202, 'RMF MAXX Krosno'], [203, 'RMF MAXX Podlasie'],
  [204, 'RMF MAXX Nowy Sącz'], [205, 'RMF MAXX Oleśnica'], [206, 'RMF MAXX Opole'],
  [207, 'RMF MAXX Piła'], [208, 'RMF MAXX Poznań'], [209, 'RMF MAXX Śląsk'],
  [210, 'RMF MAXX Pomorze'], [211, 'RMF MAXX Szczecin'],
  [212, 'RMF MAXX Dolny Śląsk'], [213, 'RMF MAXX Warszawa'],
  [214, 'RMF MAXX Włocławek'], [215, 'RMF MAXX Lubuskie'],
  [262, 'RMF MAXX Tomaszów Mazowiecki'], [272, 'RMF MAXX Dance'],
  [273, 'RMF MAXX Rap'], [274, 'RMF MAXX New Hits'],
];

const rmfClassic = [
  [85, 'RMF Classic Chopin'], [222, 'RMF Classic Thor'],
  [223, 'RMF Classic Śródziemie'], [224, 'RMF Classic Świat Czarodziejów'],
  [225, 'RMF Classic Na pirackich wodach'],
  [226, 'RMF Classic Morricone Westerny'], [227, 'RMF Classic Mindfulness'],
  [245, 'RMF Classic Filmowy Przebój Wszech Czasów'],
  [246, 'RMF Classic Valentine'], [247, 'RMF Classic Oscary 2025'],
  [250, 'RMF Classic Muzyka Oscarowa'], [251, 'RMF Classic Hans Zimmer'],
  [252, 'RMF Classic John Williams'], [253, 'RMF Classic Klasyka z werwą'],
  [254, 'RMF Classic Tarantino'], [255, 'RMF Classic Czas skupienia'],
  [261, 'FMF Classic'],
];

const fresh = [
  [267, 'FRESH Pop'], [268, 'FRESH Dance'], [269, 'FRESH Polski Hip Hop'],
  [270, 'FRESH Hip Hop'], [271, 'FRESH Polskie'],
];

// ESKA: [kod, nazwa]. Kody bez nazwy dostają nazwę z pośrednika stacji, jeśli ją zna.
const eska = [
  [2380, 'Radio ESKA'], [5380, 'ESKA Rock'],
  [6070, 'ESKA Rock - Klasyka Rocka'], [6010, 'ESKA Rock - Rock Ballads'],
  [6090, 'ESKA Rock - Teraz Polski Rock'], [6060, 'ESKA Rock - Dobrze Rockuje'],
];
for (let kod = 2010; kod <= 2230; kod += 10) eska.push([kod, null]);
eska.push([2540, null]);

const inne = [
  ['zet', 'Radio ZET', 'ZET i Antyradio', ['https://zt.cdn.eurozet.pl/zet-net.mp3', 'https://zt.cdn.eurozet.pl/zet-tun.mp3']],
  ['meloradio', 'Meloradio', 'ZET i Antyradio', ['https://ml.cdn.eurozet.pl/mel-net.mp3']],
  ['chillizet', 'Chillizet', 'ZET i Antyradio', ['https://ch.cdn.eurozet.pl/chi-net.mp3']],
  ['antyradio', 'Antyradio', 'ZET i Antyradio', ['https://an.cdn.eurozet.pl/ant-waw.mp3', 'https://an.cdn.eurozet.pl/ant-kat.mp3']],
  ['antyradio-ballads', 'Antyradio Ballads', 'ZET i Antyradio', ['https://an.cdn.eurozet.pl/ANTBAL.mp3']],
  ['antyradio-classic-rock', 'Antyradio Classic Rock', 'ZET i Antyradio', ['https://an.cdn.eurozet.pl/ANTCLA.mp3']],
  ['antyradio-covers', 'Antyradio Covers', 'ZET i Antyradio', ['https://an.cdn.eurozet.pl/ANTCOV.mp3']],
  ['antyradio-greatest', 'Antyradio Greatest', 'ZET i Antyradio', ['https://an.cdn.eurozet.pl/ANTGRE.mp3']],
  ['antyradio-hard', 'Antyradio Hard', 'ZET i Antyradio', ['https://an.cdn.eurozet.pl/ANTHAR.mp3']],
  ['antyradio-live', 'Antyradio Live', 'ZET i Antyradio', ['https://an.cdn.eurozet.pl/ANTLIV.mp3']],
  ['antyradio-made-in-poland', 'Antyradio Made in Poland', 'ZET i Antyradio', ['https://an.cdn.eurozet.pl/ANTPOL.mp3']],
  ['antyradio-makak', 'Antyradio Makak', 'ZET i Antyradio', ['https://an.cdn.eurozet.pl/ANTMAK.mp3']],
  ['antyradio-unplugged', 'Antyradio Unplugged', 'ZET i Antyradio', ['https://an.cdn.eurozet.pl/ANTUNP.mp3']],
  ['antyradio-woodstock', 'Antyradio Woodstock', 'ZET i Antyradio', ['https://an.cdn.eurozet.pl/ANTWOD.mp3']],
  ['pr1', 'Polskie Radio Jedynka', 'Polskie Radio', ['http://mp3.polskieradio.pl:8900/;']],
  ['pr2', 'Polskie Radio Dwójka', 'Polskie Radio', ['http://mp3.polskieradio.pl:8902/;']],
  ['pr3', 'Polskie Radio Trójka', 'Polskie Radio', ['http://mp3.polskieradio.pl:8904/;']],
  ['pr4', 'Polskie Radio Czwórka', 'Polskie Radio', ['http://mp3.polskieradio.pl:8906/;']],
  ['r357', 'Radio 357', 'Inne polskie', ['https://stream.rcs.revma.com/an1ug']],
  ['nowyswiat', 'Radio Nowy Świat', 'Inne polskie', ['https://stream.rcs.revma.com/ypqt40u0x1zuv']],
  ['zlote', 'Radio Złote Przeboje', 'Inne polskie', ['https://radiostream.pl/tuba9-1.mp3']],
  ['tokfm', 'TOK FM', 'Inne polskie', ['https://radiostream.pl/tuba10-1.mp3']],
  ['rockradio', 'Rock Radio', 'Inne polskie', ['https://radiostream.pl/tuba9006-1.mp3']],
  ['vox', 'VOX FM', 'Inne polskie', ['https://ic1.smcdn.pl/3990-1.mp3']],
];

// Stacje z prowadzącymi. Pozostałe kanały RMF, FRESH i Antyradia grają samą muzykę.
const zProwadzacymi = new Set([
  'rmf-5', 'rmf-6', 'rmf-7', 'rmf-190', 'rmf-152', 'rmf-162',
  'zet', 'meloradio', 'chillizet', 'antyradio', 'pr1', 'pr2', 'pr3', 'pr4',
  'r357', 'nowyswiat', 'zlote', 'tokfm', 'rockradio', 'vox', 'eska-2380', 'eska-5380',
]);

const POLSKIE = /polsk|\bpl\b|prl|disco polo|lady pank|prywatka|szanty|kolędy|piosenka literacka|made in poland|teraz polski/i;
const ANGIELSKIE = /queen|depeche mode|michael jackson|beatlemania|classic rock|grunge|nu metal|k-pop/i;

function oznacz(stacja) {
  const lokalnaMaxx = stacja.grupa === 'RMF MAXX' && !/Hop Bęc|Club|Dance|Rap|New Hits/.test(stacja.nazwa || '');
  const eskaBezNazwy = stacja.grupa === 'ESKA' && !stacja.nazwa;
  stacja.bezGadania = !zProwadzacymi.has(stacja.id) && !lokalnaMaxx && !eskaBezNazwy &&
    stacja.grupa !== 'Polskie Radio';
  const nazwa = stacja.nazwa || '';
  stacja.jezyk = POLSKIE.test(nazwa) ? 'polski' : (ANGIELSKIE.test(nazwa) && !/K-Pop/i.test(nazwa) ? 'angielski' : 'mieszany');
  return stacja;
}

const lista = [];
const dodajRmf = (grupa, wiersze) => wiersze.forEach(([rmfId, nazwa]) =>
  lista.push(oznacz({ id: 'rmf-' + rmfId, nazwa, grupa, rmfId })));
dodajRmf('RMF główne', rmfGlowne);
dodajRmf('RMF tematyczne', rmfTematyczne);
dodajRmf('RMF MAXX', rmfMaxx);
dodajRmf('RMF Classic', rmfClassic);
dodajRmf('FRESH', fresh);
eska.forEach(([kod, nazwa]) => lista.push(oznacz({
  id: 'eska-' + kod, nazwa, grupa: 'ESKA', adresy: ['https://ic1.smcdn.pl/' + kod + '-1.mp3'],
})));
inne.forEach(([id, nazwa, grupa, adresy]) => lista.push(oznacz({ id, nazwa, grupa, adresy })));

module.exports = lista;
