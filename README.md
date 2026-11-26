# House 37

A free-play Next.js arcade with two tables and a shared virtual chip balance.

- **Teen Patti** is a heads-up variant against a dealer that matches your ante and one optional chaal. Stay blind, see your cards, show, or fold. Ties return the stake.
- **European roulette** uses the 37-pocket single-zero wheel. Place straight-up, dozen, column, color, parity, or high/low bets. Chips remain on the board for editing after each spin.

Every browser starts with 1,000 chips. The balance persists in local storage and can be refilled for free. Recent hands and spins are visible while their table is open. The games have no cash value.

## Run locally

```sh
npm ci
npm run dev
```

Open [the lobby](http://localhost:3000).

## Verify

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright runs desktop and mobile tests against the production build.
