#!/usr/bin/env bash
# Cofnięcie wdrożenia strony instalacyjnej Radia NUX7.
# Przywraca poprzednie ustawienia Caddy i usuwa stronę z serwera.
set -euo pipefail

KATALOG="/opt/nux7-www"
CADDYFILE="/opt/proxy/Caddyfile"
KOPIA="/opt/kopie/Caddyfile.przed-nux7-www"
INWENTARZ="/opt/INWENTARZ.md"

echo "1/3 Przywracam ustawienia Caddy"
if [ -f "$KOPIA" ]; then
  cat "$KOPIA" > "$CADDYFILE"
  docker exec proxy-caddy-1 caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1
  docker exec proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1
  rm -f "$KOPIA"
else
  echo "Brak kopii $KOPIA, ustawień Caddy nie zmieniam."
fi

echo "2/3 Zatrzymuję i usuwam stronę"
if [ -f "$KATALOG/docker-compose.yml" ]; then
  docker compose -f "$KATALOG/docker-compose.yml" down
fi
rm -rf "$KATALOG"

echo "3/3 Poprawiam inwentarz"
if [ -f "$INWENTARZ" ] && grep -q '^## nux7-www' "$INWENTARZ"; then
  NOWY="$(mktemp)"
  awk '/^## nux7-www/{pomin=1; next} /^## /{pomin=0} !pomin' "$INWENTARZ" > "$NOWY"
  cat "$NOWY" > "$INWENTARZ"
  rm -f "$NOWY"
fi

echo "Cofnięte. nux7.com działa jak przed wdrożeniem."
