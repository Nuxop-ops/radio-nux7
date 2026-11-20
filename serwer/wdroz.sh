#!/usr/bin/env bash
# Wdrożenie Radia NUX7 pod nux7.com: strona, słuchanie w przeglądarce,
# serwer kont i stacji oraz panel admina.
# Uruchamiać z sudo. Cofnięcie zmian: cofnij-serwer.sh z tego samego katalogu.
set -euo pipefail

# Pierwszy argument pozwala wskazać inną wersję plików (do cofania zmian).
ZRODLO="${1:-https://raw.githubusercontent.com/Nuxop-ops/radio-nux7/main/serwer}"
KATALOG="/opt/nux7-www"
CADDYFILE="/opt/proxy/Caddyfile"
KOPIA="/opt/kopie/Caddyfile.przed-nux7-www"
KOPIA_API="/opt/kopie/Caddyfile.przed-nux7-api"
PORT="8031"
PORT_API="8032"
INWENTARZ="/opt/INWENTARZ.md"

przeladuj_caddy() {
  # $1 = kopia, do której wracamy, gdy nowe ustawienia są błędne
  if ! docker exec proxy-caddy-1 caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    echo "Nowe ustawienia Caddy są błędne. Przywracam poprzednie."
    cat "$1" > "$CADDYFILE"
    exit 1
  fi
  docker exec proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1
}

echo "1/6 Sprawdzam serwer"
if [ ! -f "$CADDYFILE" ]; then echo "Brak pliku $CADDYFILE. Przerywam."; exit 1; fi
if ! grep -q '^nux7\.com {' "$CADDYFILE"; then echo "W Caddyfile nie ma wpisu nux7.com. Przerywam."; exit 1; fi
if ! docker ps --format '{{.Names}}' | grep -qx 'nux7-www'; then
  if ss -ltn | grep -q ":$PORT "; then echo "Port $PORT jest zajęty. Przerywam."; exit 1; fi
fi

echo "2/6 Pobieram pliki"
mkdir -p "$KATALOG/www" "$KATALOG/api"
curl -fsSL "$ZRODLO/docker-compose.yml" -o "$KATALOG/docker-compose.yml"
for PLIK in index.html logo.png ikona.png wersja.json; do
  curl -fsSL "$ZRODLO/www/$PLIK" -o "$KATALOG/www/$PLIK"
done
# Poniższe pliki są tylko w nowszych wersjach; przy cofaniu do starszej są usuwane.
for PLIK in www/radio-nux7.apk www/sluchaj.html www/admin.html nginx.conf api/server.js api/stacje.js; do
  NOWY_PLIK="$(mktemp)"
  KOD="$(curl -sL --retry 3 --retry-delay 2 -o "$NOWY_PLIK" -w '%{http_code}' "$ZRODLO/$PLIK" || true)"
  if [ "$KOD" = "200" ] && [ -s "$NOWY_PLIK" ]; then
    cat "$NOWY_PLIK" > "$KATALOG/$PLIK"
  elif [ "$KOD" = "404" ]; then
    rm -f "$KATALOG/$PLIK"
  else
    echo "Uwaga: nie udało się pobrać $PLIK (odpowiedź $KOD). Zostaje poprzednia wersja tego pliku."
  fi
  rm -f "$NOWY_PLIK"
