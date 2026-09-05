// Testing the real tree-flattening/scale/plugin logic directly
// (dissected from the real package's own dist file, see
// hierarchicalScale.ts's own header comment for the full rationale) —
// jsdom has no real 2D canvas context or real layout engine, so
// HierarchicalScale's own methods are exercised via a minimal instance
// (constructed with `Object.create` rather than Chart.js's own real
// constructor, which needs a fully working chart/canvas context this
// project's own test setup doesn't provide — same reason
// controller.spec.ts doesn't render a real chart either), with just
// the internal fields those specific methods read/write set directly.
// The companion plugin's own hooks are tested against a fully mocked
// `chart` object instead, the same technique zoomPlugin.spec.ts/
// gradientPlugin.spec.ts/imageLabelPlugin.spec.ts all use.
import { describe, expect, it, vi } from 'vitest';
import { registry } from 'chart.js';
import {
  HierarchicalScale,
  hierarchicalCountExpanded,
  hierarchicalDetermineVisible,
  hierarchicalFlatChildren,
  hierarchicalGetMaxDepth,
  hierarchicalLastOfLevel,
  hierarchicalParentsOf,
  hierarchicalPlugin,
  hierarchicalPreOrderTraversal,
  hierarchicalResolve,
  hierarchicalSpanLogic,
  hierarchicalToNodes,
  isHierarchicalValueNode,
  type HierarchicalLabelNode,
  type HierarchicalRawLabelNode,
} from '../../src/hierarchicalScale.js';

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    translate: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    strokeStyle: '',
    lineWidth: 0,
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  };
}

function makeHierarchicalScale(overrides: Record<string, unknown> = {}): HierarchicalScale {
  // Bypasses CategoryScale's own real constructor (needs a fully
  // working chart/canvas context) — sets only the internal fields the
  // methods under test actually read/write, mirroring the original
  // package's own identical technique of casting to a minimal internal
  // shape (`IInternalScale`) for the same fields.
  const scale = Object.create(HierarchicalScale.prototype) as HierarchicalScale & Record<string, unknown>;
  scale.options = { levelPercentage: 0.75, offset: true, attributes: {}, ...((overrides.options as object) ?? {}) };
  scale.chart =
    overrides.chart ??
    // CategoryScale's own real determineDataLimits()/getMinMax() reads
    // this when this.min/this.max aren't explicitly set — a genuine
    // Chart.js internal call this port has no control over, so a
    // minimal stub (no datasets) is enough for every test that never
    // needs a data-driven min/max.
    { data: {}, getSortedVisibleDatasetMetas: () => [] };
  scale.min = (overrides.min as number) ?? 0;
  scale.max = (overrides.max as number) ?? 0;
  scale._length = (overrides._length as number) ?? 100;
  scale._startPixel = (overrides._startPixel as number) ?? 0;
  scale.getLabels = overrides.getLabels ?? ((): unknown[] => []);
  return scale as unknown as HierarchicalScale;
}

