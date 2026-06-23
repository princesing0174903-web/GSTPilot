import sharp from 'sharp';
import fs from 'fs';

const SRC = 'upload/pasted_image_1782212751517.png';
const BRAND = 'public/brand';

// Layout bounds discovered via PIL analysis
const ICON_Y = 248, ICON_Y_END = 844;
const TEXT_Y = 896, TEXT_Y_END = 1111;
const TAG_Y = 1168, TAG_Y_END = 1234;
const X_START = 612, X_END = 1660;

const fullBounds = { left: X_START, top: ICON_Y, width: X_END - X_START, height: TAG_Y_END - ICON_Y };
const iconBounds = { left: X_START, top: ICON_Y, width: X_END - X_START, height: ICON_Y_END - ICON_Y };
const textBounds = { left: X_START, top: TEXT_Y, width: X_END - X_START, height: TEXT_Y_END - TEXT_Y };

console.log('Loading source image...');
const srcBuf = fs.readFileSync(SRC);

// Helper: make near-black pixels transparent (for overlay on any bg)
function removeBlackBg(img) {
  return img.raw().toBuffer({ resolveWithObject: true }).then(({ data, info }) => {
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i], g = data[i+1], b = data[i+2];
      // If pixel is very dark, make it transparent
      const max = Math.max(r, g, b);
      if (max < 25) {
        data[i+3] = 0; // transparent
      } else if (max < 60) {
        // Partial transparency for near-black edges
        data[i+3] = Math.round((max - 25) / 35 * 255);
      }
    }
    return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  });
}

