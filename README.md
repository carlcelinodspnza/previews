# previews

Static preview hosting for in-flight builds, served by GitHub Pages.

**Live root:** https://carlcelinodspnza.github.io/previews/

Each top-level folder becomes a live link:

| Folder | Link |
|---|---|
| `liquorlicense/` | https://carlcelinodspnza.github.io/previews/liquorlicense/ |

## Adding a preview

1. Copy the built folder in at the top level (it must contain an `index.html`).
2. Add `<meta name="robots" content="noindex, nofollow, noarchive, noimageindex">` inside its `<head>`.
3. Add a card to the root `index.html` so the listing stays accurate.
4. Commit and push. GitHub Pages redeploys in ~1 minute.

```bash
cp -R /path/to/build ./my-project
git add -A && git commit -m "add my-project preview" && git push
```

## Notes

- **This repo is public.** Anyone with a URL can view these pages, and anyone can browse the repo
  itself. Do not add anything you would not hand to a stranger — credentials, unreleased pricing,
  personal data.
- `robots.txt` disallows all crawlers and every page carries a `noindex` meta, so these should stay
  out of search results. That is a request, not an enforcement — well-behaved crawlers honour it,
  and it does not make a link private.
- `.nojekyll` is present so GitHub Pages serves files verbatim (no Jekyll processing, and folders
  beginning with `_` are not dropped).
- Keep bundles lean — only the files a page actually references. Shipping build artefacts and
  screenshots makes the repo slow to clone for no benefit.
