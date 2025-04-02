# A Flickr Album Carousel (Slideshow)

This application provides a slideshow experience that displays images and descriptions from a Flickr photoset in a visually appealing way. Absolutely not maybe inspired by the Carousel pitch from Mad Men.

## Features

* Fullscreen image slideshow with automatic transitions and responsive design.
* Toggle between height-priority and width-priority display modes with fullscreen support.
* Mobile-friendly interface with swipe gestures and expandable image information.
* Can deploy as a Cloudflare worker with static assets to keep the flickr API key secret.

## Usage

### Controls

- **Left/Right Arrow Keys + Swipe Left/Right**: Navigate between images.
- **Spacebar**: Pause/resume slideshow.
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

To modify or extend this application:

1. Edit the CSS in `css/carousel.css` to change the appearance.
2. Modify the JavaScript in `js/carousel.js` to alter functionality.
3. Update the HTML structure and personalisations in `index.html` as needed.