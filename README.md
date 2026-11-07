# Mathematical Knowledge Base — Public Demo

Interactive, read-only demonstration: <https://sinplay20.github.io/math-knowledge-base-demo/>.

All mathematical text and source metadata in this repository are synthetic demonstration material. There is no real PDF and no imported book or production-library data.

- Browse four mathematical items with their original LaTeX.
- Follow five original reading positions, including a theorem statement on page 2 and its proof on page 5, attached to the same UUID.
- Distinguish explicitly stated relations from inferred relations; inspect incoming and outgoing links.
- Search, filter, copy UUIDs, inspect original JSON, and download the public demonstration data.

This repository contains a generated static site. Enable GitHub Pages from **Settings → Pages → Deploy from a branch → main → / (root)**. No server, database, secret, or GitHub token is needed in the browser.

To preview a local copy, run `python -m http.server 8000` in this directory and visit <http://localhost:8000>. A web server is needed for loading the JSON data; opening `index.html` directly is insufficient.

The interface works without external fonts or formula rendering. MathJax 3.2.2 is loaded from jsDelivr for typesetting; if unavailable, original LaTeX remains visible. Google Fonts supplies optional interface fonts. No analytics, login, or write interface is included.
