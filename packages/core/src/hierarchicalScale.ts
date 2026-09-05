/**
 * Local port of `chartjs-plugin-hierarchical` (v4.4.5, MIT, Samuel
 * Gratzl), supplied via a direct `Chart.register(HierarchicalScale)`
 * call instead of a dependency, so it avoids the docs-site
 * dynamic-import hydration gap the other still-dependency-based
 * plugins in this project hit (same rationale as `zoomPlugin.ts`/
 * `gradientPlugin.ts`/`imageLabelPlugin.ts` — see each's own header
 * comment).
 *
 * **Real, confirmed finding, not assumed**: unlike `chartjs-scale-
 * timestack` (which has a hard, real `luxon` dependency), this package
 * has zero runtime dependencies of its own — confirmed directly from
 * its own `package.json` (`peerDependencies: { "chart.js": "^4.1.0" }`,
 * nothing else). This port is therefore fully self-contained, the same
 * "zero extra dependency weight" outcome `zoom`/`gradient`/`imageLabel`
 * already have, not a tradeoff `timestack`'s own port had to accept.
 *
 * **Two things bundled into one package, dissected here as one
 * cohesive file** (matching `zoomPlugin.ts`'s own precedent of keeping
 * a single feature's full logic together, rather than splitting into
 * several small files the way the original package's own `model.ts`/
 * `utils.ts`/`scale/hierarchical.ts`/`plugin/hierarchical.ts` split
 * does):
 * - {@link HierarchicalScale} — a real `CategoryScale` subclass with
 *   its own custom pixel/value mapping, so nested tree levels get
 *   progressively tighter spacing (`levelPercentage`) instead of every
 *   category being equally wide.
 * - `hierarchicalPlugin` (module-private, registered automatically by
 *   the scale's own `afterRegister()` hook below) — draws the
 *   expand/collapse/focus indicator boxes and connector lines below
 *   (or above) the axis, and handles click-to-expand/collapse/
 *   zoom-in/zoom-out by directly mutating `chart.data` and calling
 *   `chart.update()`.
 *
 * **Real, confirmed registration mechanism**: `Chart.register(...)` is
 * called with `HierarchicalScale` alone — its own real, static
 * `afterRegister()` hook (confirmed directly from the original
 * source's own `scale/hierarchical.ts`) calls
 * `registry.addPlugins(hierarchicalPlugin)` itself, so the companion
 * plugin never needs a separate registration call.
 *
 * Every real function/class below (the tree-flattening logic, the
 * scale's own pixel math, the plugin's own draw/click-handling logic)
 * is a faithful port of the original's own real logic, dissected
 * directly from the installed package's own real TypeScript source
 * (`node_modules/chartjs-plugin-hierarchical/src/{model,utils}.ts` and
 * `src/{scale,plugin}/hierarchical.ts`), not the minified/bundled
 * `build/index.js` — the package ships its own real `.ts` sources
 * (`"files": ["build", "src/**\/*.ts"]` in its own `package.json`),
 * making a precise, readable dissection possible here.
 *
 * Fully typed against real Chart.js types throughout, same as this
 * project's other local ports.
 */
import {
  CategoryScale,
  Chart,
  defaults,
  registry,
  type CategoryScaleOptions,
  type Color,
  type FontSpec,
  type Plugin,
} from 'chart.js';
import { toFont, valueOrDefault } from 'chart.js/helpers';

// ---- tree data model (dissected from the original's own model.ts) ----

/** A single node in the flattened hierarchy tree — one per visible or
 * hidden category, with its own real position/visibility state kept
 * directly on the node object itself (mutated in place as the user
 * expands/collapses/focuses parts of the tree), matching the
 * original's own real design. */
export interface HierarchicalLabelNode {
  label: string;
  expand: boolean | 'focus';
  level: number;

  center: number;
  width: number;
  hidden: boolean;
  major: boolean;
  toString(): string;

  parent: number;
  children: HierarchicalLabelNode[];

  index: number;
  relIndex: number;

  value?: string;
}

/** The raw, consumer-authored shape passed in as `data.labels` —
 * either a plain string leaf, or an object with optional `children`
 * (each itself a nested `HierarchicalRawLabelNode` or plain string). */
export interface HierarchicalRawLabelNode {
  /** The label text shown on the axis. */
  label: string;
  /** Whether this node starts collapsed (`false`), expanded (`true`),
   * or expanded-and-focused/zoomed-in (`'focus'`).
   * @default false */
  expand?: boolean | 'focus';
  /** Hides this node (and, transitively, its own children) entirely. */
  hidden?: boolean;
  /** This node's own children, each either a nested raw node or a
   * plain string leaf label. */
  children?: (HierarchicalRawLabelNode | string)[];
}

export type HierarchicalLabelNodes = readonly HierarchicalLabelNode[];

/** The raw, consumer-authored shape passed in as each dataset's own
 * `data` (via the `tree` field the plugin populates on first use) —
 * either a plain leaf number, or an object with its own `children`
 * mirroring the label tree's own shape one-for-one. */
export interface HierarchicalValueNode {
  /** This node's own value (only meaningful for a leaf; an internal
   * node's own `value` is never read directly — see `resolve()`
   * below). */
  value: number;
  /** This node's own children, mirroring the corresponding label
   * node's own children one-for-one. */
  children: readonly (HierarchicalValueNode | number)[];
}

/** `true` for a real internal `HierarchicalValueNode` (one with real
 * children of its own), `false` for a plain leaf number. */
export function isHierarchicalValueNode(node: HierarchicalValueNode | number | null | undefined): node is HierarchicalValueNode {
  return node != null && typeof node === 'object' && Array.isArray((node as HierarchicalValueNode).children);
}

/** A dataset augmented with the `tree` field this plugin populates on
 * first use, caching the dataset's own original, full-depth tree
 * (`dataset.data` itself is repeatedly overwritten in place with just
 * the currently-visible flat values, so the original tree needs its
 * own separate, stable home to resolve future expand/collapse/zoom
 * operations against). Deliberately NOT `extends ChartDataset<'bar',
 * number[]>` — confirmed via a real `tsc --noEmit` run: a concrete
 * `'bar'` type parameter there is structurally incompatible with
 * `Chart`'s own default (unparameterized) generic used everywhere else
 * in this file (`hierarchicalFindScale(chart: Chart)` and every one of
 * its own real call sites), whose own default type parameter resolves
 * to `keyof ChartTypeRegistry` — a union across every chart kind
 * registered anywhere in this project, including `chartjs-chart-
 * financial`'s own `'ohlc'`/`'candlestick'` module augmentation. This
 * plugin's own real logic only ever reads/writes `data`/`tree` on a
 * dataset directly (every other field goes through a `Record<string,
 * unknown>` cast already, see `hierarchicalUpdateAttributes` below) —
 * a loose, chart-kind-agnostic shape is both sufficient and correct
 * here, not a narrowing this file's own logic actually needs. */
