const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function testConsecutive() {
  const rootDir = process.cwd();
  async function getRaw(sub, name) {
    return sharp(path.join(rootDir, sub, name)).raw().toBuffer();
  }
  function avgDiff(b1, b2) {
    let sum = 0;
    for (let i = 0; i < b1.length; i++) sum += Math.abs(b1[i] - b2[i]);
    return sum / b1.length;
  }

  const c1_199 = await getRaw('clip1-frames', 'ezgif-frame-199.jpg');
  const c1_200 = await getRaw('clip1-frames', 'ezgif-frame-200.jpg');
  const c2_001 = await getRaw('clip2-frames', 'ezgif-frame-001.jpg');
  const c2_002 = await getRaw('clip2-frames', 'ezgif-frame-002.jpg');
  const c2_199 = await getRaw('clip2-frames', 'ezgif-frame-199.jpg');
  const c2_200 = await getRaw('clip2-frames', 'ezgif-frame-200.jpg');
  const c3_001 = await getRaw('clip3-frames', 'ezgif-frame-001.jpg');
  const c3_002 = await getRaw('clip3-frames', 'ezgif-frame-002.jpg');

  console.log('c1_199 vs c1_200:', avgDiff(c1_199, c1_200));
  console.log('c1_200 vs c2_001:', avgDiff(c1_200, c2_001));
  console.log('c1_200 vs c2_002:', avgDiff(c1_200, c2_002));
  console.log('c2_001 vs c2_002:', avgDiff(c2_001, c2_002));
  console.log('---');
  console.log('c2_199 vs c2_200:', avgDiff(c2_199, c2_200));
  console.log('c2_200 vs c3_001:', avgDiff(c2_200, c3_001));
  console.log('c2_200 vs c3_002:', avgDiff(c2_200, c3_002));
  console.log('c3_001 vs c3_002:', avgDiff(c3_001, c3_002));
}

testConsecutive().catch(console.error);
