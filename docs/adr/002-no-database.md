# ADR 002: No database, calculators as TypeScript files

- **Status:** Accepted
- **Date:** 2026-11-22
- **Author:** Opus Calculator owner (drafted with Claude Code, 2026-11-23)

## Context

Each calculator is a description (title, text, inputs, formula, tests, related pages) plus a pure function. There are two ways to hold hundreds or thousands of them: rows in a database or content system, or code in the repository. A database means a server, a schema, migrations, credentials and a runtime dependency on every page view.

## Decision

Calculators are **TypeScript objects in the repository**: hand-written ones in `src/calculators/`, programmatic ones produced by generator functions in `src/generators/` from small lists of specs. They are validated and compiled at build time. There is no database and no CMS (CLAUDE.md rule 4).

## Consequences

- **Good:** zero runtime cost and nothing to run, secure or back up beyond git. Every change is reviewed as a pull request, tested, and can be rolled back with a revert.
- **Good:** the compiler and the tests check a calculator before it ships: types for inputs and outputs, a zod validator on every input, known-answer tests, and the quality gate (`validateForIndexing`).
- **Good:** programmatic generation needs no import step. A generator is a function; the same code that builds the page runs its known-answer checks.
- **Cost:** non-developers cannot edit a calculator without a code change. Acceptable while the owner is the only editor.
- **Cost:** no accounts, saved calculations or comments. There is no migration path to them from here; adding accounts would be a new decision and a new ADR, with its own database and privacy implications.
- **Cost:** a large catalogue makes the repository and the build bigger. The cohort rollout (ADR 003) limits how much is live at once.
