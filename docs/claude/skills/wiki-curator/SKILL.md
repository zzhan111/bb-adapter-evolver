---
name: wiki-curator
description: Read, add, edit, delete, move, or regenerate pages in the bb-adapter-evolver wiki (docs/claude/wiki/). Use when asked to update, expand, fix, or audit the wiki, its index, glossary, or changelog. Backed by tools/wiki-cli which enforces frontmatter, validates links, and refuses destructive ops on still-referenced pages.
---

# wiki-curator

You are about to read or modify the bb-adapter-evolver wiki at `docs/claude/wiki/`. **Always go through `tools/wiki-cli`** for any mutation; it enforces invariants you should not bypass manually. For reads you can also use the CLI or `cat` the file directly.

## Wiki layout (recap)

```
docs/claude/wiki/
├── README.md                              # landing page (do not move)
├── getting-started.md
├── changelog.md                           # append-only history
├── glossary.md
├── concepts/
│   ├── adapter.md
│   ├── contract.md
│   ├── intent-granularity.md
│   ├── auth-tiers.md
│   ├── envelope.md
│   └── constraints-and-pagination.md
├── domains/
│   ├── ecommerce.md
│   ├── pharma-data.md
│   ├── social-media.md
│   └── choosing-a-domain.md
├── workflow/
│   ├── author-loop.md
│   ├── reverse-engineering.md
│   ├── bb-eval.md
│   ├── runtime-verification.md
│   ├── browser-setup.md
│   └── when-to-stop-and-ask-the-human.md
├── reference/
│   ├── ecommerce-adapters.md
│   ├── ecommerce-product.md
│   ├── ecommerce-order.md
│   ├── ecommerce-cart.md
│   ├── pharma-data-adapters.md
│   ├── pharma-data-record.md
│   ├── social-media-adapters.md
│   ├── social-media-note.md
│   ├── error-codes.md
│   └── anti-patterns.md
└── decisions/
    └── index.md
```

Every wiki page begins with a YAML frontmatter block (`---` delimited). Required keys:

| Key | Required | Notes |
|---|---|---|
| `title` | yes | Display title. |
| `type` | yes | One of `wiki-index`, `wiki-page`, `wiki-concept`, `wiki-domain`, `wiki-workflow`, `wiki-reference`, `wiki-decisions`, `wiki-glossary`, `wiki-changelog`. |
| `last_updated` | yes | `YYYY-MM-DD`. |
| `domain` | only for `wiki-domain` and `wiki-reference` (when domain-specific) | `ecommerce` / `pharma-data` / `social-media`. |

## Inviolable rules

These mirror `bb-eval`-style invariants and are enforced by `tools/wiki-cli`.

