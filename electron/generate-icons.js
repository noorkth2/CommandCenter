'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Disable hardware acceleration to make it more reliable in headless environments
app.disableHardwareAcceleration();

const buildDir = path.join(__dirname, '..', 'build');
const iconsetDir = path.join(buildDir, 'icon.iconset');
const svgPath = path.join(__dirname, '..', 'src', 'assets', 'logo.svg');

// Simple ICO encoder in pure JS
function encodeIco(images) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = images.length;
  
  const totalHeaderSize = headerSize + dirEntrySize * numImages;
  const totalSize = totalHeaderSize + images.reduce((sum, img) => sum + img.buffer.length, 0);
  const outBuffer = Buffer.alloc(totalSize);
  
  // Write Header
  outBuffer.writeUInt16LE(0, 0); // Reserved
  outBuffer.writeUInt16LE(1, 2); // Type = 1 (ICO)
  outBuffer.writeUInt16LE(numImages, 4); // Number of images
  
  let currentOffset = totalHeaderSize;
  
  for (let i = 0; i < numImages; i++) {
    const img = images[i];
    const entryOffset = headerSize + i * dirEntrySize;
    
    // Width (1 byte, 0 represents 256)
    outBuffer.writeUInt8(img.width >= 256 ? 0 : img.width, entryOffset);
    // Height (1 byte, 0 represents 256)
    outBuffer.writeUInt8(img.height >= 256 ? 0 : img.height, entryOffset + 1);
    // Color count (1 byte, 0)
    outBuffer.writeUInt8(0, entryOffset + 2);
    // Reserved (1 byte, 0)
    outBuffer.writeUInt8(0, entryOffset + 3);
    // Color planes (2 bytes, 1)
    outBuffer.writeUInt16LE(1, entryOffset + 4);
    // Bits per pixel (2 bytes, 32)
    outBuffer.writeUInt16LE(32, entryOffset + 6);
    // Image data size (4 bytes)
    outBuffer.writeUInt32LE(img.buffer.length, entryOffset + 8);
    // Image data offset (4 bytes)
    outBuffer.writeUInt32LE(currentOffset, entryOffset + 12);
    
    // Copy buffer
    img.buffer.copy(outBuffer, currentOffset);
    currentOffset += img.buffer.length;
  }
  
  return outBuffer;
}

async function runIconGeneration() {
  console.log('[Icon Generator] Starting icon generation process...');
  
  if (!fs.existsSync(svgPath)) {
    throw new Error(`Branding SVG not found at: ${svgPath}`);
  }
  
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  // Create directories
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(iconsetDir, { recursive: true });
  
  // Sizing matrix for macOS iconset
  const iconsetFiles = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 }
  ];
  
  // Windows ICO target sizes
  const icoSizes = [16, 32, 48, 64, 128, 256];
  
  // Create BrowserWindow
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false
    }
  });
  
  // Generate HTML containing the SVG scaled to fill the viewport
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          background: transparent;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        svg {
          width: 100%;
          height: 100%;
          display: block;
        }
      </style>
    </head>
    <body>
      ${svgContent}
    </body>
    </html>
  `;
  
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
  
  await win.loadURL(dataUrl);
  
  // Helper to capture a resolution
  async function captureResolution(size) {
    win.setSize(size, size);
    // Give a brief moment for Chrome engine to execute vector layout/reflow
    await new Promise(resolve => setTimeout(resolve, 100));
    const image = await win.webContents.capturePage();
    return image.toPNG();
  }
  
  // 1. Capture and write all macOS iconset images
  console.log('[Icon Generator] Rendering macOS iconset PNGs...');
  for (const item of iconsetFiles) {
    const pngBuffer = await captureResolution(item.size);
    const destPath = path.join(iconsetDir, item.name);
    fs.writeFileSync(destPath, pngBuffer);
    console.log(`  - Rendered: ${item.name} (${item.size}x${item.size})`);
  }
  
  // 2. Capture and pack Windows ICO file
  console.log('[Icon Generator] Rendering Windows ICO variants...');
  const icoImages = [];
  for (const size of icoSizes) {
    const pngBuffer = await captureResolution(size);
    icoImages.push({ width: size, height: size, buffer: pngBuffer });
    console.log(`  - Rendered: Windows ${size}x${size}`);
  }
  
  console.log('[Icon Generator] Packing Windows ICO file...');
  const icoBuffer = encodeIco(icoImages);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
  console.log('  - Created: build/icon.ico');
  
  // 3. Save standard icon.png (512x512) for Linux
  console.log('[Icon Generator] Saving standard icon.png (512x512)...');
  const linuxPng = await captureResolution(512);
  fs.writeFileSync(path.join(buildDir, 'icon.png'), linuxPng);
  console.log('  - Created: build/icon.png');
  
  // 4. Generate macOS ICNS file using macOS iconutil
  if (process.platform === 'darwin') {
    console.log('[Icon Generator] Compiling macOS icon.icns via iconutil...');
    try {
      execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(buildDir, 'icon.icns')}"`);
      console.log('  - Created: build/icon.icns');
      
      // Clean up iconset folder
      console.log('[Icon Generator] Cleaning up build/icon.iconset temporary files...');
      fs.rmSync(iconsetDir, { recursive: true, force: true });
      console.log('  - Cleanup complete.');
    } catch (err) {
      console.warn('[Icon Generator] WARNING: Failed to run iconutil. This is expected if build is not run on macOS.', err.message);
    }
  } else {
    console.log('[Icon Generator] Non-macOS environment detected. Skipping iconutil icns creation.');
  }
  
  win.close();
}

app.whenReady().then(async () => {
  try {
    await runIconGeneration();
    console.log('[Icon Generator] Icon generation completed successfully!');
    app.quit();
  } catch (err) {
    console.error('[Icon Generator] FATAL ERROR:', err);
    app.exit(1);
  }
});
