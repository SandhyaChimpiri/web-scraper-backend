const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("chrome-aws-lambda");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const cors = require("cors");

// Set Puppeteer cache directory
process.env.PUPPETEER_CACHE_DIR = "/opt/render/.cache/puppeteer";

const app = express();

const CorsOrigin =
  process.env.NODE_ENV === "production"
    ? "https://web-scraper-frontend-eight.vercel.app"
    : "http://localhost:5173";

const corsOptions = {
  origin: CorsOrigin,
  methods: ["GET", "POST"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Route to verify backend status
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// Scraping route
app.post("/scrape", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/.test(url)) {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  let browser;
  try {
    console.log("Launching Puppeteer...");
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    console.log(`Navigating to ${url}...`);

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Handle screenshots directory
    const screenshotsDir = path.join(__dirname, "screenshots");
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir);
    }
    app.use("/screenshots", express.static(screenshotsDir));

    // Take screenshot
    const screenshotFilename = `screenshot_${Date.now()}.png`;
    const screenshotPath = path.join(screenshotsDir, screenshotFilename);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Scrape data
    const data = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"))
        .map((a) => ({ href: a.href, text: a.innerText.trim() }))
        .filter((link) => link.href && link.text);

      const contentElements = Array.from(
        document.querySelectorAll("title, p, span, h1, h2, h3, h4, h5, h6")
      ).map((el) => el.innerText.trim());

      const images = Array.from(document.querySelectorAll("img")).map((img) => ({
        src: img.src,
        alt: img.alt || "Image",
      }));

      return { links, contents: [...new Set(contentElements)], images };
    });

    res.json({ data, screenshot: `/screenshots/${screenshotFilename}` });
  } catch (err) {
    console.error("Scraping error:", err);
    res.status(500).json({ error: `Failed to scrape the page: ${err.message}` });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
});
