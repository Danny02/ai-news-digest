# 08 — Build the RSS fetch path

Status: out-of-scope (closed)
Type: task
Blocked by:

## Question

Which RSS feeds form the source, and how does the job fetch and parse them each
day?

Ticket 07 closed after finding no free accessible X-search path. The source is
now free public RSS feeds (pivot decided on the map). This ticket makes that
concrete.

Resolve:

- Pick a concrete set of AI-news RSS feeds: key accounts, orgs, and newsletters
  with public RSS. (This is the mechanical "which URLs" part; the taste part of
  *what's interesting* lives in ticket 02. Co-ordinate: the feed list must
  serve 02's bar.)
- Define the fetch: fetch each feed (RSS 2.0 / Atom), parse items, extract
  title, link, summary/description, and publish date per item.
- Note feed health: staleness, 404s, feeds that die. Record how to detect and
  drop a dead feed.

The output is the working RSS fetcher (linked as an asset) plus a feed list.

## Resolution: out of scope

Never started. The RSS pivot existed only because X search looked unreachable
for free. The Desearch API (ticket 01) restored X search at ~$0.14/month, so
the source reverted to X and this ticket sits past the destination.

RSS would also have narrowed the net to feeds the reader already subscribes to,
losing the discovery value of searching the broader X firehose.
