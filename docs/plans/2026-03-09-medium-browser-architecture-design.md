# Medium + Browser Architecture Design

Date: 2026-03-09

## Goal

Правильно реализовать MediumClient по DDD + Onion архитектуре, разделить ответственности, перенести все JS-скрипты, сделать браузерный слой заменяемым без изменения бизнес-логики.

## Принципы

- **Смена браузерного инструмента** — меняем только `Browser.ts`, `Session.ts`, `Scroller.ts` и что передаём в `BrowserFactory` в composition root. Бизнес-логика не трогается.
- **Новый браузерный источник** (StackOverflow) — создаём класс расширяющий `BaseBrowserSourceClient`, больше ничего не меняем.
- **`BaseSourceClient`** — единый суперкласс для всех источников (Habr и Medium).
- **`CollectionAccumulator`** — отдельная ответственность за накопление результата, дедупликацию, счёт ошибок.
- **DI везде** — реализации получают зависимости снаружи, не создают их сами.

---

## Слой 1: Domain (без изменений)

```
domain/
  article/
    Article.ts
    IFormatter.ts
    ISorter.ts
    ITransformer.ts
  source/
    ISourceClient.ts
    FetchResult.ts
    Publication.ts
  shared/
    Order.ts
    SortField.ts
    OutputFormat.ts
    TopPeriod.ts
    index.ts
```

---

## Слой 2: Infrastructure

### HTTP, Cache, Logger — без изменений

### Browser (новый подслой)

```
infrastructure/browser/
  IBrowser.ts       # контракт: createContext(cookies) → Promise<ISession>
  ISession.ts       # контракт: newPage() → Promise<IScroller>; close() → Promise<void>
  IScroller.ts      # контракт: scroll() → Promise<void>; page: IPage
  IPage.ts          # контракт: goto(url); evaluate(fn); waitForTimeout(ms)
  Browser.ts        # implements IBrowser — принимает chromium: BrowserType через DI
  Session.ts        # implements ISession — принимает BrowserContext через DI
  Scroller.ts       # implements IScroller — принимает Page через DI
  BrowserFactory.ts # создаёт Browser/Session/Scroller; принимает chromium через DI
```

**Смена инструмента:** заменяем реализации Browser/Session/Scroller и что передаём в BrowserFactory в composition root. Контракты и бизнес-логика не меняются.

---

## Слой 3: Sources

### BaseSourceClient (рефакторинг)

```
sources/
  BaseSourceClient.ts         # abstract
                              # collect() — оркестрирует обход
                              # abstract hasMore(): boolean
                              # abstract fetchNext(): Promise<PageResponse>
  CollectionAccumulator.ts    # дедупликация (seen Set)
                              # накопление publications
                              # счёт ошибок
                              # возвращает FetchResult
```

### Habr (рефакторинг — адаптация под новый BaseSourceClient)

```
sources/habr/
  HabrSearchClient.ts   # hasMore() → page <= totalPages
                        # fetchNext() → fetchPage(page++)
  HabrHubClient.ts      # hasMore() → page <= totalPages
                        # fetchNext() → fetchPage(page++)
```

### Medium (новый)

```
sources/medium/
  BaseBrowserSourceClient.ts  # abstract, extends BaseSourceClient
                              # бизнес-логика браузерного обхода:
                              #   открытие сессии, навигация, закрытие
                              # принимает BrowserFactory через DI
                              # abstract fetchPage(url): Promise<PageResponse>

  MediumClient.ts             # extends BaseBrowserSourceClient
                              # hasMore() → currentMonth >= startMonth
                              # fetchNext() → nextUrl (year/month--)
                              # использует MediumPageParser + MediumArticleMapper

  MediumPageParser.ts         # DOM → MediumArticleRaw[]
                              # парсинг карточек: title, url, author,
                              #   date, claps, description, isMember

  MediumArticleMapper.ts      # MediumArticleRaw → Publication
                              # parseClaps(str) → number
```

---

## Слой 4: Formatters

```
formatters/
  BaseFormatter.ts              # abstract — escapeCell, escapeCsv, truncate, formatDate
  MarkdownFormatter.ts          # без изменений
  JsonFormatter.ts              # без изменений
  CsvFormatter.ts               # без изменений
  MediumMarkdownFormatter.ts    # extends BaseFormatter
                                # колонки: Claps, Date, Member, Title, Author
  FormatterRegistry.ts          # без изменений
```

---

## Слой 5: Presentation

```
presentation/cli/commands/
  SearchCommand.ts              # без изменений
  HubCommand.ts                 # без изменений
  MediumCommand.ts              # habrvest medium <tag> --from <year> --to <year>
                                # использует MediumClient + MediumMarkdownFormatter
  MediumLoginCommand.ts         # habrvest medium login
                                # запускает браузер, ждёт логина, сохраняет cookies
                                # логика из medium-login.js
```

---

## Что удаляется

- `src/medium-scraper.js` — перенесён в MediumClient + MediumPageParser + MediumArticleMapper
- `src/medium-login.js` — перенесён в MediumLoginCommand
- `src/medium-to-md.js` — перенесён в MediumMarkdownFormatter

---

## Out of Scope

- StackOverflow клиент (архитектура готова, реализация — отдельная задача)
- Тесты для browser-слоя (требуют моков Playwright)
