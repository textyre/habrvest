import { IFormatter, OutputFormat } from '../types.js';

export class FormatterRegistry {
  constructor(private readonly formatters: Record<OutputFormat, IFormatter>) {}

  get(format: OutputFormat): IFormatter {
    return this.formatters[format];
  }
}
