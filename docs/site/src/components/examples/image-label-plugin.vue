<template>
  <div class="demo-stage">
    <Chart type="doughnut" :data="data" :options="options" :image-label="imageLabelConfig" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['Chrome', 'Firefox', 'Safari'],
  datasets: [
    {
      data: [55, 20, 25],
      backgroundColor: ['#4285F4', '#FF9500', '#00A1F1'],
    },
  ],
};

const options = { responsive: true, maintainAspectRatio: false };

// Doughnut charts only, confirmed directly from the real package's own
// README. imagesList is required — there's no sensible empty default,
// same reasoning as annotation's own annotations field.
const imageLabelConfig = {
  verticalAlign: 'middle' as const,
  horizontalAlign: 'middle' as const,
  imagesList: [
    { imageUrl: 'https://picsum.photos/seed/chrome/32', imageWidth: 32, imageHeight: 32 },
    { imageUrl: 'https://picsum.photos/seed/firefox/32', imageWidth: 32, imageHeight: 32 },
    { imageUrl: 'https://picsum.photos/seed/safari/32', imageWidth: 32, imageHeight: 32 },
  ],
};
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
