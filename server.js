const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const path = require("path");
const fs = require("fs");
const { executablePath } = require("puppeteer");
require("dotenv").config();

puppeteer.use(StealthPlugin());

const app = express();
const CorsOrigin ="https://web-scraper-frontend-eight.vercel.app/";

const cors = require("cors");

const corsOptions = {
  origin: CorsOrigin,
  methods: ["GET", "POST"], // Allow these HTTP methods
  credentials: true, // Allow cookies or other credentials
};

app.use(cors(corsOptions));

// Screenshots directory
const screenshotsDir = path.join(__dirname, "screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir);  // Create the screenshots directory if it doesn't exist
}

app.use("/screenshots", express.static(screenshotsDir));

app.use(express.json());

app.post("/scrape", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/.test(url)) {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
    });

    const page = await browser.newPage();

    console.log(`Navigating to ${url}...`);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    const screenshotFilename = `screenshot_${Date.now()}.png`;
    const screenshotPath = path.join(screenshotsDir, screenshotFilename);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const data = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"))
        .map(a => ({ href: a.href, text: a.innerText.trim() }))
        .filter(link => link.href && link.text);

      const contentElements = Array.from(document.querySelectorAll("title, p, span, h1, h2, h3, h4, h5, h6"))
        .map(el => el.innerText.trim());

      return { links, contents: [...new Set(contentElements)] };
    });

    await browser.close();

    res.json({ data, screenshot: `/screenshots/${screenshotFilename}` });
  } catch (err) {
    console.error(err);
    setError(`Failed to scrape the page. Error: ${err.message}`);
  }
  
});

const PORT = process.env.PORT || 5000; // Default to 5000 only if PORT is not set
app.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
});