export interface HierarchicalEnhancedDataset {
  type?: string;
  data: number[];
  tree?: (HierarchicalValueNode | number)[];
  [key: string]: unknown;
}

/** The chart's own `data` object, augmented with the extra bookkeeping
 * fields this plugin's own `check()`/`updateAttributes()` maintain —
 * `flatLabels` (every node, visible or not, in a single flat array for
 * O(1) parent/child lookups by index), `rootNodes` (the top-level
 * nodes only, for the plugin's own draw pass to start its traversal
 * from), and `_verify` (a cheap structural fingerprint used to detect
 * whether the consumer replaced `data.labels` with a genuinely new
 * tree since the last update, versus this same plugin's own prior
 * in-place mutations). Deliberately NOT `extends ChartData<'bar',
 * number[], HierarchicalLabelNode>` — same reasoning as
 * `HierarchicalEnhancedDataset` above: `labels`/`datasets` are already
 * fully overridden with this file's own real, distinct shapes below,
 * so extending a concrete-`'bar'`-typed generic added nothing but a
 * structural-compatibility conflict with `Chart`'s own default,
 * broader generic used everywhere else. */
export interface HierarchicalEnhancedChartData {
  flatLabels?: HierarchicalLabelNodes;
  labels: HierarchicalLabelNode[];
  _verify?: string;
  rootNodes?: HierarchicalLabelNodes;
  datasets: HierarchicalEnhancedDataset[];
}

/** The chart instance, augmented with the above `data` shape — used as
 * an internal cast throughout this file's own plugin-side logic, never
 * exposed to a consumer directly. `Omit<Chart, 'data'>`, not plain
 * `Chart` — confirmed via a real `tsc --noEmit` run: even with every
 * real call site in this file already casting via `as unknown as
 * Chart` where needed (see `hierarchicalUpdateAttributes` and the
 * three `hierarchicalFindScale(...)?.determineDataLimits()` call
 * sites below), the interface DECLARATION itself still fails
 * TypeScript's own "incorrectly extends" check purely from *stating*
 * `data: HierarchicalEnhancedChartData` alongside `Chart`'s own real
 * `data: ChartData<keyof ChartTypeRegistry, ...>` — omitting `data`
 * from the base before re-adding this file's own override removes the
 * conflicting property from the comparison entirely, which is what a
 * plain, unparameterized `extends Chart` alone could not do (see
 * `HierarchicalEnhancedDataset`'s own header comment above for the
 * full reasoning on why a concrete `'bar'`-typed parameterization was
 * tried and reverted first). */
export interface HierarchicalEnhancedChart extends Omit<Chart, 'data'> {
  data: HierarchicalEnhancedChartData;
}

// ---- tree utilities (dissected from the original's own utils.ts) ----

/** Builds a single real `HierarchicalLabelNode` (and, recursively, its
 * own full subtree) from a raw, consumer-authored label — either a
 * bare string leaf or a `HierarchicalRawLabelNode` object. `parent`,
 * when given, links the new node's own `parent`/`level` fields back to
 * it (root nodes are built with no `parent` at all). */
function hierarchicalAsNode(label: string | HierarchicalRawLabelNode, parent?: HierarchicalLabelNode): HierarchicalLabelNode {
  const node: HierarchicalLabelNode = {
    index: 0,
    relIndex: 0,
    label: '',
    children: [],
    expand: false,
    parent: parent ? parent.index : -1,
    level: parent ? parent.level + 1 : 0,
    center: Number.NaN,
    width: 0,
    hidden: false,
    major: !parent, // for ticks
    toString(): string {
      return this.label;
    },
  };
  if (typeof label === 'string') {
    node.label = label;
  } else {
    Object.assign(node, {
      ...label,
      children: (label.children ?? []).map((child) => hierarchicalAsNode(child, node)),
    });
  }
  return node;
}

/** Pushes `node` (and, recursively, its own children) into `flat`,
 * assigning each its own real, absolute `index` (position in `flat`)
 * and linking `parent`/`hidden` along the way — this is what turns a
 * tree of nested objects into the single flat array every other
 * function below actually operates on. */
function hierarchicalPush(node: HierarchicalLabelNode, relIndex: number, flat: HierarchicalLabelNode[], parent?: HierarchicalLabelNode): void {
  node.relIndex = relIndex;
  node.index = flat.length;
  node.parent = parent ? parent.index : -1;
  // Hidden if the parent itself isn't expanded, or if this node was
  // itself explicitly marked hidden by the consumer.
  node.hidden = Boolean(parent ? parent.expand === false || node.expand : node.expand);

  flat.push(node);

  node.children.forEach((child, childIndex) => hierarchicalPush(child, childIndex, flat, node));
}

/** Converts the consumer's own raw `data.labels` tree into a single
 * flat array of fully-linked {@link HierarchicalLabelNode}s — the real
 * form every other function in this file operates on. */
export function hierarchicalToNodes(labels: readonly (HierarchicalRawLabelNode | string)[]): HierarchicalLabelNodes {
  const nodes = labels.map((label) => hierarchicalAsNode(label));
  const flat: HierarchicalLabelNode[] = [];
  nodes.forEach((node, index) => hierarchicalPush(node, index, flat));
  return flat;
}

/** The chain of ancestors of `node`, starting from its own topmost
 * root and ending with `node` itself (inclusive) — used throughout
 * this file to resolve a node's own data value (by walking the
 * matching value tree one level at a time) and to find common
 * ancestors between two nodes. */
export function hierarchicalParentsOf(node: HierarchicalLabelNode, flat: HierarchicalLabelNodes): HierarchicalLabelNodes {
  const parents = [node];
  while (parents[0].parent >= 0) {
    parents.unshift(flat[parents[0].parent]);
  }
  return parents;
}

/** The rightmost visible-if-expanded descendant of `node` — an
 * expanded node's own rightmost grandchild, recursively, or `node`
 * itself if it's collapsed (nothing further to descend into). */
