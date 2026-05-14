import { beforeEach, describe, expect, test } from "bun:test";
import { validateTreeFile } from "@abtree/runtime";
import {
	type ActionNode,
	action,
	ambient,
	buildTreeFile,
	type CompositeNode,
	delegate,
	instruct,
	local,
	sequence,
	type TreeNode,
} from "../src/index.ts";

// The DSL keeps a module-level `ambient` bucket for state declared at
// module scope. Each test wraps its DSL calls inside a sequence body
// (so state mangles instead of leaking into ambient), but we still
// clear ambient between tests as belt-and-braces in case a future test
// declares at module scope.
beforeEach(() => {
	for (const k of Object.keys(ambient.local)) delete ambient.local[k];
	for (const k of Object.keys(ambient.global)) delete ambient.global[k];
});

// Build a single delegate scope inside a root sequence and return the
// generated scope sequence (the unwrapped delegate result).
function buildDelegate(
	name: string,
	options: Parameters<typeof delegate>[1],
	body: () => void,
): CompositeNode {
	let result!: CompositeNode;
	sequence("Test_Root", () => {
		result = delegate(name, options, body);
	});
	return result;
}

// Read the first step of an action as an instruct (throws if it isn't).
function firstInstruct(node: TreeNode): string {
	if (node.type !== "action") {
		throw new Error(`expected action, got ${node.type}`);
	}
	const step = (node as ActionNode).steps[0];
	if (!step || !("instruct" in step)) {
		throw new Error("expected first step to be an instruct");
	}
	return step.instruct;
}

describe("delegate desugaring shape", () => {
	test("emits a sequence named after the scope with the three-section shape", () => {
		const scope = buildDelegate("Compose_Greeting", {}, () => {
			sequence("Inner_Work", () => {});
		});

		expect(scope.type).toBe("sequence");
		expect(scope.name).toBe("Compose_Greeting");
		expect(scope.children).toHaveLength(3);

		const [spawnNode, bodyNode, returnNode] = scope.children;
		expect(spawnNode?.type).toBe("action");
		expect(spawnNode?.name).toBe("Spawn_Compose_Greeting");
		expect(bodyNode?.type).toBe("sequence");
		expect(bodyNode?.name).toBe("Inner_Work");
		expect(returnNode?.type).toBe("action");
		expect(returnNode?.name).toBe("Return_To_Parent_Compose_Greeting");
	});

	test("passes the body's children through verbatim, preserving order", () => {
		const scope = buildDelegate("X", {}, () => {
			sequence("First", () => {});
			sequence("Second", () => {});
			sequence("Third", () => {});
		});

		const innerNames = scope.children.slice(1, -1).map((c) => c.name);
		expect(innerNames).toEqual(["First", "Second", "Third"]);
	});
});

describe("spawn instruct content", () => {
	test("contains the exit token and the failure token", () => {
		const scope = buildDelegate("X", {}, () => {});
		const spawn = firstInstruct(scope.children[0] as TreeNode);

		expect(spawn).toMatch(/DLG__X__[0-9a-f]{8}/);
		expect(spawn).toMatch(/DLG__X__[0-9a-f]{8}__FAILED/);
	});

	test("includes the model hint when supplied; omits it when not", () => {
		const withModel = firstInstruct(
			buildDelegate("X", { model: "haiku" }, () => {}).children[0] as TreeNode,
		);
		expect(withModel).toContain('Use model: "haiku"');

		const without = firstInstruct(
			buildDelegate("Y", {}, () => {}).children[0] as TreeNode,
		);
		expect(without).not.toContain("Use model:");
	});

	test("includes the BRIEF block when supplied; omits it when not", () => {
		const briefText = "Pick a greeting and compose it.";
		const withBrief = firstInstruct(
			buildDelegate("X", { brief: briefText }, () => {})
				.children[0] as TreeNode,
		);
		expect(withBrief).toContain(`BRIEF: ${briefText}`);

		const without = firstInstruct(
			buildDelegate("Y", {}, () => {}).children[0] as TreeNode,
		);
		expect(without).not.toContain("BRIEF:");
	});
});

