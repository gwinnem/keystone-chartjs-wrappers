<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="matrix" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

// {x, y, v} per cell — chartjs-chart-matrix's own real data-point shape;
// `x`/`y` are category values here (a day of week, a week number), `v`
// is the cell's own value, driving both color and (via the dataset's
// own scriptable width/height functions below) cell size.
const data = {
  labels: { x: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], y: ['Wk 1', 'Wk 2', 'Wk 3'] },
  datasets: [
    {
      label: 'Commits',
      data: [
        { x: 'Mon', y: 'Wk 1', v: 3 },
        { x: 'Tue', y: 'Wk 1', v: 8 },
        { x: 'Wed', y: 'Wk 1', v: 5 },
        { x: 'Thu', y: 'Wk 1', v: 12 },
        { x: 'Fri', y: 'Wk 1', v: 2 },
        { x: 'Mon', y: 'Wk 2', v: 6 },
        { x: 'Tue', y: 'Wk 2', v: 9 },
        { x: 'Wed', y: 'Wk 2', v: 14 },
        { x: 'Thu', y: 'Wk 2', v: 7 },
        { x: 'Fri', y: 'Wk 2', v: 4 },
        { x: 'Mon', y: 'Wk 3', v: 10 },
        { x: 'Tue', y: 'Wk 3', v: 11 },
        { x: 'Wed', y: 'Wk 3', v: 3 },
        { x: 'Thu', y: 'Wk 3', v: 9 },
        { x: 'Fri', y: 'Wk 3', v: 13 },
      ],
      backgroundColor(ctx: { raw?: { v: number } }): string {
        const value = ctx.raw?.v ?? 0;
        const alpha = Math.min(value / 14, 1);
        return `rgba(79, 184, 201, ${alpha})`;
      },
      width(ctx: { chart: { chartArea?: { width: number } } }): number {
        return (ctx.chart.chartArea?.width ?? 250) / 5 - 4;
      },
      height(ctx: { chart: { chartArea?: { height: number } } }): number {
        return (ctx.chart.chartArea?.height ?? 150) / 3 - 4;
      },
    },
  ],
};

const options = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { type: 'category', labels: data.labels.x, offset: true },
    y: { type: 'category', labels: data.labels.y, offset: true },
  },
};
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
