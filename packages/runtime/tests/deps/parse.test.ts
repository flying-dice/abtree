import { describe, expect, test } from "bun:test";
import { parseNodeModulesRef } from "abtree_runtime";

describe("parseNodeModulesRef", () => {
	test("returns the pkg name for a bare ref", () => {
		expect(parseNodeModulesRef("node-modules:bt-retry")).toEqual({
			pkgName: "bt-retry",
		});
	});

	test("includes a sub-path when present", () => {
		expect(
			parseNodeModulesRef("node-modules:bt-retry/fragments/inner.yaml"),
		).toEqual({
			pkgName: "bt-retry",
			subPath: "fragments/inner.yaml",
		});
	});

	test("accepts a scoped package", () => {
		expect(parseNodeModulesRef("node-modules:@acme/bt-retry")).toEqual({
			pkgName: "@acme/bt-retry",
		});
	});

	test("accepts a scoped package with a sub-path", () => {
		expect(
			parseNodeModulesRef("node-modules:@acme/bt-retry/fragments/x.yaml"),
		).toEqual({
			pkgName: "@acme/bt-retry",
			subPath: "fragments/x.yaml",
		});
	});

	test("accepts hyphens, dots, and underscores in the pkg name", () => {
		expect(parseNodeModulesRef("node-modules:my_pkg.v2-beta")).toEqual({
			pkgName: "my_pkg.v2-beta",
		});
	});

	test("rejects an empty body", () => {
		expect(() => parseNodeModulesRef("node-modules:")).toThrow(
			"invalid module ref 'node-modules:': missing package name",
		);
	});

	test("rejects the wrong scheme", () => {
		expect(() => parseNodeModulesRef("https://example.com/foo")).toThrow(
			"invalid module ref 'https://example.com/foo': expected 'node-modules:' scheme",
		);
	});

	test("rejects a pkg name starting with a non-alphanumeric char", () => {
		expect(() => parseNodeModulesRef("node-modules:-bad")).toThrow(
			"invalid module ref 'node-modules:-bad': package name '-bad' violates npm naming rules",
		);
	});

	test("rejects an uppercase pkg name (npm names are lowercase)", () => {
		expect(() => parseNodeModulesRef("node-modules:Bad_Name")).toThrow(
			"invalid module ref 'node-modules:Bad_Name': package name 'Bad_Name' violates npm naming rules",
		);
	});

	test("rejects a scope without a name", () => {
		expect(() => parseNodeModulesRef("node-modules:@acme")).toThrow(
			"invalid module ref 'node-modules:@acme': scoped package missing the name half (expected @scope/name)",
		);
	});

	test("rejects a scope with an empty name segment", () => {
		expect(() => parseNodeModulesRef("node-modules:@acme/")).toThrow(
			"invalid module ref 'node-modules:@acme/': scoped package missing the name half (expected @scope/name)",
		);
	});
});
