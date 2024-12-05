const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chromium = require('chrome-aws-lambda');

// Define the path for the Chromium binary
const chromiumBinaryPath = path.join(__dirname, '..', 'node_modules', 'chrome-aws-lambda', 'bin', 'chromium.br');

// Check if the Chromium binary exists
if (!fs.existsSync(chromiumBinaryPath)) {
  console.log('Chromium binary not found, downloading...');
  
  // Download Chromium binary (if necessary, modify this based on your setup)
  execSync('npx chrome-aws-lambda@latest install', { stdio: 'inherit' });
  console.log('Chromium binary installed successfully.');
} else {
  console.log('Chromium binary already exists.');
}

