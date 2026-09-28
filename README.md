# Krillion Unlimited

A fan-made, unlimited take on the rare-answer trivia game [Krillion](https://krillion.io/).
Name one thing per prompt before the clock runs out — rarer answers sink your krill deeper.

**Play:** https://akimalikhan.github.io/krillion-unlimited/

## Features
- Dive lengths of 20, 30 or 50 prompts, or Endless (3 oxygen tanks — each timeout burns one)
- 15 / 25 / 40 second clock
- 174 prompts, each with answers in four rarity tiers:
  Plankton (10) · Schooler (30) · Rare (60) · One in a Krillion (100)
- Typo, plural and accent tolerant answer matching
- A perfect fixed-length dive touches the trench floor at 10,935m
- Shareable emoji dive log, best scores saved in your browser

## Run locally
Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 5173
```

## Adding prompts
Prompts live in `prompts.js` and `prompts-more.js`:

```js
["Name a fruit", "apple, banana|mango, kiwi|lychee, guava|durian, salak/snake fruit"],
```

Four tiers separated by `|`, answers by `,`, alternative spellings by `/` (first one is displayed).
