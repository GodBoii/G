# House 37

House 37 is a free-play arcade with two interactive 3D tables.

- **Teen Patti** deals three cards each to you and a dealer. See your cards, go straight to the showdown, or fold. The strongest hand wins.
- **European roulette** uses a 37-pocket wheel. Pick numbers, colors, dozens, columns, parity or ranges, then see which predictions matched. You can also spin without a prediction.

The cards and wheels use layered CSS 3D transforms. Both tables honor the system reduced-motion preference. Recent results stay visible while the table is open.

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

Playwright exercises desktop and mobile against the production build.
