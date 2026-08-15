# Flickr Album Carousel

A fullscreen, responsive slideshow for any public Flickr album. The application
runs as a Cloudflare Worker so the Flickr API key stays on the server rather
than being exposed in browser code.

## Features

- Automatic slideshow with keyboard, pointer, and swipe navigation
- Responsive fit and fill display modes
- Expandable photo titles, descriptions, locations, and photographer details
- Optional slide-projector transition sound, muted by default
- Fullscreen and reduced-motion support
- Server-side Flickr API proxy with 24-hour Cloudflare edge caching

## Requirements

- A public Flickr album
- A [Flickr API key](https://www.flickr.com/services/apps/create/apply/)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A current version of Node.js and npm

You will need these three Flickr values:

| Variable | Value |
| --- | --- |
| `FLICKR_API_KEY` | Your Flickr API key |
| `FLICKR_USER_ID` | The album owner's Flickr NSID, such as `12345678@N00` |
| `FLICKR_PHOTOSET_ID` | The numeric album ID at the end of its `/albums/` URL |

If you do not know the owner's NSID, look it up with Flickr's
[`flickr.people.findByUsername`](https://www.flickr.com/services/api/flickr.people.findByUsername.html)
API method.

## Deploy to Cloudflare

1. Clone this repository and enter its directory:

   ```sh
   git clone <your-repository-url>
   cd flickr-carousel
   ```

2. Authenticate Wrangler and deploy the Worker:

   ```sh
   npx wrangler login
   npx wrangler deploy
   ```

3. In the Cloudflare dashboard, open the new `flickr-carousel` Worker, then go
   to **Settings > Variables and Secrets** and add:

   - `FLICKR_API_KEY` as a secret
   - `FLICKR_USER_ID` as a text variable
   - `FLICKR_PHOTOSET_ID` as a text variable

4. Deploy the variable changes in Cloudflare, then open the Worker URL.

`keep_vars = true` is enabled in `wrangler.toml`, so later Wrangler deployments
preserve values managed in the Cloudflare dashboard. The non-user-specific
`FLICKR_EXTRAS` setting remains in `wrangler.toml`.

Workers Cache is also enabled. Successful Flickr proxy responses are cached for
24 hours on Cloudflare's tiered edge cache, so cache hits are returned without
executing the Worker or contacting Flickr. Static files remain asset-first and
only the `/flickr-api-proxy/*` path is explicitly routed to the Worker first.

## Local development

The local preview also runs through Wrangler, giving it the same Flickr API
proxy behavior as the deployed Worker.

1. Copy the local configuration template:

   ```sh
   cp .dev.vars.example .dev.vars
   ```

2. Replace all three placeholders in `.dev.vars` with your Flickr values.
   This file is ignored by Git and must not be committed.

3. Start the development server:

   ```sh
   npx wrangler dev
   ```

4. Open the URL printed by Wrangler, normally
   `http://localhost:8787`. Stop the server with `Ctrl+C`.

## Controls

- **Left/Right Arrow** or **Swipe Left/Right**: Previous or next photo
- **Spacebar**: Pause or resume the slideshow
- **Alt+S** or the sound button: Mute or unmute the transition sound
- **Alt+F**: Toggle fullscreen mode
- **Alt+M**: Toggle fit and fill display modes
- **Alt+I** or the photo information: Expand or collapse photo details

## Customization

- Edit `public/index.html` to change the title, metadata, and page structure.
- Edit `public/css/carousel.css` to change the appearance.
- Edit the `Config` object in `public/js/carousel.js` to change the slide
  interval, random ordering, and optional photo details.
- Replace the icons and manifest files in `public/` to brand the installed app.

## Sound credit

The transition uses an edited CC0 recording of a real automatic slide advance
by Joseph Sardin / BigSoundBank. Processing and license details are in
[`public/audio/NOTICE.md`](public/audio/NOTICE.md).
