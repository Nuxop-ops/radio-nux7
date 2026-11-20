#!/usr/bin/env bash
# Cofnięcie wdrożenia serwera kont i słuchania w przeglądarce.
# Strona wraca do wersji tylko z instalacją aplikacji. Konta użytkowników
# zostają na dysku w /opt/nux7-www/api-dane i nie są kasowane.
set -euo pipefail

POPRZEDNIA="https://raw.githubusercontent.com/Nuxop-ops/radio-nux7/ea5879f/serwer"
KATALOG="/opt/nux7-www"
CADDYFILE="/opt/proxy/Caddyfile"
KOPIA_API="/opt/kopie/Caddyfile.przed-nux7-api"

echo "1/3 Przywracam ustawienia Caddy sprzed podłączenia /api"
if [ -f "$KOPIA_API" ]; then
  cat "$KOPIA_API" > "$CADDYFILE"
  docker exec proxy-caddy-1 caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1
  docker exec proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1
  rm -f "$KOPIA_API"
else
  echo "Brak kopii $KOPIA_API, ustawień Caddy nie zmieniam."
fi

echo "2/3 Zatrzymuję serwer kont"
docker rm -f nux7-api >/dev/null 2>&1 || true

echo "3/3 Przywracam poprzednią wersję strony"
rm -f "$KATALOG/www/sluchaj.html" "$KATALOG/www/admin.html" "$KATALOG/nginx.conf"
curl -fsSL "$POPRZEDNIA/wdroz.sh" | bash -s -- "$POPRZEDNIA"

echo "Cofnięte. Konta zostały w $KATALOG/api-dane."
