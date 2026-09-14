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

## Sharing Note

This static website is published by Netlify from the GitHub repository's `main` branch. Push validated updates to `main`; Netlify deploys them automatically.

Important: because the website reads directly from Google Sheets, anyone who can open the website may be able to see the spreadsheet ID in the page source. For a higher-security version, put a small private backend or Google Apps Script layer between the website and the sheet, then publish only filtered summary data.
