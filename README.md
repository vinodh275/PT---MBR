# MBR Dashboard

This folder is a GitHub Pages-friendly frontend plus a secure GitHub Actions data refresh.

## Secrets

Add these repository secrets under **Settings → Secrets and variables → Actions**:

- `METABASE_URL` = `https://metabase.curefit.co`
- `METABASE_API_KEY` = recommended service API key
- or `METABASE_USERNAME` and `METABASE_PASSWORD` if the Metabase account supports password API login

Never put the token or password in `app.js`, `data/mbr.json`, or any committed file.

## Metric mapping

Edit `config/metrics.json` and fill the exact saved-question/card IDs and returned column names for every metric. The workflow intentionally stops without publishing if any card ID is missing or a query fails. This prevents the website from silently showing incomplete or incorrect numbers.

The current Revenue and AOV IDs are only the IDs already verified during dashboard inspection. The remaining IDs and column names must be verified from the corresponding Metabase cards before the first live run.

## Deployment

Upload the contents of this folder to a GitHub repository and enable GitHub Pages from the repository's Actions workflow. The scheduled workflow refreshes `data/mbr.json`; the static site reads that file without exposing Metabase credentials.
