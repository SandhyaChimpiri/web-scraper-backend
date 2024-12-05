const { execSync } = require("child_process");

console.log("Starting Chromium installation...");

try {
  execSync("npx puppeteer install", { stdio: "inherit" });
  console.log("Chromium installed successfully.");
} catch (error) {
  console.error("Error installing Chromium:", error.message);
  process.exit(1);
}
