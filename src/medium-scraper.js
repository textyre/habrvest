const { chromium } = require('/tmp/pwtest/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const TAG = process.argv[2] || 'accessibility-testing';
const START_YEAR = parseInt(process.argv[3] || '2013');
const END_YEAR = parseInt(process.argv[4] || new Date().getFullYear());
const CACHE_DIR = path.join(process.env.HOME, '.cache', 'medium-scraper');
const CACHE_FILE = path.join(CACHE_DIR, `${TAG}.json`);
const SESSION_FILE = path.join(CACHE_DIR, 'session.json');

fs.mkdirSync(CACHE_DIR, { recursive: true });

let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  process.stderr.write(`Loaded cache: ${Object.keys(cache).length} pages\n`);
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0] || await browser.newContext();

  // Load session cookies
  const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  await context.addCookies(cookies);
  process.stderr.write(`Loaded ${cookies.length} session cookies\n`);

  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  const seen = new Set();
  const results = [];

  for (let year = END_YEAR; year >= START_YEAR; year--) {
    for (let month = 12; month >= 1; month--) {
      const now = new Date();
      if (year === now.getFullYear() && month > now.getMonth() + 1) continue;

      const key = `${year}/${month}`;
      const url = `https://medium.com/tag/${TAG}/archive/${year}/${month}`;

      if (cache[key]) {
        process.stderr.write(`[cache] ${key}: ${cache[key].length} articles\n`);
        for (const a of cache[key]) {
          if (a.url && !seen.has(a.url)) { seen.add(a.url); results.push(a); }
        }
        continue;
      }

      process.stderr.write(`Fetching ${key}...`);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);

        // Scroll to load all articles
        let prevHeight = 0;
        for (let i = 0; i < 10; i++) {
          const height = await page.evaluate(() => document.body.scrollHeight);
          if (height === prevHeight) break;
          prevHeight = height;
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(1500);
        }

        const articles = await page.evaluate(() => {
          const cards = document.querySelectorAll('[data-testid="post-preview"]');
          return Array.from(cards).map(card => {
            const linkEl = card.querySelector('[data-href]');
            const url = (linkEl?.getAttribute('data-href') || '').split('?')[0];
            const titleEl = card.querySelector('h2');
            const title = titleEl?.textContent?.trim() || '';
            const authorLinks = card.querySelectorAll('a[rel="noopener follow"] p');
            const author = authorLinks[authorLinks.length - 1]?.textContent?.trim() || '';
            const timeEl = card.querySelector('time');
            const date = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';
            const h3El = card.querySelector('h3, h4');
            const description = h3El?.textContent?.trim() || '';
            const allSpans = Array.from(card.querySelectorAll('p, span'));
            const clapsEl = allSpans.find(s => /^\d[\d,.]*[KM]?$/.test(s.textContent?.trim() || ''));
            const claps = clapsEl?.textContent?.trim() || '';
            const isMember = card.innerHTML.includes('Member-only') || card.innerHTML.includes('member-only');
            return { title, url, author, date, claps, description, isMember };
          }).filter(a => a.title && a.url);
        });

        const newArticles = articles.filter(a => a.url && !seen.has(a.url));
        for (const a of newArticles) { seen.add(a.url); results.push(a); }

        cache[key] = newArticles;
        saveCache();

        const memberCount = articles.filter(a => a.isMember).length;
        process.stderr.write(` ${articles.length} articles (${memberCount} member-only)\n`);

        await page.waitForTimeout(500);
      } catch (err) {
        process.stderr.write(` ERROR: ${err.message}\n`);
        cache[key] = [];
        saveCache();
      }
    }
  }

  await page.close();
  await browser.close();

  process.stderr.write(`\nTotal unique articles: ${results.length}\n`);
  console.log(JSON.stringify(results, null, 2));
})();