done
chmod 644 "$KATALOG"/www/* 2>/dev/null || true
if [ -f "$KATALOG/www/radio-nux7.apk" ]; then
  echo "Plik aplikacji: $(stat -c %s "$KATALOG/www/radio-nux7.apk") bajtów"
else
  echo "Uwaga: na serwerze nie ma pliku aplikacji radio-nux7.apk."
fi
JEST_API="nie"
if [ -f "$KATALOG/api/server.js" ] && grep -q 'nux7-api' "$KATALOG/docker-compose.yml"; then
  JEST_API="tak"
  if ! docker ps --format '{{.Names}}' | grep -qx 'nux7-api'; then
    if ss -ltn | grep -q ":$PORT_API "; then echo "Port $PORT_API jest zajęty. Przerywam."; exit 1; fi
  fi
  # Dane kont. Tego katalogu wdrożenie nigdy nie kasuje.
  mkdir -p "$KATALOG/api-dane"
  chown 1000:1000 "$KATALOG/api-dane"
  chmod 700 "$KATALOG/api-dane"
fi

echo "3/6 Uruchamiam stronę i serwer"
docker compose -f "$KATALOG/docker-compose.yml" up -d --remove-orphans
docker exec nux7-www nginx -s reload >/dev/null 2>&1 || true
if [ "$JEST_API" = "tak" ]; then
  docker restart nux7-api >/dev/null
fi
sleep 3
if ! curl -fsS "http://127.0.0.1:$PORT/" -o /dev/null; then
  echo "Strona nie odpowiada na porcie $PORT. Caddy zostaje bez zmian."
  exit 1
fi
if [ "$JEST_API" = "tak" ]; then
  DZIALA="nie"
  for PROBA in 1 2 3 4 5 6; do
    if curl -fsS "http://127.0.0.1:$PORT_API/api/zdrowie" -o /dev/null 2>/dev/null; then DZIALA="tak"; break; fi
    sleep 2
  done
  if [ "$DZIALA" != "tak" ]; then
    echo "Serwer kont nie odpowiada na porcie $PORT_API. Caddy zostaje bez zmian."
    docker logs nux7-api --tail 15 || true
    exit 1
  fi
fi

echo "4/6 Podłączam domenę nux7.com do strony"
if sed -n '/^nux7\.com {/,/^}/p' "$CADDYFILE" | grep -q "reverse_proxy 127.0.0.1:$PORT"; then
  echo "Strona jest już podłączona."
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
  przeladuj_caddy "$KOPIA"
fi

echo "5/6 Podłączam adresy /api do serwera kont"
if [ "$JEST_API" != "tak" ]; then
  echo "Ta wersja nie ma serwera kont, pomijam."
elif sed -n '/^nux7\.com {/,/^}/p' "$CADDYFILE" | grep -q "reverse_proxy 127.0.0.1:$PORT_API"; then
  if grep -q "reverse_proxy 127.0.0.1:$PORT_API {" "$CADDYFILE"; then
    echo "Adresy /api są już podłączone."
  else
    # Starszy wpis bez natychmiastowego przesyłania dźwięku: uzupełniam go.
    KOPIA_PRZESYL="/opt/kopie/Caddyfile.przed-nux7-przesyl"
    cp "$CADDYFILE" "$KOPIA_PRZESYL"
    NOWY="$(mktemp)"
    awk -v port="$PORT_API" '
      $0 ~ "^[ \t]*reverse_proxy 127.0.0.1:" port "$" {
        print "\t\treverse_proxy 127.0.0.1:" port " {"
        print "\t\t\tflush_interval -1"
        print "\t\t}"
        next
      }
      { print }
    ' "$CADDYFILE" > "$NOWY"
    cat "$NOWY" > "$CADDYFILE"
    rm -f "$NOWY"
    przeladuj_caddy "$KOPIA_PRZESYL"
    rm -f "$KOPIA_PRZESYL"
    echo "Uzupełniono wpis /api o natychmiastowe przesyłanie dźwięku."
  fi
else
  mkdir -p /opt/kopie
  cp "$CADDYFILE" "$KOPIA_API"
  NOWY="$(mktemp)"
  awk -v port="$PORT_API" '
    { print }
    /^nux7\.com \{/ {
      print "\t@nux7api path /api/*"
      print "\thandle @nux7api {"
      print "\t\treverse_proxy 127.0.0.1:" port " {"
      print "\t\t\tflush_interval -1"
      print "\t\t}"
      print "\t}"
    }
  ' "$CADDYFILE" > "$NOWY"
  cat "$NOWY" > "$CADDYFILE"
  rm -f "$NOWY"
  przeladuj_caddy "$KOPIA_API"
fi

echo "6/6 Zapisuję w inwentarzu"
if [ -f "$INWENTARZ" ] && ! grep -q 'nux7-www' "$INWENTARZ"; then
  {
    echo ""
    echo "## nux7-www"
    echo "- Co: strona Radia NUX7 (nux7.com), kontener nux7-www (nginx)"
    echo "- Gdzie: $KATALOG, port lokalny $PORT"
    echo "- Dane: brak, same pliki strony z repozytorium Nuxop-ops/radio-nux7 (katalog serwer)"
    echo "- Kopia sprzed zmiany Caddy: $KOPIA"
  } >> "$INWENTARZ"
fi
if [ "$JEST_API" = "tak" ] && [ -f "$INWENTARZ" ] && ! grep -q 'nux7-api' "$INWENTARZ"; then
  {
    echo ""
    echo "## nux7-api"
    echo "- Co: serwer kont, listy stacji i panelu admina Radia NUX7, kontener nux7-api (node)"
    echo "- Gdzie: $KATALOG/api, port lokalny $PORT_API, adresy nux7.com/api/..."
    echo "- Dane: $KATALOG/api-dane (konta użytkowników, ustawienia stacji) - wymaga kopii zapasowej"
    echo "- Kopia sprzed zmiany Caddy: $KOPIA_API"
  } >> "$INWENTARZ"
fi

echo "Gotowe. Strona działa pod https://nux7.com"
if [ -f "$KATALOG/api-dane/kod-admina.txt" ]; then
  echo ""
  echo "Jednorazowy kod do aktywacji admina (nie pokazuj go nikomu):"
  cat "$KATALOG/api-dane/kod-admina.txt"
fi
