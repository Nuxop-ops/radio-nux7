#!/usr/bin/env bash
# Usuwa z serwera stare Radio Gizmo (radio.nuxop.com). Radio NUX7 i przekaźnik
# /opt/radio-pl zostają nietknięte. Uruchamiać z sudo. Kopii nie zostawia.
set -euo pipefail

CADDYFILE="/opt/proxy/Caddyfile"
INWENTARZ="/opt/INWENTARZ.md"

echo "1/5 Sprawdzam, czy Radio NUX7 i przekaźnik działają"
for NAZWA in radio-pl nux7-www nux7-api; do
  if ! docker ps --format '{{.Names}}' | grep -qx "$NAZWA"; then
    echo "Kontener $NAZWA nie działa. Niczego nie usuwam."; exit 1
  fi
done

echo "2/5 Usuwam kontener i obrazy starego radia"
docker rm -f radio-radio-1 >/dev/null 2>&1 || true
docker rmi radio-radio:latest radio-gizmo:przed-przekaznikiem >/dev/null 2>&1 || true

echo "3/5 Usuwam wpis radio.nuxop.com z bramy"
if grep -q '^radio\.nuxop\.com {' "$CADDYFILE"; then
  POPRZEDNI="$(mktemp)"; NOWY="$(mktemp)"
  cat "$CADDYFILE" > "$POPRZEDNI"
  awk '/^radio\.nuxop\.com \{/{pomin=1} !pomin{print} pomin&&/^\}/{pomin=0}' "$POPRZEDNI" | cat -s > "$NOWY"
  cat "$NOWY" > "$CADDYFILE"
  if ! docker exec proxy-caddy-1 caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    echo "Nowe ustawienia bramy są błędne. Przywracam poprzednie i przerywam."
    cat "$POPRZEDNI" > "$CADDYFILE"; rm -f "$POPRZEDNI" "$NOWY"; exit 1
  fi
  docker exec proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1
  rm -f "$POPRZEDNI" "$NOWY"
else
  echo "Wpisu nie ma, pomijam."
fi

echo "4/5 Usuwam pliki"
rm -rf /opt/radio /opt/kopie/radio-apka-wersja /opt/kopie/radio-apka-20261115 /opt/kopie/proxy-apk-20261115
rm -f /opt/proxy/data/pobierz/radio-gizmo.apk
rmdir --ignore-fail-on-non-empty /opt/proxy/data/pobierz 2>/dev/null || true
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f >/dev/null 2>&1 || true

echo "5/5 Porządkuję INWENTARZ"
if [ -f "$INWENTARZ" ]; then
  sed -i \
    -e '/radio (radio\.nuxop\.com) przeniesione/d' \
    -e '/radio-gizmo\.apk/d' \
    -e '/Aplikacja Radio Gizmo/d' \
    -e '/Radio Gizmo (\/opt\/radio, radio\.nuxop\.com) zatrzymane/d' \
    -e 's/dla Radio Gizmo/dla Radia NUX7/' \
    -e 's/hub, radio, wedzone/hub, wedzone/' \
    "$INWENTARZ"
  echo "- 2026-11-21: Radio Gizmo usunięte z serwera: katalog /opt/radio, kontener, obrazy, wpis radio.nuxop.com w bramie, plik aplikacji i stare kopie. Kopii nie zostawiono. Działa tylko Radio NUX7 (nux7.com); przekaźnik /opt/radio-pl zostaje." >> "$INWENTARZ"
fi

echo "Gotowe. Wolne miejsce:"
df -h / | tail -1
