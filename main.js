/**
 * NOCTIS — High-Performance Scrollytelling Engine
 * Pure Vanilla JavaScript.
 * Built for 60fps online deployment with HTTP/2 concurrent frame streaming,
 * keyframe stride preloading, on-demand priority buffering, zero layout thrashing,
 * custom headlight cursor, film grain overlay, and responsive accordion.
 */

(function () {
  'use strict';

  const cfg = window.NOCTIS_CONFIG || {};

  // Check user motion and pointer preferences
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;

  // DOM Elements
  const preloaderEl = document.getElementById('preloader');
  const preloaderBarEl = document.getElementById('preloader-bar');
  const preloaderCounterEl = document.getElementById('preloader-counter');

  const siteNavEl = document.getElementById('site-nav');
  const grainCanvas = document.getElementById('film-grain');

  const cursorEl = document.getElementById('headlight-cursor');
  const cursorLabelEl = document.getElementById('headlight-label');

  // Hero section elements
  const heroSection = document.getElementById('hero');
  const heroStage = document.getElementById('hero-stage');
  const heroCanvas = document.getElementById('hero-canvas');
  const heroProgressLine = document.getElementById('hero-progress-line');
  const hudChapterEl = document.getElementById('hud-chapter');
  const hudSpeedEl = document.getElementById('hud-speed');
  const hudDistanceEl = document.getElementById('hud-distance');
  const heroChapters = [
    document.getElementById('hero-chap-0'),
    document.getElementById('hero-chap-1'),
    document.getElementById('hero-chap-2'),
    document.getElementById('hero-chap-3')
  ];

  // Statement section
  const statementSection = document.getElementById('statement');
  const statementHeadline = document.getElementById('statement-headline');

  // Dismantle section elements
  const dismantleSection = document.getElementById('dismantle');
  const dismantleStage = document.getElementById('dismantle-stage');
  const dismantleCanvas = document.getElementById('dismantle-canvas');
  const dismantleProgressLine = document.getElementById('dismantle-progress-line');
  const dismantleCalloutsContainer = document.getElementById('dismantle-callouts');

  // Lineup section elements
  const lineupSection = document.getElementById('lineup');
  const lineupSlides = Array.from(document.querySelectorAll('.accordion-slide'));

  // Canvas contexts
  const heroCtx = heroCanvas ? heroCanvas.getContext('2d', { alpha: false, desynchronized: true }) : null;
  const dismantleCtx = dismantleCanvas ? dismantleCanvas.getContext('2d', { alpha: false, desynchronized: true }) : null;
  const grainCtx = grainCanvas ? grainCanvas.getContext('2d') : null;

  // Frame Cache & Concurrency Control
  const heroImages = [];
  const dismantleImages = [];
  const heroInFlight = new Set();
  const dismantleInFlight = new Set();
  let isMobileViewport = window.innerWidth < (cfg.breakpoints?.mobile || 768);

  // Cached viewport & canvas dimensions (prevents layout thrashing on every RAF)
  let stageWidth = window.innerWidth;
  let stageHeight = window.innerHeight;
  let heroSectionHeight = 0;
  let dismantleSectionHeight = 0;

  // Scrollytelling state
  const state = {
    hero: {
      targetProgress: 0,
      currentProgress: 0,
      targetFrame: 0,
      currentFrame: 0,
      lastDrawnFrame: -1,
      totalFrames: cfg.frames?.hero?.count || 600,
      fullyLoaded: false,
      inView: true
    },
    dismantle: {
      targetProgress: 0,
      currentProgress: 0,
      targetFrame: 0,
      currentFrame: 0,
      lastDrawnFrame: -1,
      totalFrames: cfg.frames?.dismantle?.count || 200,
      fullyLoaded: false,
      inView: false
    },
    cursor: {
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      currentX: window.innerWidth / 2,
      currentY: window.innerHeight / 2,
      isHovering: false,
      label: ''
    },
    nav: {
      lastScrollY: 0,
      hidden: false
    }
  };

  // Clamp helper
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // Linear interpolation
  function lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  /* ========================================================================
     1. HIGH-SPEED CONCURRENT PRELOADER & ADAPTIVE FRAME BUFFER
     Loads keyframes across full timeline with 10 concurrent streams.
     On scroll, priority window loads surrounding frames immediately.
     ======================================================================== */
  function getFramePath(category, index1Based, mobile) {
    const pad = String(index1Based).padStart(4, '0');
    const dir = mobile
      ? cfg.frames[category].mobileDir
      : cfg.frames[category].desktopDir;
    return `${dir}/frame_${pad}.webp`;
  }

  function preloadSingleFrame(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      if (img.decode) {
        img.decode()
          .then(() => resolve(img))
          .catch(() => {
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img);
          });
      } else {
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
      }
    });
  }

  function loadSingleFrame(category, index0Based) {
    const arr = category === 'hero' ? heroImages : dismantleImages;
    const inFlight = category === 'hero' ? heroInFlight : dismantleInFlight;

    if (arr[index0Based] && arr[index0Based].complete && arr[index0Based].naturalWidth > 0) {
      return Promise.resolve(arr[index0Based]);
    }
    if (inFlight.has(index0Based)) {
      return Promise.resolve(null);
    }
    inFlight.add(index0Based);

    const src = getFramePath(category, index0Based + 1, isMobileViewport);
    return preloadSingleFrame(src)
      .then((img) => {
        arr[index0Based] = img;
        inFlight.delete(index0Based);
        return img;
      })
      .catch(() => {
        inFlight.delete(index0Based);
        return null;
      });
  }

  // Priority window loading: immediately fetches target frame and its neighbors
  function prioritizeFrames(category, targetIndex0Based, radius = 6) {
    const total = category === 'hero' ? state.hero.totalFrames : state.dismantle.totalFrames;
    for (let r = 0; r <= radius; r++) {
      const forward = targetIndex0Based + r;
      const backward = targetIndex0Based - r;
      if (forward < total) loadSingleFrame(category, forward);
      if (backward >= 0) loadSingleFrame(category, backward);
    }
  }

  // Concurrent queue runner for batching
  async function runConcurrentQueue(category, indices, concurrency = 10, onProgress = null) {
    let cursor = 0;
    let completed = 0;
    const total = indices.length;

    async function worker() {
      while (cursor < indices.length) {
        const idx = indices[cursor++];
        await loadSingleFrame(category, idx);
        completed++;
        if (onProgress) onProgress(completed, total);
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, indices.length) }, () => worker());
    await Promise.all(workers);
  }

  async function initPreloaderAndFrames() {
    const heroCount = state.hero.totalFrames;
    const dismantleCount = state.dismantle.totalFrames;

    // Allocate array slots
    heroImages.length = heroCount;
    dismantleImages.length = dismantleCount;

    // Phase 1: Load initial intro batch (0..24) AND keyframes every 6th frame across all 600 frames
    // This guarantees full scrubbing across 0% to 100% within ~1.5 seconds!
    const keyframeIndices = new Set();
    for (let i = 0; i < 25; i++) keyframeIndices.add(i);
    for (let i = 0; i < heroCount; i += 6) keyframeIndices.add(i);
    keyframeIndices.add(heroCount - 1);

    const phase1Array = Array.from(keyframeIndices);
    let loadedInitial = 0;
    const totalInitial = phase1Array.length;

    await runConcurrentQueue('hero', phase1Array, 10, (done, total) => {
      loadedInitial = done;
      const pct = Math.min(100, Math.round((done / total) * 100));
      if (preloaderBarEl) preloaderBarEl.style.transform = `translateX(-50%) scaleX(${pct / 100})`;
      if (preloaderCounterEl) preloaderCounterEl.textContent = String(pct).padStart(3, '0') + '%';
    });

    // Reveal page immediately with initial keyframe coverage
    if (preloaderBarEl) preloaderBarEl.classList.add('flash');
    setTimeout(() => {
      if (preloaderEl) preloaderEl.classList.add('fade-out');
      drawHeroFrame(0);
      drawDismantleFrame(0);
    }, 200);

    // Phase 2: In background, concurrently fill all remaining intermediate hero frames
    const remainingHeroIndices = [];
    for (let i = 0; i < heroCount; i++) {
      if (!keyframeIndices.has(i)) remainingHeroIndices.push(i);
    }
    runConcurrentQueue('hero', remainingHeroIndices, 10).then(() => {
      state.hero.fullyLoaded = true;
    });

    // Phase 3: Concurrently load dismantle keyframes (every 5th frame), then intermediate frames
    const dismantleKeys = [];
    const dismantleRemaining = [];
    for (let i = 0; i < dismantleCount; i++) {
      if (i % 5 === 0 || i === 0 || i === dismantleCount - 1) {
        dismantleKeys.push(i);
      } else {
        dismantleRemaining.push(i);
      }
    }
    runConcurrentQueue('dismantle', dismantleKeys, 8).then(() => {
      runConcurrentQueue('dismantle', dismantleRemaining, 8).then(() => {
        state.dismantle.fullyLoaded = true;
      });
    });
  }

  // Fallback to nearest loaded frame to guarantee zero stutter
  function getNearestLoadedFrame(framesArray, targetIdx, total) {
    if (framesArray[targetIdx] && framesArray[targetIdx].complete && framesArray[targetIdx].naturalWidth > 0) {
      return framesArray[targetIdx];
    }
    for (let offset = 1; offset < total; offset++) {
      const down = targetIdx - offset;
      if (down >= 0 && framesArray[down] && framesArray[down].complete && framesArray[down].naturalWidth > 0) {
        return framesArray[down];
      }
      const up = targetIdx + offset;
      if (up < total && framesArray[up] && framesArray[up].complete && framesArray[up].naturalWidth > 0) {
        return framesArray[up];
      }
    }
    return null;
  }

  /* ========================================================================
     2. CANVAS DRAWING (ZERO LAYOUT THRASHING)
     Canvas dimensions & DPR cached on resize.
     ======================================================================== */
  function updateCanvasDimensions() {
    stageWidth = window.innerWidth;
    stageHeight = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (heroSection) heroSectionHeight = heroSection.offsetHeight;
    if (dismantleSection) dismantleSectionHeight = dismantleSection.offsetHeight;

    if (heroCanvas) {
      heroCanvas.width = Math.round(stageWidth * dpr);
      heroCanvas.height = Math.round(stageHeight * dpr);
      if (heroCtx) {
        heroCtx.setTransform(1, 0, 0, 1, 0, 0);
        heroCtx.scale(dpr, dpr);
      }
    }

    if (dismantleCanvas) {
      dismantleCanvas.width = Math.round(stageWidth * dpr);
      dismantleCanvas.height = Math.round(stageHeight * dpr);
      if (dismantleCtx) {
        dismantleCtx.setTransform(1, 0, 0, 1, 0, 0);
        dismantleCtx.scale(dpr, dpr);
      }
    }
  }

  function drawCanvasImage(ctx, img, fadeToBlackProgress) {
    if (!ctx || !img || !img.complete || img.naturalWidth === 0) return;

    const w = stageWidth;
    const h = stageHeight;

    // Clear with flat solid asphalt background
    ctx.fillStyle = '#07080A';
    ctx.fillRect(0, 0, w, h);

    const isPortrait = w < h;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    let scale, dx, dy;
    if (isPortrait) {
      // Contain-fit vertically centered on asphalt
      scale = Math.min(w / nw, h / nh);
      const dw = nw * scale;
      const dh = nh * scale;
      dx = (w - dw) * 0.5;
      dy = (h - dh) * 0.5;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      // Cover-fit
      scale = Math.max(w / nw, h / nh);
      const dw = nw * scale;
      const dh = nh * scale;
      dx = (w - dw) * 0.5;
      dy = (h - dh) * 0.5;
      ctx.drawImage(img, dx, dy, dw, dh);
    }

    // Hero fade to solid black over the last 5% of scroll (0.95 -> 1.0)
    if (fadeToBlackProgress > 0) {
      ctx.fillStyle = '#07080A';
      ctx.globalAlpha = clamp(fadeToBlackProgress, 0, 1);
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1.0;
    }
  }

  function drawHeroFrame(frameIndex) {
    const frame = getNearestLoadedFrame(heroImages, frameIndex, state.hero.totalFrames);
    const fadeStart = cfg.hero?.fadeToBlackStart || 0.95;
    const fadeProgress = state.hero.currentProgress >= fadeStart
      ? (state.hero.currentProgress - fadeStart) / (1 - fadeStart)
      : 0;
    drawCanvasImage(heroCtx, frame, fadeProgress);
  }

  function drawDismantleFrame(frameIndex) {
    const frame = getNearestLoadedFrame(dismantleImages, frameIndex, state.dismantle.totalFrames);
    drawCanvasImage(dismantleCtx, frame, 0);
  }

  /* ========================================================================
     3. FILM GRAIN OVERLAY
     Offscreen noise tile randomly translated ~8x/s, 3.5% opacity, no vignette.
     ======================================================================== */
  function initFilmGrain() {
    if (!grainCanvas || !grainCtx) return;

    const tileSize = 128;
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tileSize;
    tileCanvas.height = tileSize;
    const tileCtx = tileCanvas.getContext('2d');
    const imgData = tileCtx.createImageData(tileSize, tileSize);
    const buffer = new Uint32Array(imgData.data.buffer);

    for (let i = 0; i < buffer.length; i++) {
      const val = Math.random() < 0.5 ? 0 : 255;
      buffer[i] = (255 << 24) | (val << 16) | (val << 8) | val;
    }
    tileCtx.putImageData(imgData, 0, 0);

    function resizeGrain() {
      grainCanvas.width = window.innerWidth;
      grainCanvas.height = window.innerHeight;
    }
    resizeGrain();
    window.addEventListener('resize', resizeGrain);

    // Shift pattern ~8 times per second (every 125ms)
    setInterval(() => {
      grainCtx.clearRect(0, 0, grainCanvas.width, grainCanvas.height);
      const pattern = grainCtx.createPattern(tileCanvas, 'repeat');
      if (pattern) {
        grainCtx.save();
        const offsetX = Math.floor(Math.random() * tileSize);
        const offsetY = Math.floor(Math.random() * tileSize);
        grainCtx.translate(offsetX, offsetY);
        grainCtx.fillStyle = pattern;
        grainCtx.fillRect(-offsetX, -offsetY, grainCanvas.width + tileSize, grainCanvas.height + tileSize);
        grainCtx.restore();
      }
    }, 125);
  }

  /* ========================================================================
     4. CUSTOM CURSOR ("THE HEADLIGHT")
     6px dot inside 28px 1px ring. Morphs to 44x2px bar over interactives.
     ======================================================================== */
  function initCustomCursor() {
    if (!cursorEl || !isFinePointer || prefersReducedMotion) return;

    window.addEventListener('mousemove', (e) => {
      state.cursor.targetX = e.clientX;
      state.cursor.targetY = e.clientY;
    });

    window.addEventListener('mousedown', () => {
      cursorEl.classList.add('is-down');
      setTimeout(() => {
        cursorEl.classList.remove('is-down');
      }, 120);
    });

    const interactiveSelector = 'a, button, [role="button"], input, .accordion-slide, .swatch-box';
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest(interactiveSelector);
      if (target) {
        state.cursor.isHovering = true;
        cursorEl.classList.add('is-hovering');

        let label = target.getAttribute('data-cursor-label');
        if (!label) {
          if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('#')) {
            label = 'VIEW';
          } else if (target.classList.contains('accordion-slide')) {
            label = target.getAttribute('aria-expanded') === 'true' ? 'CONFIGURE' : 'OPEN';
          } else {
            label = 'VIEW';
          }
        }
        if (cursorLabelEl) cursorLabelEl.textContent = label;
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest(interactiveSelector);
      if (target) {
        state.cursor.isHovering = false;
        cursorEl.classList.remove('is-hovering');
        if (cursorLabelEl) cursorLabelEl.textContent = '';
      }
    });
  }

  /* ========================================================================
     5. NAVIGATION SHOW/HIDE ON SCROLL
     ======================================================================== */
  function updateNav() {
    if (!siteNavEl) return;
    const currentY = window.scrollY;
    const diff = currentY - state.nav.lastScrollY;

    if (currentY <= 60) {
      siteNavEl.classList.remove('nav-hidden');
    } else if (diff > 8 && currentY > 100) {
      siteNavEl.classList.add('nav-hidden');
    } else if (diff < -8) {
      siteNavEl.classList.remove('nav-hidden');
    }
    state.nav.lastScrollY = currentY;
  }

  /* ========================================================================
     6. SECTION 2 — STATEMENT WORD-BY-WORD REVEAL
     ======================================================================== */
  let statementWords = [];

  function initStatementSection() {
    if (!statementHeadline) return;
    const text = cfg.statement?.text || statementHeadline.textContent.trim();
    statementHeadline.innerHTML = '';

    const words = text.split(/\s+/);
    statementWords = words.map((word) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = word;
      statementHeadline.appendChild(span);
      return span;
    });
  }

  function updateStatementSection() {
    if (!statementSection || statementWords.length === 0) return;

    const rect = statementSection.getBoundingClientRect();
    const vh = stageHeight;

    const enterY = vh * 0.85;
    const fullY = vh * 0.35;
    const progress = clamp((enterY - rect.top) / (enterY - fullY), 0, 1);

    const totalWords = statementWords.length;
    statementWords.forEach((wordSpan, idx) => {
      const wordStart = idx / totalWords;
      const wordEnd = (idx + 1) / totalWords;
      const wordProgress = clamp((progress - wordStart) / (wordEnd - wordStart), 0, 1);
      const opacity = 0.15 + (1 - 0.15) * wordProgress;
      wordSpan.style.opacity = opacity.toFixed(2);
    });
  }

  /* ========================================================================
     7. SECTION 3 — DISMANTLE CALLOUTS
     ======================================================================== */
  function initDismantleCallouts() {
    if (!dismantleCalloutsContainer) return;
    dismantleCalloutsContainer.innerHTML = '';

    const callouts = cfg.dismantle?.callouts || [];
    callouts.forEach((co) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'callout-item';
      itemEl.id = `co-${co.id}`;

      const dot = document.createElement('div');
      dot.className = 'callout-dot';
      dot.style.left = `${co.dotX}%`;
      dot.style.top = `${co.dotY}%`;

      const card = document.createElement('div');
      card.className = 'callout-card';
      card.style.left = `${co.cardX}%`;
      card.style.top = `${co.cardY}%`;
      card.innerHTML = `
        <div class="callout-code">${co.code}</div>
        <div class="callout-name">${co.name}</div>
      `;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'callout-line-svg');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      path.setAttribute('class', 'callout-line-path');
      svg.appendChild(path);

      itemEl.appendChild(svg);
      itemEl.appendChild(dot);
      itemEl.appendChild(card);
      dismantleCalloutsContainer.appendChild(itemEl);
    });

    updateDismantleCalloutLines();
  }

  function updateDismantleCalloutLines() {
    if (!dismantleCalloutsContainer) return;
    const callouts = cfg.dismantle?.callouts || [];
    callouts.forEach((co) => {
      const itemEl = document.getElementById(`co-${co.id}`);
      if (!itemEl) return;

      const line = itemEl.querySelector('.callout-line-path');
      if (!line) return;

      const dotX = (co.dotX / 100) * stageWidth;
      const dotY = (co.dotY / 100) * stageHeight;
      const cardX = (co.cardX / 100) * stageWidth;
      const cardY = (co.cardY / 100) * stageHeight;

      line.setAttribute('x1', dotX);
      line.setAttribute('y1', dotY);
      line.setAttribute('x2', cardX);
      line.setAttribute('y2', cardY);
    });
  }

  function updateDismantleCalloutsState(progress) {
    const callouts = cfg.dismantle?.callouts || [];
    callouts.forEach((co) => {
      const itemEl = document.getElementById(`co-${co.id}`);
      if (!itemEl) return;

      if (progress >= co.appearProgress) {
        itemEl.classList.add('active');
      } else {
        itemEl.classList.remove('active');
      }
    });
  }

  /* ========================================================================
     8. SECTION 4 — LINEUP ACCORDION
     ======================================================================== */
  let lineupHoverTimer = null;
  let activeSlideIndex = cfg.lineup?.defaultOpenIndex || 0;

  function setOpenSlide(index) {
    activeSlideIndex = index;
    lineupSlides.forEach((slide, i) => {
      const isOpen = i === index;
      slide.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      slide.setAttribute('data-cursor-label', isOpen ? 'CONFIGURE' : 'OPEN');
      if (isOpen && state.cursor.isHovering && cursorLabelEl) {
        cursorLabelEl.textContent = 'CONFIGURE';
      }
    });
  }

  function initLineupAccordion() {
    if (!lineupSlides.length) return;

    lineupSlides.forEach((slide, idx) => {
      slide.addEventListener('mouseenter', () => {
        if (window.innerWidth < 768) return;
        clearTimeout(lineupHoverTimer);
        lineupHoverTimer = setTimeout(() => {
          setOpenSlide(idx);
        }, cfg.motion?.hoverDebounceMs || 80);
      });

      slide.addEventListener('mouseleave', () => {
        clearTimeout(lineupHoverTimer);
      });

      slide.addEventListener('click', () => {
        setOpenSlide(idx);
      });

      slide.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const next = (activeSlideIndex + 1) % lineupSlides.length;
          setOpenSlide(next);
          lineupSlides[next].focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = (activeSlideIndex - 1 + lineupSlides.length) % lineupSlides.length;
          setOpenSlide(prev);
          lineupSlides[prev].focus();
        }
      });
    });

    const swatches = document.querySelectorAll('.swatch-box');
    swatches.forEach((sw) => {
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        const parentRow = sw.closest('.swatches-row');
        if (parentRow) {
          parentRow.querySelectorAll('.swatch-box').forEach((s) => s.classList.remove('active'));
          sw.classList.add('active');
        }
      });
    });

    const lineupObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          lineupSlides.forEach((slide, i) => {
            setTimeout(() => {
              slide.style.opacity = '1';
              slide.style.transform = 'translateY(0)';
            }, i * 80);
          });
          lineupObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    if (lineupSection) {
      lineupSlides.forEach((slide) => {
        slide.style.opacity = '0';
        slide.style.transform = 'translateY(40px)';
      });
      lineupObserver.observe(lineupSection);
    }
  }

  /* ========================================================================
     9. SCROLL PROGRESS COMPUTATION & ON-DEMAND PRIORITY BUFFERING
     ======================================================================== */
  function updateScrollProgress() {
    const vh = stageHeight;

    // 1. Hero Pinned Scrollytelling
    if (heroSection) {
      const rect = heroSection.getBoundingClientRect();
      state.hero.inView = rect.bottom > 0 && rect.top < vh;

      const scrollableDist = heroSectionHeight - vh;
      const heroProg = scrollableDist > 0 ? clamp(-rect.top / scrollableDist, 0, 1) : 0;
      state.hero.targetProgress = heroProg;
      const targetFrame = Math.round(heroProg * (state.hero.totalFrames - 1));
      state.hero.targetFrame = targetFrame;

      // On-demand priority buffer around target frame
      if (state.hero.inView) {
        prioritizeFrames('hero', targetFrame, 8);
      }

      if (heroProgressLine) {
        heroProgressLine.style.transform = `scaleX(${heroProg})`;
      }

      updateHeroHUD(heroProg);
      updateHeroChapters(heroProg);
    }

    // 2. Statement Section
    updateStatementSection();

    // 3. Dismantle Pinned Scrollytelling
    if (dismantleSection) {
      const rect = dismantleSection.getBoundingClientRect();
      state.dismantle.inView = rect.bottom > 0 && rect.top < vh;

      const scrollableDist = dismantleSectionHeight - vh;
      const dismantleProg = scrollableDist > 0 ? clamp(-rect.top / scrollableDist, 0, 1) : 0;
      state.dismantle.targetProgress = dismantleProg;
      const targetFrame = Math.round(dismantleProg * (state.dismantle.totalFrames - 1));
      state.dismantle.targetFrame = targetFrame;

      // On-demand priority buffer around target frame
      if (state.dismantle.inView) {
        prioritizeFrames('dismantle', targetFrame, 8);
      }

      if (dismantleProgressLine) {
        dismantleProgressLine.style.transform = `scaleX(${dismantleProg})`;
      }

      updateDismantleCalloutsState(dismantleProg);

      if (prefersReducedMotion) {
        drawDismantleFrame(dismantleProg > 0.5 ? state.dismantle.totalFrames - 1 : 0);
      }
    }

    // 4. Site Nav
    updateNav();
  }

  function updateHeroHUD(progress) {
    if (!hudChapterEl || !hudSpeedEl || !hudDistanceEl) return;

    let chapterText = '01 / 04';
    if (progress >= 0.80) {
      chapterText = '04 / 04';
    } else if (progress >= 0.50) {
      chapterText = '03 / 04';
    } else if (progress >= 0.22) {
      chapterText = '02 / 04';
    }
    hudChapterEl.textContent = chapterText;

    const maxSpeed = cfg.hero?.hud?.speedMax || 118;
    const speed = Math.round(progress * maxSpeed);
    hudSpeedEl.textContent = String(speed).padStart(3, '0') + ' KM/H';

    const maxDist = cfg.hero?.hud?.distanceMax || 4.2;
    const distance = (progress * maxDist).toFixed(1);
    hudDistanceEl.textContent = distance + ' KM';
  }

  function updateHeroChapters(progress) {
    const chaptersConfig = cfg.hero?.chapters || [];

    chaptersConfig.forEach((ch, idx) => {
      const el = heroChapters[idx];
      if (!el) return;

      const isActive = progress >= ch.start && progress <= ch.end;
      if (isActive) {
        el.classList.add('active');
        const lines = el.querySelectorAll('.line-inner');
        lines.forEach((line) => line.classList.add('line-revealed'));
        if (prefersReducedMotion) {
          const staticIndices = [
            0,
            Math.round(state.hero.totalFrames * 0.35),
            Math.round(state.hero.totalFrames * 0.65),
            state.hero.totalFrames - 1
          ];
          drawHeroFrame(staticIndices[idx]);
        }
      } else {
        el.classList.remove('active');
      }
    });
  }

  /* ========================================================================
     10. MAIN RAF ANIMATION LOOP (60 FPS SMOOTH)
     ======================================================================== */
  function renderLoop() {
    // 1. Headlight Cursor Lerp
    if (cursorEl && isFinePointer && !prefersReducedMotion) {
      const cLerp = cfg.motion?.cursorLerp || 0.18;
      state.cursor.currentX = lerp(state.cursor.currentX, state.cursor.targetX, cLerp);
      state.cursor.currentY = lerp(state.cursor.currentY, state.cursor.targetY, cLerp);
      cursorEl.style.transform = `translate3d(${state.cursor.currentX}px, ${state.cursor.currentY}px, 0) translate(-50%, -50%)`;
    }

    if (!prefersReducedMotion) {
      const sLerp = cfg.motion?.canvasScrubLerp || 0.15;

      // 2. Hero Scrubbing (Culled if offscreen)
      if (state.hero.inView) {
        state.hero.currentProgress = lerp(state.hero.currentProgress, state.hero.targetProgress, sLerp);
        state.hero.currentFrame = lerp(state.hero.currentFrame, state.hero.targetFrame, sLerp);
        const roundedHero = Math.round(state.hero.currentFrame);
        if (roundedHero !== state.hero.lastDrawnFrame || state.hero.currentProgress >= (cfg.hero?.fadeToBlackStart || 0.95)) {
          drawHeroFrame(roundedHero);
          state.hero.lastDrawnFrame = roundedHero;
        }
      }

      // 3. Dismantle Scrubbing (Culled if offscreen)
      if (state.dismantle.inView) {
        state.dismantle.currentProgress = lerp(state.dismantle.currentProgress, state.dismantle.targetProgress, sLerp);
        state.dismantle.currentFrame = lerp(state.dismantle.currentFrame, state.dismantle.targetFrame, sLerp);
        const roundedDismantle = Math.round(state.dismantle.currentFrame);
        if (roundedDismantle !== state.dismantle.lastDrawnFrame) {
          drawDismantleFrame(roundedDismantle);
          state.dismantle.lastDrawnFrame = roundedDismantle;
        }
      }
    }

    requestAnimationFrame(renderLoop);
  }

  /* ========================================================================
     11. WINDOW EVENTS & INITIALIZATION
     ======================================================================== */
  function handleResize() {
    const wasMobile = isMobileViewport;
    isMobileViewport = window.innerWidth < (cfg.breakpoints?.mobile || 768);

    updateCanvasDimensions();
    updateDismantleCalloutLines();
    updateScrollProgress();

    if (wasMobile !== isMobileViewport) {
      drawHeroFrame(state.hero.lastDrawnFrame >= 0 ? state.hero.lastDrawnFrame : 0);
      drawDismantleFrame(state.dismantle.lastDrawnFrame >= 0 ? state.dismantle.lastDrawnFrame : 0);
    }
  }

  // Apply configured section heights from config.js
  if (heroSection && cfg.hero?.wrapperHeight) {
    heroSection.style.height = cfg.hero.wrapperHeight;
  }
  if (dismantleSection && cfg.dismantle?.wrapperHeight) {
    dismantleSection.style.height = cfg.dismantle.wrapperHeight;
  }

  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', handleResize, { passive: true });

  // Initialize
  updateCanvasDimensions();
  initFilmGrain();
  initCustomCursor();
  initStatementSection();
  initDismantleCallouts();
  initLineupAccordion();
  initPreloaderAndFrames();

  // Initial scroll calculation
  updateScrollProgress();

  // Start RAF loop
  requestAnimationFrame(renderLoop);

})();
