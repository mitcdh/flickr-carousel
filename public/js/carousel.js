(function () {
  const IMAGE_SIZE_OPTIONS = Object.freeze([
    { suffix: "6k", minWidth: 5120 },
    { suffix: "5k", minWidth: 4096 },
    { suffix: "4k", minWidth: 3072 },
    { suffix: "3k", minWidth: 2048 },
    { suffix: "k", minWidth: 1600 },
    { suffix: "h", minWidth: 1024 },
    { suffix: "b", minWidth: 0 },
  ]);
  const API_REQUEST_TIMEOUT = 15000;
  const POINTER_HANDOFF_DELAY = 120;
  const PauseReason = Object.freeze({
    controlsHover: "controls-hover",
    edgeHover: "edge-hover",
    focus: "focus",
    hiddenUI: "hidden-ui",
    infoExpanded: "info-expanded",
    infoHover: "info-hover",
    manual: "manual",
    reducedMotion: "reduced-motion",
    touch: "touch",
    visibility: "visibility",
  });
  const OVERRIDABLE_PAUSE_REASONS = new Set([
    PauseReason.controlsHover,
    PauseReason.edgeHover,
    PauseReason.focus,
    PauseReason.infoExpanded,
    PauseReason.infoHover,
    PauseReason.touch,
  ]);

  const Config = Object.freeze({
    interval: 10000,
    randomOrder: true,
    showPhotographer: true,
    showLocation: true,
    userId: "83515912@N03",
    flickrApiUrl: "/flickr-api-proxy/",
  });

  const wait = (duration) =>
    new Promise((resolve) => window.setTimeout(resolve, duration));

  const getPhotoTitle = (photo) => {
    const title =
      typeof photo.title === "string" ? photo.title : photo.title?._content;
    return title?.trim() || "Untitled";
  };

  const UI = {
    elements: {
      loadingIndicator: document.getElementById("loading-indicator"),
      slideImg: document.getElementById("slide"),
      nextSlideImg: document.getElementById("slide-next"),
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
      this.elements.loadingIndicator.hidden = false;
    },

    hideLoading() {
      if (this.elements.loadingIndicator.hidden) return;

      this.elements.loadingIndicator.hidden = true;
      if (!URLParamsHandler.params.hideInfo) {
        this.elements.slideContainer.classList.add("is-ui-ready");
      }
      IdleUIHandler.wake();
    },

    showError(message) {
      const label = this.elements.loadingIndicator.querySelector("span");
      const icon = this.elements.loadingIndicator.querySelector("img");

      if (icon) icon.hidden = true;
      if (label) label.textContent = message;
      this.elements.loadingIndicator.hidden = false;
    },

    setSlideSource(image, source) {
      image.classList.remove("is-image-ready");
      if (!source) {
        image.removeAttribute("src");
        return;
      }

      image.src = source;
      image.classList.add("is-image-ready");
    },

    clearSlideSource(image) {
      image.classList.remove("is-image-ready");
      image.removeAttribute("src");
    },

    handleSlideImageError(image) {
      this.clearSlideSource(image);
      image.alt = "";
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
        isTransitioning,
      );
      this.elements.slideContainer.classList.toggle(
        "is-forward",
        isTransitioning && direction >= 0,
      );
      this.elements.slideContainer.classList.toggle(
        "is-backward",
        isTransitioning && direction < 0,
      );
    },

    updatePhotoInfo(photo, index, total) {
      const title = getPhotoTitle(photo);
      const ownerId = photo.owner || Config.userId;
      const photoUrl = `https://www.flickr.com/photos/${encodeURIComponent(
        ownerId,
      )}/${encodeURIComponent(photo.id)}`;
      const description = photo.description?._content?.trim() || "";
      const hasLocation =
        photo.latitude &&
        photo.longitude &&
        photo.latitude !== "0" &&
        photo.longitude !== "0";

      this.elements.imageTitle.textContent = title;
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
        "0",
      );
      this.elements.totalSlides.textContent = String(total).padStart(
        digitCount,
        "0",
      );
      this.elements.slideImg.alt = `${title}, photo ${index + 1} of ${total}`;
      this.updateInfoToggleLabel(ImageHandler.infoExpanded);
      this.elements.slideAnnouncer.textContent = `Now showing ${title}, photo ${
        index + 1
      } of ${total}`;
    },

    updateInfoToggleLabel(isExpanded) {
      const title = this.elements.imageTitle.textContent.trim() || "this photo";
      const action = isExpanded ? "Hide" : "Show";
      this.elements.imageInfoToggle.setAttribute(
        "aria-label",
        `${action} photo details for ${title}`,
      );
    },

    toggleInfoExpanded(isExpanded) {
      if (URLParamsHandler.params.hideInfo) return;
      this.elements.imageInfo.classList.toggle("expanded", isExpanded);
      this.elements.imageInfoToggle.setAttribute(
        "aria-expanded",
        String(isExpanded),
      );
      this.updateInfoToggleLabel(isExpanded);
      this.elements.imageDetails.setAttribute(
        "aria-hidden",
        String(!isExpanded),
      );
      this.elements.imageDetails.inert = !isExpanded;
      if (isExpanded) IdleUIHandler.hold(PauseReason.infoExpanded);
      else IdleUIHandler.release(PauseReason.infoExpanded);
    },

    setPaused(isPaused) {
      this.elements.slideContainer.classList.toggle("is-paused", isPaused);
      this.elements.pauseBtn.setAttribute(
        "aria-label",
        isPaused ? "Resume carousel" : "Pause carousel",
      );
      this.elements.slideAnnouncer.setAttribute(
        "aria-live",
        isPaused ? "polite" : "off",
      );
    },

    setSoundMuted(isMuted) {
      this.elements.soundToggleBtn.setAttribute(
        "aria-pressed",
        String(!isMuted),
      );
    },

    restartProgress() {
      this.elements.slideContainer.classList.remove("progress-running");
      void this.elements.progressFill.offsetWidth;
      this.elements.slideContainer.classList.add("progress-running");
    },

    stopProgress() {
      this.elements.slideContainer.classList.remove("progress-running");
    },

    setFitMode(shouldFill) {
      this.elements.slideContainer.classList.toggle("fill-image", shouldFill);
      this.elements.fitModeBtn.setAttribute("aria-pressed", String(shouldFill));
    },

    setFullscreen(isFullscreen) {
      this.elements.slideContainer.classList.toggle(
        "is-fullscreen",
        isFullscreen,
      );
      this.elements.fullscreenBtn.setAttribute(
        "aria-label",
        isFullscreen ? "Exit fullscreen" : "Enter fullscreen",
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
      } catch {
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
          "Carousel sound is not supported",
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
          "Carousel sound is unavailable",
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
      const controller = new AbortController();
      const timeout = window.setTimeout(
        () => controller.abort(),
        API_REQUEST_TIMEOUT,
      );

      try {
        const response = await fetch(Config.flickrApiUrl, {
          cache: "default",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Photo service returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "Unknown error fetching photos");
        }
        if (!Array.isArray(data.photos)) {
          throw new TypeError("Photo service returned an invalid photo list");
        }

        return data.photos;
      } catch (error) {
        console.error("Carousel: Error fetching images", error);
        return [];
      } finally {
        window.clearTimeout(timeout);
      }
    },
  };

  const ImageHandler = {
    photos: [],
    currentPhotoIndex: 0,
    preloadedImages: new Map(),
    failedPhotoIndexes: new Set(),
    infoExpanded: false,

    get availablePhotoCount() {
      return this.photos.length - this.failedPhotoIndexes.size;
    },

    getBestImageUrl(photo) {
      if (!photo) return null;

      const displayWidth =
        Math.max(window.innerWidth, window.innerHeight) *
        Math.min(window.devicePixelRatio || 1, 2);

      for (const option of IMAGE_SIZE_OPTIONS) {
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
      if (index < 0 || index >= this.photos.length)
        return Promise.resolve(null);

      const imageUrl = this.getBestImageUrl(this.photos[index]);
      if (!imageUrl) return Promise.resolve(null);
      if (this.preloadedImages.has(imageUrl)) {
        return this.preloadedImages.get(imageUrl);
      }

      const image = new Image();
      const loadPromise = new Promise((resolve, reject) => {
        image.addEventListener("load", () => resolve(image), { once: true });
        image.addEventListener(
          "error",
          () => reject(new Error(`Unable to load ${imageUrl}`)),
          { once: true },
        );
      });
      const promise = loadPromise.catch((error) => {
        this.preloadedImages.delete(imageUrl);
        throw error;
      });

      this.preloadedImages.set(imageUrl, promise);
      image.src = imageUrl;
      return promise;
    },

    preloadAdjacent(index, direction = 1) {
      const adjacentIndex = this.findNextAvailableIndex(index, direction);
      if (adjacentIndex === null) return;
      this.preloadImage(adjacentIndex).catch(() => {});
    },

    setInfoExpanded(isExpanded) {
      if (URLParamsHandler.params.hideInfo) return;
      if (this.infoExpanded === isExpanded) return;

      this.infoExpanded = isExpanded;
      UI.toggleInfoExpanded(this.infoExpanded);
      if (this.infoExpanded) {
        Carousel.pauseForInteraction(PauseReason.infoExpanded);
      } else {
        Carousel.resume(PauseReason.infoExpanded);
        Carousel.clearInteractionPauseOverride(PauseReason.infoExpanded);
      }
    },

    toggleInfoDetails() {
      this.setInfoExpanded(!this.infoExpanded);
    },

    async initializePhotos() {
      const allPhotos = await FlickrAPI.fetchPhotos();
      this.photos = allPhotos.filter((photo) => this.getBestImageUrl(photo));
      this.preloadedImages.clear();
      this.failedPhotoIndexes.clear();

      if (Config.randomOrder) this.photos = this.shuffleArray(this.photos);
      return this.photos.length > 0;
    },

    findNextAvailableIndex(fromIndex, direction) {
      for (let offset = 1; offset < this.photos.length; offset += 1) {
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
    interactionPauseOverrides: new Set(),

    get isPaused() {
      return this.pauseReasons.size > 0;
    },

    clearTimer() {
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = null;
      this.timerStartedAt = null;
    },

    pauseTimer() {
      if (this.timer !== null && this.timerStartedAt !== null) {
        const elapsed = window.performance.now() - this.timerStartedAt;
        this.remainingTime = Math.max(0, this.remainingTime - elapsed);
      }
      this.clearTimer();
    },

    startTimer() {
      this.clearTimer();
      if (this.isPaused || ImageHandler.availablePhotoCount < 2) return;

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
      if (ImageHandler.availablePhotoCount < 2) {
        UI.stopProgress();
        return;
      }
      UI.restartProgress();
      this.startTimer();
    },

    recoverFromFailedPhoto(index, options) {
      const { direction, immediate } = options;
      ImageHandler.failedPhotoIndexes.add(index);
      const nextIndex = ImageHandler.findNextAvailableIndex(index, direction);

      if (
        nextIndex === ImageHandler.currentPhotoIndex &&
        UI.elements.slideImg.hasAttribute("src")
      ) {
        this.scheduleNext();
        return Promise.resolve(nextIndex);
      }

      if (nextIndex === null) {
        UI.showError("Unable to load the tray");
        return Promise.resolve(null);
      }

      return this.showPhoto(nextIndex, { direction, immediate });
    },

    async showPhoto(index, options = {}) {
      const { direction = 1, immediate = false } = options;
      const photo = ImageHandler.photos[index];
      const imageUrl = ImageHandler.getBestImageUrl(photo);
      const token = ++this.transitionToken;

      if (!imageUrl) {
        return this.recoverFromFailedPhoto(index, { direction, immediate });
      }

      this.clearTimer();
      let loadedImage;

      try {
        loadedImage = await ImageHandler.preloadImage(index);
        if (!loadedImage)
          throw new Error(`No image available for photo ${index}`);
      } catch (error) {
        console.error(`Carousel: Failed to preload photo ${index}`, error);
        if (token === this.transitionToken) {
          return this.recoverFromFailedPhoto(index, { direction, immediate });
        }
        return null;
      }

      if (token !== this.transitionToken) return null;

      if (immediate || URLParamsHandler.params.disableTransitions) {
        UI.setSlideSource(UI.elements.slideImg, loadedImage.src);
        UI.updatePhotoInfo(photo, index, ImageHandler.photos.length);
        ImageHandler.currentPhotoIndex = index;
        UI.hideLoading();
        ImageHandler.preloadAdjacent(index);
        this.scheduleNext();
        return index;
      }

      this.isTransitioning = true;
      this.activeDirection = direction;
      UI.setSlideSource(UI.elements.nextSlideImg, loadedImage.src);
      UI.elements.nextSlideImg.alt = "";
      UI.setTransitionState(true, direction);
      SoundHandler.playTransition(direction);

      const duration = UI.getTransitionDuration();
      const midpoint = Math.round(duration * 0.5);
      await wait(midpoint);

      if (token !== this.transitionToken) return null;
      UI.updatePhotoInfo(photo, index, ImageHandler.photos.length);
      await wait(duration - midpoint + 30);

      if (token !== this.transitionToken) return null;
      UI.setSlideSource(UI.elements.slideImg, UI.elements.nextSlideImg.src);
      UI.clearSlideSource(UI.elements.nextSlideImg);
      UI.setTransitionState(false);
      ImageHandler.currentPhotoIndex = index;
      this.isTransitioning = false;
      this.activeDirection = null;

      ImageHandler.preloadAdjacent(index, direction);

      if (this.queuedDirection !== null) {
        const queuedDirection = this.queuedDirection;
        this.queuedDirection = null;
        return this.navigate(queuedDirection);
      }

      this.scheduleNext();
      return index;
    },

    navigate(direction) {
      if (ImageHandler.availablePhotoCount < 2) return;

      if (this.isTransitioning) {
        if (direction !== this.activeDirection) {
          this.queuedDirection = direction;
        }
        return;
      }

      const targetIndex = ImageHandler.findNextAvailableIndex(
        ImageHandler.currentPhotoIndex,
        direction,
      );
      if (targetIndex === null) return;
      return this.showPhoto(targetIndex, { direction });
    },

    pause(reason = PauseReason.manual) {
      const wasPaused = this.isPaused;
      this.pauseReasons.add(reason);
      if (!wasPaused) {
        this.pauseTimer();
        UI.setPaused(true);
      }
    },

    pauseForInteraction(reason) {
      if (this.interactionPauseOverrides.has(reason)) return;
      this.pause(reason);
    },

    clearInteractionPauseOverride(reason) {
      this.interactionPauseOverrides.delete(reason);
    },

    resume(reason = PauseReason.manual) {
      const hadReason = this.pauseReasons.delete(reason);
      if (!hadReason) return;
      if (this.isPaused) return;
      UI.setPaused(false);
      this.startTimer();
    },

    togglePause() {
      if (URLParamsHandler.params.hideInfo) return;

      if (!this.isPaused) {
        this.interactionPauseOverrides.clear();
        this.pause(PauseReason.manual);
        return;
      }

      const activeInteractionReasons = [...this.pauseReasons].filter((reason) =>
        OVERRIDABLE_PAUSE_REASONS.has(reason),
      );
      this.pauseReasons.clear();
      this.interactionPauseOverrides.clear();
      activeInteractionReasons.forEach((reason) =>
        this.interactionPauseOverrides.add(reason),
      );
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
        !UI.elements.slideContainer.classList.contains("fill-image"),
      );
    },
  };

  const SwipeHandler = {
    touchStartX: null,
    touchStartY: null,

    reset() {
      this.touchStartX = null;
      this.touchStartY = null;
    },

    handleTouchStart(event) {
      if (event.touches.length !== 1) {
        this.reset();
        return;
      }
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

      this.reset();
    },
  };

  const URLParamsHandler = {
    params: {},

    init() {
      const urlParams = new URLSearchParams(window.location.search);
      this.params = {
        hideInfo: urlParams.has("hideInfo"),
        disableTransitions: urlParams.has("disableTransitions"),
        fillImage: urlParams.has("fillImage"),
      };
      this.applyParams();
    },

    applyParams() {
      UI.elements.slideContainer.classList.toggle(
        "ui-hidden",
        this.params.hideInfo,
      );
      UI.elements.slideContainer.classList.toggle(
        "transitions-disabled",
        this.params.disableTransitions,
      );
      UI.setFitMode(this.params.fillImage);
      if (this.params.hideInfo) Carousel.pause(PauseReason.hiddenUI);
    },
  };

  const IdleUIHandler = {
    delay: 2400,
    timer: null,
    pointerFrame: null,
    holdReasons: new Set(),

    clearTimer() {
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = null;
    },

    hasVisibleFocus() {
      if (!UI.elements.slideContainer.classList.contains("is-keyboard-input")) {
        return false;
      }

      const activeElement = document.activeElement;
      return (
        activeElement instanceof HTMLElement &&
        activeElement.matches(":focus-visible")
      );
    },

    schedule() {
      this.clearTimer();
      if (URLParamsHandler.params.hideInfo || this.holdReasons.size > 0) return;

      this.timer = window.setTimeout(() => {
        if (this.hasVisibleFocus() || this.holdReasons.size > 0) return;
        UI.elements.slideContainer.classList.add("is-ui-idle");
      }, this.delay);
    },

    wake() {
      UI.elements.slideContainer.classList.remove("is-ui-idle");
      this.schedule();
    },

    hold(reason) {
      this.holdReasons.add(reason);
      this.clearTimer();
      UI.elements.slideContainer.classList.remove("is-ui-idle");
    },

    release(reason) {
      this.holdReasons.delete(reason);
      this.wake();
    },

    handlePointerActivity() {
      if (this.pointerFrame !== null) return;
      this.pointerFrame = window.requestAnimationFrame(() => {
        this.pointerFrame = null;
        this.wake();
      });
    },
  };

  const EventHandlers = {
    resizeTimer: null,
    resizeRequest: 0,
    focusFrame: null,
    temporaryResumeTimers: new Map(),
    usingKeyboard: false,

    cancelTemporaryResume(reason) {
      const timer = this.temporaryResumeTimers.get(reason);
      if (timer === undefined) return;

      window.clearTimeout(timer);
      this.temporaryResumeTimers.delete(reason);
    },

    scheduleTemporaryResume(reason) {
      this.cancelTemporaryResume(reason);
      const timer = window.setTimeout(() => {
        this.temporaryResumeTimers.delete(reason);
        Carousel.resume(reason);
        Carousel.clearInteractionPauseOverride(reason);
        IdleUIHandler.release(reason);
      }, POINTER_HANDOFF_DELAY);
      this.temporaryResumeTimers.set(reason, timer);
    },

    bindTemporaryPause(element, reason) {
      element.addEventListener("pointerenter", () => {
        this.cancelTemporaryResume(reason);
        element.classList.add("is-pointer-active");
        IdleUIHandler.hold(reason);
        Carousel.pauseForInteraction(reason);
      });
      element.addEventListener("pointerleave", () => {
        element.classList.remove("is-pointer-active");
        this.scheduleTemporaryResume(reason);
      });
    },

    setKeyboardInput() {
      this.usingKeyboard = true;
      UI.elements.slideContainer.classList.add("is-keyboard-input");
      IdleUIHandler.wake();
      this.queueFocusUpdate();
    },

    setPointerInput() {
      this.usingKeyboard = false;
      UI.elements.slideContainer.classList.remove("is-keyboard-input");
      Carousel.clearInteractionPauseOverride(PauseReason.focus);
      IdleUIHandler.release(PauseReason.focus);
    },

    queueFocusUpdate() {
      if (this.focusFrame !== null) {
        window.cancelAnimationFrame(this.focusFrame);
      }
      this.focusFrame = window.requestAnimationFrame(() => {
        this.focusFrame = null;
        this.syncFocusState();
      });
    },

    syncFocusState() {
      const activeElement = document.activeElement;
      const hasVisibleCarouselFocus =
        this.usingKeyboard &&
        activeElement instanceof HTMLElement &&
        UI.elements.slideContainer.contains(activeElement) &&
        activeElement.matches(":focus-visible");

      if (hasVisibleCarouselFocus) {
        Carousel.pauseForInteraction(PauseReason.focus);
        IdleUIHandler.hold(PauseReason.focus);
      } else {
        Carousel.clearInteractionPauseOverride(PauseReason.focus);
        IdleUIHandler.release(PauseReason.focus);
      }
    },

    handlePointerDown() {
      this.setPointerInput();
    },

    handleDocumentClick(event) {
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

    setupEventListeners() {
      [UI.elements.slideImg, UI.elements.nextSlideImg].forEach((image) => {
        image.addEventListener("error", () => UI.handleSlideImageError(image));
      });

      UI.elements.previousBtn.addEventListener("click", () =>
        Carousel.navigate(-1),
      );
      UI.elements.nextBtn.addEventListener("click", () => Carousel.navigate(1));
      UI.elements.pauseBtn.addEventListener("click", () =>
        Carousel.togglePause(),
      );
      UI.elements.soundToggleBtn.addEventListener("click", () =>
        SoundHandler.toggle(),
      );
      UI.elements.fullscreenBtn.addEventListener("click", () =>
        FullscreenHandler.toggle(),
      );
      UI.elements.fitModeBtn.addEventListener("click", () =>
        FitModeHandler.toggle(),
      );

      if (!URLParamsHandler.params.hideInfo) {
        UI.elements.imageInfoToggle.addEventListener("click", () =>
          ImageHandler.toggleInfoDetails(),
        );
        this.bindTemporaryPause(UI.elements.imageInfo, PauseReason.infoHover);
      }

      this.bindTemporaryPause(
        UI.elements.carouselControls,
        PauseReason.controlsHover,
      );
      [UI.elements.previousBtn, UI.elements.nextBtn].forEach((button) => {
        this.bindTemporaryPause(button, PauseReason.edgeHover);
      });

      UI.elements.slideContainer.addEventListener(
        "touchstart",
        (event) => {
          IdleUIHandler.hold(PauseReason.touch);
          Carousel.pauseForInteraction(PauseReason.touch);
          SwipeHandler.handleTouchStart(event);
        },
        { passive: true },
      );
      UI.elements.slideContainer.addEventListener(
        "touchend",
        (event) => {
          SwipeHandler.handleTouchEnd(event);
          Carousel.resume(PauseReason.touch);
          Carousel.clearInteractionPauseOverride(PauseReason.touch);
          IdleUIHandler.release(PauseReason.touch);
        },
        { passive: true },
      );
      UI.elements.slideContainer.addEventListener(
        "touchcancel",
        () => {
          SwipeHandler.reset();
          Carousel.resume(PauseReason.touch);
          Carousel.clearInteractionPauseOverride(PauseReason.touch);
          IdleUIHandler.release(PauseReason.touch);
        },
        { passive: true },
      );
      document.addEventListener(
        "keydown",
        (event) => {
          this.setKeyboardInput();
          this.handleKeyPress(event);
        },
        { capture: true },
      );
      document.addEventListener(
        "pointermove",
        () => IdleUIHandler.handlePointerActivity(),
        { passive: true },
      );
      document.addEventListener("pointerdown", () => this.handlePointerDown(), {
        capture: true,
      });
      document.addEventListener("click", (event) =>
        this.handleDocumentClick(event),
      );
      document.addEventListener("focusin", () => this.queueFocusUpdate());
      document.addEventListener("focusout", () => this.queueFocusUpdate());
      document.addEventListener("fullscreenchange", () =>
        UI.setFullscreen(Boolean(document.fullscreenElement)),
      );
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) Carousel.pause(PauseReason.visibility);
        else Carousel.resume(PauseReason.visibility);
      });
      window.addEventListener("resize", () => this.handleResize());
    },

    handleKeyPress(event) {
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        switch (event.code) {
          case "KeyF":
            event.preventDefault();
            FullscreenHandler.toggle();
            return;
          case "KeyM":
            event.preventDefault();
            FitModeHandler.toggle();
            return;
          case "KeyS":
            event.preventDefault();
            SoundHandler.toggle();
            return;
          case "KeyI":
            event.preventDefault();
            if (!URLParamsHandler.params.hideInfo) {
              ImageHandler.toggleInfoDetails();
            }
            return;
        }
      }

      if (
        event.target instanceof Element &&
        event.target.closest(
          "a, button, input, select, textarea, [contenteditable='true']",
        )
      ) {
        return;
      }

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          Carousel.navigate(1);
          return;
        case "ArrowLeft":
          event.preventDefault();
          Carousel.navigate(-1);
          return;
        case " ":
          event.preventDefault();
          Carousel.togglePause();
          return;
      }
    },

    handleResize() {
      window.clearTimeout(this.resizeTimer);
      const request = ++this.resizeRequest;
      this.resizeTimer = window.setTimeout(async () => {
        this.resizeTimer = null;
        const photoIndex = ImageHandler.currentPhotoIndex;
        const currentPhoto = ImageHandler.photos[photoIndex];
        if (!currentPhoto) return;

        const imageUrl = ImageHandler.getBestImageUrl(currentPhoto);
        if (!imageUrl) return;
        const absoluteImageUrl = new URL(imageUrl, document.baseURI).href;
        if (absoluteImageUrl === UI.elements.slideImg.src) return;

        try {
          const loadedImage = await ImageHandler.preloadImage(photoIndex);
          if (
            request === this.resizeRequest &&
            photoIndex === ImageHandler.currentPhotoIndex &&
            loadedImage
          ) {
            UI.setSlideSource(UI.elements.slideImg, loadedImage.src);
          }
        } catch (error) {
          console.error("Carousel: Resize image update failed", error);
        }
      }, 180);
    },
  };

  async function init() {
    UI.showLoading();
    document.documentElement.style.setProperty(
      "--progress-duration",
      `${Config.interval}ms`,
    );
    URLParamsHandler.init();
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      Carousel.pause(PauseReason.reducedMotion);
    }
    UI.setSoundMuted(true);
    EventHandlers.setupEventListeners();

    try {
      const hasPhotos = await ImageHandler.initializePhotos();
      if (!hasPhotos) throw new Error("No photos available to display");

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
