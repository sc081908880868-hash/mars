# SSJ Managements

Read-only website dashboard for the Indonesian portfolio.

## What It Shows

- Indonesian portfolio summary
- Open positions from `INDO POSITIONS`
- Open-position transaction blocks
- Realized and unrealized P/L
- Fee burden, win rate, and profit factor
- P/L vs IHSG and daily P/L charts
- Current warnings and risk indicators

## Data Source

The site reads live data from this Google Sheet:

`1N3DukPrLJBfqUW4jo0v72tuaPvD_4aVdao9k9sHVOxg`

It refreshes automatically every 4 minutes and also has a manual refresh button.

## Automated Market Tape

The moving tape reads `market-tape.json`. A GitHub Actions workflow refreshes the IDX closing prices at 16:30 Asia/Jakarta on trading weekdays using Twelve Data, then commits the new snapshot so Netlify redeploys it automatically.

Repository setup requires one Actions secret named `TWELVE_DATA_API_KEY`. The previous valid snapshot remains in place if the data provider is unavailable or returns stale data. The workflow can also be run manually from the Actions tab.

## Sharing Note

This static website is published by Netlify from the GitHub repository's `main` branch. Push validated updates to `main`; Netlify deploys them automatically.

Important: because the website reads directly from Google Sheets, anyone who can open the website may be able to see the spreadsheet ID in the page source. For a higher-security version, put a small private backend or Google Apps Script layer between the website and the sheet, then publish only filtered summary data.
