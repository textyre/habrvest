import { IFormatter } from '../domain/article/IFormatter.js';
import { OutputFormat } from '../domain/shared/OutputFormat.js';

export class FormatterRegistry {
  constructor(private readonly formatters: Record<OutputFormat, IFormatter>) {}

  get(format: OutputFormat): IFormatter {
    return this.formatters[format];
  }
}
