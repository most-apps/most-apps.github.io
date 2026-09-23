# apps.most.org

The landing page for `apps.most.org`. Every other repo in the `most-apps` org
with GitHub Pages turned on is served at `apps.most.org/<repo-name>/`.

## Listing an app

1. Turn on GitHub Pages for the app's repo.
2. Add the topic **`most-app`** to the repo (the gear icon next to "About").
3. Wait for the hourly rebuild, or run it now: **Actions → Build landing page → Run workflow**.

The card is built from the app's own deployed page:

| Card part  | Comes from                                               |
| ---------- | -------------------------------------------------------- |
| Name       | `<title>`                                                |
| Blurb      | `<meta name="description">` (else the repo description)  |
| Icon       | `<link rel="apple-touch-icon">` or `<link rel="icon">`   |
| Colour     | `<meta name="theme-color">`                              |
| Screenshot | optional `app-card.png` at the app's root (16:9 works best) |

## Local preview

```sh
GITHUB_TOKEN=$(gh auth token) node build.mjs && open dist/index.html
```

Icons use root-relative paths, so they only show when served from `apps.most.org`.