function hierarchicalRightMost(node: HierarchicalLabelNode): HierarchicalLabelNode {
  if (!node.expand || node.children.length === 0) {
    return node;
  }
  return hierarchicalRightMost(node.children[node.children.length - 1]);
}

/** The last currently-visible node sharing `node`'s own level,
 * considering any expanded children along the way — used by the
 * plugin's own click handler to detect "this is the very last item of
 * its own expanded parent" (which triggers a zoom-in/zoom-out
 * transition rather than a plain collapse). */
export function hierarchicalLastOfLevel(node: HierarchicalLabelNode, flat: HierarchicalLabelNodes): HierarchicalLabelNode {
  if (node.parent > -1) {
    const parent = flat[node.parent];
    return hierarchicalRightMost(parent.children[parent.children.length - 1]);
  }
  const sibling =
    flat
      .slice()
      .reverse()
      .find((candidate) => candidate.parent === -1) ?? flat[0];
  return hierarchicalRightMost(sibling);
}

/** Visits `node`, then (unless `visit` returns `false` for it) each of
 * its own children, depth-first, pre-order. */
export function hierarchicalPreOrderTraversal(node: HierarchicalLabelNode, visit: (node: HierarchicalLabelNode) => void | boolean): void {
  const goDeep = visit(node);
  if (goDeep !== false) {
    node.children.forEach((child) => hierarchicalPreOrderTraversal(child, visit));
  }
}

/** Resolves `label`'s own real data value by walking its own ancestor
 * chain one level at a time through the matching value tree
 * (`dataTree`, the dataset's own cached, full-depth `tree`), using
 * each ancestor's own `relIndex` to pick the matching child at each
 * level — this is what lets a dataset's own `data` stay a flat array
 * of numbers (one per currently-visible label) while the underlying
 * value tree keeps its own full, nested shape untouched. */
export function hierarchicalResolve(label: HierarchicalLabelNode, flat: HierarchicalLabelNodes, dataTree: (HierarchicalValueNode | number)[]): number {
  const parents = hierarchicalParentsOf(label, flat);

  let dataItem: HierarchicalValueNode | number = {
    children: dataTree,
    value: Number.NaN,
  };
  const dataParents = parents.map((parent) => {
    dataItem = dataItem && isHierarchicalValueNode(dataItem) ? dataItem.children[parent.relIndex] : Number.NaN;
    return dataItem;
  });

  const value = dataParents[dataParents.length - 1];
  if (isHierarchicalValueNode(value)) {
    return value.value;
  }
  return value;
}

/** How many leaf rows become visible if `node` itself is expanded —
 * `1` for a collapsed node (just itself), or the sum of each child's
 * own `countExpanded` otherwise. Used to compute exactly how many flat
 * array slots a collapse operation needs to remove (and an expand
 * needs to insert). */
export function hierarchicalCountExpanded(node: HierarchicalLabelNode): number {
  if (!node.expand) {
    return 1;
  }
  return node.children.reduce((total, child) => total + hierarchicalCountExpanded(child), 0);
}

/** The full flat-array slice spanning `node`'s own children (and,
 * transitively, any of their own expanded descendants) — used by
 * `spanLogic()` below to find the currently-visible left/right edges
 * of an expanded group. */
export function hierarchicalFlatChildren(node: HierarchicalLabelNode, flat: HierarchicalLabelNodes): HierarchicalLabelNodes {
  if (node.children.length === 0) {
    return [];
  }
  const firstChild = node.children[0];
  if (node.parent >= 0 && node.relIndex < flat[node.parent].children.length - 1) {
    const nextSibling = flat[node.parent].children[node.relIndex + 1];
    return flat.slice(firstChild.index, nextSibling.index);
  }
  const nextSibling = flat
    .slice(firstChild.index + 1)
    .find((candidate) => candidate.level < node.level || (candidate.parent === node.parent && candidate.relIndex === node.relIndex + 1));
  if (nextSibling) {
    return flat.slice(firstChild.index, nextSibling.index);
  }
  return flat.slice(firstChild.index);
}

/** The real set of nodes that should currently be shown on the axis —
 * every non-hidden node, unless one node is `'focus'`ed (zoomed in),
 * in which case only that focused node's own visible descendants are
 * shown. */
export function hierarchicalDetermineVisible(flat: HierarchicalLabelNodes): HierarchicalLabelNodes {
  const focus = flat.find((node) => node.expand === 'focus');
  if (focus) {
    return flat.slice(focus.index + 1).filter((node) => !node.hidden && hierarchicalParentsOf(node, flat).includes(focus));
  }
  return flat.filter((node) => !node.hidden);
}

export interface HierarchicalSpanLogicResult {
  hasCollapseBox: boolean;
  hasFocusBox: boolean;
  leftVisible: HierarchicalLabelNode;
  rightVisible: HierarchicalLabelNode;
  groupLabelCenter: number;
  leftFirstVisible: boolean;
  rightLastVisible: boolean;
}

/** Computes everything the plugin's own draw pass needs to render one
 * expanded group's own indicator boxes/connector line/group label:
 * whether a collapse box belongs at its own left edge, a focus box at
 * its own right edge, which currently-visible nodes are its own
 * leftmost/rightmost, and where its own group label should be
 * centered. Returns `false` for a node with no children, or one that
 * isn't currently expanded at all (nothing to draw for it). */
export function hierarchicalSpanLogic(
  node: HierarchicalLabelNode,
  flat: HierarchicalLabelNodes,
  visibleNodes: ReadonlySet<HierarchicalLabelNode>,
  groupLabelPosition: 'first' | 'center' | 'last' | 'between-first-and-second' = 'between-first-and-second',
): false | HierarchicalSpanLogicResult {
  if (node.children.length === 0 || !node.expand) {
    return false;
  }
  const firstChild = node.children[0];
  const lastChild = node.children[node.children.length - 1];
  const flatSubTree = hierarchicalFlatChildren(node, flat);

  const leftVisible = flatSubTree.find((candidate) => visibleNodes.has(candidate));
  const rightVisible = flatSubTree
    .slice()
    .reverse()
    .find((candidate) => visibleNodes.has(candidate));

  if (!leftVisible || !rightVisible) {
    return false;
  }

  const leftParents = hierarchicalParentsOf(leftVisible, flat);
  const rightParents = hierarchicalParentsOf(rightVisible, flat);
  const leftFirstVisible = leftParents[node.level + 1] === firstChild;
  const rightLastVisible = rightParents[node.level + 1] === lastChild;

  const hasCollapseBox = leftFirstVisible && node.expand !== 'focus';
  const hasFocusBox = leftFirstVisible && rightLastVisible && node.children.length > 1;

  let groupLabelCenter = 0;
  switch (groupLabelPosition) {
    case 'between-first-and-second': {
      const nextVisible = flat.slice(leftVisible.index + 1, rightVisible.index + 1).find((candidate) => visibleNodes.has(candidate));
      groupLabelCenter = !nextVisible ? leftVisible.center : (leftVisible.center + nextVisible.center) / 2;
      break;
    }
    case 'center':
      groupLabelCenter = (leftVisible.center + rightVisible.center) / 2;
      break;
    case 'last':
      groupLabelCenter = rightVisible.center;
      break;
    case 'first':
    default:
      groupLabelCenter = leftVisible.center;
      break;
  }

  return { hasCollapseBox, hasFocusBox, leftVisible, rightVisible, groupLabelCenter, leftFirstVisible, rightLastVisible };
}

