const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function inspectCarsDetail() {
  const rootDir = process.cwd();
  const carImages = ['car.png', 'car-e1.png', 'car-e2.png', 'car-k1.png', 'car-k2.png', 'car-k3.png', 'car-k4.png'];
  for (const name of carImages) {
    const { data, info } = await sharp(path.join(rootDir, name)).raw().toBuffer({ resolveWithObject: true });
    // find center area of the car body around y = 400..600, x = 600..1000
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let y = 350; y < 550; y++) {
      for (let x = 600; x < 1000; x++) {
        const idx = (y * info.width + x) * info.channels;
        const r = data[idx], g = data[idx+1], b = data[idx+2];
        if (r > 30 || g > 30 || b > 30) {
          rSum += r; gSum += g; bSum += b; count++;
        }
      }
    }
    if (count > 0) {
      console.log(`${name}: body avg RGB = [${Math.round(rSum/count)}, ${Math.round(gSum/count)}, ${Math.round(bSum/count)}], bright pixels count=${count}`);
    } else {
      console.log(`${name}: no bright pixels found in center`);
    }
  }
}

inspectCarsDetail().catch(console.error);
