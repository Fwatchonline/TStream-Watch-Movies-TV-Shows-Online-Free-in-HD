const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_PATH = path.resolve(__dirname, '../public/assets/aistudio/tstream-logo-yellow-transparent_1__d41aea4b.png');
const PUBLIC_DIR = path.resolve(__dirname, '../public');

async function generateAssets() {
  console.log('Generating PWA, Favicon, and OG assets from source logo...');

  // 1. Copy source to public/logo.png (trimmed)
  const trimmedLogoBuffer = await sharp(SOURCE_PATH)
    .trim()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'logo.png'), trimmedLogoBuffer);
  console.log('✓ Created /public/logo.png');

  // 2. Extract emblem (yellow play triangle + T + S)
  // Bounds determined: left: 30, top: 24, width: 546, height: 297
  const emblemBuffer = await sharp(SOURCE_PATH)
    .extract({ left: 30, top: 24, width: 540, height: 290 })
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.png'), emblemBuffer);
  console.log('✓ Created /public/icon.png');

  // 3. Generate square icon base (fitted within square with padding)
  async function createSquareIcon(size, paddingRatio = 0.1, bgColor = '#121215') {
    const pad = Math.round(size * paddingRatio);
    const innerSize = size - pad * 2;
    const resizedEmblem = await sharp(emblemBuffer)
      .resize({
        width: innerSize,
        height: innerSize,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: bgColor
      }
    })
      .composite([{ input: resizedEmblem, gravity: 'center' }])
      .png()
      .toBuffer();
  }

  // Transparent square icon (for standard PWA & favicon)
  async function createTransparentSquareIcon(size, paddingRatio = 0.08) {
    const pad = Math.round(size * paddingRatio);
    const innerSize = size - pad * 2;
    const resizedEmblem = await sharp(emblemBuffer)
      .resize({
        width: innerSize,
        height: innerSize,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: resizedEmblem, gravity: 'center' }])
      .png()
      .toBuffer();
  }

  // 4. Generate Favicons
  const fav16 = await createTransparentSquareIcon(16, 0.05);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-16x16.png'), fav16);

  const fav32 = await createTransparentSquareIcon(32, 0.05);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-32x32.png'), fav32);

  // Favicon.ico (32x32 PNG is supported by modern browsers as favicon.ico)
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), fav32);
  console.log('✓ Created /public/favicon.ico, favicon-16x16.png, favicon-32x32.png');

  // 5. Apple Touch Icon (180x180, dark background with yellow emblem)
  const appleTouch = await createSquareIcon(180, 0.15, '#121215');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), appleTouch);
  console.log('✓ Created /public/apple-touch-icon.png');

  // 6. PWA 192x192 & 512x512 icons (any purpose)
  const pwa192 = await createSquareIcon(192, 0.12, '#121215');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-192x192.png'), pwa192);

  const pwa512 = await createSquareIcon(512, 0.12, '#121215');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-512x512.png'), pwa512);
  console.log('✓ Created /public/pwa-192x192.png and /public/pwa-512x512.png');

  // 7. PWA Maskable Icon 512x512 (with 20% safe-zone margin per Google/PWA specs)
  const pwaMaskable = await createSquareIcon(512, 0.22, '#121215');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-maskable-512x512.png'), pwaMaskable);
  console.log('✓ Created /public/pwa-maskable-512x512.png');

  // 8. OpenGraph / Twitter Card Image (1200x630)
  // Composite with dark cinema gradient, glow, logo, and verified badges
  const ogWidth = 1200;
  const ogHeight = 630;

  // Resize full logo to fit nicely in OG header
  const ogLogo = await sharp(trimmedLogoBuffer)
    .resize({ width: 620, height: 160, fit: 'inside' })
    .toBuffer();

  const ogSvgOverlay = Buffer.from(`
    <svg width="${ogWidth}" height="${ogHeight}" viewBox="0 0 ${ogWidth} ${ogHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0a0a0d"/>
          <stop offset="50%" stop-color="#16161b"/>
          <stop offset="100%" stop-color="#0e0f14"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stop-color="#F5C400" stop-opacity="0.18"/>
          <stop offset="60%" stop-color="#F5C400" stop-opacity="0.03"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <!-- Background -->
      <rect width="${ogWidth}" height="${ogHeight}" fill="url(#bgGrad)"/>
      <rect width="${ogWidth}" height="${ogHeight}" fill="url(#glow)"/>

      <!-- Accent Top Border -->
      <rect x="0" y="0" width="${ogWidth}" height="4" fill="#F5C400"/>

      <!-- Tagline -->
      <text x="600" y="380" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="28" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">
        Watch Movies &amp; TV Shows Online Free in HD
      </text>

      <text x="600" y="420" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" font-weight="500" fill="#A6A6AC" text-anchor="middle">
        Native Direct HLS · 4K Ultra HD · Multilingual Subtitles · Zero Ads
      </text>

      <!-- Badges -->
      <g transform="translate(320, 480)">
        <!-- Badge 1 -->
        <rect x="0" y="0" width="160" height="42" rx="21" fill="#232326" stroke="#3A3A40" stroke-width="1.5"/>
        <text x="80" y="26" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" font-weight="800" fill="#F5C400" text-anchor="middle">
          4K ULTRA HDR
        </text>

        <!-- Badge 2 -->
        <rect x="180" y="0" width="180" height="42" rx="21" fill="#232326" stroke="#3A3A40" stroke-width="1.5"/>
        <text x="270" y="26" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" font-weight="800" fill="#FFFFFF" text-anchor="middle">
          DIRECT STREAMING
        </text>

        <!-- Badge 3 -->
        <rect x="380" y="0" width="180" height="42" rx="21" fill="#232326" stroke="#3A3A40" stroke-width="1.5"/>
        <text x="470" y="26" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" font-weight="800" fill="#F5C400" text-anchor="middle">
          MULTI-SUBTITLES
        </text>
      </g>
    </svg>
  `);

  const ogImage = await sharp(ogSvgOverlay)
    .composite([
      {
        input: ogLogo,
        top: 170,
        left: Math.round((ogWidth - 620) / 2)
      }
    ])
    .png({ quality: 95 })
    .toBuffer();

  fs.writeFileSync(path.join(PUBLIC_DIR, 'og-image.png'), ogImage);
  console.log('✓ Created /public/og-image.png (1200x630)');

  // 9. SVG Favicon & Icon
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#121215"/>
  <path d="M16 28 L40 50 L16 72 Z" fill="#F5C400"/>
  <path d="M38 28 H72 V40 H58 V72 H46 V40 H38 Z" fill="#F5C400"/>
  <path d="M72 45 C70 42 66 40 60 40 C54 40 50 43 50 47 C50 51 53 53 59 55 L63 56 C71 59 75 63 75 68 C75 75 69 79 60 79 C51 79 46 74 45 68 L53 66 C54 70 57 73 61 73 C65 73 68 71 68 68 C68 65 65 63 60 61 L56 60 C49 57 45 53 45 47 C45 41 51 36 60 36 C68 36 73 40 74 46 Z" fill="#F5C400"/>
</svg>`;
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.svg'), svgContent);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), svgContent);
  console.log('✓ Created /public/icon.svg and /public/favicon.svg');

  console.log('All branding and PWA assets generated successfully!');
}

generateAssets().catch(err => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
