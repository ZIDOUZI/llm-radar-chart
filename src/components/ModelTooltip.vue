<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import type { ModelInfo } from '../types'

const props = defineProps<{ model: ModelInfo | null }>()
const x = ref(0)
const y = ref(0)

function onMouseMove(e: MouseEvent) {
  x.value = e.clientX
  y.value = e.clientY
}

watch(() => props.model, m => {
  if (m) window.addEventListener('mousemove', onMouseMove)
  else window.removeEventListener('mousemove', onMouseMove)
})

onUnmounted(() => window.removeEventListener('mousemove', onMouseMove))
</script>

<template>
  <Transition name="fade">
    <div v-if="model" class="tip" :style="{ left: x + 'px', top: y + 'px' }">
      <div class="tip-name">{{ model.name }}</div>
      <div class="tip-provider">{{ model.provider }}</div>
      <div class="tip-grid">
        <div class="tip-cell"><span class="tip-lbl">上下文</span><span class="tip-val">{{ model.meta.contextWindow }}</span></div>
        <div class="tip-cell"><span class="tip-lbl">输出速度</span><span class="tip-val">{{ model.meta.outputSpeed }}</span></div>
        <div class="tip-cell"><span class="tip-lbl">首Token</span><span class="tip-val">{{ model.meta.latency }}</span></div>
        <div class="tip-cell"><span class="tip-lbl">模态</span><span class="tip-val">{{ model.meta.modalities }}</span></div>
        <div class="tip-cell"><span class="tip-lbl">发布</span><span class="tip-val">{{ model.meta.releaseDate }}</span></div>
        <div class="tip-cell"><span class="tip-lbl">价格</span><span class="tip-val">${{ model.rawPrice.toFixed(2) }}/1M</span></div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tip {
  position: fixed; transform: translate(12px, 12px);
  background: #1f2937; color: #f9fafb; border-radius: 10px; padding: 12px 16px;
  min-width: 200px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  z-index: 100; pointer-events: none;
}
.tip-name { font-size: 0.85rem; font-weight: 600; }
.tip-provider { font-size: 0.7rem; color: #9ca3af; margin-bottom: 10px; }
.tip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
.tip-cell { display: flex; justify-content: space-between; gap: 8px; }
.tip-lbl { font-size: 0.68rem; color: #9ca3af; }
.tip-val { font-size: 0.72rem; color: #e5e7eb; font-weight: 500; white-space: nowrap; }

.fade-enter-active { transition: opacity 0.12s ease; }
.fade-leave-active { transition: opacity 0.08s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
