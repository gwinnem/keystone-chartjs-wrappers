// keystone-chartjs-core — framework-agnostic engine.
//
// Real implementation per docs/IMPLEMENTATION_PLAN.md Phase 1: chart
// lifecycle (mount/diff-update/resize/theme/destroy), lazy chart-type
// registration (including mixed-dataset kinds), and official-plugin
// registration helpers.

export { createChartController } from './controller.js';
export { CHART_TYPE_REGISTRY, ensureChartKindRegistered } from './registry.js';
export {
  withAnnotation,
  withAutocolors,
  withDataLabels,
  withGradient,
  withHierarchical,
  withImageLabel,
  withTimestack,
  withZoom,
} from './plugins.js';

export type {
  AnnotationPluginOptions,
  AutocolorsPluginOptions,
  ChartConfigData,
  ChartConfigDataset,
  ChartConfiguration,
  ChartControllerHandle,
  ChartJs,
  ChartKind,
  ChartUpdatePayload,
  DataLabelsPluginOptions,
  ImageLabelPluginOptions,
} from './types.js';
export type { GradientDatasetConfig } from './gradientPlugin.js';
export type {
  HierarchicalLabelNode,
  HierarchicalRawLabelNode,
  HierarchicalScaleOptions,
  HierarchicalValueNode,
} from './hierarchicalScale.js';
export type { ZoomPluginOptions } from './zoomPlugin.js';
