import { IPage } from './IPage.js';

export interface ISession {
  newPage(): Promise<IPage>;
  close(): Promise<void>;
}
