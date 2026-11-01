const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function testFrames() {
  const rootDir = process.cwd();
  // Check transition between clip1 last and clip2 first
  const c1_last = path.join(rootDir, 'clip1-frames', 'ezgif-frame-200.jpg');
  const c2_first = path.join(rootDir, 'clip2-frames', 'ezgif-frame-001.jpg');
  const c2_second = path.join(rootDir, 'clip2-frames', 'ezgif-frame-002.jpg');

  const c2_last = path.join(rootDir, 'clip2-frames', 'ezgif-frame-200.jpg');
  const c3_first = path.join(rootDir, 'clip3-frames', 'ezgif-frame-001.jpg');

  const buf1 = await sharp(c1_last).raw().toBuffer();
  const buf2 = await sharp(c2_first).raw().toBuffer();
  const buf2_2 = await sharp(c2_second).raw().toBuffer();
  const buf2_last = await sharp(c2_last).raw().toBuffer();
  const buf3_first = await sharp(c3_first).raw().toBuffer();

  function diff(b1, b2) {
    let diff = 0;
    for (let i = 0; i < b1.length; i += 4) {
      diff += Math.abs(b1[i] - b2[i]);
      diff += Math.abs(b1[i+1] - b2[i+1]);
      diff += Math.abs(b1[i+2] - b2[i+2]);
    }
    return diff / (b1.length / 4 * 3);
  }

  console.log('Diff c1_last vs c2_first (avg pixel diff 0-255):', diff(buf1, buf2));
  console.log('Diff c2_first vs c2_second:', diff(buf2, buf2_2));
  console.log('Diff c2_last vs c3_first:', diff(buf2_last, buf3_first));

  // Check flow clip-frames: what happens from frame 1 to frame 200?
  const f_first = path.join(rootDir, 'flow clip-frames', 'ezgif-frame-001.jpg');
  const f_mid = path.join(rootDir, 'flow clip-frames', 'ezgif-frame-100.jpg');
  const f_last = path.join(rootDir, 'flow clip-frames', 'ezgif-frame-200.jpg');
  const f_buf1 = await sharp(f_first).raw().toBuffer();
  const f_buf100 = await sharp(f_mid).raw().toBuffer();
  const f_buf200 = await sharp(f_last).raw().toBuffer();

  console.log('Flow clip: 1 vs 100 diff:', diff(f_buf1, f_buf100));
  console.log('Flow clip: 100 vs 200 diff:', diff(f_buf100, f_buf200));
}

testFrames().catch(console.error);
