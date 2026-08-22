#!/usr/bin/env bash
# Generate professional GitHub Release notes body to stdout.
#
# Usage: generate-release-notes.sh NEW_TAG PREV_TAG [RELEASE_DATE]
#   PREV_TAG: previous release tag; empty, "(initial)" or "v0.0.0" = initial release
# Env:
#   GH_ACTOR: workflow actor login (optional; credited as contributor)
#
# Design rules:
#   - Sections appear ONLY when they have content (never "No X in this release")
#   - Zero-commit releases produce an honest one-paragraph redeploy note
#   - No npm install guide (this is a hosted web app, not a package)
#   - chore/docs/ci/test noise lives in a collapsed section, not the headline body
set -euo pipefail

NEW_TAG="${1:?usage: generate-release-notes.sh NEW_TAG PREV_TAG [RELEASE_DATE]}"
PREV_TAG="${2:-}"
RELEASE_DATE="${3:-$(date +%Y-%m-%d)}"
GH_ACTOR="${GH_ACTOR:-}"

REPO_URL="$(git remote get-url origin | sed 's/\.git$//; s#git@github.com:#https://github.com/#')"

IS_INITIAL=1
if [ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "(initial)" ] && [ "$PREV_TAG" != "v0.0.0" ]; then
  IS_INITIAL=0
  COMMIT_RANGE="${PREV_TAG}..HEAD"
else
  PREV_TAG=""
  COMMIT_RANGE="HEAD"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
BODY="$TMP/body.md"

# ---------------- collect ----------------
COMMIT_COUNT=$(git log ${COMMIT_RANGE} --oneline --no-merges 2>/dev/null | wc -l | tr -d ' ')
STAT_LINE="$(git diff --stat ${COMMIT_RANGE} 2>/dev/null | tail -1 || true)"
ADDITIONS="$(echo "$STAT_LINE" | grep -oP '\d+(?= insertion)' || true)"
DELETIONS="$(echo "$STAT_LINE" | grep -oP '\d+(?= deletion)' || true)"
ADDITIONS="${ADDITIONS:-0}"
DELETIONS="${DELETIONS:-0}"

# Contributors: commit authors + actor, bots filtered
CONTRIB=""
credit() {
  local u="${1%%@*}"
  u="${u##*+}"
  case "$u" in *bot*|*github-actions*|*noreply*) return 0 ;; esac
  case " $CONTRIB " in *" $u "*) return 0 ;; esac
  CONTRIB="${CONTRIB:+$CONTRIB }$u"
}
while read -r email; do
  [ -n "$email" ] && credit "$email"
done < <(git log ${COMMIT_RANGE} --pretty=tformat:"%ae" --no-merges 2>/dev/null | sort -u)
if [ -n "$GH_ACTOR" ]; then credit "${GH_ACTOR}@workflow"; fi

# ---------------- categorize ----------------
# Map conventional-commit prefixes -> section files
while IFS=$'\t' read -r hash subject; do
  [ -n "$hash" ] || continue
  clean="$subject"
  if [[ "$subject" == BREAKING* || "$subject" == *"!:"* || "$subject" == *"!("* ]]; then
    cat="breaking"
  elif [[ "$subject" =~ ^feat ]]; then
    cat="feat"
  elif [[ "$subject" =~ ^fix ]]; then
    cat="fix"
  elif [[ "$subject" =~ ^(refactor|perf) ]]; then
    cat="changed"
  else
    cat="other"
  fi
  # strip conventional prefix up to first ": " for readability
  case "$subject" in
    *": "*) clean="${subject#*: }" ;;
  esac
  [ -n "$clean" ] || clean="$subject"
  printf -- '- %s (`%s`)\n' "$clean" "$hash" >> "$TMP/sec-$cat.txt"
done < <(git log ${COMMIT_RANGE} --pretty=tformat:"%h%x09%s" --no-merges 2>/dev/null)

cat "$TMP/sec-perf.txt" "$TMP/sec-refactor.txt" 2>/dev/null > "$TMP/sec-changed.txt" || true
cat "$TMP/sec-test.txt" "$TMP/sec-docs.txt" "$TMP/sec-ci.txt" \
    "$TMP/sec-chore.txt" "$TMP/sec-style.txt" "$TMP/sec-other.txt" 2>/dev/null \
  | grep -v '^$' > "$TMP/sec-misc.txt" || true

# ---------------- emit ----------------
say() { printf '%s\n' "$@" >> "$BODY"; }

section() { # TITLE FILE
  if [ -s "$2" ]; then
    say "" "### $1" ""
    cat "$2" >> "$BODY"
  fi
}

say "## $NEW_TAG"
say ""

if [ "$COMMIT_COUNT" -eq 0 ]; then
  say "Redeployment of ${PREV_TAG} — no code changes since the last release."
  say "Triggered manually to verify or force the deployment pipeline."
else
  PLURAL="commits"
  [ "$COMMIT_COUNT" -eq 1 ] && PLURAL="commit"
  say "${COMMIT_COUNT} ${PLURAL} · +${ADDITIONS} −${DELETIONS} · shipped ${RELEASE_DATE}"

  section "Breaking Changes" "$TMP/sec-breaking.txt"
  section "Features" "$TMP/sec-feat.txt"
  section "Fixed" "$TMP/sec-fix.txt"
  section "Changed" "$TMP/sec-changed.txt"

  if [ -s "$TMP/sec-misc.txt" ]; then
    say ""
    say "<details>"
    say "<summary>Maintenance and tooling</summary>"
    say ""
    cat "$TMP/sec-misc.txt" >> "$BODY"
    say ""
    say "</details>"
  fi

  if [ -n "$CONTRIB" ]; then
    MENTIONS=""
    for u in $CONTRIB; do MENTIONS="${MENTIONS:+$MENTIONS }@$u"; done
    say "" "Thanks ${MENTIONS}"
  fi
fi

if [ "$IS_INITIAL" -eq 0 ]; then
  say ""
  say "**Full Changelog:** [${PREV_TAG}...${NEW_TAG}](${REPO_URL}/compare/${PREV_TAG}...${NEW_TAG})"
fi

if [ "$COMMIT_COUNT" -gt 0 ]; then
  say ""
  say "<details>"
  say "<summary>All commits</summary>"
  say ""
  say '```'
  git log ${COMMIT_RANGE} --oneline --no-merges 2>/dev/null >> "$BODY" || true
  say '```'
  say "</details>"
fi

cat "$BODY"
