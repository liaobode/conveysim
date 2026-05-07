<script setup lang="ts">
</script>

<template>
  <div class="legend">
    <div class="section-title">热力图图例</div>
    <div class="legend-row">
      <span class="swatch green"></span>
      <span>&lt; 50% 畅通</span>
    </div>
    <div class="legend-row">
      <span class="swatch yellow"></span>
      <span>50~85% 接近饱和</span>
    </div>
    <div class="legend-row">
      <span class="swatch red"></span>
      <span>&gt; 85% 堵塞</span>
    </div>
  </div>
</template>

<style scoped>
.legend {
  margin-top: 8px;
}

.section-title {
  font-size: 11px;
  color: #888;
  padding-bottom: 4px;
  border-bottom: 1px solid #0f3460;
  margin-bottom: 6px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #aaa;
  padding: 2px 0;
}

.swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.swatch.green { background: #00c850; }
.swatch.yellow { background: #e9a820; }
.swatch.red { background: #e94560; }
</style>
