const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function checkCars() {
  const rootDir = process.cwd();
  const carImages = ['car.png', 'car-e1.png', 'car-e2.png', 'car-k1.png', 'car-k2.png', 'car-k3.png', 'car-k4.png'];
  for (const img of carImages) {
    const p = path.join(rootDir, img);
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      const meta = await sharp(p).metadata();
      // compute average color of borders to check background
      const raw = await sharp(p).raw().toBuffer();
      // sample corner pixel (0,0)
      const r = raw[0], g = raw[1], b = raw[2];
      console.log(`${img}: size=${stat.size}, dims=${meta.width}x${meta.height}, cornerRGB=[${r},${g},${b}]`);
    }
  }

  // Also check flow clip-frames first frame
  const f1 = path.join(rootDir, 'flow clip-frames', 'ezgif-frame-001.jpg');
  const f1Meta = await sharp(f1).metadata();
  console.log(`flow clip-frame-001: dims=${f1Meta.width}x${f1Meta.height}`);
}

checkCars().catch(console.error);