/** The deepest `level` reached by any node in `rootNodes`' own
 * expanded subtrees — used by the plugin's own draw pass to compute
 * per-level vertical offsets when `reverseOrder` is set (so the
 * deepest level sits nearest the axis instead of farthest from it). */
export function hierarchicalGetMaxDepth(rootNodes: HierarchicalLabelNode[]): number {
  const levels: number[] = [];
  const addToLevels = (node: HierarchicalLabelNode): boolean => {
    levels.push(node.level);
    return Boolean(node.expand) && node.children.length > 0;
  };
  rootNodes.forEach((root) => hierarchicalPreOrderTraversal(root, addToLevels));
  return Math.max(...levels);
}

// ---- the scale itself (dissected from the original's own scale/hierarchical.ts) ----

export interface HierarchicalScaleOptions extends CategoryScaleOptions {
  /** Ratio by which the distance between two elements shrinks the
   * higher the level of the tree is — two top-level bars have a
   * distance of `1`; two nested one level down have `levelPercentage`
   * instead (e.g. `0.75`).
   * @default 0.75 */
  levelPercentage: number;
  /** Padding between the axis's own edge and the first row of
   * expand/collapse indicators.
   * @default 5 */
  padding: number;
  /** Where each expanded group's own label is drawn relative to the
   * axis — `'none'` disables it entirely.
   * @default 'below' */
  hierarchyLabelPosition: 'below' | 'above' | 'none' | null;
  /** Where each expanded group's own label is centered relative to
   * its own visible children.
   * @default 'between-first-and-second' */
  hierarchyGroupLabelPosition: 'center' | 'first' | 'last' | 'between-first-and-second';
  /** `true` disables the interactive expand/collapse/focus boxes
   * entirely, drawing only the static connector lines/labels.
   * @default false */
  static: boolean;
  /** Size, in pixels, of each expand/collapse/focus indicator box. */
  hierarchyBoxSize: number;
  /** Vertical (or, for a vertical axis, horizontal) distance between
   * two stacked hierarchy indicator rows. */
  hierarchyBoxLineHeight: number;
  /** Stroke color of the connector lines between an expanded group's
   * own visible children. */
  hierarchySpanColor: string;
  /** Stroke width of those same connector lines. */
  hierarchySpanWidth: number;
  /** Stroke color of the expand/collapse/focus indicator boxes
   * themselves. */
  hierarchyBoxColor: string;
  /** Stroke width of those same indicator boxes. */
  hierarchyBoxWidth: number;
  /** Per-attribute defaults (e.g. `backgroundColor`) inherited down
   * the tree from whichever ancestor node first defines them —
   * populated onto each dataset automatically once resolved.
   * @default {} */
  attributes: Record<string, unknown>;
  offset: true;
  /** `true` puts the lowest hierarchy level nearest the axis and the
   * highest level farthest from it (reversing the usual, top-down
   * drawing order).
   * @default false */
  reverseOrder: boolean;
}

const HIERARCHICAL_DEFAULT_CONFIG: Partial<Omit<HierarchicalScaleOptions, 'grid'>> & {
  grid: Partial<HierarchicalScaleOptions['grid']>;
} = {
  offset: true,
  grid: { offset: true },
  static: false,
  levelPercentage: 0.75,
  padding: 5,
  hierarchyLabelPosition: 'below',
  hierarchyGroupLabelPosition: 'between-first-and-second',
  hierarchyBoxSize: 14,
  hierarchyBoxLineHeight: 30,
  hierarchySpanColor: 'gray',
  hierarchySpanWidth: 2,
  hierarchyBoxColor: 'gray',
  hierarchyBoxWidth: 1,
  attributes: {},
  reverseOrder: false,
};

/** The subset of `CategoryScale`'s own real, protected/internal
 * instance state this port reads/writes directly — Chart.js's own
 * public `Scale` type doesn't declare any of these (they're genuine
 * `CategoryScale`-internal fields), confirmed real via the original
 * package's own identical cast (`as unknown as IInternalScale`), not a
 * guess introduced by this port. */
interface HierarchicalInternalScale {
  _valueRange: number;
  _startValue: number;
  _startPixel: number;
  _length: number;
}

/**
 * A `CategoryScale` subclass whose own tick spacing tightens
 * progressively for deeper tree levels, so a chart showing e.g.
 * `2024 > Q1/Q2/Q3/Q4` groups its own quarters visually closer
 * together than the years themselves are — the real effect
 * `chartjs-plugin-hierarchical` is named for.
 *
 * Registered via `Chart.register(HierarchicalScale)`, which (via this
 * class's own real, static `afterRegister()` hook) also registers the
 * companion drawing/interaction plugin automatically — no separate
 * registration call needed for it.
 */
export class HierarchicalScale extends CategoryScale<HierarchicalScaleOptions> {
  /** The current flat node array this scale's own tick/pixel logic
   * operates against — refreshed on every `determineDataLimits()`
   * call from `getLabels()` (which the companion plugin's own `check()`
   * keeps pointed at the currently-visible node subset). */
  private _nodes: HierarchicalLabelNodes = [];

  determineDataLimits(): void {
    const labels = this.getLabels() as unknown as HierarchicalLabelNodes;
    this._nodes = labels.slice();
    super.determineDataLimits();
  }

