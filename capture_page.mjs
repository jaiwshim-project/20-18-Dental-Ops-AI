import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';

const chromeExe = execSync('where chrome').toString().trim().split('\n')[0];

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: chromeExe || 'C:\Program Files\Google\Chrome\Application\chrome.exe'
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://medvo.vercel.app/', { waitUntil: 'networkidle2', timeout: 30000 });
await page.screenshot({ path: './screenshot_medvo.png', fullPage: false });
console.log('✅ Screenshot saved: screenshot_medvo.png');
await browser.close();
