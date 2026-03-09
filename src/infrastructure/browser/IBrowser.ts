import { ISession } from './ISession.js';

export interface IBrowser {
  connect(): Promise<void>;
  createSession(cookiesPath: string): Promise<ISession>;
  close(): Promise<void>;
}
