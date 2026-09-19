const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');

// 1. Standard SVG Icon (Heart + ECG pulse + Medical Cross motif)
const svgStandard = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="50%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#064e3b" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Background rounded squircle -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />

  <!-- Inner Soft Container -->
  <rect x="36" y="36" width="440" height="440" rx="90" fill="white" fill-opacity="0.1" />

  <!-- Shield / Heart Center Symbol -->
  <g filter="url(#shadow)">
    <!-- Heart outline/fill -->
    <path d="M256 420C256 420 80 310 80 196C80 132 132 80 196 80C226 80 248 94 256 108C264 94 286 80 316 80C380 80 432 132 432 196C432 310 256 420 256 420Z"
          fill="white" />
  </g>

  <!-- Pulse Line (ECG) across Heart -->
  <path d="M120 210H195L225 150L260 270L290 185L315 210H392"
        stroke="#059669"
        stroke-width="22"
        stroke-linecap="round"
        stroke-linejoin="round" />

  <!-- Small Plus / Cross accent -->
  <path d="M256 310V355M233.5 332.5H278.5"
        stroke="#10b981"
        stroke-width="12"
        stroke-linecap="round" />
</svg>
`;

// 2. Maskable SVG with 20% safe zone padding around the graphic
const svgMaskable = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="50%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
  </defs>

  <!-- Full bleed background for adaptive icons -->
  <rect width="512" height="512" fill="url(#bgGradMask)" />

  <!-- Scaled center icon inside safe zone (diameter 380) -->
  <g transform="translate(66, 66) scale(0.74)">
    <path d="M256 420C256 420 80 310 80 196C80 132 132 80 196 80C226 80 248 94 256 108C264 94 286 80 316 80C380 80 432 132 432 196C432 310 256 420 256 420Z"
          fill="white" />
    <path d="M120 210H195L225 150L260 270L290 185L315 210H392"
          stroke="#059669"
          stroke-width="24"
          stroke-linecap="round"
          stroke-linejoin="round" />
    <path d="M256 310V355M233.5 332.5H278.5"
          stroke="#10b981"
          stroke-width="14"
          stroke-linecap="round" />
  </g>
</svg>
`;

async function generate() {
  console.log("Generating PWA icon assets in public/...");

  const bufStandard = Buffer.from(svgStandard);
  const bufMaskable = Buffer.from(svgMaskable);

  // 1. icon-512.png
  await sharp(bufStandard)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log("✓ icon-512.png created");

  // 2. icon-192.png
  await sharp(bufStandard)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log("✓ icon-192.png created");

  // 3. icon.png (alias for 192)
  await sharp(bufStandard)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon.png'));
  console.log("✓ icon.png created");

  // 4. apple-touch-icon.png (180x180)
  await sharp(bufStandard)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log("✓ apple-touch-icon.png created");

  // 5. icon-maskable-512.png
  await sharp(bufMaskable)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));
  console.log("✓ icon-maskable-512.png created");

  // 6. favicon.ico
  await sharp(bufStandard)
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log("✓ favicon.ico created");

  console.log("All icons generated successfully!");
}

generate().catch(console.error);
