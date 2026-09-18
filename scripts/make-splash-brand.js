const sharp = require('sharp');

(async () => {
  const src = 'public/images/splash-home.jpg';
  const meta = await sharp(src).metadata();
  const w = meta.width;
  const h = meta.height;
  // Slightly tighter crop so logo/name/tagline read clearly
  const left = Math.round(w * 0.14);
  const top = Math.round(h * 0.30);
  const width = Math.round(w * 0.72);
  const height = Math.round(h * 0.40);

  const crop = await sharp(src).extract({ left, top, width, height }).png().toBuffer();

  // Soft edge feather, but keep center fully opaque for visibility
  const maskSvg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="48%" r="62%">
          <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
          <stop offset="68%" stop-color="#fff" stop-opacity="1"/>
          <stop offset="88%" stop-color="#fff" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`
  );

  await sharp(crop)
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toFile('public/images/splash-brand.png');

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 230, g: 224, b: 212 },
    },
  })
    .jpeg({ quality: 85 })
    .toFile('public/images/splash-brand-patch.jpg');

  console.log('ok', { left, top, width, height });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
