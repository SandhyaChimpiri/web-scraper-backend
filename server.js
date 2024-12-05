const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("chrome-aws-lambda");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const cors = require("cors");

const app = express();

const allowedOrigins = process.env.NODE_ENV === "production"
  ? ["https://web-scraper-frontend-eight.vercel.app"]          // Production frontend
  : ["http://localhost:5173"];                                 // Local frontend

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS error: Origin ${origin} not allowed.`));
    }
  },
  methods: ["GET", "POST"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Initialize screenshots directory
const screenshotsDir = path.join(__dirname, "screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir);
}
app.use("/screenshots", express.static(screenshotsDir));

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
    browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    const screenshotFilename = `screenshot_${Date.now()}.png`;
    const screenshotPath = path.join(screenshotsDir, screenshotFilename);
    await page.screenshot({ path: screenshotPath, fullPage: true });

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
    res.status(500).json({ error: `Failed to scrape the page` });
  } finally {
    if (browser) await browser.close();
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port: ${PORT}`));