describe('hierarchicalScale', () => {
  describe('hierarchicalToNodes / tree flattening', () => {
    it('flattens a simple two-level tree, assigning real, sequential absolute indices', () => {
      const raw: (HierarchicalRawLabelNode | string)[] = [{ label: '2024', children: ['Q1', 'Q2'] }];
      const flat = hierarchicalToNodes(raw);

      expect(flat).toHaveLength(3);
      expect(flat[0].label).toBe('2024');
      expect(flat[0].index).toBe(0);
      expect(flat[1].label).toBe('Q1');
      expect(flat[1].index).toBe(1);
      expect(flat[1].parent).toBe(0);
      expect(flat[2].label).toBe('Q2');
      expect(flat[2].parent).toBe(0);
      expect(flat[2].relIndex).toBe(1);
    });

    it('a node hides its children when it is not expanded, but not itself (a real root defaults to visible)', () => {
      const raw: (HierarchicalRawLabelNode | string)[] = [{ label: '2024', expand: false, children: ['Q1'] }];
      const flat = hierarchicalToNodes(raw);

      expect(flat[0].hidden).toBe(false); // root itself
      expect(flat[1].hidden).toBe(true); // child of a non-expanded parent
    });

    it('a node whose own parent IS expanded is visible (not hidden)', () => {
      const raw: (HierarchicalRawLabelNode | string)[] = [{ label: '2024', expand: true, children: ['Q1'] }];
      const flat = hierarchicalToNodes(raw);

      expect(flat[1].hidden).toBe(false);
    });

    it('an explicitly hidden node on the raw input does not override the real, recomputed hidden state (matches the original package\'s own real push() logic)', () => {
      // The original package's own push() unconditionally recomputes
      // `hidden` from the parent/own expand state on every node —
      // confirmed directly from its own real source, not a guess this
      // port introduced — so an explicitly-set `hidden: true` on the
      // raw input only ever "sticks" if the recomputed value happens to
      // agree with it (e.g. under a genuinely collapsed parent).
      const raw: (HierarchicalRawLabelNode | string)[] = [{ label: '2024', expand: true, children: [{ label: 'Q1', hidden: true }] }];
      const flat = hierarchicalToNodes(raw);

      expect(flat[1].hidden).toBe(false);
    });

    it('a plain string leaf becomes a real node with an empty children array and level 0', () => {
      const flat = hierarchicalToNodes(['Solo']);
      expect(flat).toHaveLength(1);
      expect(flat[0].label).toBe('Solo');
      expect(flat[0].children).toEqual([]);
      expect(flat[0].level).toBe(0);
    });

    it("each node's own toString() returns its real label", () => {
      const flat = hierarchicalToNodes(['Solo']);
      expect(String(flat[0])).toBe('Solo');
    });

    it('a root node is marked major (for ticks), a child node is not', () => {
      const flat = hierarchicalToNodes([{ label: '2024', children: ['Q1'] }]);
      expect(flat[0].major).toBe(true);
      expect(flat[1].major).toBe(false);
    });
  });

  describe('hierarchicalParentsOf', () => {
    it('returns the full ancestor chain, starting from the topmost root, ending with the node itself', () => {
      const flat = hierarchicalToNodes([{ label: '2024', children: [{ label: 'Q1', children: ['Jan'] }] }]);
      const jan = flat[2];
      const parents = hierarchicalParentsOf(jan, flat);

      expect(parents.map((n) => n.label)).toEqual(['2024', 'Q1', 'Jan']);
    });

    it("a root node's own parent chain is just itself", () => {
      const flat = hierarchicalToNodes(['Solo']);
      expect(hierarchicalParentsOf(flat[0], flat)).toEqual([flat[0]]);
    });
  });

  describe('hierarchicalLastOfLevel', () => {
    it('finds the last top-level sibling when the node itself is a root', () => {
      const flat = hierarchicalToNodes(['A', 'B', 'C']);
      expect(hierarchicalLastOfLevel(flat[0], flat).label).toBe('C');
    });

    it('descends into an expanded last child to find the real rightmost visible descendant', () => {
      const flat = hierarchicalToNodes([{ label: 'A', children: [{ label: 'X', expand: true, children: ['Y'] }] }]);
      const x = flat[1];
      expect(hierarchicalLastOfLevel(x, flat).label).toBe('Y');
    });
  });

  describe('hierarchicalPreOrderTraversal', () => {
    it('visits a node then its children, depth-first, in real pre-order', () => {
      const flat = hierarchicalToNodes([{ label: 'A', children: ['B', 'C'] }]);
      const visited: string[] = [];
      hierarchicalPreOrderTraversal(flat[0], (node) => {
        visited.push(node.label);
      });
      expect(visited).toEqual(['A', 'B', 'C']);
    });

    it("stops descending into a node's own children when visit returns false for it", () => {
      const flat = hierarchicalToNodes([{ label: 'A', children: ['B'] }]);
      const visited: string[] = [];
      hierarchicalPreOrderTraversal(flat[0], (node) => {
        visited.push(node.label);
        return false;
      });
      expect(visited).toEqual(['A']);
    });
  });

  describe('isHierarchicalValueNode', () => {
    it('is true for a real object with a children array', () => {
      expect(isHierarchicalValueNode({ value: 1, children: [] })).toBe(true);
    });
    it('is false for a plain leaf number', () => {
      expect(isHierarchicalValueNode(5)).toBe(false);
    });
    it('is false for null/undefined', () => {
      expect(isHierarchicalValueNode(null)).toBe(false);
      expect(isHierarchicalValueNode(undefined)).toBe(false);
    });
  });

  describe('hierarchicalResolve', () => {
    it("resolves a leaf label's own real value by walking the matching value tree one level at a time", () => {
      const flat = hierarchicalToNodes([{ label: '2024', children: ['Q1', 'Q2'] }]);
      const tree = [{ value: 100, children: [20, 25] }];

      expect(hierarchicalResolve(flat[1], flat, tree)).toBe(20);
      expect(hierarchicalResolve(flat[2], flat, tree)).toBe(25);
    });

    it("resolves an internal (non-leaf) node's own real aggregate value, not a leaf's", () => {
      const flat = hierarchicalToNodes([{ label: '2024', children: ['Q1'] }]);
      const tree = [{ value: 100, children: [20] }];

      expect(hierarchicalResolve(flat[0], flat, tree)).toBe(100);
    });
  });

  describe('hierarchicalCountExpanded', () => {
    it('is exactly 1 for a collapsed node, regardless of how many children it has', () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: false, children: ['B', 'C'] }]);
      expect(hierarchicalCountExpanded(flat[0])).toBe(1);
    });

    it("is the real sum of each child's own countExpanded for an expanded node", () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: true, children: ['B', 'C'] }]);
      expect(hierarchicalCountExpanded(flat[0])).toBe(2);
    });

    it('recurses through a genuinely nested, multi-level expanded tree', () => {
      const flat = hierarchicalToNodes([
        { label: 'A', expand: true, children: [{ label: 'B', expand: true, children: ['C', 'D'] }, 'E'] },
      ]);
      expect(hierarchicalCountExpanded(flat[0])).toBe(3);
    });
  });

  describe('hierarchicalFlatChildren', () => {
    it("returns the exact flat-array slice spanning a node's own children", () => {
      const flat = hierarchicalToNodes([{ label: 'A', children: ['B', 'C'] }, 'D']);
      const children = hierarchicalFlatChildren(flat[0], flat);
      expect(children.map((n) => n.label)).toEqual(['B', 'C']);
    });

    it('returns an empty array for a leaf node with no children', () => {
      const flat = hierarchicalToNodes(['Solo']);
      expect(hierarchicalFlatChildren(flat[0], flat)).toEqual([]);
    });

    it('uses the real, fast sibling-lookup path when the node itself has a parent and is not its own parent\'s last child', () => {
      // hierarchicalFlatChildren's own `if (node.parent >= 0 &&
      // node.relIndex < flat[node.parent].children.length - 1)` — every
      // other test in this file calls this with a top-level node
      // (parent === -1), which always skips straight to the slower,
      // general-purpose sibling search below instead.
      const flat = hierarchicalToNodes([{ label: 'A', children: [{ label: 'B', children: ['B1', 'B2'] }, 'C'] }]);
      const b = flat.find((n) => n.label === 'B')!;
      const children = hierarchicalFlatChildren(b, flat);
      expect(children.map((n) => n.label)).toEqual(['B1', 'B2']);
    });
  });

  describe('hierarchicalDetermineVisible', () => {
    it('returns every non-hidden node when nothing is focused', () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: false, children: ['B'] }]);
      const visible = hierarchicalDetermineVisible(flat);
      expect(visible.map((n) => n.label)).toEqual(['A']);
    });

    it("returns only a focused node's own visible descendants when one node is focused", () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: 'focus', children: ['B', 'C'] }]);
      const visible = hierarchicalDetermineVisible(flat);
      expect(visible.map((n) => n.label)).toEqual(['B', 'C']);
    });
  });

  describe('hierarchicalSpanLogic', () => {
    it('returns false for a node with no children at all', () => {
      const flat = hierarchicalToNodes(['Solo']);
      expect(hierarchicalSpanLogic(flat[0], flat, new Set())).toBe(false);
    });

    it('returns false for a node that has children but is not expanded', () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: false, children: ['B'] }]);
      expect(hierarchicalSpanLogic(flat[0], flat, new Set(flat))).toBe(false);
    });

    it('reports hasCollapseBox true when the leftmost visible child is genuinely the first child', () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: true, children: ['B', 'C'] }]);
      flat.forEach((n, i) => {
        n.center = i * 10;
      });
      const visible = new Set([flat[1], flat[2]]);
      const result = hierarchicalSpanLogic(flat[0], flat, visible);

      expect(result).not.toBe(false);
      if (result !== false) {
        expect(result.hasCollapseBox).toBe(true);
        expect(result.leftVisible.label).toBe('B');
        expect(result.rightVisible.label).toBe('C');
      }
    });

    it('reports hasFocusBox true only when both edges are visible AND there is more than one child', () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: true, children: ['B', 'C'] }]);
      flat.forEach((n, i) => {
        n.center = i * 10;
      });
      const visible = new Set([flat[1], flat[2]]);
      const result = hierarchicalSpanLogic(flat[0], flat, visible);

      expect(result).not.toBe(false);
      if (result !== false) {
        expect(result.hasFocusBox).toBe(true);
      }
    });

    it('returns false when neither child is currently visible', () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: true, children: ['B', 'C'] }]);
      expect(hierarchicalSpanLogic(flat[0], flat, new Set())).toBe(false);
    });

    it("computes groupLabelCenter as the real midpoint of left and right when position is 'center'", () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: true, children: ['B', 'C'] }]);
      flat[1].center = 10;
      flat[2].center = 30;
      const result = hierarchicalSpanLogic(flat[0], flat, new Set([flat[1], flat[2]]), 'center');
      expect(result).not.toBe(false);
      if (result !== false) {
        expect(result.groupLabelCenter).toBe(20);
      }
    });

    it("computes groupLabelCenter as exactly the left edge's own center when position is 'first'", () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: true, children: ['B', 'C'] }]);
      flat[1].center = 10;
      flat[2].center = 30;
      const result = hierarchicalSpanLogic(flat[0], flat, new Set([flat[1], flat[2]]), 'first');
      expect(result).not.toBe(false);
      if (result !== false) {
        expect(result.groupLabelCenter).toBe(10);
      }
    });

    it("computes groupLabelCenter as exactly the right edge's own center when position is 'last'", () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: true, children: ['B', 'C'] }]);
      flat[1].center = 10;
      flat[2].center = 30;
      const result = hierarchicalSpanLogic(flat[0], flat, new Set([flat[1], flat[2]]), 'last');
      expect(result).not.toBe(false);
      if (result !== false) {
        expect(result.groupLabelCenter).toBe(30);
      }
    });
  });

  describe('hierarchicalGetMaxDepth', () => {
    it('is 0 for a flat, single-level set of roots', () => {
      const flat = hierarchicalToNodes(['A', 'B']);
      expect(hierarchicalGetMaxDepth(flat as HierarchicalLabelNode[])).toBe(0);
    });

    it('is the real deepest level reached by any expanded subtree', () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: true, children: [{ label: 'B', expand: true, children: ['C'] }] }]);
      const roots = flat.filter((n) => n.parent === -1) as HierarchicalLabelNode[];
      expect(hierarchicalGetMaxDepth(roots)).toBe(2);
    });

    it('does not descend into a collapsed subtree at all, even if it has deep children', () => {
      const flat = hierarchicalToNodes([{ label: 'A', expand: false, children: [{ label: 'B', expand: true, children: ['C'] }] }]);
      const roots = flat.filter((n) => n.parent === -1) as HierarchicalLabelNode[];
      expect(hierarchicalGetMaxDepth(roots)).toBe(0);
    });
  });

  describe('HierarchicalScale', () => {
    it('has the real, expected static id and afterRegister hook', () => {
      expect(HierarchicalScale.id).toBe('hierarchical');
      expect(typeof HierarchicalScale.afterRegister).toBe('function');
    });

    it('determineDataLimits() reads getLabels() into its own internal node array', () => {
      const nodes = hierarchicalToNodes(['A', 'B']) as HierarchicalLabelNode[];
      const scale = makeHierarchicalScale({ getLabels: () => nodes });
      // super.determineDataLimits() (CategoryScale's own real
      // implementation) needs a real, dataset-driven chart to compute
      // min/max on its own — not mocked here, so this test only
      // confirms this port's own real addition (populating `_nodes`
      // from getLabels()) via its own observable side effect below
      // (buildTicks reading from it), rather than asserting on
      // CategoryScale's own separate min/max computation.
      scale.determineDataLimits();
      scale.min = 0;
      scale.max = 1;

      expect(scale.buildTicks()).toEqual([
        { label: 'A', value: 0 },
        { label: 'B', value: 1 },
      ]);
    });

    it('buildTicks() returns one tick per node in the current min..max range, with real sequential index values', () => {
      const nodes = hierarchicalToNodes(['A', 'B', 'C']) as HierarchicalLabelNode[];
      const scale = makeHierarchicalScale({ getLabels: () => nodes });
      scale.determineDataLimits();
      scale.min = 0;
      scale.max = 2;

      const ticks = scale.buildTicks();
      expect(ticks).toEqual([
        { label: 'A', value: 0 },
        { label: 'B', value: 1 },
        { label: 'C', value: 2 },
      ]);
    });

    it('buildTicks() returns an empty array once the current node slice is empty', () => {
      const scale = makeHierarchicalScale({ getLabels: () => [], min: 0, max: -1 });
      scale.determineDataLimits();
      expect(scale.buildTicks()).toEqual([]);
    });

    it('configure() assigns each node an exact, real center/width based on the configured levelPercentage', () => {
      // Two top-level, equally-weighted nodes over a 100px length —
      // half-distance before/after (0.5 each) plus one full-weight gap
      // between them (ratio**0=1, since level 0) sums to 2, so each
      // node's own real width should be exactly total/(2*distance)=25.
      // super.configure() (CartesianScale's own real implementation)
      // recomputes _length/_startPixel from the scale's own real
      // left/right/width — provided directly here (a real, horizontal,
      // 0-100px scale) so that computation lands on the same 100/0
      // this test's own expected math assumes, rather than mocking
      // configure() itself away.
      const nodes = hierarchicalToNodes(['A', 'B']) as HierarchicalLabelNode[];
      const flat = nodes;
      const scale = makeHierarchicalScale({
        getLabels: () => nodes,
        chart: { data: { flatLabels: flat }, getSortedVisibleDatasetMetas: () => [] },
      });
      Object.assign(scale, { left: 0, right: 100, top: 0, bottom: 0, width: 100, height: 0 });
      scale.isHorizontal = () => true;
      scale.determineDataLimits();
      scale.min = 0;
      scale.max = 1;
      scale.configure();

      // distances = [0.5, 1 (ratio**0), 0.5], total=2, factor=100/2=50.
      // offset starts at 0.5*50=25 -> node[0].center=25, width=min(50,25)/2=12.5
      // then offset += 1*50=50 -> offset=75 -> node[1].center=75, width=min(25,50)/2=12.5
      expect(nodes[0].center).toBeCloseTo(25, 5);
      expect(nodes[1].center).toBeCloseTo(75, 5);
      expect(nodes[0].width).toBeCloseTo(12.5, 5);
      expect(nodes[1].width).toBeCloseTo(12.5, 5);
    });

    it('configure() does nothing (no throw) when the current node slice is empty', () => {
      const scale = makeHierarchicalScale({ getLabels: () => [], chart: { data: {}, getSortedVisibleDatasetMetas: () => [] } });
      Object.assign(scale, { left: 0, right: 100, top: 0, bottom: 0, width: 100, height: 0 });
      scale.isHorizontal = () => true;
      scale.determineDataLimits();
      scale.min = 0;
      scale.max = -1;
      expect(() => scale.configure()).not.toThrow();
    });

    it('getPixelForDecimal() resolves to the real center of the node at the given fractional index', () => {
      const nodes = hierarchicalToNodes(['A', 'B']) as HierarchicalLabelNode[];
      nodes[0].center = 10;
      nodes[0].width = 5;
      nodes[1].center = 30;
      nodes[1].width = 5;
      const scale = makeHierarchicalScale({ getLabels: () => nodes, min: 0, max: 1, _startPixel: 0 });
      scale.determineDataLimits();

      // value=0.9 -> floor(0.9*2)=1 -> real index 1 -> node[1].center=30
      expect(scale.getPixelForDecimal(0.9)).toBeCloseTo(30, 5);
    });

    it('getPixelForDecimal() resolves to a single node\'s own real center regardless of the given fractional value (clamped to the only real index)', () => {
      // getPixelForDecimal's own `Math.min(Math.floor(value*length),
      // length-1)` — for a single-node scale (length=1), this always
      // clamps to index 0 regardless of `value` (even value=1, since
      // floor(1*1)=1 is still clamped down to length-1=0) — confirmed
      // directly by tracing the real formula, not assumed. The
      // `index===1 && length===1` corner-case branch immediately below
      // it can therefore never actually fire for a single-node scale:
      // the index reaching this check has already been clamped to 0.
      const nodes = hierarchicalToNodes(['Solo']) as HierarchicalLabelNode[];
      nodes[0].center = 42;
      nodes[0].width = 5;
      const scale = makeHierarchicalScale({ getLabels: () => nodes });
      scale.determineDataLimits();
      scale.min = 0;
      scale.max = 0;

      expect(scale.getPixelForDecimal(1)).toBeCloseTo(42, 5);
      expect(scale.getPixelForDecimal(0)).toBeCloseTo(42, 5);
    });

    it('getValueForPixel() resolves to the real index of the node whose own center/width band contains the pixel', () => {
      const nodes = hierarchicalToNodes(['A', 'B']) as HierarchicalLabelNode[];
      nodes[0].center = 10;
      nodes[0].width = 5;
      nodes[1].center = 30;
      nodes[1].width = 5;
      const scale = makeHierarchicalScale({ getLabels: () => nodes, min: 0, max: 1 });
      scale.determineDataLimits();

      expect(scale.getValueForPixel(30)).toBe(1);
      expect(scale.getValueForPixel(10)).toBe(0);
    });

    it('getValueForPixel() resolves to -1 (findIndex\'s own real "not found" value) for a pixel outside every node\'s band', () => {
      const nodes = hierarchicalToNodes(['A']) as HierarchicalLabelNode[];
      nodes[0].center = 10;
      nodes[0].width = 2;
      const scale = makeHierarchicalScale({ getLabels: () => nodes, min: 0, max: 0 });
      scale.determineDataLimits();

      expect(scale.getValueForPixel(999)).toBe(-1);
    });

    it('_centerBase() falls back to the real base pixel when the resolved index has no matching node at all', () => {
      // _centerBase's own `if (node == null) return base;` — every
      // other test in this file resolves to a real, populated node.
      // A private method, but accessible via the same bracket-notation
      // technique this test file already uses to bypass CategoryScale's
      // own real constructor.
      const nodes = hierarchicalToNodes(['A']) as HierarchicalLabelNode[];
      const scale = makeHierarchicalScale({ getLabels: () => nodes, _startPixel: 7 });
      scale.determineDataLimits();

      const result = (scale as unknown as { _centerBase(i: number): number })._centerBase(5);
      expect(result).toBe(7);
    });

    it('configure() computes the real common-ancestor distance when adjacent nodes switch to a different parent (a genuine 3-level tree)', () => {
      // configure()'s own `while (parents[common] === previousParents[common])`
      // loop — every other configure() test in this file uses flat,
      // same-parent siblings, where `previous.parent === node.parent`
      // short-circuits before that loop ever runs at all.
      const nodes = hierarchicalToNodes([
        { label: 'A', expand: true, children: ['A1', 'A2'] },
        { label: 'B', expand: true, children: ['B1'] },
      ]) as HierarchicalLabelNode[];
      const flat = nodes;
      // Visible, adjacent nodes with DIFFERENT parents: A2 (under A) then
      // B1 (under B) — A2.parent !== B1.parent, forcing the real
      // common-ancestor walk (common=0, since A!==B at the root level).
      const a2 = flat.find((n) => n.label === 'A2')!;
      const b1 = flat.find((n) => n.label === 'B1')!;
      const scale = makeHierarchicalScale({
        getLabels: () => [a2, b1],
        chart: { data: { flatLabels: flat }, getSortedVisibleDatasetMetas: () => [] },
      });
      Object.assign(scale, { left: 0, right: 100, top: 0, bottom: 0, width: 100, height: 0 });
      scale.isHorizontal = () => true;
      scale.determineDataLimits();
      scale.min = 0;
      scale.max = 1;

      expect(() => scale.configure()).not.toThrow();
      // A real, distinct center/width was still computed for both —
      // confirms the common-ancestor branch produced a real distance,
      // not NaN or a thrown error.
      expect(Number.isFinite(a2.center)).toBe(true);
      expect(Number.isFinite(b1.center)).toBe(true);
    });

    it('configure() walks past a real, genuinely shared ancestor level before finding where two nodes actually diverge (a 4-level tree)', () => {
      // The same `while (parents[common] === previousParents[common])`
      // loop, but this time common>0 is reached first — the previous
      // test's own tree only ever has common=0 (A!==B at the very root),
      // so the loop's own body (`common += 1`) never actually executes.
      // Here, both nodes share the same real grandparent ('G') but
      // diverge one level below it.
      const nodes = hierarchicalToNodes([
        {
          label: 'G',
          expand: true,
          children: [
            { label: 'A', expand: true, children: ['A1'] },
            { label: 'B', expand: true, children: ['B1'] },
          ],
        },
      ]) as HierarchicalLabelNode[];
      const flat = nodes;
      const a1 = flat.find((n) => n.label === 'A1')!;
      const b1 = flat.find((n) => n.label === 'B1')!;
      const scale = makeHierarchicalScale({
        getLabels: () => [a1, b1],
        chart: { data: { flatLabels: flat }, getSortedVisibleDatasetMetas: () => [] },
      });
      Object.assign(scale, { left: 0, right: 100, top: 0, bottom: 0, width: 100, height: 0 });
      scale.isHorizontal = () => true;
      scale.determineDataLimits();
      scale.min = 0;
      scale.max = 1;

      expect(() => scale.configure()).not.toThrow();
      expect(Number.isFinite(a1.center)).toBe(true);
      expect(Number.isFinite(b1.center)).toBe(true);
    });

    it('afterRegister() registers its own real companion plugin with the shared registry', () => {
      // HierarchicalScale's own static afterRegister() hook — called
      // directly here, the same way Chart.js's own real Chart.register()
      // machinery would call it, without needing the full registration
      // flow this test file otherwise bypasses entirely.
      const addPluginsSpy = vi.spyOn(registry, 'addPlugins');
      HierarchicalScale.afterRegister!();
      expect(addPluginsSpy).toHaveBeenCalledWith(hierarchicalPlugin);
      addPluginsSpy.mockRestore();
    });
  });

  describe('hierarchicalPlugin', () => {
    function makeChart(overrides: Record<string, unknown> = {}) {
      const ctx = makeCtx();
      const scales: Record<string, unknown> = overrides.scales ?? {};
      return {
        ctx,
        scales,
        config: { options: overrides.options ?? { scales: { x: { type: 'hierarchical' } } } },
        data: overrides.data ?? { labels: [], datasets: [] },
        update: vi.fn(),
      };
    }

    it('has the real, expected id', () => {
      expect(hierarchicalPlugin.id).toBe('hierarchical');
    });

    it('beforeUpdate does nothing when neither axis is configured as a hierarchical scale', () => {
      const chart = makeChart({ options: { scales: { x: { type: 'category' } } } });
      expect(() => hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {})).not.toThrow();
      expect(chart.data.labels).toEqual([]); // untouched — no flattening ran
    });

    it('beforeUpdate flattens raw data.labels into real, linked nodes on a hierarchical chart', () => {
      const chart = makeChart({
        data: {
          labels: [{ label: '2024', children: ['Q1', 'Q2'] }],
          datasets: [{ data: [{ value: 100, children: [40, 60] }] }],
        },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});

      // The top-level '2024' node starts collapsed by default, so only
      // itself is visible — real, confirmed behavior, not assumed.
      const labels = chart.data.labels as unknown as HierarchicalLabelNode[];
      expect(labels).toHaveLength(1);
      expect(labels[0].label).toBe('2024');
      expect((chart.data as { flatLabels?: unknown[] }).flatLabels).toHaveLength(3);
      expect(chart.data.datasets[0].data).toEqual([100]);
    });

    it('beforeUpdate is a real no-op on a second call with the identical raw tree (the _verify fingerprint matches)', () => {
      const rawLabels = [{ label: '2024', children: ['Q1'] }];
      const chart = makeChart({
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [5] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      const firstFlat = (chart.data as { flatLabels?: unknown[] }).flatLabels;
      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      const secondFlat = (chart.data as { flatLabels?: unknown[] }).flatLabels;

      // Same reference — genuinely never re-flattened, not just
      // producing an equal-looking result.
      expect(secondFlat).toBe(firstFlat);
    });

    it('beforeDatasetsDraw does nothing when there is no hierarchical scale registered on the chart at all', () => {
      const chart = makeChart({ scales: {} });
      expect(() => hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {})).not.toThrow();
      expect(chart.ctx.save).not.toHaveBeenCalled();
    });

    it('beforeDatasetsDraw does nothing when a real scale exists but the chart has no real ctx at all', () => {
      // beforeDatasetsDraw's own `if (!scale || !ctx) { return; }` —
      // every other test in this file has a real, truthy ctx; this one
      // isolates the `!ctx` half of that guard specifically.
      const scale = makeHierarchicalScale({ options: {} });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      const chart = makeChart({ scales: { x: scale } });
      (chart as unknown as { ctx: unknown }).ctx = null;
      expect(() => hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {})).not.toThrow();
    });

    it('beforeDatasetsDraw draws via the real ctx once a hierarchical scale and its own flattened data exist', () => {
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: false,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'right', { value: 100, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 20, configurable: true });
      scale.isHorizontal = () => true;

      const rawLabels = [{ label: '2024', children: ['Q1'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [5] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {});

      expect(chart.ctx.save).toHaveBeenCalled();
      expect(chart.ctx.restore).toHaveBeenCalled();
    });

    it('beforeDatasetsDraw draws via the real "box-adjacent"/"edge hint" connector forms when both edges genuinely qualify (hasCollapseBox AND hasFocusBox true)', () => {
      // Every other beforeDatasetsDraw test in this file either skips
      // the whole connector block entirely (a single visible child
      // makes leftVisible===rightVisible) or has both hasCollapseBox/
      // hasFocusBox false (the middle-child-only tests) — this is the
      // one real scenario where both are true simultaneously: two
      // children, both visible, both genuinely the group's own first
      // and last.
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: false,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'right', { value: 100, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 20, configurable: true });
      scale.isHorizontal = () => true;

      const rawLabels = [{ label: '2024', expand: true, children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [4, 6] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {});

      expect(chart.ctx.moveTo).toHaveBeenCalled();
      expect(chart.ctx.lineTo).toHaveBeenCalled();
      expect(chart.ctx.strokeRect).toHaveBeenCalled(); // real collapse/focus boxes drawn this time
    });

    it('beforeDatasetsDraw draws the equivalent VERTICAL-axis connector forms when both edges qualify too', () => {
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: false,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      scale.isHorizontal = () => false;

      const rawLabels = [{ label: '2024', expand: true, children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [4, 6] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {});

      expect(chart.ctx.moveTo).toHaveBeenCalled();
      expect(chart.ctx.lineTo).toHaveBeenCalled();
      expect(chart.ctx.strokeRect).toHaveBeenCalled();
    });

    it('beforeDatasetsDraw skips an expanded root entirely when none of its own children are currently visible at all (hierarchicalSpanLogic\'s own real false result)', () => {
      // renderHorLevel's/renderVertLevel's own `if (!r) { return false;
      // }` — hierarchicalSpanLogic can only return false here (its own
      // first early-return, "no children at all"/"not expanded", never
      // applies — renderHorLevel/renderVertLevel already filter both of
      // those cases out before ever calling it) when NEITHER edge of an
      // expanded node's own subtree is currently visible. A second,
      // separately-focused root (whose own descendant IS visible) makes
      // this the real, natural outcome for the other root, rather than
      // an artificial one.
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: false,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'right', { value: 100, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 20, configurable: true });
      scale.isHorizontal = () => true;

      const rawLabels = [
        { label: '2023', expand: true, children: ['P1'] },
        { label: '2024', expand: true, children: ['Q1', 'Q2'] },
      ];
      const chart = makeChart({
        scales: { x: scale },
        data: {
          labels: rawLabels,
          datasets: [{ data: [{ value: 10, children: [10] }, { value: 10, children: [4, 6] }] }],
        },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      // Manually narrow visibility to '2023's own child only — neither of
      // '2024's own children (Q1, Q2) is visible at all, so
      // hierarchicalSpanLogic('2024', ...) genuinely returns false.
      const flatLabels = (chart.data as { flatLabels?: HierarchicalLabelNode[] }).flatLabels!;
      const p1 = flatLabels.find((n) => n.label === 'P1')!;
      chart.data.labels = [p1] as unknown as typeof chart.data.labels;

      expect(() => hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {})).not.toThrow();
    });

    it('beforeDatasetsDraw skips an expanded root entirely on a VERTICAL axis too, under the identical no-visible-children scenario', () => {
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: false,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      scale.isHorizontal = () => false;

      const rawLabels = [
        { label: '2023', expand: true, children: ['P1'] },
        { label: '2024', expand: true, children: ['Q1', 'Q2'] },
      ];
      const chart = makeChart({
        scales: { x: scale },
        data: {
          labels: rawLabels,
          datasets: [{ data: [{ value: 10, children: [10] }, { value: 10, children: [4, 6] }] }],
        },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      const flatLabels = (chart.data as { flatLabels?: HierarchicalLabelNode[] }).flatLabels!;
      const p1 = flatLabels.find((n) => n.label === 'P1')!;
      chart.data.labels = [p1] as unknown as typeof chart.data.labels;

      expect(() => hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {})).not.toThrow();
    });

    it('beforeDatasetsDraw draws the real "left edge, no collapse box" hint form when the parent is focused (leftFirstVisible true but hasCollapseBox forced false)', () => {
      // hasCollapseBox = leftFirstVisible && expand !== 'focus' — a
      // genuinely distinct combination from every prior test: the left
      // edge IS the group's own real first child (leftFirstVisible
      // true), but hasCollapseBox is still false because the group
      // itself is focused. This isolates the `else if (leftFirstVisible)`
      // branch specifically (moveTo + a follow-up lineTo), never reached
      // by the hasCollapseBox=true test above.
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: false,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'right', { value: 100, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 20, configurable: true });
      scale.isHorizontal = () => true;

      const rawLabels = [{ label: '2024', expand: 'focus' as const, children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [4, 6] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {});

      // The left-edge hint (moveTo + lineTo) confirms the real
      // `else if (leftFirstVisible)` branch fired — hasCollapseBox
      // itself is still false (a real collapse box, drawn via
      // strokeRect, would only appear if hasCollapseBox were true).
      // A focus box IS still drawn here regardless (hasFocusBox doesn't
      // depend on the focus state at all), so strokeRect is called
      // exactly once — for that focus box, not a collapse box.
      expect(chart.ctx.moveTo).toHaveBeenCalled();
      expect(chart.ctx.strokeRect).toHaveBeenCalledTimes(1);
    });

    it('beforeDatasetsDraw draws the real "right edge, no focus box" hint form when only the group\'s own last child is visible (rightLastVisible true, leftFirstVisible false)', () => {
      // Isolates the `else if (rightLastVisible)` branch specifically —
      // every prior test either has both edges qualify or neither;
      // hiding the group's own first child (Q1) while keeping the last
      // two (Q2, Q3) visible makes the real left edge (Q2) NOT the
      // group's own first child, while the real right edge (Q3) IS its
      // own last child.
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: false,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'right', { value: 100, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 20, configurable: true });
      scale.isHorizontal = () => true;

      const rawLabels = [{ label: '2024', expand: true, children: ['Q1', 'Q2', 'Q3'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [3, 4, 3] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      const flatLabels = (chart.data as { flatLabels?: HierarchicalLabelNode[] }).flatLabels!;
      const q2 = flatLabels.find((n) => n.label === 'Q2')!;
      const q3 = flatLabels.find((n) => n.label === 'Q3')!;
      chart.data.labels = [q2, q3] as unknown as typeof chart.data.labels; // Q1 hidden

      expect(() => hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {})).not.toThrow();
      expect(chart.ctx.lineTo).toHaveBeenCalled();
      expect(chart.ctx.strokeRect).not.toHaveBeenCalled(); // no collapse/focus box — neither hasCollapseBox nor hasFocusBox qualify
    });

    it('beforeEvent ignores every event type other than a real click', () => {
      const chart = makeChart();
      expect(() => hierarchicalPlugin.beforeEvent!(chart as never, { event: { type: 'mousemove' } } as never)).not.toThrow();
    });

    it('beforeEvent ignores a real click when the scale itself is configured as static', () => {
      const scale = makeHierarchicalScale({ options: { static: true, padding: 5 } });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      scale.isHorizontal = () => true;
      const chart = makeChart({ scales: { x: scale } });

      expect(() =>
        hierarchicalPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 10, y: 10 } } as never),
      ).not.toThrow();
    });

    it('a real click on an unexpanded leaf label with children expands it, splicing its own children in and calling chart.update()', () => {
      const scale = makeHierarchicalScale({
        options: {
          padding: 0,
          hierarchyBoxLineHeight: 30,
          reverseOrder: false,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 100, configurable: true });
      scale.isHorizontal = () => true;
      // Real click resolves via getValueForPixel — stub it directly to
      // point at index 0 (the only, unexpanded root) regardless of the
      // exact click coordinates, isolating the click-handling logic
      // itself from getValueForPixel's own separately-tested math.
      scale.getValueForPixel = () => 0;

      const rawLabels = [{ label: '2024', children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 100, children: [40, 60] }] }] },
      });
      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});

      hierarchicalPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 10, y: 110 } } as never);

      const labels = chart.data.labels as unknown as HierarchicalLabelNode[];
      expect(labels.map((n) => n.label)).toEqual(['Q1', 'Q2']);
      expect(chart.update).toHaveBeenCalled();
    });

    it('a real click on the first visible child of an already-expanded parent collapses it back, calling chart.update()', () => {
      // Exercises hierarchicalCollapse via a real click round trip —
      // '2024' starts expanded, so Q1/Q2 are the real visible labels;
      // clicking Q1 (relIndex 0, the collapse box's own real position)
      // collapses '2024' back to its own single, unexpanded label.
      const scale = makeHierarchicalScale({ options: { padding: 0, hierarchyBoxLineHeight: 30, reverseOrder: false } });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 100, configurable: true });
      scale.isHorizontal = () => true;
      scale.getValueForPixel = () => 0; // Q1 is the real, first visible label

      const rawLabels = [{ label: '2024', expand: true, children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 100, children: [40, 60] }] }] },
      });
      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      expect((chart.data.labels as unknown as HierarchicalLabelNode[]).map((n) => n.label)).toEqual(['Q1', 'Q2']);

      hierarchicalPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 10, y: 110 } } as never);

      const labels = chart.data.labels as unknown as HierarchicalLabelNode[];
      expect(labels.map((n) => n.label)).toEqual(['2024']);
      expect(chart.update).toHaveBeenCalled();
    });

    it('a real click on the last visible child of a fully-expanded parent zooms in on it (focus), calling chart.update()', () => {
      // Exercises hierarchicalZoomIn via a real click round trip —
      // clicking the real last visible child (Q2, relIndex 1, the last
      // of its own level) of an expanded, non-focused parent zooms in.
      const scale = makeHierarchicalScale({ options: { padding: 0, hierarchyBoxLineHeight: 30, reverseOrder: false } });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 100, configurable: true });
      scale.isHorizontal = () => true;
      scale.getValueForPixel = () => 1; // Q2, the real last visible child

      const rawLabels = [{ label: '2024', expand: true, children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 100, children: [40, 60] }] }] },
      });
      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});

      hierarchicalPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 10, y: 110 } } as never);

      const labels = chart.data.labels as unknown as HierarchicalLabelNode[];
      expect(labels.map((n) => n.label)).toEqual(['Q1', 'Q2']); // same visible labels, but now focused
      expect((chart.data as { rootNodes?: HierarchicalLabelNode[] }).rootNodes![0].expand).toBe('focus');
      expect(chart.update).toHaveBeenCalled();
    });

    it('zooming in on a new group resets a real, different, previously-focused node back to plain expanded', () => {
      // hierarchicalZoomIn's own `flat.forEach((node) => { if
      // (node.expand === \'focus\') { node.expand = true; } });` — every
      // other zoom-in test in this file has no pre-existing focused
      // node at all, so this reset loop's own real branch (finding one)
      // never actually fires.
      const scale = makeHierarchicalScale({ options: { padding: 0, hierarchyBoxLineHeight: 30, reverseOrder: false } });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 100, configurable: true });
      scale.isHorizontal = () => true;

      const rawLabels = [
        { label: '2023', expand: 'focus' as const, children: ['P1'] },
        { label: '2024', expand: true, children: ['Q1', 'Q2'] },
      ];
      const chart = makeChart({
        scales: { x: scale },
        data: {
          labels: rawLabels,
          datasets: [{ data: [{ value: 10, children: [10] }, { value: 100, children: [40, 60] }] }],
        },
      });
      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      // '2023' is focused, so only its own descendant (P1) is visible at
      // all — '2024' and its own children are hidden entirely for now.
      expect((chart.data.labels as unknown as HierarchicalLabelNode[]).map((n) => n.label)).toEqual(['P1']);

      const flatLabels = (chart.data as { flatLabels?: HierarchicalLabelNode[] }).flatLabels!;
      const twenty24 = flatLabels.find((n) => n.label === '2024')!;
      expect(twenty24.expand).toBe(true); // real, plain expanded — not focused (yet)

      // Directly zoom in on '2024' itself (bypassing the real click path
      // entirely, since '2024' isn't even visible right now to click on)
      // — this still exercises the exact same real reset logic.
      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {}); // no-op, already flattened
      const q2 = flatLabels.find((n) => n.label === 'Q2')!;
      const flat = flatLabels;
      const cc = chart as unknown as { data: { flatLabels: HierarchicalLabelNode[]; rootNodes: HierarchicalLabelNode[] } };
      const twenty23 = flatLabels.find((n) => n.label === '2023')!;
      expect(twenty23.expand).toBe('focus');

      // Call the real click-handling entry point directly with a
      // synthetic elem pointing at Q2's own real index within a
      // manually-restored, fully-expanded (non-focused) view — the
      // cleanest way to reach zoomIn's own reset branch without needing
      // a live click to first zoom out of '2023'.
      twenty23.expand = true;
      cc.data.flatLabels = flat;
      chart.data.labels = [flatLabels.find((n) => n.label === 'P1')!, ...flatLabels.filter((n) => ['Q1', 'Q2'].includes(n.label))] as unknown as typeof chart.data.labels;
      cc.data.rootNodes = [twenty23, twenty24];
      twenty23.expand = 'focus'; // restore: a real, different node is STILL focused

      scale.getValueForPixel = () => chart.data.labels.length - 1; // Q2's own real position, the last visible entry
      hierarchicalPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 10, y: 110 } } as never);

      // The previously-focused '2023' is now a plain expanded node again
      // — confirms the reset loop's own real branch fired.
      expect(twenty23.expand).toBe(true);
      expect(twenty24.expand).toBe('focus');
    });

    it('a real click on the last visible child of an already-focused (zoomed-in) parent zooms back out, calling chart.update()', () => {
      // Exercises hierarchicalZoomOut via a real click round trip —
      // '2024' starts pre-focused ('focus'), so a click on its own last
      // visible child (isLastChildOfParent && parent.expand==='focus')
      // zooms back out to the real, un-focused expanded view.
      const scale = makeHierarchicalScale({ options: { padding: 0, hierarchyBoxLineHeight: 30, reverseOrder: false } });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 100, configurable: true });
      scale.isHorizontal = () => true;
      scale.getValueForPixel = () => 1; // Q2, the real last visible child

      const rawLabels = [{ label: '2024', expand: 'focus' as const, children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 100, children: [40, 60] }] }] },
      });
      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});

      hierarchicalPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 10, y: 110 } } as never);

      expect((chart.data as { rootNodes?: HierarchicalLabelNode[] }).rootNodes![0].expand).toBe(true);
      expect(chart.update).toHaveBeenCalled();
    });

    it('beforeEvent resolves a real click on a vertical axis via its own x-coordinate, not y', () => {
      // hierarchicalResolveElement's own !horizontal branch — the
      // in-range check and index resolution both key off event.x
      // instead of event.y for a vertical scale.
      const scale = makeHierarchicalScale({ options: { padding: 0, hierarchyBoxLineHeight: 30, reverseOrder: false } });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 100, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      scale.isHorizontal = () => false;
      scale.getValueForPixel = () => 0;

      const rawLabels = [{ label: '2024', children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 100, children: [40, 60] }] }] },
      });
      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});

      // offset = scale.left(100) - padding(0) = 100; a real vertical
      // click's own in-range check needs x <= offset && x >= offset -
      // boxRow(30) — 90 satisfies both.
      hierarchicalPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 90, y: 10 } } as never);

      const labels = chart.data.labels as unknown as HierarchicalLabelNode[];
      expect(labels.map((n) => n.label)).toEqual(['Q1', 'Q2']);
      expect(chart.update).toHaveBeenCalled();
    });

    it('beforeUpdate resolves an unset attribute from the configured default when no ancestor sets it', () => {
      // Exercises hierarchicalUpdateAttributes's own real, non-empty
      // path — every prior test in this file uses the default, empty
      // attributes:{}, where the whole Object.keys(attributes).forEach
      // loop never runs at all.
      const scale = makeHierarchicalScale({ options: { attributes: { backgroundColor: 'red' } } });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });

      const rawLabels = [{ label: '2024', children: ['Q1', 'Q2'] }]; // starts collapsed
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 100, children: [40, 60] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});

      // The only visible node ('2024') sets no backgroundColor of its
      // own, so it falls back to the configured attributes default.
      expect((chart.data.datasets[0] as unknown as { backgroundColor: unknown }).backgroundColor).toBe('red');
    });

    it('beforeUpdate resolves a real ancestor-defined attribute over the configured default, walking up the tree', () => {
      const scale = makeHierarchicalScale({ options: { attributes: { backgroundColor: 'red' } } });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });

      const rawLabels = [{ label: '2024', backgroundColor: 'blue', children: ['Q1', 'Q2'] }] as unknown as {
        label: string;
        children: string[];
      }[];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 100, children: [40, 60] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});

      expect((chart.data.datasets[0] as unknown as { backgroundColor: unknown }).backgroundColor).toBe('blue');
    });

    it('beforeDatasetsDraw draws via the real vertical-axis path (renderVertLevel) when the scale is not horizontal', () => {
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: false,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      scale.isHorizontal = () => false;

      const rawLabels = [{ label: '2024', expand: true, children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [4, 6] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {});

      expect(chart.ctx.save).toHaveBeenCalled();
      expect(chart.ctx.fillText).toHaveBeenCalled(); // the expanded group's own label
    });

    it('beforeDatasetsDraw draws expand/collapse indicators via the real static (tick-mark) form when options.static is true', () => {
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: true,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'right', { value: 100, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 20, configurable: true });
      scale.isHorizontal = () => true;

      const rawLabels = [{ label: '2024', expand: true, children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [4, 6] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {});

      // The static drawing form uses moveTo/lineTo/stroke (a thin tick
      // mark), not strokeRect/fillRect (the default box-and-symbol form).
      expect(chart.ctx.moveTo).toHaveBeenCalled();
      expect(chart.ctx.strokeRect).not.toHaveBeenCalled();
    });

    it('hierarchicalEnabled resolves to false-y when the chart config has no scales key at all', () => {
      const chart = makeChart({ options: {} });
      expect(() => hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {})).not.toThrow();
      expect(chart.data.labels).toEqual([]); // untouched
    });

    it('hierarchicalEnabled resolves to false-y when scales exist but neither x nor y declares a type at all', () => {
      const chart = makeChart({ options: { scales: { x: {} } } });
      expect(() => hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {})).not.toThrow();
      expect(chart.data.labels).toEqual([]);
    });

    it('hierarchicalEnabled recognizes a hierarchical y-axis even when x is a different, real type', () => {
      const chart = makeChart({
        options: { scales: { x: { type: 'linear' }, y: { type: 'hierarchical' } } },
        data: { labels: [{ label: '2024', children: ['Q1'] }], datasets: [{ data: [{ value: 10, children: [10] }] }] },
      });
      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      // A real flatten genuinely ran — confirms the y-axis branch itself
      // was taken, not just that beforeUpdate didn't throw.
      expect((chart.data as { flatLabels?: unknown[] }).flatLabels).toHaveLength(2);
    });

    it('beforeDatasetsDraw draws expand/collapse indicators via the real static, vertical (tick-mark) form when both static and !horizontal', () => {
      // hierarchicalRenderButton's own static+vertical branch — every
      // other static-form test in this file uses a horizontal scale.
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: true,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      scale.isHorizontal = () => false;

      const rawLabels = [{ label: '2024', expand: true, children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [4, 6] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {});

      expect(chart.ctx.moveTo).toHaveBeenCalled();
      expect(chart.ctx.strokeRect).not.toHaveBeenCalled();
    });

    it('beforeDatasetsDraw draws the expanded group label above the axis when hierarchyLabelPosition is \'above\'', () => {
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'above',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: false,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'right', { value: 100, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 20, configurable: true });
      scale.isHorizontal = () => true;

      const rawLabels = [{ label: '2024', expand: true, children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [4, 6] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {});

      expect(chart.ctx.fillText).toHaveBeenCalled();
      expect(chart.ctx.textBaseline).toBe('bottom');
    });

    it('beforeDatasetsDraw draws the real "plain line" connector form (no collapse/focus box) when only the middle child of three is visible', () => {
      // hierarchicalSpanLogic's own leftFirstVisible/rightLastVisible
      // both false here (the real leftmost/rightmost VISIBLE child is
      // neither the group's own real first nor last child) — every
      // other beforeDatasetsDraw test in this file has both edges
      // visible, always taking the moveTo/lineTo "box-adjacent" or
      // "edge hint" branches instead of this plain, middle-only one.
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: false,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'right', { value: 100, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 20, configurable: true });
      scale.isHorizontal = () => true;

      const rawLabels = [{ label: '2024', expand: true, children: ['Q1', 'Q2', 'Q3', 'Q4'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [2, 3, 2, 3] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      // Manually narrow the "currently visible" set to just the two
      // middle children (Q2, Q3) — beforeDatasetsDraw reads
      // cc.data.labels directly for this, not hierarchicalDetermineVisible
      // again, so this is a real, legitimate way to isolate this
      // specific rendering path. Two distinct nodes are needed (not
      // one): a single visible node makes leftVisible===rightVisible,
      // skipping the whole moveTo/lineTo connector block entirely.
      const flatLabels = (chart.data as { flatLabels?: HierarchicalLabelNode[] }).flatLabels!;
      const q2 = flatLabels.find((n) => n.label === 'Q2')!;
      const q3 = flatLabels.find((n) => n.label === 'Q3')!;
      chart.data.labels = [q2, q3] as unknown as typeof chart.data.labels;

      expect(() => hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {})).not.toThrow();
      expect(chart.ctx.moveTo).toHaveBeenCalled();
      expect(chart.ctx.strokeRect).not.toHaveBeenCalled(); // no collapse/focus box drawn — neither edge qualifies
    });

    it('beforeDatasetsDraw draws the real "plain line" connector form on a VERTICAL axis too (renderVertLevel\'s own equivalent else branches)', () => {
      // The identical middle-child-only scenario as the horizontal test
      // above, but exercising renderVertLevel's own separate moveTo/
      // lineTo else-branches instead of renderHorLevel's.
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: false,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      scale.isHorizontal = () => false;

      const rawLabels = [{ label: '2024', expand: true, children: ['Q1', 'Q2', 'Q3', 'Q4'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [2, 3, 2, 3] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      const flatLabels = (chart.data as { flatLabels?: HierarchicalLabelNode[] }).flatLabels!;
      const q2 = flatLabels.find((n) => n.label === 'Q2')!;
      const q3 = flatLabels.find((n) => n.label === 'Q3')!;
      chart.data.labels = [q2, q3] as unknown as typeof chart.data.labels;

      expect(() => hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {})).not.toThrow();
      // renderVertLevel's own plain "else" branch calls lineTo only, not
      // moveTo (a real, confirmed asymmetry from renderHorLevel's own
      // equivalent else branch, which does call moveTo — not a guess).
      expect(chart.ctx.lineTo).toHaveBeenCalled();
      expect(chart.ctx.strokeRect).not.toHaveBeenCalled();
    });

    it('beforeEvent skips an out-of-range ancestor in the click loop (the real "continue" path) before finding the real match one level up', () => {
      // hierarchicalHandleClick's own `if (!inRange(offset)) { continue; }`
      // — every other click test in this file has a 2-level tree
      // (root + child), so the loop's own single iteration always
      // matches immediately. A genuine 3-level tree (root > mid > leaf)
      // is needed so the loop's own first ancestor can fail inRange
      // before a later one succeeds.
      const scale = makeHierarchicalScale({ options: { padding: 0, hierarchyBoxLineHeight: 30, reverseOrder: false } });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 100, configurable: true });
      scale.isHorizontal = () => true;
      scale.getValueForPixel = () => 0; // 'Jan', the only real visible leaf

      const rawLabels = [{ label: '2024', expand: true, children: [{ label: 'Q1', expand: true, children: ['Jan'] }] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 100, children: [{ value: 40, children: [40] }] }] }] },
      });
      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      expect((chart.data.labels as unknown as HierarchicalLabelNode[]).map((n) => n.label)).toEqual(['Jan']);

      // elem.offset = scale.bottom(100) + padding(0) = 100. At i=1
      // ('Q1'), inRange checks [100, 130) — clicking at y=135 fails that
      // first row, forcing a real `continue`, then succeeds at i=2's
      // own adjusted row [130, 160).
      hierarchicalPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 10, y: 135 } } as never);

      // 'Jan' is relIndex 0 under an expanded 'Q1' — the real match
      // found one level up collapses 'Q1' back to just itself.
      const labels = chart.data.labels as unknown as HierarchicalLabelNode[];
      expect(labels.map((n) => n.label)).toEqual(['Q1']);
      expect(chart.update).toHaveBeenCalled();
    });

    it('beforeDatasetsDraw draws nothing at all for an unexpanded, static node (the real static "expand" no-op)', () => {
      // hierarchicalRenderButton's own `if (isStatic) { if (type ===
      // 'expand') { return; } ... }` — every other static-mode test in
      // this file uses an already-EXPANDED parent, which only ever
      // calls renderButton with 'collapse'/'focus', never 'expand'.
      // renderButton('expand', ...) is only ever called for an
      // unexpanded, visible node with real children of its own.
      const scale = makeHierarchicalScale({
        options: {
          hierarchyBoxSize: 14,
          hierarchyBoxLineHeight: 30,
          hierarchyBoxColor: 'gray',
          hierarchyBoxWidth: 1,
          hierarchySpanColor: 'gray',
          hierarchySpanWidth: 2,
          hierarchyLabelPosition: 'below',
          hierarchyGroupLabelPosition: 'between-first-and-second',
          static: true,
          reverseOrder: false,
          padding: 5,
        },
      });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'right', { value: 100, configurable: true });
      Object.defineProperty(scale, 'top', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 20, configurable: true });
      scale.isHorizontal = () => true;

      const rawLabels = [{ label: '2024', children: ['Q1', 'Q2'] }]; // starts collapsed
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 10, children: [4, 6] }] }] },
      });

      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});
      hierarchicalPlugin.beforeDatasetsDraw!(chart as never, {} as never, {});

      // The static 'expand' path returns immediately with no drawing
      // calls of its own at all — confirmed by nothing beyond the outer
      // save/restore having run.
      expect(chart.ctx.moveTo).not.toHaveBeenCalled();
      expect(chart.ctx.strokeRect).not.toHaveBeenCalled();
      expect(chart.ctx.fillRect).not.toHaveBeenCalled();
    });

    it('beforeEvent does nothing when a real click lands above the indicator row entirely (hierarchicalResolveElement\'s own null rejection)', () => {
      // hierarchicalResolveElement's own `if ((horizontal && event.y <=
      // offset) || ...) return null;` — every other click test in this
      // file clicks within the real indicator row; this one clicks well
      // above it (inside the normal plot area instead).
      const scale = makeHierarchicalScale({ options: { padding: 0, hierarchyBoxLineHeight: 30, reverseOrder: false } });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 100, configurable: true });
      scale.isHorizontal = () => true;
      scale.getValueForPixel = () => 0;

      const rawLabels = [{ label: '2024', children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 100, children: [40, 60] }] }] },
      });
      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});

      // offset = scale.bottom(100) + padding(0) = 100; event.y=50 <= 100
      // fails the real, strict `>` needed to proceed at all.
      hierarchicalPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 10, y: 50 } } as never);

      const labels = chart.data.labels as unknown as HierarchicalLabelNode[];
      expect(labels.map((n) => n.label)).toEqual(['2024']); // untouched — no expand happened
      expect(chart.update).not.toHaveBeenCalled();
    });

    it('beforeEvent does nothing when the resolved click index has no real, matching visible label at all', () => {
      // hierarchicalHandleClick's own `if (!label) { return; }` — every
      // other click test in this file resolves to a real, visible label;
      // this one deliberately resolves to an out-of-bounds index (the
      // real "missed every node's own band" outcome getValueForPixel
      // itself can produce, confirmed by its own dedicated test above).
      const scale = makeHierarchicalScale({ options: { padding: 0, hierarchyBoxLineHeight: 30, reverseOrder: false } });
      Object.defineProperty(scale, 'type', { value: 'hierarchical', configurable: true });
      Object.defineProperty(scale, 'left', { value: 0, configurable: true });
      Object.defineProperty(scale, 'bottom', { value: 100, configurable: true });
      scale.isHorizontal = () => true;
      scale.getValueForPixel = () => -1; // real "not found" value

      const rawLabels = [{ label: '2024', children: ['Q1', 'Q2'] }];
      const chart = makeChart({
        scales: { x: scale },
        data: { labels: rawLabels, datasets: [{ data: [{ value: 100, children: [40, 60] }] }] },
      });
      hierarchicalPlugin.beforeUpdate!(chart as never, {} as never, {});

      expect(() =>
        hierarchicalPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 10, y: 110 } } as never),
      ).not.toThrow();

      const labels = chart.data.labels as unknown as HierarchicalLabelNode[];
      expect(labels.map((n) => n.label)).toEqual(['2024']); // untouched
      expect(chart.update).not.toHaveBeenCalled();
    });
  });
});
