# 07 — Build the free scraper fetch path

Status: out-of-scope (closed)
Type: task
Blocked by: (01)

## Question

Which free proxy search site should the job scrape, and how does the fetcher
extract posts from it each day?

Ticket 01 recommended the paid X API, but the reader overrode that for a free,
own-cost path and accepts fragility. This ticket makes that override concrete.

Resolve (research to narrow the site choice, then task to build the fetcher):

- Pick a specific proxy search site that (a) renders results in parseable HTML
  or JSON, (b) supports X's curated-keyword query operators (needed by ticket
  02's query set), and (c) needs no login. Candidates surfaced so far:
  twitterviewer.net, ilo.so — verify each actually works and is scrapable.
- Define the extraction: the URL shape for a query, how results are paginated/
  capped, and the exact selectors/JSON fields to pull out post text, author,
  link, and date.
- Note the fragility contract: this path WILL break when X or the site changes;
  record how to detect breakage and recover.

The output is the working fetcher (linked as an asset) plus a short
operability note. Until this resolves, tickets 02's design cannot be exercised
end-to-end.
