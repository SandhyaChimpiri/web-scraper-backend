const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN=process.env.CORS_ORIGIN || "https://web-scraper-cyan-xi.vercel.app/"

const allowedOrigins = [
  CORS_ORIGIN,                    // Deployed frontend URL
  "http://localhost:5173"         // Local development URL  
];

app.use(cors({
  origin: function (origin, callback) {
    console.log(origin);
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {  // !origin allows Postman and server-to-server requests
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },                                   // to allow frontend URL
  methods: ['GET', 'POST'],            // to allow methods you want (GET, POST, etc.)
  allowedHeaders: ['Content-Type']     // to allow specific headers
}));

app.options("*", cors());  // Handle preflight requests

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

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
  
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  
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

    await browser.close();
  
    res.json({
      data,
      screenshot: `/screenshots/${screenshotFilename}`,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to scrape the page",
      details: error.message,
    });
  }
  
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
