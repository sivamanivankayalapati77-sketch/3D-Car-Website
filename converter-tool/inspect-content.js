const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function inspectContent() {
  const rootDir = process.cwd();
  // Let's check flow clip-frame-001 vs car.png
  // Let's check average pixel values and what car images are
  const carImages = ['car.png', 'car-e1.png', 'car-e2.png', 'car-k1.png', 'car-k2.png', 'car-k3.png', 'car-k4.png'];
  
  for (const name of carImages) {
    const raw = await sharp(path.join(rootDir, name)).raw().toBuffer();
    // find non-black bounding box
    let minX = 1672, maxX = 0, minY = 941, maxY = 0;
    const w = 1672, h = 941;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = raw[idx], g = raw[idx+1], b = raw[idx+2];
        if (r > 20 || g > 20 || b > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    console.log(`${name}: bbox x=[${minX}, ${maxX}] (${((maxX-minX)/w*100).toFixed(1)}%), y=[${minY}, ${maxY}] (bottom: ${(maxY/h*100).toFixed(1)}%)`);
  }

  // Check flow clip-frames: 001, 050, 100, 150, 200
  for (const num of ['001', '050', '100', '150', '200']) {
    const raw = await sharp(path.join(rootDir, 'flow clip-frames', `ezgif-frame-${num}.jpg`)).raw().toBuffer();
    const w = 1280, h = 720;
    let minX = 1280, maxX = 0, minY = 720, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 3;
        const r = raw[idx], g = raw[idx+1], b = raw[idx+2];
        if (r > 25 || g > 25 || b > 25) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    console.log(`flow clip ${num}: bbox x=[${minX}, ${maxX}] (${((maxX-minX)/w*100).toFixed(1)}%), y=[${minY}, ${maxY}] (bottom: ${(maxY/h*100).toFixed(1)}%)`);
  }
}

inspectContent().catch(console.error);
