(function () {
  const Config = {
    interval: 10000,
    randomOrder: true,
    showPhotographer: true,
    showLocation: true,
    userId: "83515912@N03",
    flickrApiUrl: "/flickr-api-proxy/",

    update(newConfig) {
      Object.assign(this, newConfig);
      document.documentElement.style.setProperty(
        "--progress-duration",
        `${this.interval}ms`
      );
    },
  };

  const wait = (duration) =>
    new Promise((resolve) => window.setTimeout(resolve, duration));

  const UI = {
    elements: {
      loadingIndicator: document.getElementById("loading-indicator"),
      slideImg: document.getElementById("slide"),
      nextSlideImg: document.getElementById("slide-next"),
      slideStage: document.getElementById("slide-stage"),
      slideContainer: document.getElementById("slide-container"),
      imageInfo: document.getElementById("image-info"),
      imageInfoToggle: document.getElementById("image-info-toggle"),
      imageDetails: document.getElementById("image-details"),
      imageTitle: document.getElementById("image-title"),
      imageLocation: document.getElementById("image-location"),
      imagePhotographer: document.getElementById("image-photographer"),
      imageDescription: document.getElementById("image-description"),
      flickrLink: document.getElementById("flickr-link"),
      currentSlide: document.getElementById("current-slide"),
      totalSlides: document.getElementById("total-slides"),
      progressFill: document.getElementById("progress-fill"),
      carouselControls: document.getElementById("carousel-controls"),
      previousBtn: document.getElementById("previous-btn"),
      nextBtn: document.getElementById("next-btn"),
      pauseBtn: document.getElementById("pause-btn"),
      soundToggleBtn: document.getElementById("sound-toggle-btn"),
      fullscreenBtn: document.getElementById("fullscreen-btn"),
      fitModeBtn: document.getElementById("fit-mode-btn"),
      slideAnnouncer: document.getElementById("slide-announcer"),
    },

    showLoading() {
      this.elements.loadingIndicator.style.display = "grid";
    },

    hideLoading() {
      this.elements.loadingIndicator.style.display = "none";
      if (!URLParamsHandler.params.hideInfo) {
        this.elements.imageInfo.style.opacity = "1";
      }
      IdleUIHandler.wake();
    },

    showError(message) {
      const label = this.elements.loadingIndicator.querySelector("span");
      const icon = this.elements.loadingIndicator.querySelector("img");

      if (icon) icon.style.display = "none";
      if (label) label.textContent = message;
      this.elements.loadingIndicator.style.display = "grid";
    },

    getTransitionDuration() {
      const value = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--transition-duration")
        .trim();
      const amount = Number.parseFloat(value) || 0;

      return value.endsWith("ms") ? amount : amount * 1000;
    },

    setTransitionState(isTransitioning, direction = 1) {
      this.elements.slideContainer.classList.toggle(
        "is-transitioning",
        isTransitioning
      );
      this.elements.slideContainer.classList.toggle(
        "is-forward",
        isTransitioning && direction >= 0
      );
      this.elements.slideContainer.classList.toggle(
        "is-backward",
        isTransitioning && direction < 0
      );
    },

    updatePhotoInfo(photo, index, total) {
      const title =
        typeof photo.title === "string"
          ? photo.title
          : photo.title?._content || "Untitled";
      const ownerId = photo.owner || Config.userId;
      const photoUrl = `https://www.flickr.com/photos/${ownerId}/${photo.id}`;
      const description = photo.description?._content?.trim() || "";
      const hasLocation =
        photo.latitude &&
        photo.longitude &&
        photo.latitude !== "0" &&
        photo.longitude !== "0";

      this.elements.imageTitle.textContent = title || "Untitled";
      this.elements.imageDescription.textContent = description;
      this.elements.imageLocation.textContent =
        Config.showLocation && hasLocation
          ? `${photo.latitude}, ${photo.longitude}`
          : "";
      this.elements.imagePhotographer.textContent =
        Config.showPhotographer && photo.ownername
          ? `Photograph by ${photo.ownername}`
          : "";
      this.elements.flickrLink.href = photoUrl;

      const digitCount = Math.max(2, String(total).length);
      this.elements.currentSlide.textContent = String(index + 1).padStart(
        digitCount,
        "0"
      );
      this.elements.totalSlides.textContent = String(total).padStart(
        digitCount,
        "0"
      );
      this.elements.slideImg.alt = `${title || "Untitled"}, photo ${
        index + 1
      } of ${total}`;
      this.updateInfoToggleLabel(ImageHandler.infoExpanded);
      this.elements.slideAnnouncer.textContent = `Now showing ${
        title || "Untitled"
      }, photo ${index + 1} of ${total}`;
    },

    updateInfoToggleLabel(isExpanded) {
      const title = this.elements.imageTitle.textContent.trim() || "this photo";
      const action = isExpanded ? "Hide" : "Show";
      this.elements.imageInfoToggle.setAttribute(
        "aria-label",
        `${action} photo details for ${title}`
      );
    },

    toggleInfoExpanded(isExpanded) {
      if (URLParamsHandler.params.hideInfo) return;
      this.elements.imageInfo.classList.toggle("expanded", isExpanded);
      this.elements.imageInfoToggle.setAttribute(
        "aria-expanded",
        String(isExpanded)
      );
      this.updateInfoToggleLabel(isExpanded);
      this.elements.imageDetails.setAttribute(
        "aria-hidden",
        String(!isExpanded)
      );
      this.elements.imageDetails.inert = !isExpanded;
      if (isExpanded) IdleUIHandler.hold();
      else IdleUIHandler.wake();
    },

    setPaused(isPaused) {
      this.elements.slideContainer.classList.toggle("is-paused", isPaused);
      this.elements.pauseBtn.setAttribute(
        "aria-label",
        isPaused ? "Resume carousel" : "Pause carousel"
      );
      this.elements.slideAnnouncer.setAttribute(
        "aria-live",
        isPaused ? "polite" : "off"
      );
    },

    setSoundMuted(isMuted) {
      this.elements.soundToggleBtn.setAttribute(
        "aria-pressed",
        String(!isMuted)
      );
    },

    restartProgress() {
      this.elements.slideContainer.classList.remove("progress-running");
      void this.elements.progressFill.offsetWidth;
      this.elements.slideContainer.classList.add("progress-running");
    },

    setFitMode(shouldFill) {
      this.elements.slideContainer.classList.toggle("fill-image", shouldFill);
      this.elements.fitModeBtn.setAttribute("aria-pressed", String(shouldFill));
    },

    setFullscreen(isFullscreen) {
      this.elements.slideContainer.classList.toggle(
        "is-fullscreen",
        isFullscreen
      );
      this.elements.fullscreenBtn.setAttribute(
        "aria-label",
        isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
      );
    },
  };

  const SoundHandler = {
    muted: true,
    context: null,
    masterGain: null,
    sampleBuffer: null,
    samplePromise: null,
    activeSource: null,
    sampleUrl: "audio/carousel-advance.mp3",

    ensureContext() {
      if (this.context) return this.context;

      const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) return null;

      this.context = new AudioContextConstructor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.58;
      this.masterGain.connect(this.context.destination);
      return this.context;
    },

    loadSample() {
      const context = this.ensureContext();
      if (!context) return Promise.reject(new Error("Audio is not supported"));
      if (this.sampleBuffer) return Promise.resolve(this.sampleBuffer);
      if (this.samplePromise) return this.samplePromise;

      this.samplePromise = fetch(this.sampleUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Projector sound returned ${response.status}`);
          }
          return response.arrayBuffer();
        })
        .then((audioData) => context.decodeAudioData(audioData))
        .then((buffer) => {
          this.sampleBuffer = buffer;
          return buffer;
        })
        .catch((error) => {
          this.samplePromise = null;
          throw error;
        });

      return this.samplePromise;
    },

    stopActiveSound() {
      if (!this.activeSource) return;

      try {
        this.activeSource.stop();
      } catch (_error) {
        // The source may already have reached its natural end.
      }
      this.activeSource = null;
    },

    async toggle() {
      if (!this.muted) {
        this.muted = true;
        this.stopActiveSound();
        UI.setSoundMuted(true);
        return;
      }

      const context = this.ensureContext();
      if (!context) {
        UI.elements.soundToggleBtn.disabled = true;
        UI.elements.soundToggleBtn.setAttribute(
          "aria-label",
          "Carousel sound is not supported"
        );
        return;
      }

      try {
        if (context.state !== "running") await context.resume();
        await this.loadSample();
        this.muted = false;
        UI.setSoundMuted(false);
      } catch (error) {
        this.muted = true;
        UI.setSoundMuted(true);
        UI.elements.soundToggleBtn.disabled = true;
        UI.elements.soundToggleBtn.setAttribute(
          "aria-label",
          "Carousel sound is unavailable"
        );
        console.error("Carousel: Unable to enable sound", error);
      }
    },

    playTransition(direction) {
      if (this.muted) return;

      const context = this.ensureContext();
      if (
        !context ||
        context.state !== "running" ||
        !this.sampleBuffer ||
        !this.masterGain
      ) {
        return;
      }

      this.stopActiveSound();

      const source = context.createBufferSource();
      source.buffer = this.sampleBuffer;
      // Keep reverse navigation recognisable without making the mechanism
      // sound like an artificial effect.
      source.playbackRate.value = direction < 0 ? 0.985 : 1;
      source.connect(this.masterGain);
      source.addEventListener("ended", () => {
        if (this.activeSource === source) this.activeSource = null;
      });
      this.activeSource = source;
      source.start(context.currentTime + 0.012);
    },
  };

  const FlickrAPI = {
    async fetchPhotos() {
      try {
        const response = await fetch(Config.flickrApiUrl, { cache: "default" });

        if (!response.ok) {
          throw new Error(`Photo service returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "Unknown error fetching photos");
        }

        return data.photos;
      } catch (error) {
        console.error("Carousel: Error fetching images", error);
        return [];
      }
    },
  };

  const ImageHandler = {
    photos: [],
    currentPhotoIndex: 0,
    preloadedImages: new Map(),
    failedPhotoIndexes: new Set(),
    infoExpanded: false,

    getBestImageUrl(photo) {
      const displayWidth =
        Math.max(window.innerWidth, window.innerHeight) *
        Math.min(window.devicePixelRatio || 1, 2);
      const sizeOptions = [
        { suffix: "6k", minWidth: 5120 },
        { suffix: "5k", minWidth: 4096 },
        { suffix: "4k", minWidth: 3072 },
        { suffix: "3k", minWidth: 2048 },
        { suffix: "k", minWidth: 1600 },
        { suffix: "h", minWidth: 1024 },
        { suffix: "b", minWidth: 0 },
      ];

      for (const option of sizeOptions) {
        const imageUrl = photo[`url_${option.suffix}`];
        if (imageUrl && displayWidth >= option.minWidth) return imageUrl;
      }

      return photo.url_o || null;
    },

    shuffleArray(array) {
      const shuffled = [...array];

      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [
          shuffled[randomIndex],
          shuffled[index],
        ];
      }

      return shuffled;
    },

    preloadImage(index) {
      if (index < 0 || index >= this.photos.length) return Promise.resolve(null);

      const imageUrl = this.getBestImageUrl(this.photos[index]);
      if (!imageUrl) return Promise.resolve(null);
      if (this.preloadedImages.has(imageUrl)) {
        return this.preloadedImages.get(imageUrl).promise;
      }

      const image = new Image();
      const promise = new Promise((resolve, reject) => {
        image.addEventListener("load", () => resolve(image), { once: true });
        image.addEventListener(
          "error",
          () => reject(new Error(`Unable to load ${imageUrl}`)),
          { once: true }
        );
      });

      this.preloadedImages.set(imageUrl, { image, promise });
      image.src = imageUrl;
      return promise;
    },

    setInfoExpanded(isExpanded) {
      if (URLParamsHandler.params.hideInfo) return;
      if (this.infoExpanded === isExpanded) return;

      this.infoExpanded = isExpanded;
      UI.toggleInfoExpanded(this.infoExpanded);
      if (this.infoExpanded) Carousel.pauseForInteraction("info-expanded");
      else Carousel.resume("info-expanded");
    },

    toggleInfoDetails() {
      this.setInfoExpanded(!this.infoExpanded);
    },

    async initializePhotos() {
      const allPhotos = await FlickrAPI.fetchPhotos();
      this.photos = allPhotos.filter((photo) => this.getBestImageUrl(photo));
      this.failedPhotoIndexes.clear();

      if (Config.randomOrder) this.photos = this.shuffleArray(this.photos);
      console.log(`Carousel: ${this.photos.length} photos loaded`);
      return this.photos.length > 0;
    },

    findNextAvailableIndex(fromIndex, direction) {
      for (let offset = 1; offset <= this.photos.length; offset += 1) {
        const index =
          (fromIndex + direction * offset + this.photos.length) %
          this.photos.length;
        if (!this.failedPhotoIndexes.has(index)) return index;
      }

      return null;
    },
  };

  const Carousel = {
    timer: null,
    timerStartedAt: null,
    remainingTime: Config.interval,
    pauseReasons: new Set(),
    isTransitioning: false,
    activeDirection: null,
    queuedDirection: null,
    transitionToken: 0,
    userRequestedRotation: false,

    get isPaused() {
      return this.pauseReasons.size > 0;
    },

    clearTimer() {
      if (this.timer) window.clearTimeout(this.timer);
      this.timer = null;
      this.timerStartedAt = null;
    },

    pauseTimer() {
      if (this.timer && this.timerStartedAt !== null) {
        const elapsed = window.performance.now() - this.timerStartedAt;
        this.remainingTime = Math.max(0, this.remainingTime - elapsed);
      }
      this.clearTimer();
    },

    startTimer() {
      this.clearTimer();
      if (this.isPaused || ImageHandler.photos.length < 2) return;

      this.timerStartedAt = window.performance.now();
      this.timer = window.setTimeout(() => {
        this.timer = null;
        this.timerStartedAt = null;
        this.remainingTime = Config.interval;
        this.navigate(1);
      }, this.remainingTime);
    },

    scheduleNext() {
      this.clearTimer();
      this.remainingTime = Config.interval;
      UI.restartProgress();
      this.startTimer();
    },

    async showPhoto(index, options = {}) {
      const { direction = 1, immediate = false } = options;
      const photo = ImageHandler.photos[index];
      const imageUrl = ImageHandler.getBestImageUrl(photo);
      const token = ++this.transitionToken;

      if (!imageUrl) {
        ImageHandler.failedPhotoIndexes.add(index);
        const nextIndex = ImageHandler.findNextAvailableIndex(index, direction);
        if (nextIndex === null) UI.showError("Unable to load the tray");
        else this.showPhoto(nextIndex, { direction });
        return;
      }

      this.clearTimer();

      try {
        await ImageHandler.preloadImage(index);
      } catch (error) {
        console.error(`Carousel: Failed to preload photo ${index}`, error);
        ImageHandler.failedPhotoIndexes.add(index);
        if (token === this.transitionToken) {
          const nextIndex = ImageHandler.findNextAvailableIndex(index, direction);
          if (nextIndex === null) UI.showError("Unable to load the tray");
          else this.showPhoto(nextIndex, { direction });
        }
        return;
      }

      if (token !== this.transitionToken) return;

      if (immediate || URLParamsHandler.params.disableTransitions) {
        UI.elements.slideImg.src = imageUrl;
        UI.updatePhotoInfo(photo, index, ImageHandler.photos.length);
        ImageHandler.currentPhotoIndex = index;
        UI.hideLoading();
        ImageHandler.preloadImage(
          (index + 1) % ImageHandler.photos.length
        ).catch(() => {});
        this.scheduleNext();
        return;
      }

      this.isTransitioning = true;
      this.activeDirection = direction;
      UI.elements.nextSlideImg.src = imageUrl;
      UI.elements.nextSlideImg.alt = "";
      UI.setTransitionState(true, direction);
      SoundHandler.playTransition(direction);

      const duration = UI.getTransitionDuration();
      const midpoint = Math.round(duration * 0.5);
      await wait(midpoint);

      if (token !== this.transitionToken) return;
      UI.updatePhotoInfo(photo, index, ImageHandler.photos.length);
      await wait(duration - midpoint + 30);

      if (token !== this.transitionToken) return;
      UI.elements.slideImg.src = imageUrl;
      UI.elements.nextSlideImg.removeAttribute("src");
      UI.setTransitionState(false);
      ImageHandler.currentPhotoIndex = index;
      this.isTransitioning = false;
      this.activeDirection = null;

      ImageHandler.preloadImage(
        (index + direction + ImageHandler.photos.length) %
          ImageHandler.photos.length
      ).catch(() => {});

      if (this.queuedDirection !== null) {
        const queuedDirection = this.queuedDirection;
        this.queuedDirection = null;
        this.navigate(queuedDirection);
        return;
      }

      this.scheduleNext();
    },

    navigate(direction) {
      if (ImageHandler.photos.length < 2) return;

      if (this.isTransitioning) {
        if (direction !== this.activeDirection) {
          this.queuedDirection = direction;
        }
        return;
      }

      const targetIndex = ImageHandler.findNextAvailableIndex(
        ImageHandler.currentPhotoIndex,
        direction
      );
      if (targetIndex === null) return;
      this.showPhoto(targetIndex, { direction });
    },

    pause(reason = "manual") {
      const wasPaused = this.isPaused;
      this.pauseReasons.add(reason);
      if (!wasPaused) {
        this.pauseTimer();
        UI.setPaused(true);
      }
    },

    pauseForInteraction(reason) {
      if (this.userRequestedRotation) return;
      this.pause(reason);
    },

    resume(reason = "manual") {
      const hadReason = this.pauseReasons.delete(reason);
      if (!hadReason) return;
      if (this.isPaused) return;
      UI.setPaused(false);
      this.startTimer();
    },

    togglePause() {
      if (URLParamsHandler.params.hideInfo) return;

      if (!this.isPaused) {
        this.userRequestedRotation = false;
        this.pause("manual");
        return;
      }

      this.pauseReasons.clear();
      this.userRequestedRotation = true;
      UI.setPaused(false);
      this.startTimer();
    },
  };

  const FullscreenHandler = {
    async toggle() {
      if (URLParamsHandler.params.hideInfo) return;

      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (error) {
        console.error("Carousel: Fullscreen request failed", error);
      }
    },
  };

  const FitModeHandler = {
    toggle() {
      UI.setFitMode(
        !UI.elements.slideContainer.classList.contains("fill-image")
      );
    },
  };

  const SwipeHandler = {
    touchStartX: null,
    touchStartY: null,

    handleTouchStart(event) {
      this.touchStartX = event.touches[0].clientX;
      this.touchStartY = event.touches[0].clientY;
    },

    handleTouchEnd(event) {
      if (this.touchStartX === null || this.touchStartY === null) return;

      const differenceX = this.touchStartX - event.changedTouches[0].clientX;
      const differenceY = this.touchStartY - event.changedTouches[0].clientY;

      if (
        Math.abs(differenceX) > Math.abs(differenceY) &&
        Math.abs(differenceX) > 50
      ) {
        Carousel.navigate(differenceX > 0 ? 1 : -1);
      }

      this.touchStartX = null;
      this.touchStartY = null;
    },
  };

  const URLParamsHandler = {
    params: {},

    init() {
      const urlParams = new URLSearchParams(window.location.search);
      this.params.hideInfo = urlParams.has("hideInfo");
      this.params.disableTransitions = urlParams.has("disableTransitions");
      this.params.fillImage = urlParams.has("fillImage");
      this.applyParams();
    },

    applyParams() {
      UI.elements.slideContainer.classList.toggle(
        "ui-hidden",
        this.params.hideInfo
      );
      UI.elements.slideContainer.classList.toggle(
        "transitions-disabled",
        this.params.disableTransitions
      );
      UI.setFitMode(this.params.fillImage);
      if (this.params.hideInfo) Carousel.pause("hidden-ui");
    },
  };

  const IdleUIHandler = {
    delay: 2400,
    timer: null,
    pointerFrame: null,

    clearTimer() {
      if (this.timer) window.clearTimeout(this.timer);
      this.timer = null;
    },

    hasVisibleFocus() {
      const activeElement = document.activeElement;
      return (
        activeElement instanceof HTMLElement &&
        activeElement.matches(":focus-visible")
      );
    },

    schedule() {
      this.clearTimer();
      if (URLParamsHandler.params.hideInfo || ImageHandler.infoExpanded) return;

      this.timer = window.setTimeout(() => {
        if (this.hasVisibleFocus() || ImageHandler.infoExpanded) return;
        UI.elements.slideContainer.classList.add("is-ui-idle");
      }, this.delay);
    },

    wake() {
      UI.elements.slideContainer.classList.remove("is-ui-idle");
      this.schedule();
    },

    hold() {
      this.clearTimer();
      UI.elements.slideContainer.classList.remove("is-ui-idle");
    },

    handlePointerActivity() {
      if (this.pointerFrame) return;
      this.pointerFrame = window.requestAnimationFrame(() => {
        this.pointerFrame = null;
        this.wake();
      });
    },
  };

  const EventHandlers = {
    resizeTimer: null,
    usingKeyboard: false,

    setupEventListeners() {
      UI.elements.previousBtn.addEventListener("click", () =>
        Carousel.navigate(-1)
      );
      UI.elements.nextBtn.addEventListener("click", () =>
        Carousel.navigate(1)
      );
      UI.elements.pauseBtn.addEventListener("click", () =>
        Carousel.togglePause()
      );
      UI.elements.soundToggleBtn.addEventListener("click", () =>
        SoundHandler.toggle()
      );
      UI.elements.fullscreenBtn.addEventListener("click", () =>
        FullscreenHandler.toggle()
      );
      UI.elements.fitModeBtn.addEventListener("click", () =>
        FitModeHandler.toggle()
      );

      if (!URLParamsHandler.params.hideInfo) {
        UI.elements.imageInfoToggle.addEventListener("click", () =>
          ImageHandler.toggleInfoDetails()
        );
        UI.elements.imageInfo.addEventListener("mouseenter", () => {
          IdleUIHandler.hold();
          Carousel.pauseForInteraction("info-hover");
        });
        UI.elements.imageInfo.addEventListener("mouseleave", () => {
          Carousel.resume("info-hover");
          IdleUIHandler.wake();
        });
      }

      UI.elements.carouselControls.addEventListener("pointerenter", () => {
        IdleUIHandler.hold();
        Carousel.pauseForInteraction("controls-hover");
      });
      UI.elements.carouselControls.addEventListener("pointerleave", () => {
        Carousel.resume("controls-hover");
        IdleUIHandler.wake();
      });
      [UI.elements.previousBtn, UI.elements.nextBtn].forEach((button) => {
        button.addEventListener("pointerenter", () => {
          IdleUIHandler.hold();
          Carousel.pauseForInteraction("edge-hover");
        });
        button.addEventListener("pointerleave", () => {
          Carousel.resume("edge-hover");
          IdleUIHandler.wake();
        });
      });

      UI.elements.slideContainer.addEventListener("touchstart", (event) => {
        IdleUIHandler.wake();
        Carousel.pauseForInteraction("touch");
        SwipeHandler.handleTouchStart(event);
      });
      UI.elements.slideContainer.addEventListener("touchend", (event) =>
        SwipeHandler.handleTouchEnd(event)
      );
      document.addEventListener("keydown", (event) =>
        this.handleKeyPress(event)
      );
      document.addEventListener(
        "pointermove",
        () => IdleUIHandler.handlePointerActivity(),
        { passive: true }
      );
      document.addEventListener(
        "pointerdown",
        (event) => {
          this.usingKeyboard = false;

          if (
            !ImageHandler.infoExpanded ||
            !(event.target instanceof Node) ||
            UI.elements.imageInfo.contains(event.target)
          ) {
            return;
          }

          ImageHandler.setInfoExpanded(false);
          if (document.activeElement === UI.elements.imageInfoToggle) {
            UI.elements.imageInfoToggle.blur();
          }
        },
        { capture: true }
      );
      document.addEventListener("focusin", (event) => {
        if (
          this.usingKeyboard &&
          UI.elements.slideContainer.contains(event.target)
        ) {
          Carousel.pauseForInteraction("focus");
        }
        window.requestAnimationFrame(() => {
          if (IdleUIHandler.hasVisibleFocus()) IdleUIHandler.hold();
          else IdleUIHandler.wake();
        });
      });
      document.addEventListener("focusout", () => IdleUIHandler.wake());
      document.addEventListener(
        "keydown",
        () => {
          this.usingKeyboard = true;
          IdleUIHandler.wake();
        },
        { capture: true }
      );
      document.addEventListener("fullscreenchange", () =>
        UI.setFullscreen(Boolean(document.fullscreenElement))
      );
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) Carousel.pause("visibility");
        else Carousel.resume("visibility");
      });
      window.addEventListener("resize", () => this.handleResize());
    },

    handleKeyPress(event) {
      if (
        event.target instanceof HTMLAnchorElement ||
        event.target instanceof HTMLButtonElement
      ) {
        return;
      }

      switch (event.key) {
        case "ArrowRight":
          Carousel.pauseForInteraction("keyboard-navigation");
          Carousel.navigate(1);
          return;
        case "ArrowLeft":
          Carousel.pauseForInteraction("keyboard-navigation");
          Carousel.navigate(-1);
          return;
        case " ":
          event.preventDefault();
          Carousel.togglePause();
          return;
      }

      if (!event.altKey || event.ctrlKey || event.metaKey) return;

      switch (event.code) {
        case "KeyF":
          event.preventDefault();
          FullscreenHandler.toggle();
          break;
        case "KeyM":
          event.preventDefault();
          FitModeHandler.toggle();
          break;
        case "KeyS":
          event.preventDefault();
          SoundHandler.toggle();
          break;
        case "KeyI":
          event.preventDefault();
          if (!URLParamsHandler.params.hideInfo) {
            ImageHandler.toggleInfoDetails();
          }
          break;
      }
    },

    handleResize() {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(async () => {
        const currentPhoto =
          ImageHandler.photos[ImageHandler.currentPhotoIndex];
        if (!currentPhoto) return;

        const imageUrl = ImageHandler.getBestImageUrl(currentPhoto);
        if (imageUrl && imageUrl !== UI.elements.slideImg.src) {
          try {
            await ImageHandler.preloadImage(ImageHandler.currentPhotoIndex);
            UI.elements.slideImg.src = imageUrl;
          } catch (error) {
            console.error("Carousel: Resize image update failed", error);
          }
        }
      }, 180);
    },
  };

  async function init() {
    UI.showLoading();
    document.documentElement.style.setProperty(
      "--progress-duration",
      `${Config.interval}ms`
    );
    URLParamsHandler.init();
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      Carousel.pause("reduced-motion");
    }
    UI.setSoundMuted(true);
    EventHandlers.setupEventListeners();

    try {
      const hasPhotos = await ImageHandler.initializePhotos();
      if (!hasPhotos) throw new Error("No photos available to display");

      await ImageHandler.preloadImage(0);
      await Carousel.showPhoto(0, { immediate: true });
    } catch (error) {
      console.error("Carousel: Initialization error", error);
      UI.showError("Unable to load the tray");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
