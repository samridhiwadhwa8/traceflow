const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSpanTree } = require("./spanTree");

test("reconstructs nested parent-child spans", () => {
  const roots = buildSpanTree([
    { spanId: "root", parentSpanId: null, operation: "request" },
    { spanId: "child", parentSpanId: "root", operation: "database" },
    { spanId: "grandchild", parentSpanId: "child", operation: "query" },
  ]);

  assert.equal(roots.length, 1);
  assert.equal(roots[0].spanId, "root");
  assert.equal(roots[0].children[0].spanId, "child");
  assert.equal(roots[0].children[0].children[0].spanId, "grandchild");
});

test("keeps spans with missing parents as roots", () => {
  const roots = buildSpanTree([
    { spanId: "orphan", parentSpanId: "missing", operation: "orphan" },
  ]);
  assert.equal(roots.length, 1);
  assert.equal(roots[0].spanId, "orphan");
});
