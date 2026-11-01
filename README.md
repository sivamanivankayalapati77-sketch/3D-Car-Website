# NOCTIS — The City is Asleep

A premium, minimal, single-page scrollytelling web experience for **NOCTIS**, a fictional electric vehicle brand.

> *Mood: A city in total blackout at night where the car's light is the only light in the world. Quiet, expensive, precise: huge empty space, few words, perfect motion.*

---

## ⚡ Tech Stack & Architecture

- **Vanilla HTML5, CSS3 & JavaScript** (ES6+) — Zero frameworks, zero build tools, zero npm dependencies.
- **Scroll-Scrubbed Canvas Sequences**:
  - **Hero Section**: 600-frame continuous sequence joined across 3 camera angles scrubbing smoothly via `requestAnimationFrame` with a `0.15` lerp factor.
  - **Dismantle Section**: 200-frame mechanical exploded sequence with interactive SVG hairline callouts connecting directly to chassis parts after 70% scroll progress.
  - Device-aware asset serving (`assets/frames/hero/` and `assets/frames/hero-mobile/`).
- **Strict Minimalist Design System**:
  - **Tokens**: `--asphalt` (`#07080A`), `--graphite` (`#121418`), `--fog` (`#8A8F98`), `--bone` (`#EDEAE4`), `--xenon` (`#CFE3FF`), `--taillight` (`#E1251B`), `--hairline` (`rgba(237,234,228,0.12)`).
  - **Strict Rules**: Flat solid colors and hairlines only. No gradients, no glassmorphism/blur, no glows, no drop shadows.
  - **Typography**: Google Fonts — Archivo variable font (`wdth: 125%`), Inter (body), JetBrains Mono (HUD/telemetry).
- **Interactive Features**:
  - **Custom Headlight Cursor**: 6px xenon dot inside a 28px stroke ring with `0.18` follow lerp, morphing into a 44x2px horizontal light bar with contextual mono labels (`VIEW`, `RESERVE`, `MENU`, `OPEN`, `CONFIGURE`).
  - **Fixed Film-Grain Overlay**: Offscreen noise tile translated ~8x/s at 3.5% opacity with zero pointer interference.
  - **Telemetry HUD**: Real-time velocity counter (`000 → 118 KM/H`) and distance odometer (`0.0 → 4.2 KM`).
  - **Statement Word Reveal**: Sentence illuminates word-by-word with scroll.
  - **Lineup Accordion**: 5-model horizontal accordion (GT-E, S, X, R, ONE) with 80ms debounced hover, drive-in animation, color swatches, and keyboard navigation.

---

## 🚀 Running Locally

Open the directory in VS Code and launch with **Live Server**, or run using the included lightweight Node server:

```bash
node server.js
```

Then visit [http://localhost:3000/](http://localhost:3000/) in your browser.

---

## 📁 Repository Structure

```text
├── index.html                 # Semantic single-page markup
├── styles.css                 # Zero-gradient design token stylesheet
├── main.js                    # Canvas scrubbing & interaction engine
├── config.js                  # Central configuration for heights, frames & callouts
├── server.js                  # Zero-dependency local development server
├── assets/
│   ├── frames/
│   │   ├── hero/              # 600 desktop WebP frames (1600px)
│   │   ├── hero-mobile/       # 600 mobile WebP frames (960px)
│   │   ├── dismantle/         # 200 desktop WebP frames (1600px)
│   │   └── dismantle-mobile/  # 200 mobile WebP frames (960px)
│   └── cars/                  # Model lineup imagery (GT-E, S, X, R, ONE)
└── README.md
```

---

## ⚖️ License & Attribution

Designed and developed as a fictional automotive concept.
