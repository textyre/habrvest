import { BaseSourceClient } from './BaseSourceClient.js';
import { IBrowser } from '../infrastructure/browser/IBrowser.js';
import { ISession } from '../infrastructure/browser/ISession.js';
import { IPage } from '../infrastructure/browser/IPage.js';
import { BrowserFactory } from '../infrastructure/browser/BrowserFactory.js';
import { ILogger } from '../infrastructure/logger/ILogger.js';

export abstract class BaseBrowserSourceClient extends BaseSourceClient {
  constructor(
    protected readonly browserFactory: BrowserFactory,
    protected readonly cookiesPath: string,
    logger: ILogger,
  ) {
    super(logger);
  }

  // Оркестрирует браузерную сессию, делегирует обход наследнику
  protected async withSession<T>(fn: (page: IPage) => Promise<T>): Promise<T> {
    const browser: IBrowser = this.browserFactory.create();
    await browser.connect();
    const session: ISession = await browser.createSession(this.cookiesPath);
    const page: IPage = await session.newPage();
    try {
      return await fn(page);
    } finally {
      await page.close();
      await session.close();
      await browser.close();
    }
  }
}