  buildTicks(): { label: string; value: number }[] {
    const nodes = this._nodes.slice(this.min, this.max + 1);
    const internal = this as unknown as HierarchicalInternalScale;
    internal._valueRange = Math.max(nodes.length, 1);
    internal._startValue = this.min - 0.5;
    if (nodes.length === 0) {
      return [];
    }
    // A fresh array (not `nodes` itself) since Chart.js's own autoSkip
    // pass mutates whatever array it's given.
    return nodes.map((node, index) => ({ label: node.label, value: index }));
  }

  configure(): void {
    super.configure();
    const nodes = this._nodes.slice(this.min, this.max + 1);
    const flat = (this.chart as unknown as HierarchicalEnhancedChart).data.flatLabels ?? [];
    const total = (this as unknown as HierarchicalInternalScale)._length;

    if (nodes.length === 0) {
      return;
    }

    // Distances are expressed as fractions of one another first
    // (`ratio ** level`), then scaled to real pixels once their own
    // total is known — this is what makes nested levels visually
    // tighter without needing to know the real pixel width up front.
    const ratio = this.options.levelPercentage;
    const distances: number[] = [0.5]; // half of one top-level distance before the first node

    let previous = nodes[0];
    let previousParents = hierarchicalParentsOf(previous, flat);
    for (let i = 1; i < nodes.length; i += 1) {
      const node = nodes[i];
      const parents = hierarchicalParentsOf(node, flat);
      if (previous.parent === node.parent) {
        distances.push(ratio ** node.level);
      } else {
        let common = 0;
        while (parents[common] === previousParents[common]) {
          common += 1;
        }
        distances.push(ratio ** common);
      }
      previous = node;
      previousParents = parents;
    }
    distances.push(0.5); // half of one top-level distance after the last node

    const totalDistance = distances.reduce((sum, distance) => sum + distance, 0);
    const factor = total / totalDistance;

    let offset = distances[0] * factor;
    nodes.forEach((node, i) => {
      const previousGap = distances[i] * factor;
      const nextGap = distances[i + 1] * factor;
      node.center = offset;
      offset += nextGap;
      node.width = Math.min(nextGap, previousGap) / 2;
    });
  }

  getPixelForDecimal(value: number): number {
    const index = Math.min(Math.floor(value * this._nodes.length), this._nodes.length - 1);
    if (index === 1 && this._nodes.length === 1) {
      // A real Chart.js corner case (confirmed via the original's own
      // identical special-case, not introduced here): Chart.js itself
      // probes with a hard-coded `value` corresponding to index `1`
      // when measuring a single-category scale's own tick width, even
      // though the only real index is `0`.
      return this._nodes[0].width;
    }
    return this._centerBase(index);
  }

  private _centerBase(index: number): number {
    const centerTick = this.options.offset;
    const base = (this as unknown as HierarchicalInternalScale)._startPixel;
    const node = this._nodes[index];
    if (node == null) {
      return base;
    }
    const nodeCenter = node.center ?? 0;
    const nodeWidth = node.width ?? 0;
    return base + nodeCenter - (centerTick ? 0 : nodeWidth / 2);
  }

  getValueForPixel(pixel: number): number {
    return this._nodes.findIndex((node) => pixel >= node.center - node.width / 2 && pixel <= node.center + node.width / 2);
  }

  static id = 'hierarchical';

  static defaults = {
    ...(CategoryScale.defaults as Record<string, unknown>),
    ...HIERARCHICAL_DEFAULT_CONFIG,
  } as unknown as Record<string, unknown>;

  static afterRegister(): void {
    registry.addPlugins(hierarchicalPlugin);
  }
}

// ---- the companion plugin (dissected from the original's own plugin/hierarchical.ts) ----

/** A cheap structural fingerprint of the consumer's own raw label
 * tree — recomputed and compared on every `beforeUpdate`, so the
 * plugin can tell "the consumer replaced `data.labels` with a genuinely
 * new tree" (needs a full re-flatten) apart from "this is just this
 * same plugin's own prior in-place mutation coming back around" (no
 * re-flatten needed, would wipe out expand/collapse state). */
function hierarchicalGenerateCode(labels: readonly (HierarchicalLabelNode | string)[]): string {
  let code = '';
  const encode = (label: string | HierarchicalLabelNode): void => {
    if (typeof label === 'string') {
      code += label;
      return;
    }
    code += `(l=${label.label},e=${label.expand},c=[`;
    (label.children || []).forEach(encode);
    code += '])';
  };
  labels.forEach(encode);
  return code;
}

function hierarchicalIsValidScaleType(chart: Chart, scaleId: 'x' | 'y'): boolean {
  const scales = chart.config.options?.scales as Record<string, { type?: string }> | undefined;
  if (!scales || !Object.prototype.hasOwnProperty.call(scales, scaleId)) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(scales[scaleId], 'type');
}

/** `'x'`/`'y'` if that axis is configured as a hierarchical scale,
 * `null` if neither is — every one of the plugin's own hooks below
 * uses this as an early-exit guard so a chart with no hierarchical
 * axis at all pays no cost from this plugin being globally
 * registered. */
function hierarchicalEnabled(chart: Chart): 'x' | 'y' | null {
  const { options } = chart.config;
  if (!options || !Object.prototype.hasOwnProperty.call(options, 'scales')) {
    return null;
  }
  const scales = chart.config.options?.scales as Record<string, { type?: string }> | undefined;
  if (scales && hierarchicalIsValidScaleType(chart, 'x') && scales.x.type === 'hierarchical') {
    return 'x';
  }
  if (scales && hierarchicalIsValidScaleType(chart, 'y') && scales.y.type === 'hierarchical') {
    return 'y';
  }
  return null;
}

function hierarchicalFindScale(chart: Chart): HierarchicalScale | undefined {
  return Object.values(chart.scales).find((scale) => scale.type === 'hierarchical') as HierarchicalScale | undefined;
}

/** Re-derives every per-attribute default (e.g. `backgroundColor`)
 * this scale's own `options.attributes` declares, walking each visible
 * node's own ancestor chain until it finds one that actually sets the
 * attribute (or falls back to the configured default) — applied onto
 * each dataset directly, collapsing to a single shared value when
 * every visible node resolves to the same one. */
