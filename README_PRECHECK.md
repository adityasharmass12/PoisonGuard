Precheck module

Purpose
- Provides fast, heuristic checks for URLs before running heavier ML analysis.
- Non-invasive: implemented as a standalone module so it won't change existing backend/frontend behavior.

Checks performed
- Redirections: follows HEAD requests and reports final URL, number of redirects, and whether it ends with '/'.
- Firewall / blocking heuristics: attempts GET and flags 403/451/511 or timeouts as possible blocking.
- Paywall detection: GET page and look for common paywall keywords and provider signals.
- Cache: results are stored in a simple shelve DB (`precheck_cache.db`) for 24 hours by default.

How to use
- From Python code (backend or script):

  from precheck import precheck_url
  result = precheck_url('https://example.com')

- CLI:

  python precheck.py https://example.com

Notes and caveats
- The checks are heuristic and may generate false positives/negatives.
- The module uses `requests` and performs network calls; ensure the runtime environment allows outbound HTTP.
- No changes are made to the current backend code. To wire this into the existing `/api/upload` flow, call `precheck_url(url)` before sending the URL to the ML pipeline.

