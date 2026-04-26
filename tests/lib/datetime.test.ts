import { describe, expect, it } from "vitest";
import {
	isoToJstDatetimeLocal,
	jstHourOf,
	jstIsoFromFormInput,
	parseJstAware,
} from "../../src/lib/datetime";

describe("parseJstAware", () => {
	it("parses an ISO string with explicit +09:00 offset as that instant", () => {
		const d = parseJstAware("2026-04-28T14:00:00+09:00");
		expect(d.toISOString()).toBe("2026-04-28T05:00:00.000Z");
	});

	it("parses an ISO string with explicit Z as UTC", () => {
		const d = parseJstAware("2026-04-28T05:00:00Z");
		expect(d.toISOString()).toBe("2026-04-28T05:00:00.000Z");
	});

	it("treats `YYYY-MM-DD HH:MM:SS` (no offset, space-separated) as JST wall-clock", () => {
		// Without normalization, Workers (UTC runtime) would parse this
		// as UTC and the displayed JST would be 9h ahead.
		const d = parseJstAware("2026-04-28 14:00:00");
		expect(d.toISOString()).toBe("2026-04-28T05:00:00.000Z");
	});

	it("treats `YYYY-MM-DDTHH:MM:SS` (no offset, T-separated) as JST wall-clock", () => {
		const d = parseJstAware("2026-04-28T14:00:00");
		expect(d.toISOString()).toBe("2026-04-28T05:00:00.000Z");
	});

	it("respects compact ±HHMM offsets", () => {
		const d = parseJstAware("2026-04-28T14:00:00+0900");
		expect(d.toISOString()).toBe("2026-04-28T05:00:00.000Z");
	});
});

describe("jstHourOf", () => {
	it("returns the JST hour for an offset-bearing ISO", () => {
		expect(jstHourOf("2026-04-28T14:00:00+09:00")).toBe(14);
	});

	it("returns the JST hour for an offset-less stored value (treated as JST)", () => {
		expect(jstHourOf("2026-04-28 14:00:00")).toBe(14);
	});

	it("returns the JST hour for a UTC-tagged value", () => {
		expect(jstHourOf("2026-04-28T05:00:00Z")).toBe(14);
	});
});

describe("isoToJstDatetimeLocal", () => {
	it("returns empty string for null/undefined", () => {
		expect(isoToJstDatetimeLocal(null)).toBe("");
		expect(isoToJstDatetimeLocal(undefined)).toBe("");
	});

	it("formats an offset-bearing ISO into JST datetime-local", () => {
		expect(isoToJstDatetimeLocal("2026-04-28T05:00:00Z")).toBe("2026-04-28T14:00");
	});

	it("formats an offset-less stored value as JST wall-clock (no double-shift)", () => {
		expect(isoToJstDatetimeLocal("2026-04-28 14:00:00")).toBe("2026-04-28T14:00");
	});
});

describe("jstIsoFromFormInput", () => {
	it("returns null for empty input", () => {
		expect(jstIsoFromFormInput(null)).toBeNull();
		expect(jstIsoFromFormInput(undefined)).toBeNull();
		expect(jstIsoFromFormInput("")).toBeNull();
	});

	it("appends `:00+09:00` when seconds are missing", () => {
		expect(jstIsoFromFormInput("2026-04-28T14:00")).toBe("2026-04-28T14:00:00+09:00");
	});

	it("preserves seconds when already present", () => {
		expect(jstIsoFromFormInput("2026-04-28T14:00:30")).toBe("2026-04-28T14:00:30+09:00");
	});
});