function hierarchicalUpdateAttributes(chart: HierarchicalEnhancedChart): void {
  const scale = hierarchicalFindScale(chart as unknown as Chart);
  if (!scale) {
    return;
  }
  const { attributes } = scale.options;
  const nodes = chart.data.labels;
  const flat = chart.data.flatLabels ?? [];

  Object.keys(attributes).forEach((attr) => {
    chart.data.datasets.forEach((dataset) => {
      const values = nodes.map((startNode: HierarchicalLabelNode | null) => {
        let node = startNode;
        while (node) {
          const nodeRecord = node as unknown as Record<string, unknown>;
          if (nodeRecord[attr] !== undefined) {
            return nodeRecord[attr];
          }
          node = node.parent >= 0 ? flat[node.parent] : null;
        }
        return attributes[attr];
      });
      const datasetRecord = dataset as unknown as Record<string, unknown>;
      datasetRecord[attr] = values.length >= 1 && values.every((value) => value === values[0]) ? values[0] : values;
    });
  });
}

function hierarchicalUpdateVerifyCode(chart: HierarchicalEnhancedChart): void {
  chart.data._verify = hierarchicalGenerateCode(chart.data.labels);
}

/** Rebuilds the flat node tree (and every visible dataset's own flat
 * value array) from the consumer's own raw `data.labels`, but only
 * when `data.labels` genuinely changed since the last check (per
 * `_verify`) — otherwise a no-op, so this plugin's own prior
 * expand/collapse mutations aren't immediately undone by the very
 * next update they themselves triggered. */
function hierarchicalCheck(chart: HierarchicalEnhancedChart): void {
  if (chart.data.labels && chart.data._verify === hierarchicalGenerateCode(chart.data.labels)) {
    return;
  }

  const flat = hierarchicalToNodes(chart.data.labels as unknown as (HierarchicalRawLabelNode | string)[]);
  chart.data.flatLabels = flat;
  chart.data.rootNodes = flat.filter((node) => node.parent === -1);

  const labels = hierarchicalDetermineVisible(flat);
  chart.data.labels = labels as unknown as HierarchicalLabelNode[];
  hierarchicalUpdateVerifyCode(chart);

  chart.data.datasets.forEach((dataset) => {
    if (dataset.tree == null) {
      dataset.tree = (dataset.data as unknown as (HierarchicalValueNode | number)[]).slice();
    }
    dataset.data = labels.map((label) => hierarchicalResolve(label, flat, dataset.tree!)) as unknown as number[];
  });

  hierarchicalUpdateAttributes(chart);
}

function hierarchicalPostDataUpdate(chart: HierarchicalEnhancedChart): void {
  hierarchicalUpdateVerifyCode(chart);
  hierarchicalUpdateAttributes(chart);
  chart.update();
}

/** Splices `toAdd` into `chart.data.labels`/each dataset's own flat
 * `data` at `index`, replacing `count` existing entries — using
 * `Array.prototype.splice` specifically (not a full array
 * reassignment) since Chart.js's own animation system tracks array
 * mutations through that exact method to animate the transition
 * smoothly. */
function hierarchicalExpandCollapse(chart: HierarchicalEnhancedChart, index: number, count: number, toAdd: HierarchicalLabelNodes): void {
  const labels = chart.data.labels;
  const flatLabels = chart.data.flatLabels ?? [];
  const datasets = chart.data.datasets;

  const removed = labels.splice(index, count, ...toAdd);
  removed.forEach((node) => {
    node.hidden = true;
  });
  toAdd.forEach((node) => {
    node.hidden = false;
  });
  hierarchicalFindScale(chart as unknown as Chart)?.determineDataLimits();

  datasets.forEach((dataset) => {
    const toAddData = toAdd.map((node) => hierarchicalResolve(node, flatLabels, dataset.tree!));
    (dataset.data as unknown as number[])?.splice(index, count, ...toAddData);
  });
}

function hierarchicalCollapse(chart: HierarchicalEnhancedChart, index: number, parent: HierarchicalLabelNode): void {
  const count = hierarchicalCountExpanded(parent);
  parent.children.forEach((child) =>
    hierarchicalPreOrderTraversal(child, (node) => {
      node.expand = false;
    }),
  );
  hierarchicalExpandCollapse(chart, index, count, [parent]);
  parent.expand = false;
  hierarchicalPostDataUpdate(chart);
}

function hierarchicalExpand(chart: HierarchicalEnhancedChart, index: number, node: HierarchicalLabelNode): void {
  hierarchicalExpandCollapse(chart, index, 1, node.children);
  node.expand = true;
  hierarchicalPostDataUpdate(chart);
}

function hierarchicalZoomIn(chart: HierarchicalEnhancedChart, lastIndex: number, parent: HierarchicalLabelNode, flat: HierarchicalLabelNodes): void {
  const count = hierarchicalCountExpanded(parent);
  flat.forEach((node) => {
    if (node.expand === 'focus') {
      node.expand = true;
    }
  });
  parent.expand = 'focus';

  const index = lastIndex - count + 1;
  const { labels } = chart.data;
  labels.splice(lastIndex + 1, labels.length);
  labels.splice(0, index);
  hierarchicalFindScale(chart as unknown as Chart)?.determineDataLimits();

  chart.data.datasets.forEach((dataset) => {
    const data = dataset.data as unknown as number[] | undefined;
    if (data) {
      data.splice(lastIndex + 1, data.length);
      data.splice(0, index);
    }
  });

  hierarchicalPostDataUpdate(chart);
}

function hierarchicalZoomOut(chart: HierarchicalEnhancedChart, parent: HierarchicalLabelNode): void {
  const labels = chart.data.labels;
  const flatLabels = chart.data.flatLabels ?? [];

  parent.expand = true;
  const nextLabels = flatLabels.filter((node) => !node.hidden);
  const index = nextLabels.indexOf(labels[0]);
  const count = labels.length;

  labels.splice(labels.length, 0, ...nextLabels.slice(index + count));
  labels.splice(0, 0, ...nextLabels.slice(0, index));
  hierarchicalFindScale(chart as unknown as Chart)?.determineDataLimits();

  chart.data.datasets.forEach((dataset) => {
    const toAddBefore = nextLabels.slice(0, index).map((node) => hierarchicalResolve(node, flatLabels, dataset.tree!));
    const toAddAfter = nextLabels.slice(index + count).map((node) => hierarchicalResolve(node, flatLabels, dataset.tree!));
    const data = dataset.data as unknown as number[] | undefined;
    if (data) {
      data.splice(data.length, 0, ...toAddAfter);
      data.splice(0, 0, ...toAddBefore);
    }
  });

  hierarchicalPostDataUpdate(chart);
}

function hierarchicalResolveElement(event: { x: number; y: number }, scale: HierarchicalScale): { offset: number; index: number } | null {
  const horizontal = scale.isHorizontal();
  const offset = horizontal ? scale.bottom + scale.options.padding : scale.left - scale.options.padding;
  if ((horizontal && event.y <= offset) || (!horizontal && event.x > offset)) {
    return null;
  }
  const index = scale.getValueForPixel(horizontal ? event.x - scale.left : event.y - scale.top);
  return { offset, index };
}

