#!/usr/bin/env bash
#
# test-curd.sh — end-to-end CRUD + consistency tests for the wiki-curator skill.
#
# Run from repo root:  ./tests/wiki/test-curd.sh
#
# Exit code: 0 if all tests pass, 1 otherwise.
#
# Tests:
#   1. Inventory: count wiki pages, ensure >= 30 expected pages exist.
#   2. Frontmatter: every page has title/type/last_updated.
#   3. Internal links: every (label)(path) in any page resolves to a real file.
#   4. List: wiki-cli list returns the same count as the inventory.
#   5. Get: wiki-cli get on a known page returns non-empty content.
#   6. Search: wiki-cli search finds a known term.
#   7. Frontmatter extraction: wiki-cli frontmatter shows the right keys.
#   8. Add: wiki-cli add creates a new page with the given frontmatter.
#   9. Edit --append: adds new content to the bottom of a page.
#  10. Edit --set: changes a frontmatter key.
#  11. Edit --replace: replaces a literal string.
#  12. References: wiki-cli references lists all pages that link to a target.
#  13. Delete (refuse): wiki-cli delete refuses to delete a still-referenced page.
#  14. Delete (allow): wiki-cli delete removes an unreferenced page.
#  15. Regenerate-index: rewrites README's Sections table without losing content.
#  16. validate: end state has zero FAIL on frontmatter and zero broken links.
#
# Side-effects: the test creates, edits, and deletes files under docs/claude/wiki/.
# Tests 8-15 clean up after themselves. Test 16 is the final gate.
# If the test exits unexpectedly, run `git status docs/claude/wiki/` to see drift.

set -u

REPO_ROOT="$(pwd)"
WIKI="${REPO_ROOT}/docs/claude/wiki"
CLI="${REPO_ROOT}/tools/wiki-cli"
PASS=0
FAIL=0
TESTS_RUN=0

note() { printf '  %s\n' "$*"; }
ok()   { printf '  PASS  %s\n' "$1"; PASS=$((PASS+1)); }
ko()   { printf '  FAIL  %s\n      %s\n' "$1" "$2"; FAIL=$((FAIL+1)); }
run()  { TESTS_RUN=$((TESTS_RUN+1)); }

# --- Test 1: Inventory ---------------------------------------------------
run
note "test 1: inventory"
EXPECTED_PAGES=30
COUNT=$(find "$WIKI" -type f -name '*.md' | wc -l | tr -d ' ')
if [[ "$COUNT" -ge "$EXPECTED_PAGES" ]]; then
  ok "inventory count >= $EXPECTED_PAGES (got $COUNT)"
else
  ko "inventory count" "expected >= $EXPECTED_PAGES, got $COUNT"
fi

# --- Test 2: Frontmatter -------------------------------------------------
run
note "test 2: frontmatter"
FM_BAD=0
while IFS= read -r -d '' f; do
  if ! "$CLI" frontmatter "$f" | grep -qE '^(title|type|last_updated)='; then
    FM_BAD=$((FM_BAD+1))
  fi
done < <(find "$WIKI" -type f -name '*.md' -print0)
if [[ "$FM_BAD" -eq 0 ]]; then
  ok "all wiki pages have title/type/last_updated"
else
  ko "frontmatter" "$FM_BAD pages missing required keys"
fi

# --- Test 3: Internal links ---------------------------------------------
run
note "test 3: internal links"
if "$CLI" validate 2>&1 | grep -q "FAIL  broken-link"; then
  ko "internal links" "broken-link FAIL present"
else
  ok "no broken internal links"
fi

