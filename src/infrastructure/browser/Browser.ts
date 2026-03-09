import { BrowserType, Browser as PlaywrightBrowser, BrowserContext } from 'playwright';
import { readFileSync } from 'node:fs';
import { IBrowser } from './IBrowser.js';
import { ISession } from './ISession.js';
import { Session } from './Session.js';

export class Browser implements IBrowser {
  private browser: PlaywrightBrowser | null = null;

  constructor(private readonly chromium: BrowserType) {}

  async connect(): Promise<void> {
    this.browser = await this.chromium.connectOverCDP('http://localhost:9222');
  }

  async createSession(cookiesPath: string): Promise<ISession> {
    if (!this.browser) throw new Error('Browser not connected. Call connect() first.');
    const context: BrowserContext = this.browser.contexts()[0] ?? await this.browser.newContext();
    const cookies = JSON.parse(readFileSync(cookiesPath, 'utf-8'));
    await context.addCookies(cookies);
    return new Session(context);
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }
}
