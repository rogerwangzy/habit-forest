<script>
  import { onMount } from 'svelte';
  import HabitForest from './components/HabitForest.svelte';
  import Auth from './components/Auth.svelte';
  import { pb } from './lib/pb';

  let isLoggedIn = false;

  onMount(() => {
    const updateState = () => {
      isLoggedIn = pb.authStore.isValid;
    };
    updateState();
    const off = pb.authStore.onChange(updateState);
    return off;
  });
</script>

{#if !isLoggedIn}
  <main class="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-emerald-100">
    <div class="max-w-5xl mx-auto px-4 py-8">
      <!-- 顶部标题 -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600 mb-2">
          🌲 习惯森林
        </h1>
        <p class="text-gray-600 text-lg">每一次打卡，你的森林就增长一分</p>
      </div>

      <!-- 认证模块 -->
      <Auth />

      <!-- 页脚 -->
      <div class="mt-12 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
        <p>坚持每一个习惯，见证你的成长 ✨</p>
      </div>
    </div>
  </main>
{:else}
  <!-- 已登录 - 使用完整高度布局 -->
  <HabitForest />
{/if}

<style>
  :global(* ) {
    box-sizing: border-box;
  }
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
  }
</style>
