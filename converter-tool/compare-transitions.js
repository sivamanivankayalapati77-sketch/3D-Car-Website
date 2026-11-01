const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function inspectFlowAndClips() {
  const rootDir = process.cwd();
  // Let's sample frames from flow clip-frames: 1, 50, 100, 150, 200
  // And let's check hero clip1, clip2, clip3 frames
  console.log('Inspecting clip frames...');

  // Let's check if clip1 200 vs clip2 001 is identical:
  const c1_200 = fs.readFileSync(path.join(rootDir, 'clip1-frames', 'ezgif-frame-200.jpg'));
  const c2_001 = fs.readFileSync(path.join(rootDir, 'clip2-frames', 'ezgif-frame-001.jpg'));
  const c2_200 = fs.readFileSync(path.join(rootDir, 'clip2-frames', 'ezgif-frame-200.jpg'));
  const c3_001 = fs.readFileSync(path.join(rootDir, 'clip3-frames', 'ezgif-frame-001.jpg'));

  console.log('Exact byte match c1_200 vs c2_001:', c1_200.equals(c2_001));
  console.log('Exact byte match c2_200 vs c3_001:', c2_200.equals(c3_001));

  // Let's check pixel-wise comparison:
  const raw1_200 = await sharp(c1_200).raw().toBuffer();
  const raw2_001 = await sharp(c2_001).raw().toBuffer();
  const raw2_002 = await sharp(path.join(rootDir, 'clip2-frames', 'ezgif-frame-002.jpg')).raw().toBuffer();
  const raw2_200 = await sharp(c2_200).raw().toBuffer();
  const raw3_001 = await sharp(c3_001).raw().toBuffer();
  const raw3_002 = await sharp(path.join(rootDir, 'clip3-frames', 'ezgif-frame-002.jpg')).raw().toBuffer();

  function maxDiff(b1, b2) {
    let max = 0, diffCount = 0, sum = 0;
    for (let i = 0; i < b1.length; i++) {
      const d = Math.abs(b1[i] - b2[i]);
      if (d > max) max = d;
      if (d > 5) diffCount++;
      sum += d;
    }
    return { max, avg: sum / b1.length, diffRatio: diffCount / b1.length };
  }

  console.log('c1_200 vs c2_001:', maxDiff(raw1_200, raw2_001));
  console.log('c2_001 vs c2_002:', maxDiff(raw2_001, raw2_002));
  console.log('c2_200 vs c3_001:', maxDiff(raw2_200, raw3_001));
  console.log('c3_001 vs c3_002:', maxDiff(raw3_001, raw3_002));
}

inspectFlowAndClips().catch(console.error);
