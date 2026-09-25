# Pokémon → D&D Converter

A small static web app that converts Pokémon stats, abilities, and selected moves into homebrew D&D-style creature rules.

## Publish with GitHub Pages

1. Create a GitHub repository (for example, `pokemon-dnd`).
2. Upload `index.html`, `style.css`, and `app.js` to the repository root.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`, then save.
6. GitHub will publish the site at a URL like:
   `https://YOUR-USERNAME.github.io/pokemon-dnd/`

No build step or server is required. The app loads public Pokémon data from PokéAPI in the browser.

## Editing abilities

Hand-written ability conversions live near the top of `app.js` in:

`const ABILITY_EFFECTS = { ... }`

Add new entries there as you translate abilities.

## Editing unusual moves

Moves that need special rules live in:

`const SPECIAL_MOVES = { ... }`

Everything else is translated automatically from PokéAPI metadata when possible.
