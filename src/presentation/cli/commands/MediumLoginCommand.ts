import { Command } from 'commander';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { MEDIUM_SESSION_FILE } from '../../../infrastructure/config.js';

export function createMediumLoginCommand(): Command {
  return new Command('login')
    .description('Login to Medium and save session cookies')
    .action(async () => {
      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('https://medium.com/m/signin', { waitUntil: 'domcontentloaded', timeout: 30000 });

      console.log('Login in the browser window. Press Enter here when done...');
      process.stdin.resume();
      await new Promise((resolve) => process.stdin.once('data', resolve));

      const cookies = await context.cookies();
      mkdirSync(dirname(MEDIUM_SESSION_FILE), { recursive: true });
      writeFileSync(MEDIUM_SESSION_FILE, JSON.stringify(cookies, null, 2));
      console.log(`Session saved to ${MEDIUM_SESSION_FILE}`);

      await browser.close();
      process.exit(0);
    });
}
