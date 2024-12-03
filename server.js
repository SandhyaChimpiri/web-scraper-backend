const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { executablePath } = require("puppeteer");
require("dotenv").config();

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "https://web-scraper-frontend-iota.vercel.app" // Add your deployed frontend URL
];

app.use(cors({
  origin: function (origin, callback) {
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'], // Allow specific methods
  allowedHeaders: ['Content-Type'],   // Allow specific headers
  credentials: true                   // Include cookies if needed
}));

//  screenshots directory
const screenshotsDir = path.join(__dirname, "screenshots");

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir);         // Create the screenshots directory if it doesn't exist
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
  console.log('Executable Path:', executablePath());

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--no-zygote',
    '--single-process',
  ],
      executablePath: process.env.CHROMIUM_PATH || executablePath()
    });
    const page = await browser.newPage();
  
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 }) // 30 seconds
    .catch(err => {
     throw new Error(`Page took too long to load: ${err.message}`);
     });

    const screenshotFilename = `screenshot_${Date.now()}.png`;
    const screenshotPath = path.join(screenshotsDir, screenshotFilename);

    await page.screenshot({ path: screenshotPath, fullPage: true });
  
    const data = await page.evaluate(() => {
  
      const links = Array.from(document.querySelectorAll("a"))
        .map(a => ({
          href: a.href,
          text: a.innerText.trim(),
        }))
        .filter(link => link.href && link.text);
  
      const contentElements = Array.from(
        document.querySelectorAll("title, a, p, span, h1, h2, h3, h4, h5, h6")
      )
        .filter((el) => el.childNodes.length === 1 && el.innerText.trim())
        .map((el) => el.innerText.trim());
  
      const uniqueContents = Array.from(new Set(contentElements));
  
      const images = Array.from(document.querySelectorAll("img")).map((img) => ({
        src: img.src,
        alt: img.alt || "No description",
        title: img.title || "No title",
      }));
  
      return { links, contents: uniqueContents, images };
    });
  
    res.json({
      data,
      screenshot: `/screenshots/${screenshotFilename}`,
    });
  } catch (error) {
    console.error("Scraping failed:", error); // Logs detailed error to the console
    res.status(500).json({
      error: "Failed to scrape the page",
      details: error.message,  // Sends the error message to the client
    });
  } 
  finally {
    if (browser) {
      await browser.close();
    } 
  }
});

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || "development"} mode`);
  console.log(`Listening at: http://localhost:${PORT}`);
});

