import { BrowserContext, Page } from 'playwright';
import { ISession } from './ISession.js';
import { IPage } from './IPage.js';

export class Session implements ISession {
  constructor(private readonly context: BrowserContext) {}

  async newPage(): Promise<IPage> {
    const page: Page = await this.context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    return page as unknown as IPage;
  }

  async close(): Promise<void> {
    await this.context.close();
  }
}
