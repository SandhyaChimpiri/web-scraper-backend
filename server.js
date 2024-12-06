const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const cors = require("cors");

const app = express();
// console.log(puppeteer.executablePath());

const allowedOrigins = process.env.NODE_ENV === "production"
  ? ["https://web-scraper-frontend-eight.vercel.app"]          // Production frontend
  : ["http://localhost:5173"];                                 // Local frontend

const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use((req, res, next) => {
  console.log("Origin: ", req.get("Origin"));
  next();
});
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
    const executablePath = (process.env.NODE_ENV === 'production' ?
      '/opt/render/.cache/puppeteer/chrome/linux-131.0.6778.87/chrome-linux64/chrome' : // Render (Linux)
      'C:/Users/Admin/.cache/puppeteer/chrome/win64-131.0.6778.87/chrome-win64/chrome.exe' // Local (Windows)
    ) 
     
  // console.log(`Using Chromium at: ${executablePath}`);
      browser = await puppeteer.launch({
      executablePath: executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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

