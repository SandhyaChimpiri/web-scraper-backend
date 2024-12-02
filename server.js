const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN=process.env.CORS_ORIGIN || "http://localhost:5173"

// Enable CORS
app.use(cors({
  origin: CORS_ORIGIN,  // Allow your frontend URL
  methods: ['GET', 'POST'],        // Allow methods you want (GET, POST, etc.)
  allowedHeaders: ['Content-Type'] // Allow specific headers
}));

// Serve screenshots directory
const screenshotsDir = path.join(__dirname, "screenshots");

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir); // Create the screenshots directory if it doesn't exist
}

app.use("/screenshots", express.static(screenshotsDir));

app.use(express.json());

// app.post("/scrape", async (req, res) => {
//   const { url } = req.body;

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
      headless: process.env.NODE_ENV === 'production',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();

    await page.goto(url);

    // Save the screenshot as a file
    const screenshotFilename = `screenshot_${Date.now()}.png`;
    const screenshotPath = path.join(screenshotsDir, screenshotFilename);

    await page.screenshot({ path: screenshotPath, fullPage: true });

    const data = await page.evaluate(() => {
      // Extract links
      const links = Array.from(document.querySelectorAll("a"))
        .map(a => ({
          href: a.href,
          text: a.innerText.trim(),
        }))
        .filter(link => link.href && link.text); // Filter valid links

      // Extract contents
      const contentElements = Array.from(
        document.querySelectorAll("title, a, p, span, h1, h2, h3, h4, h5, h6")
      )
        .filter((el) => el.childNodes.length === 1 && el.innerText.trim())
        .map((el) => el.innerText.trim());
      const uniqueContents = Array.from(new Set(contentElements));

      // Extract images
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
    console.error("Error scraping:", error.message);
    res.status(500).json({ error: "Failed to scrape the page" });
  }
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