1. **All wiki pages must live under `docs/claude/wiki/`.** Do not create top-level `.md` files outside the wiki for wiki content.
2. **Frontmatter is required.** Every page must begin with a valid YAML `---` block with `title`, `type`, `last_updated`.
3. **One `changelog.md`, append-only.** Never rewrite history; add a dated entry.
4. **No silent deletions of still-referenced pages.** `wiki-cli delete` cross-checks every other wiki page for a markdown link or frontmatter reference; if found, the command FAILS unless `--force` is passed.
5. **Internal links use relative paths.** Cross-references between wiki pages should be `[label](../concepts/envelope.md)` style, not absolute.
6. **Wiki never overrides the contract.** When the wiki and the contract disagree, the contract wins. The wiki links to the canonical source.
7. **Wiki content is English.** Reply to the user in Chinese (AGENTS.md #6).
8. **The wiki is a map, not territory.** Reference pages link to the contract; they do not copy it verbatim. Long canonical text stays in `docs/claude/contracts/`, `docs/claude/methodology/`, `docs/claude/decisions/`, `memory/`.
9. **Use `wiki-cli` for mutations.** Don't `cat > file.md` — the CLI validates frontmatter and updates `last_updated`.
10. **Index is regenerated, not hand-edited.** `wiki-cli regenerate-index` rewrites `README.md`'s "Sections" table based on actual files. Don't hand-edit that table.

## Command quick reference

```bash
# Read
./tools/wiki-cli list                            # all pages with title + path
./tools/wiki-cli get <path-or-slug>              # full content of one page
./tools/wiki-cli search <term>                   # grep across all pages

# Write
./tools/wiki-cli add <path> --title "..." --type wiki-concept
./tools/wiki-cli edit <path> --set title="..."
./tools/wiki-cli edit <path> --append "## New section"
./tools/wiki-cli move <old-path> <new-path>
./tools/wiki-cli delete <path>                   # refused if referenced
./tools/wiki-cli regenerate-index                # rewrites README's Sections table
./tools/wiki-cli frontmatter <path>              # show parsed frontmatter

# Audit
./tools/wiki-cli validate                        # frontmatter + broken-link check
./tools/wiki-cli references <path>               # list every page that links to <path>
```

Full help: `./tools/wiki-cli help`.

## Author workflow

```
1. IDENTIFY which page (or new page) you need
   → tools/wiki-cli list                 # see all pages
   → tools/wiki-cli search <term>        # find by content
   → tools/wiki-cli get <path>           # read for context

2. DRAFT the change locally
   → If new page: write the body as a draft string in your head / scratch.
   → If existing page: read it, identify the section to change, draft the diff.

3. APPLY via tools/wiki-cli
   → New page:
       tools/wiki-cli add <path> --title "..." --type <type> --body-file <scratch.md>
   → Existing page edit:
       tools/wiki-cli edit <path> --set <key>=<value>     # frontmatter
       tools/wiki-cli edit <path> --append <markdown>    # append section
       tools/wiki-cli edit <path> --replace <old> <new>  # replace exact string

4. VALIDATE
   → tools/wiki-cli validate
   → Fix any FAIL before declaring done.

5. UPDATE the changelog
   → tools/wiki-cli edit changelog.md --append "### YYYY-MM-DD — <summary>"
   → tools/wiki-cli edit changelog.md --append "- **Added/Updated/Removed:** ..."

6. REGENERATE the index (only if you added/moved/deleted a page)
   → tools/wiki-cli regenerate-index

7. COMMIT
   → <type>(<scope>): <summary>
   → Examples:
       docs(wiki): add auth-tiers concept page
       docs(wiki): fix broken link from glossary to envelope
       chore(wiki): regenerate index after page move
```

## Anti-patterns to avoid

| Anti-pattern | Why wrong | Correct approach |
|---|---|---|
| `cat > docs/claude/wiki/x.md <<EOF` | Bypasses frontmatter validation; missing `last_updated`. | Use `wiki-cli add` or `wiki-cli edit`. |
| Hand-editing `README.md`'s "Sections" table | Goes stale after every add/move/delete. | Use `wiki-cli regenerate-index`. |
| Rewriting `changelog.md` history | Loses audit trail. | Append a dated entry. |
| Deleting a page that's still linked | Breaks wiki navigation. | `wiki-cli delete` checks references; fix links first or use `--force` and document why. |
| Copying contract text verbatim into a wiki page | The wiki goes stale; the contract is the source of truth. | Reference the contract path; quote only short examples. |
| Creating a top-level `.md` for wiki content | Violates the docs/claude/<category>/ structure. | Always under `docs/claude/wiki/<subdir>/`. |

## Stop-and-ask gates

You must stop and ask the human before:

| Gate | Ask |
|---|---|
| Deleting a page that's still referenced | "Page `<path>` is referenced from `<N>` other pages. Delete anyway? (passes `--force` for one-shot)" |
| Moving a page outside `docs/claude/wiki/` | "Moving wiki content outside the wiki breaks the docs/claude/<category>/ rule. Confirm?" |
| Renaming `README.md` or `changelog.md` | These are anchors; renaming breaks every internal link. Confirm? |
| Bulk regenerating the index | Confirm you've reviewed the diff first; an accidental hand-edit will be overwritten. |

## When NOT to use this skill

- You want to update a **contract**, **methodology**, **decision**, or **memory entry**. Those live outside the wiki and have their own conventions.
- You want to add a brand-new category (e.g. `docs/claude/security/`). Use a regular editor; the wiki curator only manages `docs/claude/wiki/`.
- The user asks for content that doesn't fit any wiki page type. Add a new `wiki-<type>` value first (file a contract change) or escalate.

## Reading order before editing

1. This file (you're here).
2. `tools/wiki-cli --help` to know the actual flags.
3. `docs/claude/wiki/README.md` — current index.
4. `docs/claude/wiki/glossary.md` — term dictionary; align your terminology.
5. The relevant contract/methodology page that your change references.
