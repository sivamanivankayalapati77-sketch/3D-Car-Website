/**
 * NOCTIS — Main Engine
 * Vanilla JavaScript implementation for high-precision scrollytelling.
 * Handles canvas frame scrubbing, headlight cursor, film grain,
 * word-by-word statement reveal, dismantle callouts, and lineup accordion.
 */

(function () {
  'use strict';

  const cfg = window.NOCTIS_CONFIG || {};

  // Check user motion preferences
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
  const heroCtx = heroCanvas ? heroCanvas.getContext('2d', { alpha: false }) : null;
  const dismantleCtx = dismantleCanvas ? dismantleCanvas.getContext('2d', { alpha: false }) : null;
  const grainCtx = grainCanvas ? grainCanvas.getContext('2d') : null;

  // Frame Cache
  const heroImages = [];
  const dismantleImages = [];
  let isMobileViewport = window.innerWidth < (cfg.breakpoints?.mobile || 768);

  // Scrollytelling state
  const state = {
    hero: {
      targetProgress: 0,
      currentProgress: 0,
      targetFrame: 0,
      currentFrame: 0,
      lastDrawnFrame: -1,
      totalFrames: cfg.frames?.hero?.count || 600,
      initialLoadedCount: 0,
      fullyLoaded: false
    },
    dismantle: {
      targetProgress: 0,
      currentProgress: 0,
      targetFrame: 0,
      currentFrame: 0,
      lastDrawnFrame: -1,
      totalFrames: cfg.frames?.dismantle?.count || 200,
      initialLoadedCount: 0,
      fullyLoaded: false
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
     1. PRELOADER & FRAME LOADING
     Load hero frames 1–40 first, reveal page, then load remaining in background.
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

  async function initPreloaderAndFrames() {
    const initialBatchSize = cfg.preloader?.heroInitialBatch || 40;
    const heroCount = state.hero.totalFrames;
    let initialCount = 0;

    // Allocate array slots
    heroImages.length = heroCount;
    dismantleImages.length = state.dismantle.totalFrames;

    // Load initial 40 hero frames with smooth progress counter
    const initialPromises = [];
    for (let i = 1; i <= initialBatchSize; i++) {
      const p = preloadSingleFrame(getFramePath('hero', i, isMobileViewport)).then((img) => {
        heroImages[i - 1] = img;
        initialCount++;
        const pct = Math.min(100, Math.round((initialCount / initialBatchSize) * 100));
        if (preloaderBarEl) preloaderBarEl.style.transform = `translateX(-50%) scaleX(${pct / 100})`;
        if (preloaderCounterEl) preloaderCounterEl.textContent = String(pct).padStart(3, '0') + '%';
      });
      initialPromises.push(p);
    }

    await Promise.all(initialPromises);

    // Initial batch loaded: Flash preloader bar and fade out
    if (preloaderBarEl) preloaderBarEl.classList.add('flash');
    setTimeout(() => {
      if (preloaderEl) preloaderEl.classList.add('fade-out');
      // Draw first frame immediately
      drawHeroFrame(0);
      drawDismantleFrame(0);
    }, 250);

    // Continue loading remaining hero frames sequentially in background
    loadRemainingHeroFrames(initialBatchSize + 1);

    // Then load dismantle frames
    loadDismantleFrames();
  }

  async function loadRemainingHeroFrames(startIndex) {
    const total = state.hero.totalFrames;
    for (let i = startIndex; i <= total; i++) {
      const img = await preloadSingleFrame(getFramePath('hero', i, isMobileViewport));
      heroImages[i - 1] = img;
    }
    state.hero.fullyLoaded = true;
  }

  async function loadDismantleFrames() {
    const total = state.dismantle.totalFrames;
    for (let i = 1; i <= total; i++) {
      const img = await preloadSingleFrame(getFramePath('dismantle', i, isMobileViewport));
      dismantleImages[i - 1] = img;
    }
    state.dismantle.fullyLoaded = true;
  }

  // Fallback to nearest loaded frame to ensure zero stutter
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
     2. CANVAS DRAWING (COVER ON LANDSCAPE, CONTAIN ON PORTRAIT)
     Scale by devicePixelRatio (cap at 2). Centered on --asphalt (#07080A).
     ======================================================================== */
  function drawCanvasImage(ctx, canvas, img, fadeToBlackProgress) {
    if (!ctx || !canvas || !img) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    // Clear with flat solid asphalt background
    ctx.fillStyle = '#07080A';
    ctx.fillRect(0, 0, w, h);

    const isPortrait = w < h;
    const nw = img.naturalWidth || 1600;
    const nh = img.naturalHeight || 900;

    let scale, dx, dy;
    if (isPortrait) {
      // Contain-fit vertically centered
      scale = Math.min(w / nw, h / nh);
      const dw = nw * scale;
      const dh = nh * scale;
      dx = (w - dw) / 2;
      dy = (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      // Cover-fit
      scale = Math.max(w / nw, h / nh);
      const dw = nw * scale;
      const dh = nh * scale;
      dx = (w - dw) / 2;
      dy = (h - dh) / 2;
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
    drawCanvasImage(heroCtx, heroCanvas, frame, fadeProgress);
  }

  function drawDismantleFrame(frameIndex) {
    const frame = getNearestLoadedFrame(dismantleImages, frameIndex, state.dismantle.totalFrames);
    drawCanvasImage(dismantleCtx, dismantleCanvas, frame, 0);
  }

  /* ========================================================================
     3. FILM GRAIN OVERLAY
     Small noise tile generated once offscreen, randomly shifted 8x/s, 3.5% opacity.
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

    // Mousedown flash (120ms brighter)
    window.addEventListener('mousedown', () => {
      cursorEl.classList.add('is-down');
      setTimeout(() => {
        cursorEl.classList.remove('is-down');
      }, 120);
    });

    // Interactive element hover detection
    const interactiveSelector = 'a, button, [role="button"], input, .accordion-slide, .swatch-box';
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest(interactiveSelector);
      if (target) {
        state.cursor.isHovering = true;
        cursorEl.classList.add('is-hovering');

        // Determine context label
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
     Hides on scroll down, shows on scroll up.
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
     Sentence spans 15% to 100% opacity driven by viewport scroll.
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
    const vh = window.innerHeight;

    // Active range: begins when top enters at 80% vh, ends when center reaches 40% vh
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
     Four callouts (BODY, DRIVE, LIGHT, BATTERY) with SVG hairline connecting lines.
     ======================================================================== */
  function initDismantleCallouts() {
    if (!dismantleCalloutsContainer) return;
    dismantleCalloutsContainer.innerHTML = '';

    const callouts = cfg.dismantle?.callouts || [];
    callouts.forEach((co) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'callout-item';
      itemEl.id = `co-${co.id}`;

      // Dot on the part
      const dot = document.createElement('div');
      dot.className = 'callout-dot';
      dot.style.left = `${co.dotX}%`;
      dot.style.top = `${co.dotY}%`;

      // Text card
      const card = document.createElement('div');
      card.className = 'callout-card';
      card.style.left = `${co.cardX}%`;
      card.style.top = `${co.cardY}%`;
      card.innerHTML = `
        <div class="callout-code">${co.code}</div>
        <div class="callout-name">${co.name}</div>
      `;

      // SVG connecting line
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
    const stageRect = dismantleStage ? dismantleStage.getBoundingClientRect() : null;
    if (!stageRect) return;

    const callouts = cfg.dismantle?.callouts || [];
    callouts.forEach((co) => {
      const itemEl = document.getElementById(`co-${co.id}`);
      if (!itemEl) return;

      const line = itemEl.querySelector('.callout-line-path');
      if (!line) return;

      const dotX = (co.dotX / 100) * stageRect.width;
      const dotY = (co.dotY / 100) * stageRect.height;
      const cardX = (co.cardX / 100) * stageRect.width;
      const cardY = (co.cardY / 100) * stageRect.height;

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
     5 vertical slides across full width. GT-E open by default.
     Debounced hover (80ms), keyboard accessibility, color swatches.
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

    // Hover debounce for desktop
    lineupSlides.forEach((slide, idx) => {
      slide.addEventListener('mouseenter', () => {
        if (window.innerWidth < 768) return; // Touch row stack handled by click
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

      // Keyboard arrow navigation
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

    // Swatch box selection
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

    // Reveal animation when lineup enters viewport
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
     9. SCROLL PROGRESS COMPUTATION
     progress = clamp(-wrapper.getBoundingClientRect().top / (wrapper.offsetHeight - innerHeight), 0, 1)
     targetFrame = round(progress * (frameCount - 1))
     ======================================================================== */
  function updateScrollProgress() {
    const vh = window.innerHeight;

    // 1. Hero Pinned Scrollytelling
    if (heroSection) {
      const rect = heroSection.getBoundingClientRect();
      const scrollableDist = heroSection.offsetHeight - vh;
      const heroProg = scrollableDist > 0 ? clamp(-rect.top / scrollableDist, 0, 1) : 0;
      state.hero.targetProgress = heroProg;
      state.hero.targetFrame = Math.round(heroProg * (state.hero.totalFrames - 1));

      // Update Hero progress line
      if (heroProgressLine) {
        heroProgressLine.style.transform = `scaleX(${heroProg})`;
      }

      // Update Hero HUD
      updateHeroHUD(heroProg);

      // Update Hero Chapters
      updateHeroChapters(heroProg);
    }

    // 2. Statement Section
    updateStatementSection();

    // 3. Dismantle Pinned Scrollytelling
    if (dismantleSection) {
      const rect = dismantleSection.getBoundingClientRect();
      const scrollableDist = dismantleSection.offsetHeight - vh;
      const dismantleProg = scrollableDist > 0 ? clamp(-rect.top / scrollableDist, 0, 1) : 0;
      state.dismantle.targetProgress = dismantleProg;
      state.dismantle.targetFrame = Math.round(dismantleProg * (state.dismantle.totalFrames - 1));

      // Update Dismantle progress line
      if (dismantleProgressLine) {
        dismantleProgressLine.style.transform = `scaleX(${dismantleProg})`;
      }

      // Update Callouts visibility
      updateDismantleCalloutsState(dismantleProg);

      if (prefersReducedMotion) {
        // Reduced motion: first + last frame
        drawDismantleFrame(dismantleProg > 0.5 ? state.dismantle.totalFrames - 1 : 0);
      }
    }

    // 4. Site Nav
    updateNav();
  }

  function updateHeroHUD(progress) {
    if (!hudChapterEl || !hudSpeedEl || !hudDistanceEl) return;

    // Chapter index (01-04)
    let chapterText = '01 / 04';
    if (progress >= 0.80) {
      chapterText = '04 / 04';
    } else if (progress >= 0.50) {
      chapterText = '03 / 04';
    } else if (progress >= 0.22) {
      chapterText = '02 / 04';
    }
    hudChapterEl.textContent = chapterText;

    // Velocity 000 -> 118 KM/H
    const maxSpeed = cfg.hero?.hud?.speedMax || 118;
    const speed = Math.round(progress * maxSpeed);
    hudSpeedEl.textContent = String(speed).padStart(3, '0') + ' KM/H';

    // Distance 0.0 -> 4.2 KM
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
          // Reduced motion: show one static frame per chapter (0%, 35%, 65%, 100%)
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
     10. MAIN RAF ANIMATION LOOP
     60fps smooth scrubbing with lerp factor 0.15.
     Cursor follow with lerp factor 0.18.
     Only redraws when rounded frame changes.
     ======================================================================== */
  function renderLoop() {
    // 1. Custom Cursor Follow
    if (cursorEl && isFinePointer && !prefersReducedMotion) {
      const cLerp = cfg.motion?.cursorLerp || 0.18;
      state.cursor.currentX = lerp(state.cursor.currentX, state.cursor.targetX, cLerp);
      state.cursor.currentY = lerp(state.cursor.currentY, state.cursor.targetY, cLerp);
      cursorEl.style.transform = `translate3d(${state.cursor.currentX}px, ${state.cursor.currentY}px, 0) translate(-50%, -50%)`;
    }

    if (!prefersReducedMotion) {
      const sLerp = cfg.motion?.canvasScrubLerp || 0.15;

      // 2. Hero Scrubbing
      state.hero.currentProgress = lerp(state.hero.currentProgress, state.hero.targetProgress, sLerp);
      state.hero.currentFrame = lerp(state.hero.currentFrame, state.hero.targetFrame, sLerp);
      const roundedHero = Math.round(state.hero.currentFrame);
      if (roundedHero !== state.hero.lastDrawnFrame || state.hero.currentProgress >= (cfg.hero?.fadeToBlackStart || 0.95)) {
        drawHeroFrame(roundedHero);
        state.hero.lastDrawnFrame = roundedHero;
      }

      // 3. Dismantle Scrubbing
      state.dismantle.currentProgress = lerp(state.dismantle.currentProgress, state.dismantle.targetProgress, sLerp);
      state.dismantle.currentFrame = lerp(state.dismantle.currentFrame, state.dismantle.targetFrame, sLerp);
      const roundedDismantle = Math.round(state.dismantle.currentFrame);
      if (roundedDismantle !== state.dismantle.lastDrawnFrame) {
        drawDismantleFrame(roundedDismantle);
        state.dismantle.lastDrawnFrame = roundedDismantle;
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

    updateDismantleCalloutLines();
    updateScrollProgress();

    // If breakpoint changed, force redraw
    if (wasMobile !== isMobileViewport) {
      drawHeroFrame(state.hero.lastDrawnFrame >= 0 ? state.hero.lastDrawnFrame : 0);
      drawDismantleFrame(state.dismantle.lastDrawnFrame >= 0 ? state.dismantle.lastDrawnFrame : 0);
    }
  }

  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', handleResize, { passive: true });

  // Apply configured section heights from config.js
  if (heroSection && cfg.hero?.wrapperHeight) {
    heroSection.style.height = cfg.hero.wrapperHeight;
  }
  if (dismantleSection && cfg.dismantle?.wrapperHeight) {
    dismantleSection.style.height = cfg.dismantle.wrapperHeight;
  }

  // Initialize all subsystems
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
