const { execSync } = require("child_process");

console.log("Starting Chromium installation...");

try {
  // Explicitly run Puppeteer's installation script
  execSync("node node_modules/puppeteer/install.js", { stdio: "inherit" });
  console.log("Chromium installed successfully.");
} catch (error) {
  console.error("Error installing Chromium:", error.message);
  process.exit(1);
}
