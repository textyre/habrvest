const { chromium } = require('/tmp/pwtest/node_modules/playwright-extra');
const StealthPlugin = require('/tmp/pwtest/node_modules/puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

chromium.use(StealthPlugin());

const SESSION_FILE = path.join(process.env.HOME, '.cache', 'medium-scraper', 'session.json');
fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://medium.com/m/signin', { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('Залогинься в браузере. После входа нажми Enter здесь...');
  process.stdin.resume();
  await new Promise(resolve => process.stdin.once('data', resolve));

  // save cookies + localStorage
  const cookies = await context.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  console.log('Сессия сохранена в', SESSION_FILE);

  await browser.close();
  process.exit(0);
})();
