# A Flickr Album Carousel (Slideshow)

This application provides a slideshow experience that displays images and descriptions from a Flickr photoset in a visually appealing way. Absolutely not maybe inspired by the Carousel pitch from Mad Men.

## Features

* Fullscreen image slideshow with automatic transitions and responsive design.
* Optional real slide-projector transition sound, muted by default.
* Toggle between height-priority and width-priority display modes with fullscreen support.
* Mobile-friendly interface with swipe gestures and expandable image information.
* Can deploy as a Cloudflare worker with static assets to keep the flickr API key secret.

## Usage

### Controls

- **Left/Right Arrow Keys + Swipe Left/Right**: Navigate between images.
- **Spacebar**: Pause/resume slideshow.
- **S Key/Sound Button**: Mute or unmute the projector transition sound.
- **F Key**: Toggle fullscreen mode.
- **M Key**: Toggle between height and width priority modes.
- **Click on Image Info/I Key**: Expand/collapse image details.

## Installation

1. Clone the repository
2. If using Cloudflare:
    1. Update the variables in `wrangler.toml`.
    2. Deploy as a Cloudflare worker and set `FLICKR_API_KEY` as an environment secret. You can obtain an api key [on Flickr](https://www.flickr.com/services/apps/create/apply/).
3. If not using Cloudflare workers:
    * Update `flickrApiUrl` in `carousel.js` to be a full flickr api url, you can find a sample in `worker/index.js` but the vars will need to be assigned.
3. Update the personalisations in `index.html` and `/public`. Make it your own Carousel.
4. Access the application and enjoy.

## Development

### Sound credit

The transition uses an edited CC0 recording of a real automatic slide advance
by Joseph Sardin / BigSoundBank. Processing and license details are recorded in
[`public/audio/NOTICE.md`](public/audio/NOTICE.md).

### Local preview

The local preview runs through Cloudflare Wrangler so that the Flickr API proxy
works in the same way as the deployed Worker.

1. Copy the secret template:

   ```sh
   cp .dev.vars.example .dev.vars
   ```

2. Edit `.dev.vars` and replace the placeholder with your Flickr API key.
   This file is ignored by Git and must not be committed.

3. Start the development server:

   ```sh
   npx wrangler dev
   ```

4. Open the local URL printed by Wrangler, normally
   `http://localhost:8787`.

Stop the server with `Ctrl+C`.

### Making changes

To modify or extend this application:

1. Edit the CSS in `public/css/carousel.css` to change the appearance.
2. Modify the JavaScript in `public/js/carousel.js` to alter functionality.
3. Update the HTML structure and personalisations in `public/index.html` as needed.