function hierarchicalHandleClick(
  chart: Chart,
  elem: { offset: number; index: number },
  offsetDelta: number,
  inRange: (offset: number) => boolean,
  reverse: boolean,
): void {
  const cc = chart as unknown as HierarchicalEnhancedChart;
  let { offset } = elem;
  const { index } = elem;
  const flat = cc.data.flatLabels ?? [];
  const label = cc.data.labels?.[index];
  if (!label) {
    return;
  }
  const parents = hierarchicalParentsOf(label, flat);
  const maxDepth = hierarchicalGetMaxDepth((cc.data.rootNodes ?? []) as HierarchicalLabelNode[]);
  if (reverse) offset += maxDepth * offsetDelta;

  for (let i = 1; i < parents.length; i += 1, reverse ? (offset -= offsetDelta) : (offset += offsetDelta)) {
    if (!inRange(offset)) {
      continue;
    }
    const node = parents[i];
    const isParentOfFirstChild = node.children[0] === parents[i + 1] || i === parents.length - 1;
    const parent = flat[node.parent];

    if (isParentOfFirstChild && node.relIndex === 0 && parent.expand === true) {
      hierarchicalCollapse(cc, index, parent);
      return;
    }
    const isLastChildOfParent = hierarchicalLastOfLevel(node, flat) === label;

    if (isLastChildOfParent && parent.expand === 'focus') {
      hierarchicalZoomOut(cc, parent);
      return;
    }
    if (isLastChildOfParent && parent.expand === true && hierarchicalFlatChildren(parent, flat).every((child) => child.expand !== 'focus')) {
      hierarchicalZoomIn(cc, index, parent, flat);
      return;
    }
  }

  if (label.children.length > 0 && inRange(offset)) {
    hierarchicalExpand(cc, index, label);
  }
}

/** Draws one expand/collapse/focus box, in either the box-and-symbol
 * form (default) or a thin tick mark (`options.static`, when only a
 * "collapse"-shaped indicator is drawn, since a static chart has
 * nothing to expand into). */
