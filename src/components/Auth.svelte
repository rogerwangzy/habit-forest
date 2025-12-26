<script>
  import { pb, isLoggedIn, currentUser } from '../lib/pb';
  import { onMount } from 'svelte';

  let mode = 'login'; // or 'register'
  let email = '';
  let password = '';
  let username = '';
  let user = null;
  let error = '';

  onMount(() => {
    if (pb.authStore.isValid) user = pb.authStore.model;
    pb.authStore.onChange(() => (user = pb.authStore.isValid ? pb.authStore.model : null));
  });

  async function register() {
    error = '';
    try {
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm: password,
        username: username || email,
      });
      // auto-login
      await login();
    } catch (e) {
      error = e?.message || String(e);
    }
  }

  async function login() {
    error = '';
    try {
      await pb.collection('users').authWithPassword(email, password);
      user = pb.authStore.model;
    } catch (e) {
      error = e?.message || String(e);
    }
  }

  function logout() {
    pb.authStore.clear();
    user = null;
  }
</script>

<div class="mb-6">
  {#if user}
    <div class="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
            {user.email?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="font-semibold text-gray-800">{user.email}</div>
            <div class="text-xs text-gray-500">已登录 ✓</div>
          </div>
        </div>
        <button on:click={logout} class="text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition">
          登出
        </button>
      </div>
    </div>
  {:else}
    <div class="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mx-auto w-full max-w-md md:max-w-xl lg:max-w-2xl">
      <!-- Tab 切换 -->
      <div class="flex border-b border-gray-200">
        <button 
          on:click={() => (mode = 'login')} 
          class="flex-1 py-3 font-medium transition {mode === 'login' 
            ? 'text-green-600 border-b-2 border-green-600 bg-green-50' 
            : 'text-gray-600 hover:text-gray-800'}"
        >
          登录
        </button>
        <button 
          on:click={() => (mode = 'register')} 
          class="flex-1 py-3 font-medium transition {mode === 'register' 
            ? 'text-green-600 border-b-2 border-green-600 bg-green-50' 
            : 'text-gray-600 hover:text-gray-800'}"
        >
          注册
        </button>
      </div>

      <!-- 表单内容 -->
      <div class="p-5 space-y-3">
        {#if mode === 'register'}
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input 
              id="username"
              placeholder="选择一个用户名" 
              bind:value={username} 
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" 
            />
          </div>
        {/if}

        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
          <input 
            id="email"
            placeholder="example@email.com" 
            bind:value={email} 
            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" 
          />
        </div>
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">密码</label>
          <input 
            id="password"
            placeholder="至少 6 个字符" 
            type="password" 
            bind:value={password} 
            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" 
          />
        </div>

        <button 
          on:click={mode === 'login' ? login : register} 
          class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition"
        >
          {mode === 'login' ? '登录' : '注册并登录'}
        </button>

        {#if error}
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
