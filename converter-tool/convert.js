const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Disable Sharp cache to keep memory clean
sharp.cache(false);

const rootDir = process.cwd();

function naturalSort(files) {
  return files.slice().sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function areNearlyIdentical(fileA, fileB) {
  const bufA = await sharp(fileA).raw().toBuffer();
  const bufB = await sharp(fileB).raw().toBuffer();
  if (bufA.length !== bufB.length) return false;
  let sumDiff = 0;
  for (let i = 0; i < bufA.length; i++) {
    sumDiff += Math.abs(bufA[i] - bufB[i]);
  }
  const avg = sumDiff / bufA.length;
  // If avg pixel delta is less than 0.5 (out of 255), it's essentially a duplicate
  return avg < 0.5;
}

async function convertFile(inputPath, destDesktop, destMobile) {
  // Read once into memory
  const inputBuffer = fs.readFileSync(inputPath);

  // Desktop (1600px wide, quality 78)
  const desktopPromise = sharp(inputBuffer)
    .resize({ width: 1600, withoutEnlargement: false })
    .webp({ quality: 78, effort: 4 })
    .toFile(destDesktop);

  // Mobile (960px wide, quality 72)
  const mobilePromise = sharp(inputBuffer)
    .resize({ width: 960, withoutEnlargement: false })
    .webp({ quality: 72, effort: 4 })
    .toFile(destMobile);

  await Promise.all([desktopPromise, mobilePromise]);
}

async function processQueue(tasks, concurrency = 8) {
  let index = 0;
  let completed = 0;
  const total = tasks.length;
  const startTime = Date.now();

  async function worker() {
    while (index < tasks.length) {
      const taskIndex = index++;
      const task = tasks[taskIndex];
      await convertFile(task.input, task.destDesktop, task.destMobile);
      completed++;
      if (completed % 50 === 0 || completed === total) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[${task.category}] Processed ${completed}/${total} frames (${elapsed}s)...`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
}

function getFolderStats(dirPath) {
  const files = fs.readdirSync(dirPath);
  let totalBytes = 0;
  for (const f of files) {
    totalBytes += fs.statSync(path.join(dirPath, f)).size;
  }
  return {
    count: files.length,
    bytes: totalBytes,
    formatted: (totalBytes / (1024 * 1024)).toFixed(2) + ' MB'
  };
}

async function run() {
  console.log('Starting frame conversion process...');

  const heroDesktopDir = path.join(rootDir, 'assets', 'frames', 'hero');
  const heroMobileDir = path.join(rootDir, 'assets', 'frames', 'hero-mobile');
  const dismantleDesktopDir = path.join(rootDir, 'assets', 'frames', 'dismantle');
  const dismantleMobileDir = path.join(rootDir, 'assets', 'frames', 'dismantle-mobile');

  ensureDir(heroDesktopDir);
  ensureDir(heroMobileDir);
  ensureDir(dismantleDesktopDir);
  ensureDir(dismantleMobileDir);

  // 1. Gather hero frames
  const clip1Files = naturalSort(fs.readdirSync(path.join(rootDir, 'clip1-frames'))).map(f => path.join(rootDir, 'clip1-frames', f));
  const clip2Files = naturalSort(fs.readdirSync(path.join(rootDir, 'clip2-frames'))).map(f => path.join(rootDir, 'clip2-frames', f));
  const clip3Files = naturalSort(fs.readdirSync(path.join(rootDir, 'clip3-frames'))).map(f => path.join(rootDir, 'clip3-frames', f));

  console.log(`Clip1 frames: ${clip1Files.length}`);
  console.log(`Clip2 frames: ${clip2Files.length}`);
  console.log(`Clip3 frames: ${clip3Files.length}`);

  // Check join 1 -> 2
  const join1Identical = await areNearlyIdentical(clip1Files[clip1Files.length - 1], clip2Files[0]);
  console.log(`Join Clip1->Clip2 identical/nearly identical: ${join1Identical}`);
  const finalClip2 = join1Identical ? clip2Files.slice(1) : clip2Files;

  // Check join 2 -> 3
  const join2Identical = await areNearlyIdentical(finalClip2[finalClip2.length - 1], clip3Files[0]);
  console.log(`Join Clip2->Clip3 identical/nearly identical: ${join2Identical}`);
  const finalClip3 = join2Identical ? clip3Files.slice(1) : clip3Files;

  const heroFrames = [...clip1Files, ...finalClip2, ...finalClip3];
  console.log(`Total hero frames to process: ${heroFrames.length}`);

  const heroTasks = heroFrames.map((filePath, i) => {
    const pad = String(i + 1).padStart(4, '0');
    return {
      category: 'HERO',
      input: filePath,
      destDesktop: path.join(heroDesktopDir, `frame_${pad}.webp`),
      destMobile: path.join(heroMobileDir, `frame_${pad}.webp`)
    };
  });

  // 2. Gather dismantle frames
  const dismantleFiles = naturalSort(fs.readdirSync(path.join(rootDir, 'flow clip-frames'))).map(f => path.join(rootDir, 'flow clip-frames', f));
  console.log(`Total dismantle frames to process: ${dismantleFiles.length}`);

  const dismantleTasks = dismantleFiles.map((filePath, i) => {
    const pad = String(i + 1).padStart(4, '0');
    return {
      category: 'DISMANTLE',
      input: filePath,
      destDesktop: path.join(dismantleDesktopDir, `frame_${pad}.webp`),
      destMobile: path.join(dismantleMobileDir, `frame_${pad}.webp`)
    };
  });

  console.log('\n--- Processing Hero Frames ---');
  await processQueue(heroTasks, 8);

  console.log('\n--- Processing Dismantle Frames ---');
  await processQueue(dismantleTasks, 8);

  console.log('\n--- Conversion Complete! Gathering stats ---');
  const heroDesktopStats = getFolderStats(heroDesktopDir);
  const heroMobileStats = getFolderStats(heroMobileDir);
  const dismantleDesktopStats = getFolderStats(dismantleDesktopDir);
  const dismantleMobileStats = getFolderStats(dismantleMobileDir);

  const report = {
    heroDesktop: heroDesktopStats,
    heroMobile: heroMobileStats,
    dismantleDesktop: dismantleDesktopStats,
    dismantleMobile: dismantleMobileStats,
  };

  console.log(JSON.stringify(report, null, 2));

  fs.writeFileSync(path.join(rootDir, 'converter-tool', 'stats.json'), JSON.stringify(report, null, 2));
}

run().catch(err => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