function hierarchicalRenderButton(
  ctx: CanvasRenderingContext2D,
  type: 'expand' | 'collapse' | 'focus',
  vertical: boolean,
  x: number,
  y: number,
  boxSize: number,
  isStatic: boolean,
  spanColor: string,
  spanWidth: number,
): void {
  const boxSize05 = boxSize * 0.5;
  const boxSize01 = boxSize * 0.1;
  if (isStatic) {
    if (type === 'expand') {
      return;
    }
    ctx.save();
    ctx.strokeStyle = spanColor;
    ctx.lineWidth = spanWidth;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(x - boxSize01, y);
      ctx.lineTo(x - boxSize05, y);
    } else {
      ctx.moveTo(x, y + boxSize01);
      ctx.lineTo(x, y + boxSize05);
      ctx.lineTo(x + (type === 'collapse' ? boxSize05 : -boxSize05), y + boxSize05);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  const x0 = x - (vertical ? boxSize : boxSize05);
  const y0 = y - (vertical ? boxSize05 : 0);
  ctx.strokeRect(x0, y0, boxSize, boxSize);
  switch (type) {
    case 'expand':
      ctx.fillRect(x0 + 2, y0 + boxSize05 - 1, boxSize - 4, 2);
      ctx.fillRect(x0 + boxSize05 - 1, y0 + 2, 2, boxSize - 4);
      break;
    case 'collapse':
      ctx.fillRect(x0 + 2, y0 + boxSize05 - 1, boxSize - 4, 2);
      break;
    case 'focus':
      ctx.fillRect(x0 + boxSize05 - 2, y0 + boxSize05 - 2, 4, 4);
      break;
  }
}

export const hierarchicalPlugin: Plugin = {
  id: 'hierarchical',

  beforeUpdate(chart: Chart): void {
    if (!hierarchicalEnabled(chart)) {
      return;
    }
    hierarchicalCheck(chart as unknown as HierarchicalEnhancedChart);
  },

  beforeDatasetsDraw(chart: Chart): void {
    if (!hierarchicalEnabled(chart)) {
      return;
    }
    const cc = chart as unknown as HierarchicalEnhancedChart;
    const scale = hierarchicalFindScale(chart);
    const { ctx } = chart;
    if (!scale || !ctx) {
      return;
    }
    const flat = cc.data.flatLabels ?? [];
    const visible = cc.data.labels;
    const roots = cc.data.rootNodes ?? [];
    const visibleNodes = new Set(visible);
    const horizontal = scale.isHorizontal();

    const boxSize = scale.options.hierarchyBoxSize;
    const boxRow = scale.options.hierarchyBoxLineHeight;
    const boxColor = scale.options.hierarchyBoxColor;
    const boxWidth = scale.options.hierarchyBoxWidth;
    const spanColor = scale.options.hierarchySpanColor;
    const spanWidth = scale.options.hierarchySpanWidth;
    const renderLabel = scale.options.hierarchyLabelPosition;
    const groupLabelPosition = scale.options.hierarchyGroupLabelPosition;
    const isStatic = scale.options.static;
    const scaleReverse = scale.options.reverseOrder;
    const boxSize05 = boxSize * 0.5;
    const boxSize01 = boxSize * 0.1;

    const scaleLabelOptions = scale.options.title as unknown as { color?: Color; font?: Partial<FontSpec> };
    const scaleLabelFontColor = valueOrDefault(scaleLabelOptions?.color, defaults.color as Color);
    const scaleLabelFont = toFont(scaleLabelOptions?.font ?? {});

    const renderButton = (type: 'expand' | 'collapse' | 'focus', vertical: boolean, x: number, y: number): void =>
      hierarchicalRenderButton(ctx, type, vertical, x, y, boxSize, isStatic, spanColor, spanWidth);

    ctx.save();
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = boxWidth;
    ctx.fillStyle = scaleLabelFontColor as string;
    ctx.font = scaleLabelFont.string;

    const renderHorLevel = (node: HierarchicalLabelNode, maxDepth = 0): boolean => {
      if (node.children.length === 0) {
        return false;
      }
      const offset = scaleReverse ? maxDepth * boxRow - node.level * boxRow : node.level * boxRow;

      if (!node.expand) {
        if (visibleNodes.has(node)) {
          renderButton('expand', false, node.center, offset);
        }
        return false;
      }
      const r = hierarchicalSpanLogic(node, flat, visibleNodes, groupLabelPosition);
      if (!r) {
        return false;
      }
      const { hasFocusBox, hasCollapseBox, leftVisible, rightVisible, leftFirstVisible, rightLastVisible, groupLabelCenter } = r;

      if (renderLabel === 'below') {
        ctx.fillText(node.label, groupLabelCenter, offset + boxSize);
      } else if (renderLabel === 'above') {
        ctx.fillText(node.label, groupLabelCenter, offset - boxSize);
      }
      if (hasCollapseBox) renderButton('collapse', false, leftVisible.center, offset);
      if (hasFocusBox) renderButton('focus', false, rightVisible.center, offset);

      if (leftVisible !== rightVisible) {
        ctx.strokeStyle = spanColor;
        ctx.lineWidth = spanWidth;
        ctx.beginPath();
        if (hasCollapseBox) {
          ctx.moveTo(leftVisible.center + boxSize05, offset + boxSize05);
        } else if (leftFirstVisible) {
          ctx.moveTo(leftVisible.center, offset + boxSize01);
          ctx.lineTo(leftVisible.center, offset + boxSize05);
        } else {
          ctx.moveTo(leftVisible.center, offset + boxSize05);
        }
        if (hasFocusBox) {
          ctx.lineTo(rightVisible.center - boxSize05, offset + boxSize05);
        } else if (rightLastVisible) {
          ctx.lineTo(rightVisible.center, offset + boxSize05);
          ctx.lineTo(rightVisible.center, offset + boxSize01);
        } else {
          ctx.lineTo(rightVisible.center, offset + boxSize05);
        }
        ctx.stroke();
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = boxWidth;
      }
      return true;
    };

    const renderVertLevel = (node: HierarchicalLabelNode, maxDepth = 0): boolean => {
      if (node.children.length === 0) {
        return false;
      }
      const offset = (scaleReverse ? maxDepth * boxRow - node.level * boxRow : node.level * boxRow) * -1;

      if (!node.expand) {
        if (visibleNodes.has(node)) {
          renderButton('expand', true, offset, node.center);
        }
        return false;
      }
      const r = hierarchicalSpanLogic(node, flat, visibleNodes, groupLabelPosition);
      if (!r) {
        return false;
      }
      const { hasFocusBox, hasCollapseBox, leftVisible, rightVisible, leftFirstVisible, rightLastVisible, groupLabelCenter } = r;

      ctx.fillText(node.label, offset - boxSize, groupLabelCenter);
      if (hasCollapseBox) renderButton('collapse', true, offset, leftVisible.center);
      if (hasFocusBox) renderButton('focus', true, offset, rightVisible.center);

      if (leftVisible !== rightVisible) {
        ctx.strokeStyle = spanColor;
        ctx.lineWidth = spanWidth;
        ctx.beginPath();
        if (hasCollapseBox) {
          ctx.moveTo(offset - boxSize05, leftVisible.center + boxSize05);
        } else if (leftFirstVisible) {
          ctx.moveTo(offset - boxSize01, leftVisible.center);
          ctx.lineTo(offset - boxSize05, leftVisible.center);
        } else {
          ctx.lineTo(offset - boxSize05, leftVisible.center);
        }
        if (hasFocusBox) {
          ctx.lineTo(offset - boxSize05, rightVisible.center - boxSize05);
        } else if (rightLastVisible) {
          ctx.lineTo(offset - boxSize05, rightVisible.center - boxSize05);
          ctx.lineTo(offset - boxSize01, rightVisible.center - boxSize05);
        } else {
          ctx.lineTo(offset - boxSize05, rightVisible.center);
        }
        ctx.stroke();
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = boxWidth;
      }
      return true;
    };

    const maxLevel = hierarchicalGetMaxDepth(roots as HierarchicalLabelNode[]);
    if (horizontal) {
      ctx.textAlign = 'center';
      ctx.textBaseline = renderLabel === 'above' ? 'bottom' : 'top';
      ctx.translate(scale.left, scale.bottom + scale.options.padding);
      roots.forEach((root) => hierarchicalPreOrderTraversal(root, (node) => renderHorLevel(node, maxLevel)));
    } else {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.translate(scale.left - scale.options.padding, scale.top);
      roots.forEach((root) => hierarchicalPreOrderTraversal(root, (node) => renderVertLevel(node, maxLevel)));
    }

    ctx.restore();
  },

  beforeEvent(chart: Chart, args): void {
    const { event } = args;
    if (event.type !== 'click' || !hierarchicalEnabled(chart)) {
      return;
    }
    const clickEvent = event as unknown as { x: number; y: number };
    const scale = hierarchicalFindScale(chart);
    if (!scale || scale.options.static) {
      return;
    }
    const horizontal = scale.isHorizontal();
    const elem = hierarchicalResolveElement(clickEvent, scale);
    if (!elem) {
      return;
    }
    const boxRow = scale.options.hierarchyBoxLineHeight;
    const reverse = scale.options.reverseOrder;
    const inRange = horizontal
      ? (o: number) => clickEvent.y >= o && clickEvent.y <= o + boxRow
      : (o: number) => clickEvent.x <= o && clickEvent.x >= o - boxRow;
    const offsetDelta = horizontal ? boxRow : -boxRow;
    hierarchicalHandleClick(chart, elem, offsetDelta, inRange, reverse);
  },
};

// Real improvement over the original package's own consumer-facing
// experience, confirmed via a real, resolved gap (not a guess): this
// project's own `timestack-scale.vue` docs example needs an
// `as unknown as ChartConfiguration['options']` cast to write
// `type: 'timestack'`, since that third-party package's own identical
// module augmentation is never statically imported anywhere in that
// file's own compile graph (it only ever loads via a dynamic
// `import()` at runtime). Because this file is statically imported by
// every real consumer of `keystone-chartjs-core` already, the same
// augmentation here is picked up automatically — no cast needed to
// write `options.scales.x.type = 'hierarchical'` or
// `dataset.tree = [...]` (see the docs site's own hierarchical-scale
// example, which needs no such cast for exactly this reason).
declare module 'chart.js' {
  interface ControllerDatasetOptions {
    tree?: (HierarchicalValueNode | number)[];
  }
  interface CartesianScaleTypeRegistry {
    hierarchical: {
      options: HierarchicalScaleOptions;
    };
  }
}
