const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function inspect() {
  const rootDir = process.cwd();
  const items = fs.readdirSync(rootDir);
  console.log('Root directory items:', items);

  const checkDirs = ['clip1-frames', 'clip2-frames', 'clip3-frames', 'flow clip-frames'];
  for (const dir of checkDirs) {
    const fullDir = path.join(rootDir, dir);
    if (fs.existsSync(fullDir)) {
      const files = fs.readdirSync(fullDir).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      });
      console.log(`\nDir: ${dir}, Count: ${files.length}`);
      console.log(`First 3:`, files.slice(0, 3));
      console.log(`Last 3:`, files.slice(-3));
      
      const firstMeta = await sharp(path.join(fullDir, files[0])).metadata();
      const lastMeta = await sharp(path.join(fullDir, files[files.length - 1])).metadata();
      console.log(`First image: ${files[0]} (${firstMeta.width}x${firstMeta.height}, format: ${firstMeta.format})`);
      console.log(`Last image: ${files[files.length - 1]} (${lastMeta.width}x${lastMeta.height})`);
    }
  }

  // Check the car images
  const carImages = items.filter(f => f.startsWith('car') && f.endsWith('.png'));
  console.log('\nCar images found:', carImages);
  for (const img of carImages) {
    const meta = await sharp(path.join(rootDir, img)).metadata();
    console.log(`Car image ${img}: ${meta.width}x${meta.height}`);
  }
}

inspect().catch(console.error);
