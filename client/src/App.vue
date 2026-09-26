<script setup>
import { useToast } from './stores/toast';
const toast = useToast();
</script>

<template>
  <RouterView />
  <div class="toast" role="status" aria-live="polite">
    <span v-if="toast.message" class="toast-msg">{{ toast.message }}</span>
  </div>
</template>

<style scoped>
.toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); z-index: 50; }
.toast-msg {
  display: block; padding: 12px 20px; border-radius: 10px;
  background: var(--text); color: var(--bg); font-size: 14px; font-weight: 500;
}
</style>
