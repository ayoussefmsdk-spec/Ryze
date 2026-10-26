#!/usr/bin/env bash
# =====================================================================
# Ryze / HDJ — lance les suites de non-régression (tests/NN-*.js)
#   bash tests/run.sh            toutes les suites
#   bash tests/run.sh 03         seulement celles dont le nom contient « 03 »
#   bash tests/run.sh documents  idem avec « documents »
# Une ligne par suite : nom | N OK | M FAIL | erreurs JS : K | durée
# Code de sortie 1 si un contrôle échoue (FAIL), si une erreur JavaScript
# survient ou si une suite s'arrête anormalement.
# Journaux, PDF et fichiers exportés : tests/out/ (ignoré par git),
# ou le dossier indiqué par RYZE_TESTS_OUT.
# =====================================================================
set -u
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${RYZE_TESTS_OUT:-$DIR/out}"
export RYZE_TESTS_OUT="$OUT"
mkdir -p "$OUT"

# Playwright installé globalement : le trouver via npm root -g
if [ -z "${NODE_PATH:-}" ]; then
  NODE_PATH="$(npm root -g 2>/dev/null || true)"
  export NODE_PATH
fi
if ! command -v node >/dev/null 2>&1; then echo "node introuvable : installez Node.js (18 ou plus)"; exit 2; fi

motif="${1:-}"
debut=$(date +%s)
echec=0
n=0
printf '%-16s | %-7s | %-7s | %-15s | %s\n' 'suite' 'OK' 'FAIL' 'erreurs JS' 'durée'
for f in "$DIR"/[0-9][0-9]-*.js; do
  [ -e "$f" ] || continue
  nom="$(basename "$f" .js)"
  if [ -n "$motif" ] && [[ "$nom" != *"$motif"* ]]; then continue; fi
  n=$((n + 1))
  t0=$(date +%s)
  node "$f" > "$OUT/$nom.log" 2>&1
  code=$?
  t1=$(date +%s)
  resume="$(grep -E '^[0-9]+ OK, [0-9]+ FAIL; erreurs JS : [0-9]+' "$OUT/$nom.log" | tail -1)"
  if [ -z "$resume" ]; then
    printf '%-16s | %7s | %7s | %-14s | %s s\n' "$nom" '?' '?' "arrêt (code $code)" "$((t1 - t0))"
    tail -n 8 "$OUT/$nom.log" | sed 's/^/    /'
    echec=1
    continue
  fi
  ok="$(sed -E 's/^([0-9]+) OK.*/\1/' <<< "$resume")"
  ko="$(sed -E 's/^[0-9]+ OK, ([0-9]+) FAIL.*/\1/' <<< "$resume")"
  js="$(sed -E 's/.*erreurs JS : ([0-9]+).*/\1/' <<< "$resume")"
  corr=""
  if [[ "$resume" == *"à corriger"* ]]; then corr=" · à corriger : $(sed -E 's/.*à corriger : ([0-9]+).*/\1/' <<< "$resume")"; fi
  printf '%-16s | %4s OK | %2s FAIL | erreurs JS : %-2s | %s s%s\n' "$nom" "$ok" "$ko" "$js" "$((t1 - t0))" "$corr"
  if [ "$code" -ne 0 ] || [ "$ko" -ne 0 ] || [ "$js" -ne 0 ]; then
    echec=1
    grep -E '^  FAIL ' "$OUT/$nom.log" | head -n 15 | sed 's/^/    /'
    sed -n '/^Erreurs JavaScript/,/^Durée/p' "$OUT/$nom.log" | grep -v '^Durée' | head -n 10 | sed 's/^/    /'
  fi
  grep -E '^  À CORRIGER ' "$OUT/$nom.log" | head -n 10 | sed 's/^/    /'
done
if [ "$n" -eq 0 ]; then echo "Aucune suite ne correspond au motif « $motif »"; exit 2; fi
fin=$(date +%s)
echo "Durée totale : $((fin - debut)) s — journaux, PDF et exports : $OUT"
if [ "$echec" -ne 0 ]; then echo "ÉCHEC"; else echo "Tout est vert"; fi
exit "$echec"
