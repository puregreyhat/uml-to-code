const symbol = access => access === 'private' ? '−' : access === 'protected' ? '#' : access === 'package' ? '~' : '+';
export const attributeLabel = item => `${symbol(item.access)} ${item.name || 'attribute'}: ${item.type || 'Object'}${item.array ? '[]' : ''}`;
export const methodLabel = item => `${symbol(item.access)} ${item.name || 'method'}(${item.params || ''}): ${item.returnType || 'void'}`;

export function layoutDiagram(classes, relationships) {
  const gap = 40;
  const padding = 32;
  const nodes = new Map(classes.map(item => {
    const labels = [...item.attributes.map(attributeLabel), ...item.methods.map(methodLabel)];
    const width = Math.max(230, item.name.length * 9 + 40, ...labels.map(label => label.length * 7.8 + 32));
    const divider = 42 + Math.max(1, item.attributes.length) * 22 + 16;
    const height = divider + Math.max(1, item.methods.length) * 22 + 16;
    return [item.id, { width, height, divider, children: [] }];
  }));
  const parents = new Map();
  for (const { parentId, childId, type } of relationships) {
    if (type && type !== 'inheritance') continue;
    if (!nodes.has(parentId) || !nodes.has(childId) || parents.has(childId)) continue;
    let ancestor = parentId;
    const seen = new Set([childId]);
    while (ancestor && !seen.has(ancestor)) { seen.add(ancestor); ancestor = parents.get(ancestor); }
    if (ancestor) continue;
    parents.set(childId, parentId);
    nodes.get(parentId).children.push(childId);
  }
  const roots = classes.filter(item => !parents.has(item.id));
  const rowHeights = [];
  const measure = (id, depth) => {
    const node = nodes.get(id);
    node.depth = depth;
    rowHeights[depth] = Math.max(rowHeights[depth] || 0, node.height);
    const childWidths = node.children.map(child => measure(child, depth + 1));
    node.span = Math.max(node.width, childWidths.reduce((a, b) => a + b, 0) + Math.max(0, childWidths.length - 1) * gap);
    return node.span;
  };
  roots.forEach(item => measure(item.id, 0));
  const rowY = [];
  rowHeights.forEach((height, i) => { rowY[i] = i ? rowY[i - 1] + rowHeights[i - 1] + 88 : padding; });
  const place = (id, left) => {
    const node = nodes.get(id);
    node.x = left + (node.span - node.width) / 2;
    node.y = rowY[node.depth];
    const childSpan = node.children.reduce((sum, child) => sum + nodes.get(child).span, 0) + Math.max(0, node.children.length - 1) * gap;
    let childLeft = left + (node.span - childSpan) / 2;
    node.children.forEach(child => { place(child, childLeft); childLeft += nodes.get(child).span + gap; });
  };
  let left = padding;
  roots.forEach(item => { place(item.id, left); left += nodes.get(item.id).span + gap; });
  return { nodes, width: Math.max(320, left - gap + padding), height: Math.max(220, ...[...nodes.values()].map(node => node.y + node.height + padding)) };
}
