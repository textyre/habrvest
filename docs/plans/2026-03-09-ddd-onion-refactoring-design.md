# DDD + Onion Architecture Refactoring Design

Date: 2026-03-09

## Goal

Restructure the codebase using DDD + Onion Architecture with full OOP hierarchy:
- Interface (pure contract) → Abstract Base Class (shared logic) → Concrete Implementation
- SOLID, testability, extensibility for new sources (Medium, SO) and formatters
- TDD-ready structure

## Layer Responsibilities

### `domain/` — Core, zero dependencies
Pure contracts and value objects. No logic, no imports from other layers.

- `article/Article.ts` — immutable value object
- `article/IFormatter.ts` — formatter port
- `article/ISorter.ts` — sorter port
- `article/ITransformer.ts` — transformer port
- `source/ISourceClient.ts` — pure source contract
- `source/FetchResult.ts` — result type
- `source/Publication.ts` — raw Habr API type (HabrPublication)
- `shared/Order.ts`, `SortField.ts`, `OutputFormat.ts`, `TopPeriod.ts` — enums

### `application/` — Orchestration
Coordinates use of domain interfaces. No infrastructure details.

- `App.ts` — orchestrates search/hub flow (replaces current App + hub inline logic)

### `infrastructure/` — External concerns only
HTTP, file system, cache, logger. The only place that touches I/O.

- `http/HttpClient.ts` — fetch with retry, rate limiting
- `http/Throttler.ts`
- `cache/ICache.ts` + `cache/FileCache.ts`
- `logger/ILogger.ts` + `logger/Logger.ts`
- `config.ts`

### `shared/` — Utilities (no source/format specifics)
Abstract base classes with shared logic, usable across layers.

- `sorter/BaseSorter.ts` — abstract class implementing `ISorter`; methods: `byVotes`, `byDate`, `byViews`, `byBookmarks`, `byComments`; `sort(field, asc)` dispatches to method
- `transformer/ArticleTransformer.ts` — implements `ITransformer`
- `formatter/BaseFormatter.ts` — abstract class implementing `IFormatter`; shared escape/header logic

### `sources/` — Concrete source implementations
Three-level hierarchy: `ISourceClient` → `BaseSourceClient` → specific.

- `BaseSourceClient.ts` — abstract class: pagination loop, deduplication, error counting, sequential fetch (anti-DDoS)
- `habr/HabrSearchClient.ts` — implements `buildUrl(page)` and `parseResponse()`
- `habr/HabrHubClient.ts` — hub-specific URL building
- `medium/MediumClient.ts` — stub for future implementation

### `formatters/` — Concrete formatter implementations
Three-level: `IFormatter` → `BaseFormatter` → specific.

- `MarkdownFormatter.ts`
- `JsonFormatter.ts`
- `CsvFormatter.ts`
- `FormatterRegistry.ts` — maps `OutputFormat` → `IFormatter`

### `presentation/` — CLI entry point
Composition root + Commander setup. No business logic.

- `cli/index.ts` — wires all dependencies (composition root)
- `cli/commands/SearchCommand.ts` — parses opts, calls App
- `cli/commands/HubCommand.ts` — parses opts, calls App

## Class Hierarchy Summary

```
ISourceClient
  └─ BaseSourceClient (pagination, deduplication, sequential fetching)
       ├─ HabrSearchClient
       ├─ HabrHubClient
       └─ MediumClient (stub)

ISorter
  └─ BaseSorter (byVotes, byDate, byViews, byBookmarks, byComments, sort dispatch)

IFormatter
  └─ BaseFormatter (escape, shared rendering helpers)
       ├─ MarkdownFormatter
       ├─ JsonFormatter
       └─ CsvFormatter
```

## Key Decisions

- `types.ts` is deleted — all types distributed to their respective layer
- `HabrClient` and `HubClient` are split into `HabrSearchClient` / `HabrHubClient` — different URL strategies
- Pagination/deduplication logic (currently duplicated) moves to `BaseSourceClient`
- `FileCache` gets `ICache` interface for testability
- `App.ts` handles both search and hub commands (currently hub logic is inline in `index.ts`)
- `mcp.ts` stays as-is (not in scope)

## Out of Scope

- MediumClient / SOClient full implementation (stubs only)
- Tests (separate TDD phase after refactoring)
- MCP server changes