describe("return instruct content", () => {
	test("contains the same exit token as the spawn instruct", () => {
		const scope = buildDelegate("Scope_A", {}, () => {});
		const spawn = firstInstruct(scope.children[0] as TreeNode);
		const returnAction = firstInstruct(scope.children.at(-1) as TreeNode);

		const spawnTokenMatch = spawn.match(/DLG__Scope_A__[0-9a-f]{8}/);
		expect(spawnTokenMatch).not.toBeNull();
		const token = spawnTokenMatch?.[0] ?? "";
		expect(returnAction).toContain(token);
	});
});

describe("exit-token determinism", () => {
	test("the same scope name yields the same token across builds", () => {
		const a = firstInstruct(
			buildDelegate("Same_Name", {}, () => {}).children[0] as TreeNode,
		);
		const b = firstInstruct(
			buildDelegate("Same_Name", {}, () => {}).children[0] as TreeNode,
		);

		const tokenA = a.match(/DLG__Same_Name__[0-9a-f]{8}/)?.[0];
		const tokenB = b.match(/DLG__Same_Name__[0-9a-f]{8}/)?.[0];
		expect(tokenA).toBe(tokenB);
	});

	test("different scope names yield different tokens", () => {
		const a = firstInstruct(
			buildDelegate("Alpha", {}, () => {}).children[0] as TreeNode,
		);
		const b = firstInstruct(
			buildDelegate("Beta", {}, () => {}).children[0] as TreeNode,
		);

		const tokenA = a.match(/DLG__Alpha__[0-9a-f]{8}/)?.[0];
		const tokenB = b.match(/DLG__Beta__[0-9a-f]{8}/)?.[0];
		expect(tokenA).toBeDefined();
		expect(tokenB).toBeDefined();
		expect(tokenA).not.toBe(tokenB);
	});
});

describe("nested delegate", () => {
	test("produces two distinct tokens, one per scope", () => {
		let outerScope!: CompositeNode;
		sequence("Root", () => {
			outerScope = delegate("Outer", {}, () => {
				delegate("Inner", {}, () => {
					sequence("Leaf", () => {});
				});
			});
		});

		const outerSpawn = firstInstruct(outerScope.children[0] as TreeNode);
		const innerScope = outerScope.children[1] as CompositeNode;
		expect(innerScope.type).toBe("sequence");
		expect(innerScope.name).toBe("Inner");
		const innerSpawn = firstInstruct(innerScope.children[0] as TreeNode);

		const outerToken = outerSpawn.match(/DLG__Outer__[0-9a-f]{8}/)?.[0];
		const innerToken = innerSpawn.match(/DLG__Inner__[0-9a-f]{8}/)?.[0];

		expect(outerToken).toBeDefined();
		expect(innerToken).toBeDefined();
		expect(outerToken).not.toBe(innerToken);
		expect(outerSpawn).not.toContain("DLG__Inner__");
		expect(innerSpawn).not.toContain("DLG__Outer__");
	});
});

describe("output-gate semantics", () => {
	test("when output is supplied, Return action's first step is an evaluate on that ref", () => {
		let scope!: CompositeNode;
		sequence("Root", () => {
			const greeting = local("greeting", null);
			scope = delegate("X", { output: greeting }, () => {
				sequence("Body", () => {});
			});
		});

		const returnAction = scope.children[2] as ActionNode;
		expect(returnAction.steps).toHaveLength(2);
		const first = returnAction.steps[0];
		expect(first).toHaveProperty("evaluate");
		if ("evaluate" in (first ?? {})) {
			expect((first as { evaluate: string }).evaluate).toContain(
				"$LOCAL.Root__greeting is set",
			);
		}
	});

	test("when output is omitted, Return action has exactly one step (the instruct)", () => {
		const scope = buildDelegate("X", {}, () => {});
		const returnAction = scope.children.at(-1) as ActionNode;
		expect(returnAction.steps).toHaveLength(1);
		expect(returnAction.steps[0]).toHaveProperty("instruct");
	});
});

describe("validateTreeFile round-trip", () => {
	test("the desugared tree passes validateTreeFile without errors", () => {
		const root: TreeNode = sequence("Hello_World", () => {
			delegate("Compose", { brief: "do the thing", model: "haiku" }, () => {
				action("Real_Inner_Action", () => {
					instruct("do something");
				});
			});
		});

		const treeFile = buildTreeFile({
			pkg: { name: "@test/delegate", version: "0.1.0" },
			tree: root,
		});

		expect(() => validateTreeFile(treeFile)).not.toThrow();
	});
});
