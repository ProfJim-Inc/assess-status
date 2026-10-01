# Creatium Assess status

The public status page for Creatium Assess: https://status.assess.creatium.com
(also https://profjim-inc.github.io/assess-status/).

- `checks.json`: what is checked. `check.mjs` runs every five minutes from `.github/workflows/check.yml`
  and records into `site/data/summary.json` (a tally per day for 90 days, and the last 288 checks).
- `site/data/notices.json`: incidents and maintenance, written by people. Add an entry, push, and the
  page shows it within a minute:

  ```json
  [{ "date": "2026-11-03T14:10:00Z", "title": "Slow results sync", "body": "Results reach /results up to 10 minutes late. We are on it.", "status": "investigating" }]
  ```

  `status` is `investigating`, `monitoring`, `resolved` or `maintenance`. Resolved notices stay listed for 14 days.
- Availability target: 99.5% a calendar month for the production API.
