const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const path = require("path");
const fs = require("fs");
const { executablePath } = require("puppeteer");
require("dotenv").config();

puppeteer.use(StealthPlugin());

const app = express();
const CorsOrigin = process.env.CORS_ORIGIN || "https://web-scraper-frontend-eight.vercel.app";

const cors = require("cors");

const allowedOrigins = [
  "http://localhost:5173", // Frontend in development
  "https://web-scraper-frontend-eight.vercel.app", // Frontend in production
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or CURL requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true); // Allow the origin
    } else {
      callback(new Error("Not allowed by CORS")); // Block the origin
    }
  },
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
      executablePath: process.env.CHROMIUM_PATH || executablePath(),
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

app.listen(process.env.PORT || 5000, () => console.log(`Server running on port ${process.env.PORT || 5000}`));