# --- Test 4: list vs inventory ------------------------------------------
run
note "test 4: list count matches inventory"
LIST_COUNT=$("$CLI" list 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
if [[ "$LIST_COUNT" -eq "$COUNT" ]]; then
  ok "list count $LIST_COUNT matches inventory"
else
  ko "list count" "list=$LIST_COUNT inventory=$COUNT"
fi

# --- Test 5: get --------------------------------------------------------
run
note "test 5: get"
GET_OUT=$("$CLI" get docs/claude/wiki/glossary.md 2>/dev/null || true)
if [[ -n "$GET_OUT" && "$GET_OUT" == *"# Glossary"* ]]; then
  ok "get returns glossary content"
else
  ko "get" "empty or wrong content"
fi

# --- Test 6: search -----------------------------------------------------
run
note "test 6: search"
SEARCH_OUT=$("$CLI" search "xsec_token" 2>/dev/null || true)
if [[ -n "$SEARCH_OUT" && "$SEARCH_OUT" == *"social-media"* ]]; then
  ok "search finds xsec_token"
else
  ko "search" "no matches in social-media docs"
fi

# --- Test 7: frontmatter extraction ------------------------------------
run
note "test 7: frontmatter extraction"
FM_OUT=$("$CLI" frontmatter docs/claude/wiki/glossary.md 2>/dev/null || true)
if echo "$FM_OUT" | grep -q "^title=Glossary$" \
   && echo "$FM_OUT" | grep -q "^type=wiki-glossary$"; then
  ok "frontmatter shows correct keys"
else
  ko "frontmatter extraction" "got: $FM_OUT"
fi

# --- Test 8: add --------------------------------------------------------
run
note "test 8: add new page"
TMPDIR_PAGE="concepts/_test-temp-page.md"
"$CLI" add "$TMPDIR_PAGE" --title "Test temp page" --type wiki-concept --body "Body." 2>/dev/null
if [[ -f "$WIKI/$TMPDIR_PAGE" ]]; then
  ok "add created the page"
else
  ko "add" "page not created"
fi

# --- Test 9: edit --append ----------------------------------------------
run
note "test 9: edit --append"
BEFORE_LEN=$(wc -c < "$WIKI/$TMPDIR_PAGE" | tr -d ' ')
"$CLI" edit "$TMPDIR_PAGE" --append "## Appended section

Extra content here." 2>/dev/null
AFTER_LEN=$(wc -c < "$WIKI/$TMPDIR_PAGE" | tr -d ' ')
if [[ "$AFTER_LEN" -gt "$BEFORE_LEN" && "$(tail -n 3 "$WIKI/$TMPDIR_PAGE" | head -n 1)" == "## Appended section" ]]; then
  ok "append grew the file and added the heading"
else
  ko "edit --append" "before=$BEFORE_LEN after=$AFTER_LEN"
fi

# --- Test 10: edit --set -------------------------------------------------
run
note "test 10: edit --set"
"$CLI" edit "$TMPDIR_PAGE" --set title="Test temp page (renamed)" 2>/dev/null
NEW_TITLE=$("$CLI" frontmatter "$TMPDIR_PAGE" 2>/dev/null | grep '^title=' || true)
if [[ "$NEW_TITLE" == "title=Test temp page (renamed)" ]]; then
  ok "edit --set changed the title"
else
  ko "edit --set" "got: $NEW_TITLE"
fi

# --- Test 11: edit --replace --------------------------------------------
run
note "test 11: edit --replace"
"$CLI" edit "$TMPDIR_PAGE" --replace "## Appended section" "## Replaced section" 2>/dev/null
if grep -qF "## Replaced section" "$WIKI/$TMPDIR_PAGE"; then
  ok "edit --replace swapped the heading"
else
  ko "edit --replace" "heading not replaced"
fi

# --- Test 12: references ------------------------------------------------
run
note "test 12: references"
REFS=$("$CLI" references docs/claude/wiki/concepts/envelope.md 2>/dev/null || true)
if echo "$REFS" | grep -qF "docs/claude/wiki/concepts/contract.md"; then
  ok "references lists known back-links"
else
  ko "references" "no back-links found"
fi

# --- Test 13: delete (refuse) -------------------------------------------
run
note "test 13: delete refuses still-referenced page"
set +e
DELETE_OUT=$("$CLI" delete glossary.md 2>&1)
DELETE_RC=$?
set -e
if [[ "$DELETE_RC" -ne 0 && "$DELETE_OUT" == *"still referenced by"* ]]; then
  ok "delete refused with reason"
else
  ko "delete refused" "rc=$DELETE_RC output=$DELETE_OUT"
fi

# --- Test 14: delete (allow) --------------------------------------------
run
note "test 14: delete unreferenced page"
"$CLI" delete "$TMPDIR_PAGE" 2>/dev/null
if [[ ! -f "$WIKI/$TMPDIR_PAGE" ]]; then
  ok "delete removed the page"
else
  ko "delete unreferenced" "page still exists"
fi

# --- Test 15: regenerate-index -----------------------------------------
run
note "test 15: regenerate-index preserves content"
# Snapshot a checksum of the trailing content. Strip CR first to be CRLF/LF-agnostic.
content_hash() {
  tail -n +20 docs/claude/wiki/README.md | tr -d '\r' | md5sum | cut -d' ' -f1
}
BEFORE_HASH=$(content_hash)
"$CLI" regenerate-index 2>/dev/null
AFTER_HASH=$(content_hash)
if [[ "$BEFORE_HASH" != "$AFTER_HASH" ]]; then
  ko "regenerate-index" "trailing content changed unexpectedly (before=$BEFORE_HASH after=$AFTER_HASH)"
else
  if grep -q "## Sections" docs/claude/wiki/README.md \
     && grep -q "| Section | What it covers |" docs/claude/wiki/README.md; then
    ok "regenerate-index updated table, preserved rest"
  else
    ko "regenerate-index" "missing Sections header or table"
  fi
fi

# --- Test 16: final validate --------------------------------------------
run
note "test 16: final validate (0 FAIL)"
if "$CLI" validate 2>&1 | grep -q "FAIL"; then
  ko "final validate" "FAIL detected"
else
  ok "final validate 0 FAIL"
fi

# --- Summary ------------------------------------------------------------
printf '\n=========================\n'
printf '%d/%d tests passed\n' "$PASS" "$TESTS_RUN"
if [[ "$FAIL" -gt 0 ]]; then
  printf '%d FAILED\n' "$FAIL"
  exit 1
fi
printf 'all green\n'
exit 0
