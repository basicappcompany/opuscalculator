# ADR 005: Agent-first positioning

Date: 27 Nov 2026. Status: accepted (owner request).

## Decision

Opus Calculator is positioned as "exact calculators for people and AI agents". The calculator page is tool-first (title, one answer sentence, the tool, actions on the result card), and every page offers a "Use with AI" dialog. The home page leads with search and the MCP address, `/agents/` documents the MCP server, `llms.txt`, the JSON index and markdown copies, and the footer links it.

## Why

The MCP server, `llms.txt` and markdown copies already existed but were not visible in the product or the brand. The earlier "free calculators for everyday questions" copy described neither the exactness nor the agent access that set the site apart.

## Consequences

Titles, the header, the footer, the social image and `llms.txt` use the new line. The old tagline is retired like the "365" one in ADR 004. Search reads `/calculators.json`, so it lists published calculators only (rule 6).
