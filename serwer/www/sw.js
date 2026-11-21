// Dzięki temu plikowi przeglądarka pozwala zainstalować radio jak zwykły program.
// Niczego nie zapamiętuje na zapas, więc strona zawsze jest aktualna.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (zdarzenie) { zdarzenie.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
