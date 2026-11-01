/**
 * NOCTIS Configuration
 * All section heights, chapter ranges, frame counts, frame paths, and callout coordinates.
 * Pure Vanilla JavaScript — Config object exposed to window.NOCTIS_CONFIG.
 */

window.NOCTIS_CONFIG = {
  // Brand
  brand: {
    name: 'NOCTIS',
    tagline: 'The city is asleep.',
    year: 2026
  },

  // Breakpoints
  breakpoints: {
    mobile: 768
  },

  // Motion & Animation Lerp Factors
  motion: {
    canvasScrubLerp: 0.15,  // Target frame lerp factor (60fps smoothing)
    cursorLerp: 0.18,       // Headlight cursor follow lerp
    hoverDebounceMs: 80     // Lineup hover debounce
  },

  // Preloader settings
  preloader: {
    heroInitialBatch: 40,   // Number of initial hero frames required to reveal page
    minDisplayTimeMs: 800   // Smooth transition
  },

  // Frame sequences
  frames: {
    hero: {
      count: 600,
      desktopDir: 'assets/frames/hero',
      mobileDir: 'assets/frames/hero-mobile',
      filePattern: 'frame_{index}.webp', // 1-based, padded to 4 digits (frame_0001.webp)
      stats: {
        desktop: { count: 600, size: '19.05 MB' },
        mobile: { count: 600, size: '9.32 MB' }
      }
    },
    dismantle: {
      count: 200,
      desktopDir: 'assets/frames/dismantle',
      mobileDir: 'assets/frames/dismantle-mobile',
      filePattern: 'frame_{index}.webp', // 1-based, padded to 4 digits
      stats: {
        desktop: { count: 200, size: '10.60 MB' },
        mobile: { count: 200, size: '5.23 MB' }
      }
    }
  },

  // Section 1: Hero (Pinned Scrollytelling)
  hero: {
    wrapperHeight: '600vh',
    fadeToBlackStart: 0.95, // Progress at which canvas fades to solid black
    hud: {
      speedMax: 118,        // KM/H at progress 1.0
      distanceMax: 4.2      // KM at progress 1.0
    },
    chapters: [
      {
        id: 'intro',
        num: '01',
        start: 0.00,
        end: 0.12,
        title: 'NOCTIS',
        subtitle: 'The city is asleep.',
        hint: 'SCROLL TO WAKE IT'
      },
      {
        id: 'presence',
        num: '02',
        start: 0.22,
        end: 0.40,
        statement: "It doesn't need the city's light."
      },
      {
        id: 'light',
        num: '03',
        start: 0.50,
        end: 0.68,
        statement: 'It brings its own.'
      },
      {
        id: 'gt-e',
        num: '04',
        start: 0.80,
        end: 1.00,
        title: 'GT-E',
        specs: '0–100 KM/H 3.1S · 640 KM RANGE · DUAL MOTOR',
        actionLabel: 'Discover the GT-E',
        actionTarget: '#lineup'
      }
    ]
  },

  // Section 2: Statement (word-by-word reveal)
  statement: {
    sectionNum: '02 — ENGINEERING',
    text: 'Every part was designed to disappear into one line of light.'
  },

  // Section 3: Dismantle (Pinned Scrollytelling)
  dismantle: {
    wrapperHeight: '350vh',
    title: 'Look closer.',
    calloutStartProgress: 0.70, // Callouts begin fading in after 70% progress
    callouts: [
      {
        id: 'body',
        code: 'BODY',
        name: 'Carbon composite monocoque',
        // Percentage coordinates on the stage (matching disassembled chassis)
        dotX: 52, // % from left
        dotY: 34, // % from top
        cardX: 20, // % from left for text card
        cardY: 26, // % from top for text card
        appearProgress: 0.72
      },
      {
        id: 'drive',
        code: 'DRIVE',
        name: 'Dual axial-flux motors, 680 kW',
        dotX: 62,
        dotY: 55,
        cardX: 74,
        cardY: 48,
        appearProgress: 0.79
      },
      {
        id: 'light',
        code: 'LIGHT',
        name: 'Single-line LED signature',
        dotX: 78,
        dotY: 66,
        cardX: 82,
        cardY: 76,
        appearProgress: 0.86
      },
      {
        id: 'battery',
        code: 'BATTERY',
        name: '110 kWh structural pack',
        dotX: 48,
        dotY: 76,
        cardX: 24,
        cardY: 82,
        appearProgress: 0.92
      }
    ]
  },

  // Section 4: Lineup (Accordion)
  lineup: {
    tag: '03 — THE LINEUP',
    heading: 'Five ways to drive the night.',
    defaultOpenIndex: 0,
    cars: [
      {
        id: 'gt-e',
        num: '01',
        name: 'GT-E',
        tagline: 'The grand tourer.',
        specs: {
          range: '640 km',
          accel: '3.1 s',
          power: '680 kW'
        },
        image: 'assets/cars/gt-e.webp',
        alt: 'NOCTIS GT-E grand tourer coupe in matte graphite',
        swatches: ['#121418', '#EDEAE4', '#1A2A44', '#E1251B'],
        activeSwatch: 0
      },
      {
        id: 's',
        num: '02',
        name: 'S',
        tagline: 'Four doors, no compromise.',
        specs: {
          range: '600 km',
          accel: '3.6 s',
          power: '520 kW'
        },
        image: 'assets/cars/s.webp',
        alt: 'NOCTIS S four-door sport sedan in satin bone white',
        swatches: ['#EDEAE4', '#121418', '#2D3139', '#545B67'],
        activeSwatch: 0
      },
      {
        id: 'x',
        num: '03',
        name: 'X',
        tagline: 'Higher, never heavier.',
        specs: {
          range: '560 km',
          accel: '4.2 s',
          power: '480 kW'
        },
        image: 'assets/cars/x.webp',
        alt: 'NOCTIS X electric SUV coupe in midnight blue',
        swatches: ['#0E1A2B', '#121418', '#EDEAE4', '#3E4651'],
        activeSwatch: 0
      },
      {
        id: 'r',
        num: '04',
        name: 'R',
        tagline: 'Built for the track.',
        specs: {
          range: '420 km',
          accel: '2.4 s',
          power: '900 kW'
        },
        image: 'assets/cars/r.webp',
        alt: 'NOCTIS R two-seat track coupe in satin black with red accents',
        swatches: ['#0A0B0E', '#E1251B', '#343840', '#CFE3FF'],
        activeSwatch: 0
      },
      {
        id: 'one',
        num: '05',
        name: 'ONE',
        tagline: 'The future, early.',
        specs: {
          range: 'Concept',
          accel: 'Concept',
          power: 'Concept'
        },
        image: 'assets/cars/one.webp',
        alt: 'NOCTIS ONE hypercar concept in liquid silver',
        swatches: ['#C5CBD3', '#121418', '#CFE3FF', '#EDEAE4'],
        activeSwatch: 0
      }
    ]
  },

  // Section 5: Reserve
  reserve: {
    heading: 'Drive the night.',
    body: 'Strictly limited production. Direct delivery from the facility to your private location.',
    cta: 'RESERVE YOUR NOCTIS'
  },

  // Footer Links
  footer: {
    wordmark: 'NOCTIS',
    copyright: '© 2026 NOCTIS (fictional brand)',
    columns: [
      {
        title: 'VEHICLES',
        links: ['GT-E', 'S SEDAN', 'X CROSS', 'R TRACK', 'ONE CONCEPT']
      },
      {
        title: 'INNOVATION',
        links: ['SOLID ARCHITECTURE', 'LIGHT SIGNATURE', 'AXIAL-FLUX MOTOR', 'AERODYNAMICS']
      },
      {
        title: 'COMPANY',
        links: ['ATELIER', 'PURCHASE & LEASE', 'PRESS', 'CONTACT']
      }
    ]
  }
};
