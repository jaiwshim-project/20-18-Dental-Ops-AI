const puppeteer = require("puppeteer-core");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    defaultViewport: { width: 1200, height: 2400 }
  });
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
  await page.screenshot({ path: "screenshot-index.png", fullPage: true });
  console.log("✅ Screenshot saved: screenshot-index.png");
  await browser.close();
})();
