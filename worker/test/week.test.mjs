import test from "node:test";
import assert from "node:assert/strict";
import {
  weekKeyOf,
  mondayOf,
  shiftWeek,
  weekLabel,
  todayUTC,
  isValidDate,
  isValidWeekKey,
} from "../src/week.js";

test("weekKeyOf matches ISO-8601 across year boundaries", () => {
  // The cases where week-numbering year != calendar year.
  assert.equal(weekKeyOf("2026-08-14"), "2026-W33");
  assert.equal(weekKeyOf("2027-01-01"), "2026-W53"); // Friday, still 2026's week
  assert.equal(weekKeyOf("2026-01-01"), "2026-W01"); // Thursday
  assert.equal(weekKeyOf("2023-01-01"), "2022-W52"); // Sunday
  assert.equal(weekKeyOf("2021-01-04"), "2021-W01");
  assert.equal(weekKeyOf("2020-12-31"), "2020-W53"); // 2020 is a 53-week year
});

test("a week starts on Monday", () => {
  assert.equal(mondayOf("2026-W33"), "2026-08-10");
  assert.equal(weekKeyOf(mondayOf("2026-W33")), "2026-W33");
  for (const d of ["2026-08-10", "2026-08-14", "2026-08-16"]) {
    assert.equal(weekKeyOf(d), "2026-W33", `${d} belongs to W33`);
  }
  assert.equal(weekKeyOf("2026-08-17"), "2026-W34");
});

test("shiftWeek crosses year boundaries correctly", () => {
  assert.equal(shiftWeek("2026-W33", -1), "2026-W32");
  assert.equal(shiftWeek("2026-W01", -1), "2025-W52");
  assert.equal(shiftWeek("2020-W53", 1), "2021-W01");
  assert.equal(shiftWeek("2021-W01", -1), "2020-W53");
  assert.equal(shiftWeek("2026-W33", 52), weekKeyOf("2027-08-12"));
});

test("week keys sort chronologically as strings", () => {
  const keys = ["2026-W09", "2025-W52", "2026-W10"];
  assert.deepEqual([...keys].sort(), ["2025-W52", "2026-W09", "2026-W10"]);
});

test("weekLabel reads as a date range", () => {
  assert.equal(weekLabel("2026-W33"), "10–16 Aug 2026");
  assert.equal(weekLabel("2026-W27"), "29 Jun–5 Jul 2026"); // spans two months
});

test("validation rejects impossible dates and weeks", () => {
  assert.ok(isValidDate("2026-02-28"));
  assert.ok(!isValidDate("2026-02-30"), "Date.UTC silently rolls this over");
  assert.ok(!isValidDate("2026-13-01"));
  assert.ok(!isValidDate("26-01-01"));
  assert.ok(isValidWeekKey("2020-W53"));
  assert.ok(!isValidWeekKey("2021-W53"), "2021 has 52 ISO weeks");
  assert.ok(!isValidWeekKey("2026-W00"));
  assert.ok(!isValidWeekKey("2026-W1"));
});

test("todayUTC is the UTC calendar day, not the local one", () => {
  assert.equal(todayUTC(Date.parse("2026-08-14T23:59:59Z")), "2026-08-14");
  assert.equal(todayUTC(Date.parse("2026-08-15T00:00:01Z")), "2026-08-15");
});