async function run() {
  // 1. Full logo (vertical: icon + GSTPilot + tagline) — on black background, high-res
  console.log('Generating full logo...');
  await sharp(srcBuf)
    .extract(fullBounds)
    
    .png({ quality: 95 })
    .toFile(`${BRAND}/gstpilot-logo-full.png`);

  // 2. Full logo on transparent background (icon + text, black removed)
  console.log('Generating full logo (transparent)...');
  const fullTrimmed = await sharp(srcBuf).extract(fullBounds).toBuffer();
  const fullTransparent = await removeBlackBg(sharp(fullTrimmed));
  await fullTransparent.png({ quality: 95 }).toFile(`${BRAND}/gstpilot-logo-full-transparent.png`);

  // 3. Icon only — square crop, on black background
  console.log('Generating icon (black bg)...');
  const iconCrop = await sharp(srcBuf).extract(iconBounds).toBuffer();
  const iconMeta = await sharp(iconCrop).metadata();
  const iconSize = Math.max(iconMeta.width, iconMeta.height);
  await sharp(iconCrop)
    .resize({ width: iconMeta.width, height: iconMeta.height, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .extend({
      top: Math.floor((iconSize - iconMeta.height) / 2),
      bottom: Math.ceil((iconSize - iconMeta.height) / 2),
      left: Math.floor((iconSize - iconMeta.width) / 2),
      right: Math.ceil((iconSize - iconMeta.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png({ quality: 95 })
    .toFile(`${BRAND}/gstpilot-icon.png`);

  // 4. Icon only — transparent background (for overlay on any color)
  console.log('Generating icon (transparent)...');
  const iconTransparent = await removeBlackBg(sharp(iconCrop));
  await iconTransparent
    .resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 95 })
    .toFile(`${BRAND}/gstpilot-icon-transparent.png`);

  // 5. Icon white version (for light backgrounds) — make icon white
  console.log('Generating icon (white)...');
  const iconWhiteBuf = await removeBlackBg(sharp(iconCrop)).then(s => 
    s.raw().toBuffer({ resolveWithObject: true }).then(({ data, info }) => {
      for (let i = 0; i < data.length; i += info.channels) {
        if (data[i+3] > 0) {
          data[i] = 255; data[i+1] = 255; data[i+2] = 255;
        }
      }
      return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
    })
  );
  await iconWhiteBuf
    .resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 95 })
    .toFile(`${BRAND}/gstpilot-icon-white.png`);

  // 6. Favicons — 16, 32 (from transparent icon)
  console.log('Generating favicons...');
  const iconTransparentBuf = await removeBlackBg(sharp(iconCrop)).then(s => s.png().toBuffer());
  
  for (const size of [16, 32]) {
    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
    })
      .composite([{
        input: await sharp(iconCrop).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } }).toBuffer(),
        blend: 'over'
      }])
      .png()
      .toFile(`public/favicon-${size}x${size}.png`);
  }

  // 7. Apple touch icon (180x180, black bg, padding)
  console.log('Generating apple-touch-icon...');
  await sharp({
    create: { width: 180, height: 180, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
  })
    .composite([{
      input: await sharp(iconCrop).resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
      blend: 'over',
      gravity: 'center'
    }])
    .png()
    .toFile(`public/apple-touch-icon.png`);

  // 8. Android chrome icons (192, 512) — black bg, centered icon with padding
  for (const size of [192, 512]) {
    const inner = Math.round(size * 0.78);
    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
    })
      .composite([{
        input: await sharp(iconCrop).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
        blend: 'over',
        gravity: 'center'
      }])
      .png()
      .toFile(`public/android-chrome-${size}.png`);
  }

  // 9. favicon.ico (multi-size: 16+32+48 packed) — use sharp to make a 48x48 png, then ico
  //    sharp can't make .ico directly; we'll use a tiny pure-JS ICO encoder.
  console.log('Generating favicon.ico...');
  const sizes48 = [16, 32, 48];
  const pngBufs = [];
  for (const s of sizes48) {
    const b = await sharp({
      create: { width: s, height: s, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
    })
      .composite([{
        input: await sharp(iconCrop).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } }).toBuffer(),
        blend: 'over'
      }])
      .png()
      .toBuffer();
    pngBufs.push(b);
  }
  // Encode ICO
  const ico = encodeICO(pngBufs, sizes48);
  fs.writeFileSync('public/favicon.ico', ico);

  // 10. OG image (1200x630) — full logo centered on black
  console.log('Generating og-image...');
  const fullLogoForOG = await sharp(srcBuf).extract(fullBounds).resize(1000, 560, { fit: "inside" }).toBuffer();
  await sharp({
    create: { width: 1200, height: 630, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
  })
    .composite([{
      input: fullLogoForOG,
      blend: 'over',
      gravity: 'center'
    }])
    .png()
    .toFile('public/og-image.png');

  // 11. Splash screen logo (full, larger for mobile splash) — 1024px wide
  console.log('Generating splash logo...');
  await sharp(srcBuf)
    .extract(fullBounds)
    
    .resize({ width: 1024, withoutEnlargement: false })
    .png({ quality: 95 })
    .toFile(`${BRAND}/gstpilot-splash.png`);

  // 12. Report the results
  console.log('\n=== Generated brand assets ===');
  const files = [
    'public/brand/gstpilot-logo-full.png',
    'public/brand/gstpilot-logo-full-transparent.png',
    'public/brand/gstpilot-icon.png',
    'public/brand/gstpilot-icon-transparent.png',
    'public/brand/gstpilot-icon-white.png',
    'public/brand/gstpilot-splash.png',
    'public/favicon.ico',
    'public/favicon-16x16.png',
    'public/favicon-32x32.png',
    'public/apple-touch-icon.png',
    'public/android-chrome-192.png',
    'public/android-chrome-512.png',
    'public/og-image.png',
  ];
  for (const f of files) {
    const stat = fs.statSync(f);
    const meta = await sharp(f).metadata().catch(() => ({}));
    console.log(`  ${f}  ${meta.width||'?'}x${meta.height||'?'}  ${(stat.size/1024).toFixed(1)}KB`);
  }
  console.log('\n✓ All brand assets generated');
}

// Minimal ICO encoder (PNG-based entries)
function encodeICO(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = headerSize + dirEntrySize * count;
  const parts = [];
  // ICONDIR header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);
  parts.push(header);
  let offset = dirSize;
  for (let i = 0; i < count; i++) {
    const png = pngBuffers[i];
    const s = sizes[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(s >= 256 ? 0 : s, 0); // width
    entry.writeUInt8(s >= 256 ? 0 : s, 1); // height
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // offset
    parts.push(entry);
    offset += png.length;
  }
  for (const png of pngBuffers) parts.push(png);
  return Buffer.concat(parts);
}

run().catch(e => { console.error(e); process.exit(1); });
