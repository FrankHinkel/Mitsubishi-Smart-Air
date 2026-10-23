// Run with Node + sharp (or set NODE_PATH to the bundled workspace packages).
// Keep the same Lucide paths and palette as the Watch icon, with an opaque background.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

(async () => {
  const root = path.join(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'favicon.svg'), 'utf8');
  const paths = source.slice(source.indexOf('>') + 1, source.lastIndexOf('</svg>')).trim();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 32 32"><rect width="32" height="32" fill="#007f78"/><g transform="translate(4 4)" fill="none" stroke="#f4f6f2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
  await sharp(Buffer.from(svg)).removeAlpha().png().toFile(path.join(root, 'sun-snow.png'));
  console.log('Generated opaque 180px Apple touch icon from the Lucide vector.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
