(function () {
  // Configuration module
  const Config = {
    interval: 10000,
    randomOrder: true,
    showPhotographer: true,
    showLocation: true,
    flickrApiUrl: "/flickr-api-proxy/", // Assumes CF worker but can be replaced with a full flickr api url.

    // Allow runtime configuration updates
    update(newConfig) {
      Object.assign(this, newConfig);
    },
  };

  // UI module to handle DOM interactions
  const UI = {
    elements: {
      loadingIndicator: document.getElementById("loading-indicator"),
      wallpaperImg: document.getElementById("wallpaper"),
      imageTitle: document.getElementById("image-title"),
      imageLocation: document.getElementById("image-location"),
      imagePhotographer: document.getElementById("image-photographer"),
      imageInfo: document.getElementById("image-info"),
      imageDescription: document.getElementById("image-description"),
      flickrLink: document.getElementById("flickr-link"),
      wallpaperContainer: document.getElementById("wallpaper-container"),
      fullscreenBtn: document.getElementById("fullscreen-btn"),
      fitModeBtn: document.getElementById("fit-mode-btn"),
    },

    showLoading() {
      this.elements.loadingIndicator.style.display = "block";
    },

    hideLoading() {
      this.elements.loadingIndicator.style.display = "none";
      this.elements.fullscreenBtn.style.opacity = 1;
      this.elements.fitModeBtn.style.opacity = 1;
    },

    fadeOut() {
      this.elements.wallpaperImg.style.opacity = 0;
      this.elements.imageInfo.style.opacity = 0;
    },

    fadeIn() {
      this.elements.wallpaperImg.style.opacity = 1;
      this.elements.imageInfo.style.opacity = 1;
    },

    updatePhoto(photo, imgUrl, infoExpanded) {
      this.elements.wallpaperImg.src = imgUrl;
      this.elements.imageTitle.textContent = photo.title || "Untitled";

      const photoUrl = `https://www.flickr.com/photos/${Config.userId}/${photo.id}`;
      this.elements.flickrLink.href = photoUrl;

      // Update description
      if (photo.description && photo.description._content) {
        this.elements.imageDescription.textContent = photo.description._content;
      } else {
        this.elements.imageDescription.textContent = "No description available";
      }
      this.elements.imageDescription.style.display = infoExpanded
        ? "block"
        : "none";

      // Update location
      if (
        photo.latitude &&
        photo.longitude &&
        photo.latitude !== "0" &&
        photo.longitude !== "0"
      ) {
        this.elements.imageLocation.textContent = `Location: ${photo.latitude}, ${photo.longitude}`;
        this.elements.imageLocation.style.display =
          Config.showLocation && infoExpanded ? "block" : "none";
      } else {
        this.elements.imageLocation.style.display = "none";
      }

      // Update photographer
      this.elements.imagePhotographer.textContent = `Photographer: ${photo.ownername || "Unknown"
        }`;
      this.elements.imagePhotographer.style.display =
        Config.showPhotographer && infoExpanded ? "block" : "none";
    },

    toggleInfoExpanded(isExpanded) {
      this.elements.imageDescription.style.display = isExpanded
        ? "block"
        : "none";

      if (Config.showLocation) {
        this.elements.imageLocation.style.display = isExpanded
          ? "block"
          : "none";
      }

      if (Config.showPhotographer) {
        this.elements.imagePhotographer.style.display = isExpanded
          ? "block"
          : "none";
      }

      if (isExpanded) {
        this.elements.imageInfo.classList.add("expanded");
      } else {
        this.elements.imageInfo.classList.remove("expanded");
      }
    },
  };

  // Flickr API proxy module
  const FlickrAPI = {
    async fetchPhotos() {
      const url = Config.flickrApiUrl;

      try {
        // Use cache: 'default' to respect HTTP caching headers
        const response = await fetch(url, {
          cache: "default",
        });

        const data = await response.json();

        if (data.success) {
          return data.photos;
        } else {
          throw new Error(data.message || "Unknown error fetching photos");
        }
      } catch (error) {
        console.error("Carousel: Error fetching images :: ", error);
        return [];
      }
    },
  };

  // Image handling module
  const ImageHandler = {
    photos: [],
    currentPhotoIndex: 0,
    preloadedImages: {},
    infoExpanded: false,

    // Get the best available size for a photo based on display size
    getBestImageUrl(photo) {
      const viewportWidth = window.innerWidth;

      // Define size options with their thresholds in descending order
      const sizeOptions = [
        { suffix: "6k", minWidth: 5120 },
        { suffix: "5k", minWidth: 4096 },
        { suffix: "4k", minWidth: 3072 },
        { suffix: "3k", minWidth: 2048 },
        { suffix: "k", minWidth: 1600 },
        { suffix: "h", minWidth: 1024 },
        { suffix: "b", minWidth: 0 }, // Always acceptable (minimum threshold)
      ];

      // Find the first size that's both available and appropriate for viewport
      for (const option of sizeOptions) {
        const urlKey = `url_${option.suffix}`;

        // If this size is available and viewport is wide enough
        if (photo[urlKey] && viewportWidth >= option.minWidth) {
          return photo[urlKey];
        }
      }

      // If we get here, none of the specified sizes are available
      // Return the original image URL if it exists
      if (photo.url_o) {
        return photo.url_o;
      }

      // If no suitable image URL is found, return null to indicate this photo should be skipped
      return null;
    },

    shuffleArray(array) {
      const newArray = [...array]; // Create a copy to avoid mutating the original
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    },

    preloadImage(index) {
      if (index >= this.photos.length) return;

      const photo = this.photos[index];
      const imgUrl = this.getBestImageUrl(photo);

      // Skip preloading if no suitable URL is found
      if (!imgUrl) return;

      if (!this.preloadedImages[imgUrl]) {
        const img = new Image();
        img.src = imgUrl;
        this.preloadedImages[imgUrl] = img;

        console.log(`Image: preloading ${index} from \'${imgUrl}\'`);
      }
    },

    // Toggle display of additional info
    toggleInfoDetails(event) {
      if (event.target === UI.elements.flickrLink) {
        return; // Don't toggle if clicking on the Flickr link
      }
      this.infoExpanded = !this.infoExpanded;
      UI.toggleInfoExpanded(this.infoExpanded);
    },

    // Initialize photos
    async initializePhotos() {
      const allPhotos = await FlickrAPI.fetchPhotos();

      // Filter out photos that don't have any usable image URLs
      this.photos = allPhotos.filter((photo) => {
        const imageUrl = this.getBestImageUrl(photo);
        return imageUrl !== null;
      });

      console.log(
        `Image: ${this.photos.length} images loaded`
      );

      if (Config.randomOrder) {
        this.photos = this.shuffleArray(this.photos);
        console.log("Image: shuffled into random order");
      }

      return this.photos.length > 0;
    },
  };

  // Carousel controller
  const Carousel = {
    timer: null,
    isPaused: false,
    transitionDelay: 1000, // ms

    // Display a photo
    showPhoto(index) {
      const photo = ImageHandler.photos[index];
      const imgUrl = ImageHandler.getBestImageUrl(photo);

      // This check should never be triggered due to our filtering, but just in case
      if (!imgUrl) {
        console.error(
          `Image: No suitable image URL found index ${index}`
        );
        // Skip to next photo
        ImageHandler.currentPhotoIndex =
          (ImageHandler.currentPhotoIndex + 1) % ImageHandler.photos.length;
        this.showPhoto(ImageHandler.currentPhotoIndex);
        return;
      }

      if (UI.elements.loadingIndicator.style.display !== "none") {
        UI.hideLoading();
      }

      UI.fadeOut();

      const nextIndex = (index + 1) % ImageHandler.photos.length;
      ImageHandler.preloadImage(nextIndex);

      setTimeout(() => {
        UI.updatePhoto(photo, imgUrl, ImageHandler.infoExpanded);
        UI.fadeIn();
      }, this.transitionDelay);
    },

    // Start the carousel
    start() {
      if (this.timer) {
        clearInterval(this.timer);
      }

      this.timer = setInterval(() => {
        ImageHandler.currentPhotoIndex =
          (ImageHandler.currentPhotoIndex + 1) % ImageHandler.photos.length;
        this.showPhoto(ImageHandler.currentPhotoIndex);
      }, Config.interval);
    },

    // Pause carousel
    pause() {
      this.isPaused = true;
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
        console.log("Carousel: paused");
      }
    },

    // Resume carousel
    resume() {
      if (!this.isPaused) return;

      this.isPaused = false;
      this.start();
      console.log("Carousel: resumed");
    },
  };

  // Fullscreen functionality
  const FullscreenHandler = {
    toggle() {
      const container = document.documentElement;

      if (!document.fullscreenElement) {
        // Enter fullscreen
        if (container.requestFullscreen) {
          container.requestFullscreen();
        } else if (container.webkitRequestFullScreen) {
          container.webkitRequestFullScreen();
        } else if (container.mozRequestFullScreen) {
          container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) {
          container.msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    },
  };

  const FitModeHandler = {
    toggle() {
      const isCurrentlyWidthPriority = UI.elements.wallpaperImg.classList.contains('width-priority');

      if (isCurrentlyWidthPriority) {
        UI.elements.wallpaperImg.classList.remove('width-priority');
        console.log('Image: fit mode changed to \'height priority\'');
      } else {
        UI.elements.wallpaperImg.classList.add('width-priority');
        console.log('Image: fit mode changed to \'width priority\'');
      }
    }
  };


  // Swipe handling functionality
  const SwipeHandler = {
    touchStartX: null,
    touchStartY: null,

    handleTouchStart(event) {
      this.touchStartX = event.touches[0].clientX;
      this.touchStartY = event.touches[0].clientY;
    },

    handleTouchEnd(event) {
      if (!this.touchStartX || !this.touchStartY) {
        return;
      }

      const touchEndX = event.changedTouches[0].clientX;
      const touchEndY = event.changedTouches[0].clientY;

      const diffX = this.touchStartX - touchEndX;
      const diffY = this.touchStartY - touchEndY;

      // Only register as horizontal swipe if horizontal movement is greater than vertical
      // and if the swipe distance is significant enough (> 50px)
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0) {
          // Swiped left - show next image
          clearInterval(Carousel.timer);
          ImageHandler.currentPhotoIndex =
            (ImageHandler.currentPhotoIndex + 1) % ImageHandler.photos.length;
          Carousel.showPhoto(ImageHandler.currentPhotoIndex);
          Carousel.start();
        } else {
          // Swiped right - show previous image
          clearInterval(Carousel.timer);
          ImageHandler.currentPhotoIndex =
            (ImageHandler.currentPhotoIndex - 1 + ImageHandler.photos.length) %
            ImageHandler.photos.length;
          Carousel.showPhoto(ImageHandler.currentPhotoIndex);
          Carousel.start();
        }
      }

      // Reset values
      this.touchStartX = null;
      this.touchStartY = null;
    }
  };

  // Event handlers
  const EventHandlers = {
    setupEventListeners() {
      UI.elements.fullscreenBtn.addEventListener(
        "click",
        FullscreenHandler.toggle
      );
      UI.elements.fitModeBtn.addEventListener(
        "click",
        () => FitModeHandler.toggle()
      );
      UI.elements.imageInfo.addEventListener("click", (e) =>
        ImageHandler.toggleInfoDetails(e)
      );
      UI.elements.imageInfo.addEventListener("mouseenter", () =>
        Carousel.pause()
      );
      UI.elements.imageInfo.addEventListener("mouseleave", () =>
        Carousel.resume()
      );

      // Add touch event listeners for swipe
      UI.elements.wallpaperContainer.addEventListener(
        "touchstart",
        (e) => SwipeHandler.handleTouchStart(e),
        { passive: false }
      );
      UI.elements.wallpaperContainer.addEventListener(
        "touchend",
        (e) => SwipeHandler.handleTouchEnd(e),
        { passive: false }
      );

      // Add keyboard navigation
      document.addEventListener("keydown", this.handleKeyPress);

      // Add responsive handling
      window.addEventListener("resize", this.handleResize);

      // Add error handling for image loading
      UI.elements.wallpaperImg.addEventListener("error", this.handleImageError);
    },

    handleKeyPress(event) {
      switch (event.key) {
        case "ArrowRight":
        case "n":
        case "l":
          // Next photo
          clearInterval(Carousel.timer);
          ImageHandler.currentPhotoIndex =
            (ImageHandler.currentPhotoIndex + 1) % ImageHandler.photos.length;
          Carousel.showPhoto(ImageHandler.currentPhotoIndex);
          Carousel.start();
          break;
        case "ArrowLeft":
        case "p":
        case "h":
          // Previous photo
          clearInterval(Carousel.timer);
          ImageHandler.currentPhotoIndex =
            (ImageHandler.currentPhotoIndex - 1 + ImageHandler.photos.length) %
            ImageHandler.photos.length;
          Carousel.showPhoto(ImageHandler.currentPhotoIndex);
          Carousel.start();
          break;
        case " ":
          // Toggle pause
          if (Carousel.isPaused) {
            Carousel.resume();
          } else {
            Carousel.pause();
          }
          break;
        case "f":
          // Toggle fullscreen
          FullscreenHandler.toggle();
          break;
        case "m":
          // Toggle fit mode
          FitModeHandler.toggle();
          break;
        case "i":
          // Toggle info
          ImageHandler.toggleInfoDetails({ target: UI.elements.imageInfo });
          break;
      }
    },

    handleResize() {
      // Recalculate best image URL for current photo
      const currentPhoto = ImageHandler.photos[ImageHandler.currentPhotoIndex];
      const newBestUrl = ImageHandler.getBestImageUrl(currentPhoto);

      if (newBestUrl && newBestUrl !== UI.elements.wallpaperImg.src) {
        console.log("Window: resized, updating image resolution");
        UI.elements.wallpaperImg.src = newBestUrl;
      }

      // Clear preloaded images cache
      ImageHandler.preloadedImages = {};

      // Preload next image with new best URLs
      const nextIndex =
        (ImageHandler.currentPhotoIndex + 1) % ImageHandler.photos.length;
      ImageHandler.preloadImage(nextIndex);
    },

    handleImageError() {
      console.error(
        `Image: Failed to load index ${ImageHandler.currentPhotoIndex}`
      );
      // Skip to next photo
      ImageHandler.currentPhotoIndex =
        (ImageHandler.currentPhotoIndex + 1) % ImageHandler.photos.length;
      Carousel.showPhoto(ImageHandler.currentPhotoIndex);
    },
  };

  // App initialization
  async function init() {
    UI.showLoading();

    try {
      const hasPhotos = await ImageHandler.initializePhotos();

      if (hasPhotos) {
        ImageHandler.preloadImage(0);
        if (ImageHandler.photos.length > 1) {
          ImageHandler.preloadImage(1);
        }

        Carousel.showPhoto(0);
        Carousel.start();

        EventHandlers.setupEventListeners();
      } else {
        throw new Error("No photos available to display");
      }
    } catch (error) {
      console.error("Carousel: Initialization error:", error);
      UI.elements.loadingIndicator.textContent =
        "Error loading carousel. Please try again later.";
    }
  }

  // Initialize when the page loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
