import { BrowserType } from 'playwright';
import { IBrowser } from './IBrowser.js';
import { Browser } from './Browser.js';

export class BrowserFactory {
  constructor(private readonly chromium: BrowserType) {}

  create(): IBrowser {
    return new Browser(this.chromium);
  }
}
