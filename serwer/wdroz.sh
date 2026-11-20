#!/usr/bin/env bash
# Wdrożenie strony instalacyjnej Radia NUX7 pod nux7.com.
# Uruchamiać z sudo. Cofnięcie zmian: cofnij.sh z tego samego katalogu.
set -euo pipefail

ZRODLO="https://raw.githubusercontent.com/Nuxop-ops/radio-nux7/main/serwer"
KATALOG="/opt/nux7-www"
CADDYFILE="/opt/proxy/Caddyfile"
KOPIA="/opt/kopie/Caddyfile.przed-nux7-www"
PORT="8031"
INWENTARZ="/opt/INWENTARZ.md"

echo "1/5 Sprawdzam serwer"
if [ ! -f "$CADDYFILE" ]; then echo "Brak pliku $CADDYFILE. Przerywam."; exit 1; fi
if ! grep -q '^nux7\.com {' "$CADDYFILE"; then echo "W Caddyfile nie ma wpisu nux7.com. Przerywam."; exit 1; fi
if ! docker ps --format '{{.Names}}' | grep -qx 'nux7-www'; then
  if ss -ltn | grep -q ":$PORT "; then echo "Port $PORT jest zajęty. Przerywam."; exit 1; fi
fi

echo "2/5 Pobieram pliki strony"
mkdir -p "$KATALOG/www"
curl -fsSL "$ZRODLO/docker-compose.yml" -o "$KATALOG/docker-compose.yml"
curl -fsSL "$ZRODLO/www/index.html" -o "$KATALOG/www/index.html"
if [ ! -f "$KATALOG/www/wersja.json" ]; then
  curl -fsSL "$ZRODLO/www/wersja.json" -o "$KATALOG/www/wersja.json"
fi

echo "3/5 Uruchamiam stronę"
docker compose -f "$KATALOG/docker-compose.yml" up -d
sleep 2
if ! curl -fsS "http://127.0.0.1:$PORT/" -o /dev/null; then
  echo "Strona nie odpowiada na porcie $PORT. Caddy zostaje bez zmian."
  exit 1
fi

echo "4/5 Podłączam domenę nux7.com"
if sed -n '/^nux7\.com {/,/^}/p' "$CADDYFILE" | grep -q "reverse_proxy 127.0.0.1:$PORT"; then
  echo "Domena jest już podłączona."
else
  if ! sed -n '/^nux7\.com {/,/^}/p' "$CADDYFILE" | grep -q 'respond 404'; then
    echo "Wpis nux7.com wygląda inaczej, niż oczekiwano. Caddy zostaje bez zmian."
    exit 1
  fi
  mkdir -p /opt/kopie
  cp "$CADDYFILE" "$KOPIA"
  NOWY="$(mktemp)"
  sed "/^nux7\.com {/,/^}/ s|respond 404|reverse_proxy 127.0.0.1:$PORT|" "$CADDYFILE" > "$NOWY"
  cat "$NOWY" > "$CADDYFILE"
  rm -f "$NOWY"
  if ! docker exec proxy-caddy-1 caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    echo "Nowe ustawienia Caddy są błędne. Przywracam poprzednie."
    cat "$KOPIA" > "$CADDYFILE"
    exit 1
  fi
  docker exec proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1
fi

echo "5/5 Zapisuję w inwentarzu"
if [ -f "$INWENTARZ" ] && ! grep -q 'nux7-www' "$INWENTARZ"; then
  {
    echo ""
    echo "## nux7-www"
    echo "- Co: strona instalacyjna Radia NUX7 (nux7.com), kontener nux7-www (nginx)"
    echo "- Gdzie: $KATALOG, port lokalny $PORT"
    echo "- Dane: brak, same pliki strony z repozytorium Nuxop-ops/radio-nux7 (katalog serwer)"
    echo "- Kopia sprzed zmiany Caddy: $KOPIA"
  } >> "$INWENTARZ"
fi

echo "Gotowe. Strona działa pod https://nux7.com"
