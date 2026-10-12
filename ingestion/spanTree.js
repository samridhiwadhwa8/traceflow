/**
 * Span tree reconstruction module for TraceFlow
 * Converts flat span lists into hierarchical tree structures
 */

/**
 * Build a hierarchical tree from flat span data
 * @param {Array} spans - Array of span objects with spanId and parentSpanId
 * @returns {Array} Array of root span nodes with nested children
 */
function buildSpanTree(spans) {
    const nodeById = new Map();
    const roots = [];

    // Step 1: Create a node for every span.
    for (const span of spans) {
        nodeById.set(span.spanId, {
            ...span,
            children: []
        });
    }

    // Step 2: Connect each node to its parent.
    for (const span of spans) {
        const node = nodeById.get(span.spanId);

        if (span.parentSpanId == null) {
            // This span has no parent.
            roots.push(node);
        } else {
            const parent = nodeById.get(span.parentSpanId);

            if (parent) {
                parent.children.push(node);
            } else {
                // Keep spans whose parent is missing.
                roots.push(node);
            }
        }
    }

    // Step 3: Return all root nodes.
    return roots;
}

module.exports = { buildSpanTree };
