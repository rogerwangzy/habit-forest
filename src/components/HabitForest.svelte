<script>
  import { onMount } from 'svelte';
  import { pb } from '../lib/pb';
  // html2canvas loaded dynamically when exporting image

  const STORAGE_KEY = 'forest-habbit:habits';
  const EMOJI_LIST = ['💪', '📚', '🏃', '🧘', '🎯', '💤', '🥗', '🚴', '🏊', '⚽', '🎮', '🎨'];
  const MAX_HABITS = 7;

  let habits = [];
  let newTitle = '';
  let newIcon = '💪';
  let newColor = '#10b981';
  let isLoggedIn = false;
  let currentUser = null;
  let isLoading = false; // 防抖标志
  let savingCheckins = new Set(); // 正在保存的 checkins
  let sidebarOpen = false; // 默认在手机上关闭侧边栏
  let isMobile = true; // 是否为手机设备
  let showDeleteModal = false;
  let deleteTarget = null;
  let deleteConfirmCode = '';
  let deleteInput = '';
  let bouncing = new Set();
  let darkMode = false;
  let parallaxX = 0;
  let parallaxY = 0;
  let showGrowthFX = false;
  let fxColor = '#10b981';
  let fxIcon = '💪';
  let forestRef;
  let showOnboarding = false;
  let onboardingStep = 0;

  function getStageByStreak(s) {
    if (s >= 30) return 4; // flower stage
    if (s >= 15) return 3;
    if (s >= 7) return 2;
    return 1;
  }

  function stageOf(habit) {
    return getStageByStreak(streak(habit));
  }

  function triggerBounce(id) {
    try {
      bouncing.add(id);
      const _id = id;
      setTimeout(() => {
        bouncing.delete(_id);
        // 触发更新
        habits = [...habits];
      }, 300);
    } catch {}
  }

  onMount(() => {
    // 检测屏幕大小
    const checkMobile = () => {
      isMobile = window.innerWidth < 768; // md 断点
      if (isMobile) {
        sidebarOpen = false;
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // 读取主题
    try {
      darkMode = localStorage.getItem('forest-habbit:theme') === 'dark';
    } catch {}

    // 初次引导
    try {
      const seen = localStorage.getItem('forest-habbit:onboarded') === '1';
      showOnboarding = !seen;
      onboardingStep = 0;
    } catch {}
    return () => window.removeEventListener('resize', checkMobile);
  });

  // Load local data or server data if logged in
  async function load() {
    // 防抖：如果正在加载，则跳过
    if (isLoading) {
      console.log('load already in progress, skipping');
      return;
    }
    isLoading = true;

    try {
      if (pb.authStore.isValid) {
        const userId = pb.authStore.model?.id;
        // load habits from pocketbase (only user's habits)
        const items = await pb.collection('habits').getFullList({
          filter: `owner = '${userId}'`,
          $autoCancel: false
        });
        
        // For each habit, load its checkins
        const habitsWithCheckins = await Promise.all(items.map(async (item) => {
          try {
            const checkins = await pb.collection('checkins').getFullList({
              filter: `habit = '${item.id}' && owner = '${userId}'`,
              $autoCancel: false
            });
            return {
              id: item.id,
              title: item.title,
              icon: item.icon || '💪',
              color: item.color || '#10b981',
              completions: checkins.map(c => {
                // 标准化 date 格式为 YYYY-MM-DD
                const dateStr = c.date;
                if (dateStr && dateStr.length >= 10) {
                  return dateStr.slice(0, 10);
                }
                return dateStr;
              }),
              _pb: item,
            };
          } catch (e) {
            console.log('failed to load checkins for habit:', item.id, e?.message);
            return {
              id: item.id,
              title: item.title,
              icon: item.icon || '💪',
              color: item.color || '#10b981',
              completions: [],
              _pb: item,
            };
          }
        }));
        
        habits = habitsWithCheckins;
        console.log('loaded habits:', habits.length);
      } else {
        const raw = localStorage.getItem(STORAGE_KEY);
        habits = raw ? JSON.parse(raw) : [];
      }
    } catch (e) {
      console.warn('load failed', e?.message || e);
      const raw = localStorage.getItem(STORAGE_KEY);
      habits = raw ? JSON.parse(raw) : [];
    } finally {
      isLoading = false;
    }
  }

  let _sub = null;
  let _loadTimer = null;

  // Subscribe to auth changes and realtime updates when logged in
  function setupRealtime() {
    // clean previous
    try { _sub?.unsubscribe?.(); } catch (e) {}

    if (!pb.authStore.isValid) return;

    // subscribe to collection changes and reload when they happen
    _sub = pb.collection('habits').subscribe('*', (e) => {
      // 用延迟防止频繁重新加载导致请求冲突
      clearTimeout(_loadTimer);
      _loadTimer = setTimeout(() => {
        console.log('realtime event, reloading habits');
        load();
      }, 500);
    });
  }

  async function save() {
    if (!pb.authStore.isValid) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
      return;
    }

    const userId = pb.authStore.model?.id;
    console.log('saving with userId:', userId, 'auth valid:', pb.authStore.isValid);

    // sync all local habits to server (create/update)
    for (const h of habits) {
      try {
        if (h._pb?.id) {
          // Update existing habit (title, icon, color)
          await pb.collection('habits').update(h._pb.id, { 
            title: h.title,
            icon: h.icon,
            color: h.color,
          });
        } else {
          // Create new habit
          const created = await pb.collection('habits').create({ 
            title: h.title,
            icon: h.icon,
            color: h.color,
            owner: userId,
          });
          h._pb = created;
          h.id = created.id;
          console.log('habit created:', created);
        }
      } catch (e) {
        console.error('habit sync failed', e?.message || e);
      }
    }
  }

  async function saveCheckin(habit, date, isChecked) {
    if (!pb.authStore.isValid || !habit._pb?.id) return;

    const userId = pb.authStore.model?.id;
    const checkinKey = `${habit._pb.id}:${date}`;

    // 防止同一个 checkin 重复保存
    if (savingCheckins.has(checkinKey)) {
      console.log('checkin already being saved, skipping');
      return;
    }
    savingCheckins.add(checkinKey);

    console.log('saving checkin with userId:', userId, 'habit:', habit._pb?.id, 'date:', date);

    try {
      // 标准化日期格式
      const dateKey = date.slice(0, 10); // 确保是 YYYY-MM-DD

      // Query existing checkin for this habit and date - with retry
      let existing = null;
      try {
        existing = await pb.collection('checkins').getFirstListItem(
          `habit = '${habit._pb.id}' && date = '${dateKey}'`
        );
      } catch (e) {
        // not found is ok
        existing = null;
      }

      if (isChecked) {
        // Create if doesn't exist
        if (!existing) {
          try {
            const checkinRecord = await pb.collection('checkins').create({
              habit: habit._pb.id,
              date: dateKey,
              owner: userId,
            });
            console.log('checkin created:', checkinRecord.id);
            // 创建成功后更新本地状态
            habit.completions = [...(habit.completions || []), dateKey];
          } catch (createError) {
            // 如果创建失败（例如重复或其他原因），验证是否已存在
            if (createError?.status === 400) {
              console.log('create failed with 400, checking if already exists...');
              // 再次检查
              try {
                existing = await pb.collection('checkins').getFirstListItem(
                  `habit = '${habit._pb.id}' && date = '${dateKey}'`
                );
                if (existing) {
                  console.log('checkin already exists, updating local state');
                  if (!habit.completions.includes(dateKey)) {
                    habit.completions = [...(habit.completions || []), dateKey];
                  }
                  habits = [...habits]; // 触发反应式更新
                }
              } catch (retryError) {
                console.error('failed to verify checkin after create error', retryError?.message);
              }
            } else {
              throw createError;
            }
          }
        } else {
          console.log('checkin already exists locally');
          if (!habit.completions.includes(dateKey)) {
            habit.completions = [...(habit.completions || []), dateKey];
          }
          habits = [...habits];
        }
      } else {
        // Delete if unchecked
        if (existing) {
          await pb.collection('checkins').delete(existing.id);
          console.log('checkin deleted:', existing.id);
          habit.completions = habit.completions.filter(d => d !== dateKey);
          habits = [...habits];
        } else {
          // 本地移除
          habit.completions = habit.completions.filter(d => d !== dateKey);
          habits = [...habits];
        }
      }
    } catch (e) {
      console.error('checkin sync failed', e?.message || e);
    } finally {
      savingCheckins.delete(checkinKey);
    }
  }

  async function addHabit() {
    const title = newTitle.trim();
    if (!title) return;
    if (habits.length >= MAX_HABITS) {
      alert(`最多只能添加 ${MAX_HABITS} 个习惯`);
      return;
    }
    const h = { id: Date.now(), title, icon: newIcon, color: newColor, completions: [] };
    habits = [...habits, h];
    newTitle = '';
    newIcon = '💪';
    newColor = '#10b981';
    await save();
    // 添加习惯后自动收起侧边栏
    sidebarOpen = false;
  }

  async function toggleToday(habit) {
    const today = new Date().toISOString().slice(0,10);
    const has = (habit.completions || []).includes(today);
    if (has) {
      habit.completions = habit.completions.filter(d => d !== today);
    } else {
      habit.completions = [...(habit.completions || []), today];
      // 成长特效（仅打卡时）
      fxColor = habit.color || '#10b981';
      fxIcon = habit.icon || '💪';
      showGrowthFX = true;
      setTimeout(() => (showGrowthFX = false), 800);
    }
    habits = [...habits];
    triggerBounce(habit.id);
    await saveCheckin(habit, today, !has);
  }

  function streak(habit) {
    if (!habit.completions || !habit.completions.length) return 0;
    let count = 0;
    let d = new Date();
    while (true) {
      const key = d.toISOString().slice(0,10);
      if ((habit.completions || []).includes(key)) {
        count++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return count;
  }

  async function removeHabitConfirmed(id) {
    const h = habits.find(x => x.id === id);
    if (h?._pb?.id && pb.authStore.isValid) {
      try {
        // First delete all checkins associated with this habit
        const checkins = await pb.collection('checkins').getFullList({
          filter: `habit = '${h._pb.id}' && owner = '${pb.authStore.model?.id}'`,
          $autoCancel: false
        });
        for (const checkin of checkins) {
          await pb.collection('checkins').delete(checkin.id);
        }
        console.log(`deleted ${checkins.length} checkins for habit ${h._pb.id}`);
        
        // Then delete the habit itself
        await pb.collection('habits').delete(h._pb.id);
        console.log('habit deleted:', h._pb.id);
      } catch (e) { 
        console.error('failed to delete habit:', e?.message || e);
      }
    }
    habits = habits.filter(h => h.id !== id);
    await save();
  }

  function triggerDelete(habit) {
    deleteTarget = habit;
    deleteInput = '';
    // generate a 4-digit confirmation code
    deleteConfirmCode = Math.floor(1000 + Math.random() * 9000).toString();
    showDeleteModal = true;
  }

  function toggleDark() {
    darkMode = !darkMode;
    try { localStorage.setItem('forest-habbit:theme', darkMode ? 'dark' : 'light'); } catch {}
  }

  function onParallaxMove(event) {
    const el = event.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width - 0.5;
    const y = (event.clientY - r.top) / r.height - 0.5;
    parallaxX = Math.max(-0.5, Math.min(0.5, x));
    parallaxY = Math.max(-0.5, Math.min(0.5, y));
  }
  function onParallaxLeave() {
    parallaxX = 0; parallaxY = 0;
  }

  async function exportForest() {
    try {
      const el = forestRef;
      if (!el) {
        alert('森林元素未找到');
        return;
      }
      // 动态导入 html2canvas
      const mod = await import('html2canvas');
      const html2canvas = mod.default || mod;
      
      // 生成图片
      const canvas = await html2canvas(el, { 
        backgroundColor: '#a7d8de', 
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `习惯森林-${new Date().toISOString().slice(0,10)}.png`;
      a.click();
      
      alert('海报已生成！');
    } catch (e) {
      console.error('生成海报失败:', e);
      alert('生成图片失败：' + (e.message || '未知错误'));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteInput !== deleteConfirmCode) {
      alert('验证码不正确，请重新输入');
      return;
    }
    await removeHabitConfirmed(deleteTarget.id);
    showDeleteModal = false;
    deleteTarget = null;
    deleteInput = '';
  }

  // 统计：总打卡数、最长连续、本月打卡
  function computeLongestStreak(dates) {
    if (!dates || dates.length === 0) return 0;
    const sorted = [...dates].sort();
    let maxS = 1, cur = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curd = new Date(sorted[i]);
      const diff = Math.round((curd - prev) / 86400000);
      if (diff === 1) {
        cur += 1;
      } else if (diff === 0) {
        // same day duplicate ignored
      } else {
        if (cur > maxS) maxS = cur;
        cur = 1;
      }
    }
    if (cur > maxS) maxS = cur;
    return maxS;
  }

  function longestStreakAll() {
    let maxAll = 0;
    for (const h of habits) {
      const m = computeLongestStreak(h.completions || []);
      if (m > maxAll) maxAll = m;
    }
    return maxAll;
  }

  function monthCheckinsCount() {
    const d = new Date();
    const ym = d.toISOString().slice(0,7);
    let c = 0;
    for (const h of habits) {
      c += (h.completions || []).filter(x => x.startsWith(ym)).length;
    }
    return c;
  }

  // 登出当前用户
  function logout() {
    try {
      pb.authStore.clear();
    } catch (e) {
      console.error('logout failed', e?.message || e);
    }
    isLoggedIn = false;
    currentUser = null;
    sidebarOpen = false;
    // 切换到未登录视图（App.svelte 也会响应 authStore 变化）
    load();
  }

  // 生成过去30天的模拟打卡记录
  async function generateMockCheckins() {
    if (!pb.authStore.isValid) return;
    
    const userId = pb.authStore.model?.id;
    const habitsToFill = habits.filter(h => h._pb?.id);
    
    if (habitsToFill.length === 0) {
      alert('请先创建至少一个习惯');
      return;
    }

    try {
      let createdCount = 0;
      const today = new Date();
      
      // 为每个习惯创建连续打卡数据以达到开花效果（40 天连续）
      for (const habit of habitsToFill) {
        // 创建连续 40 天的打卡数据（确保超过 30 天达到开花）
        for (let i = 0; i < 40; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateKey = date.toISOString().slice(0, 10);
          
          try {
            await pb.collection('checkins').create({
              habit: habit._pb.id,
              date: dateKey,
              owner: userId,
            });
            createdCount++;
          } catch (e) {
            // 忽略重复错误（UNIQUE 约束冲突）
            if (e?.status !== 400) {
              console.error('failed to create checkin:', e?.message);
            }
          }
        }
      }
      
      console.log(`created ${createdCount} mock checkins`);
      alert(`已生成 ${createdCount} 条打卡数据，习惯将展示 35 天连续打卡（开花效果）`);
      
      // 重新加载数据
      await load();
    } catch (e) {
      console.error('generate mock checkins failed:', e?.message || e);
      alert('生成失败：' + (e?.message || '未知错误'));
    }
  }

  onMount(() => {
    // Update login state
    const updateState = () => {
      isLoggedIn = pb.authStore.isValid;
      currentUser = pb.authStore.model;
    };
    updateState();
    
    load();
    // react to auth changes
    const off = pb.authStore.onChange(() => {
      updateState();
      load();
      setupRealtime();
    });
    setupRealtime();
    return () => {
      try { _sub?.unsubscribe?.(); } catch (e) {}
      off();
    };
  });
</script>

<div class="h-screen flex flex-col bg-gray-100 dark:bg-slate-900" class:dark={darkMode}>
  {#if !isLoggedIn}
    <!-- 未登录状态 -->
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="bg-white rounded-lg shadow-lg p-12 text-center max-w-md">
        <svg class="w-16 h-16 mx-auto mb-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <h3 class="text-2xl font-bold mb-2 text-gray-800">🌲 习惯森林</h3>
        <p class="text-gray-600 mb-6">每一次打卡，你的森林就会成长</p>
      </div>
    </div>
  {:else}
    <!-- 已登录 - 左侧边栏 + 主内容区域 -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- 背景遮罩（手机模态） -->
      {#if sidebarOpen && isMobile}
        <div 
          class="fixed inset-0 bg-black bg-opacity-50 z-40"
          on:click={() => sidebarOpen = false}
        ></div>
      {/if}

      <!-- 左侧可隐藏的个人信息侧边栏 -->
      <div class={`transition-all duration-300 bg-gradient-to-b from-green-500 to-green-600 text-white overflow-hidden flex flex-col ${isMobile ? 'fixed left-0 top-0 bottom-0 z-50 w-72' : `relative ${sidebarOpen ? 'w-96' : 'w-0'}`} ${sidebarOpen && isMobile ? 'translate-x-0' : (isMobile ? '-translate-x-full' : '')}`}>
        <div class="p-4 md:p-6 border-b border-green-400 flex-shrink-0 flex items-start justify-between">
          <div class="flex-1">
            <h1 class="text-xl md:text-2xl font-bold mb-1">🌲 习惯森林</h1>
            <p class="text-green-100 text-xs md:text-sm">每一次打卡，你的森林就会成长</p>
          </div>
          <button 
            on:click={() => { sidebarOpen = false; }}
            class="flex-shrink-0 ml-2 text-white hover:text-green-100 transition"
            title="隐藏侧边栏"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
        </div>

        <!-- 个人信息卡片 -->
        <div class="p-4 md:p-6 border-b border-green-400 flex-shrink-0">
          <div class="bg-green-400 bg-opacity-30 rounded-lg p-3 mb-3">
            <div class="text-xs md:text-sm text-green-100 mb-1">登录用户</div>
            <div class="text-white font-semibold truncate text-sm">{currentUser?.email || '用户'}</div>
          </div>
          <div class="grid grid-cols-2 gap-2 md:gap-3">
            <div class="bg-green-400 bg-opacity-30 rounded-lg p-2 md:p-3 text-center">
              <div class="text-base md:text-lg font-bold">{habits.length}</div>
              <div class="text-xs text-green-100">活跃习惯</div>
            </div>
            <div class="bg-green-400 bg-opacity-30 rounded-lg p-2 md:p-3 text-center">
              <div class="text-base md:text-lg font-bold">{habits.reduce((sum, h) => sum + (h.completions || []).length, 0)}</div>
              <div class="text-xs text-green-100">总打卡次数</div>
            </div>
          </div>
        </div>

        <!-- 添加习惯表单 -->
        <div class="p-4 md:p-6 flex-1 overflow-y-auto">
          <label class="block text-sm font-semibold mb-3">添加新习惯</label>
          <div class="space-y-2 md:space-y-3">
            <input 
              placeholder="习惯名称..." 
              bind:value={newTitle} 
              class="w-full border border-green-400 bg-green-400 bg-opacity-20 rounded-lg px-3 py-2 text-white placeholder-green-100 focus:outline-none focus:ring-2 focus:ring-white text-sm" 
            />
            <select bind:value={newIcon} class="w-full border border-green-400 bg-green-400 bg-opacity-20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white text-sm">
              {#each EMOJI_LIST as emoji}
                <option value={emoji} class="bg-green-600">{emoji}</option>
              {/each}
            </select>
            <div class="flex gap-2">
              <div class="flex items-center justify-center px-3 rounded-lg bg-white bg-opacity-10">
                <div class="text-2xl md:text-3xl">{newIcon}</div>
              </div>
              <input 
                type="color"
                bind:value={newColor}
                class="h-9 md:h-10 border border-green-400 rounded-lg cursor-pointer"
              />
              <button 
                on:click={addHabit}
                disabled={habits.length >= MAX_HABITS}
                class="flex-1 bg-white text-green-600 px-3 py-2 rounded-lg font-semibold transition text-sm {habits.length >= MAX_HABITS ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-50'}"
              >
                添加
              </button>
            </div>
            {#if habits.length >= MAX_HABITS}
              <div class="text-xs text-green-100 text-center">已达到最多 {MAX_HABITS} 个习惯</div>
            {/if}
          </div>

          <!-- 生成数据按钮 -->
          <button 
            on:click={generateMockCheckins}
            class="w-full mt-3 px-3 py-2 rounded-lg bg-green-400 bg-opacity-30 hover:bg-opacity-50 text-white text-sm font-semibold transition border border-green-400"
            title="生成 35 天连续数据看开花效果（需要先有习惯）"
          >
            📊 生成测试数据
          </button>

          <!-- 习惯列表 -->
          {#if habits.length > 0}
            <div class="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-green-400">
              <label class="block text-sm font-semibold mb-2 md:mb-3">你的习惯</label>
              <div class="space-y-1 md:space-y-2 text-xs md:text-sm">
                {#each habits as habit}
                  <div class="bg-green-400 bg-opacity-20 rounded-lg p-2 md:p-3 flex items-start justify-between group">
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold truncate"><span class="text-xl md:text-2xl mr-2">{habit.icon}</span> {habit.title}</div>
                      <div class="text-xs text-green-100 mt-1 truncate">
                        连续: {streak(habit)} 天 | 次数: {(habit.completions || []).length}
                      </div>
                    </div>
                    <button 
                      on:click={() => triggerDelete(habit)}
                      class="text-red-300 hover:text-red-100 opacity-0 group-hover:opacity-100 transition flex-shrink-0 ml-2"
                      title="删除"
                    >
                      ×
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

      <!-- 侧边栏底部：退出登录 -->
      <div class="p-4 md:p-6 border-t border-green-400 flex-shrink-0">
        <button
          on:click={logout}
          class="w-full bg-white text-green-600 px-3 py-2 rounded-lg font-semibold hover:bg-green-50 transition"
        >
          退出登录
        </button>
      </div>
      </div>

      <!-- 主内容区域 - 森林和每日打卡 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- 顶部标题栏 -->
        <div class="bg-white dark:bg-slate-800 dark:border-slate-700 border-b border-gray-200 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between text-gray-800 dark:text-slate-100">
          <div class="flex-1 flex items-center gap-3">
            {#if !isMobile && !sidebarOpen}
              <button 
                on:click={() => sidebarOpen = true}
                class="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex-shrink-0"
                title="打开侧边栏"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            {/if}
            <div>
              <h2 class="text-xl md:text-2xl font-bold text-gray-800">你的习惯森林</h2>
              <p class="text-gray-600 text-xs md:text-sm mt-1 hidden md:block">连续打卡，你的树木会不断成长</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button 
              on:click={toggleDark}
              class="p-2 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              title={darkMode ? '切换到日间' : '切换到夜间'}
            >{darkMode ? '☀️' : '🌙'}</button>
          {#if !sidebarOpen && isMobile}
            <button 
              on:click={() => sidebarOpen = true}
              class="ml-2 p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex-shrink-0"
              title="打开侧边栏"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          {/if}
          </div>
        </div>

        <!-- 内容区域 -->
        <div class="flex-1 overflow-y-auto flex flex-col">
          <!-- 森林可视化 - 主要显示区域 -->
          <div class="bg-white/70 dark:bg-slate-800/40 backdrop-blur rounded-lg shadow-lg m-3 md:m-6 p-3 md:p-6 text-gray-800 dark:text-slate-100">
            <div class="flex items-center justify-between mb-3 md:mb-4">
              <h3 class="text-base md:text-lg font-semibold text-gray-800 dark:text-slate-100">🌲 森林概览</h3>
              <button on:click={exportForest} class="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition text-sm">生成海报</button>
            </div>
            {#if habits.length > 0}
            <div class="relative rounded-lg overflow-hidden" on:mousemove={onParallaxMove} on:mouseleave={onParallaxLeave} bind:this={forestRef}>
              <!-- 背景：轻云层（远景） -->
              <div class="pointer-events-none absolute inset-0" style="transform: translate3d({parallaxX * 12}px, {parallaxY * 8}px, 0); z-index:0;">
                <div class="absolute -top-6 left-10 w-48 h-20 bg-white/40 dark:bg-slate-200/10 rounded-full blur-2xl"></div>
                <div class="absolute top-10 right-16 w-56 h-24 bg-white/40 dark:bg-slate-200/10 rounded-full blur-2xl"></div>
              </div>
              <!-- 中景：光束/气氛 -->
              <div class="pointer-events-none absolute inset-0" style="transform: translate3d({parallaxX * 6}px, {parallaxY * 4}px, 0); z-index:1;">
                <div class="absolute -top-10 left-1/3 w-72 h-72 bg-gradient-to-b from-white/20 to-transparent rounded-full blur-3xl"></div>
              </div>
              <svg viewBox="0 0 1400 420" class="w-full rounded-lg relative h-[350px] md:h-[420px]" style="z-index:2;" preserveAspectRatio="xMidYMid meet">
                <!-- 天空渐变背景 -->
                <defs>
                  <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:{darkMode ? '#0b132b' : '#a7d8de'};stop-opacity:1" />
                    <stop offset="60%" style="stop-color:{darkMode ? '#1c2541' : '#c8e6c9'};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:{darkMode ? '#3a506b' : '#a5d6a7'};stop-opacity:1" />
                  </linearGradient>
                </defs>
                <rect width="1400" height="420" fill="url(#sky)" />
                <!-- 地面分层 - 创建立体感 -->
                <rect y="300" width="1400" height="120" fill={darkMode ? '#2e7d32' : '#81c784'} />
                <rect y="360" width="1400" height="60" fill={darkMode ? '#1b5e20' : '#66bb6a'} />
                <!-- 地面装饰（草） -->
                <circle cx="100" cy="310" r="3" fill={darkMode ? '#388e3c' : '#7cb342'} opacity="0.6" />
                <circle cx="250" cy="315" r="2.5" fill={darkMode ? '#388e3c' : '#7cb342'} opacity="0.6" />
                <circle cx="1100" cy="308" r="2" fill={darkMode ? '#388e3c' : '#7cb342'} opacity="0.6" />
                <circle cx="1300" cy="312" r="3" fill={darkMode ? '#388e3c' : '#7cb342'} opacity="0.6" />

                <!-- 树木 -->
                {#each habits as habit, i}
                  {#key habit.id}
                    {#if i < 7}
                      <g transform={"translate(" + (100 + i*180) + ",230)"}>
                        <!-- 树影阴影（下方） -->
                        <ellipse cx="6" cy="76" rx="20" ry="5" fill="#000000" opacity="0.12" />
                        <!-- 树根 -->
                        <ellipse cx="0" cy="70" rx="15" ry="4" fill={habit.color} opacity="0.3" />
                        <!-- 树干 -->
                        <path d="M -8 0 Q -6 20 -8 40 Q -6 55 0 70 Q 6 55 8 40 Q 6 20 8 0" fill="#795548" stroke="#5d4037" stroke-width="0.5" />
                        <!-- 树干高亮 -->
                        <path d="M -4 5 Q -3 25 -4 45" fill="none" stroke="#a1887f" stroke-width="1" opacity="0.5" />
                        <!-- 树冠圆形，多层次 -->
                        <ellipse cx="0" cy={-(Math.min(110, 25 + streak(habit) * 6))} rx={Math.max(25, 20 + streak(habit) * 1.8)} ry={Math.min(110, 25 + streak(habit) * 6)} fill={habit.color} opacity="0.9" />
                        <!-- 树冠高亮 -->
                        <ellipse cx="-8" cy={-(Math.min(110, 25 + streak(habit) * 6)) - 15} rx={Math.max(15, 12 + streak(habit) * 1.2)} ry={Math.max(20, 15 + streak(habit) * 1.5)} fill="#ffffff" opacity="0.15" />
                        {#if streak(habit) > 5}
                          <ellipse cx="-8" cy={-(Math.min(60, 15 + streak(habit) * 3))} rx={Math.max(18, 15 + streak(habit) * 1.2)} ry={Math.min(60, 15 + streak(habit) * 3)} fill={habit.color} opacity="0.8" />
                        {/if}
                        {#if streak(habit) > 10}
                          <ellipse cx="8" cy={-(Math.min(80, 20 + streak(habit) * 4))} rx={Math.max(20, 18 + streak(habit) * 1.3)} ry={Math.min(80, 20 + streak(habit) * 4)} fill={habit.color} opacity="0.75" />
                        {/if}
                        <!-- 花朵（30+ 天） -->
                        {#if streak(habit) >= 30}
                          <g transform="translate(0, {-(Math.min(110, 25 + streak(habit) * 6)) - 10})">
                            <!-- 5 个花瓣，每个旋转 72 度 -->
                            {#each [0, 72, 144, 216, 288] as angle}
                              <ellipse 
                                cx="0" 
                                cy="-10" 
                                rx="6" 
                                ry="11" 
                                fill="#FFB6D9" 
                                opacity="0.9"
                                transform="rotate({angle})"
                              />
                            {/each}
                            <!-- 花芯 -->
                            <circle cx="0" cy="0" r="5" fill="#FFD700" />
                          </g>
                        {/if}
                        <!-- 标签：名称 -->
                        <text x="0" y="88" font-size="13" font-weight="bold" text-anchor="middle" fill="#2d5016" letter-spacing="0.5">{habit.title.slice(0,6)}</text>
                        <!-- 标签：图标 -->
                        <text x="0" y="106" font-size="22" text-anchor="middle" dominant-baseline="middle">{habit.icon}</text>
                        <!-- 连续天数装饰 -->
                        {#if streak(habit) > 0}
                          <text x="0" y={-Math.min(110, 25 + streak(habit) * 6) - 15} font-size="11" font-weight="bold" text-anchor="middle" fill="#d32f2f">🔥{streak(habit)}</text>
                        {/if}
                        <!-- 阶段标识 -->
                        <text x="-16" y="90" font-size="10" text-anchor="middle" fill="#1b5e20">S{stageOf(habit)}</text>
                      </g>
                    {/if}
                  {/key}
                {/each}
              </svg>
              <!-- 前景：淡淡的小草/叶子（近景） -->
              <div class="pointer-events-none absolute inset-x-0 bottom-0 h-10" style="transform: translate3d({parallaxX * -10}px, {parallaxY * -6}px, 0); z-index:3;">
                <div class="absolute left-6 bottom-2 w-12 h-3 bg-green-600/30 dark:bg-green-400/20 rounded-full blur-sm"></div>
                <div class="absolute left-24 bottom-1 w-16 h-3 bg-green-600/30 dark:bg-green-400/20 rounded-full blur-sm"></div>
                <div class="absolute right-10 bottom-2 w-14 h-3 bg-green-600/30 dark:bg-green-400/20 rounded-full blur-sm"></div>
              </div>
            </div>
            {:else}
              <div class="flex-1 flex items-center justify-center text-gray-500">
                <div class="text-center">
                  <svg class="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m0 0h6m-6-12H6m6 0H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2z"/>
                  </svg>
                  <p>还没有添加习惯，开始添加你的第一个吧！</p>
                </div>
              </div>
            {/if}
          </div>

          <!-- 今日打卡区域 -->
          {#if habits.length > 0}
            <div class="bg-white/80 dark:bg-slate-800/50 backdrop-blur rounded-lg shadow-lg m-3 md:m-6 md:mt-0 p-3 md:p-6 text-gray-800 dark:text-slate-100">
              <h3 class="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">📅 今日打卡</h3>
              <div class="grid gap-2 md:gap-4" style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));">
                {#each habits as habit}
                  {#if (habit.completions || []).includes(new Date().toISOString().slice(0,10))}
                    <button 
                      on:click={() => toggleToday(habit)}
                      class="p-3 md:p-5 rounded-lg transition transform hover:scale-105 active:scale-95 text-white font-semibold shadow-lg text-sm md:text-base {bouncing.has(habit.id) ? 'pop-bounce' : ''}"
                      style="background: linear-gradient(135deg, {habit.color} 0%, {habit.color}dd 100%);"
                      title="点击取消打卡"
                    >
                      <div class="text-2xl md:text-3xl mb-1">{habit.icon}</div>
                      <div class="text-xs md:text-sm font-bold truncate mb-1">{habit.title}</div>
                      <div class="text-xs">✓ 已打卡</div>
                    </button>
                  {:else}
                    <button 
                      on:click={() => toggleToday(habit)}
                      class="p-3 md:p-5 rounded-lg border-2 border-gray-300 bg-white text-gray-700 transition transform hover:border-gray-400 hover:shadow-md active:scale-95 text-sm md:text-base {bouncing.has(habit.id) ? 'pop-bounce' : ''}"
                      title="点击打卡"
                    >
                      <div class="text-2xl md:text-3xl mb-1">{habit.icon}</div>
                      <div class="text-xs md:text-sm font-bold truncate mb-1">{habit.title}</div>
                      <div class="text-xs text-gray-500">未打卡</div>
                    </button>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          <!-- 统计面板 -->
          {#if habits.length > 0}
            <div class="bg-white/80 dark:bg-slate-800/50 backdrop-blur rounded-lg shadow-lg m-3 md:m-6 p-3 md:p-6 text-gray-800 dark:text-slate-100">
              <h3 class="text-base md:text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4 md:mb-6">📊 统计概览</h3>
              <!-- 三个大统计卡片 -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6">
                <!-- 总打卡数 -->
                <div class="relative rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 p-6 text-white shadow-lg hover:shadow-xl transition">
                  <div class="absolute top-3 right-3 text-3xl opacity-20">📝</div>
                  <div class="text-sm font-medium opacity-90 mb-2">总打卡数</div>
                  <div class="text-4xl font-bold">{habits.reduce((s,h) => s + (h.completions || []).length, 0)}</div>
                  <div class="text-xs opacity-75 mt-2">次</div>
                </div>
                <!-- 最长连续 -->
                <div class="relative rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-6 text-white shadow-lg hover:shadow-xl transition">
                  <div class="absolute top-3 right-3 text-3xl opacity-20">🔥</div>
                  <div class="text-sm font-medium opacity-90 mb-2">最长连续</div>
                  <div class="text-4xl font-bold">{longestStreakAll()}</div>
                  <div class="text-xs opacity-75 mt-2">天</div>
                </div>
                <!-- 本月打卡 -->
                <div class="relative rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 p-6 text-white shadow-lg hover:shadow-xl transition">
                  <div class="absolute top-3 right-3 text-3xl opacity-20">📅</div>
                  <div class="text-sm font-medium opacity-90 mb-2">本月打卡</div>
                  <div class="text-4xl font-bold">{monthCheckinsCount()}</div>
                  <div class="text-xs opacity-75 mt-2">次</div>
                </div>
              </div>
              <!-- 习惯打卡数对比图表 -->
              <div class="mt-6">
                <div class="text-sm font-semibold text-gray-600 dark:text-slate-300 px-3 py-2 mb-4">打卡统计</div>
                <div class="bg-white/50 dark:bg-slate-700/30 rounded-lg p-4 md:p-6 overflow-x-auto">
                  <svg viewBox="0 0 1000 380" class="w-full h-[450px] md:h-[320px]" preserveAspectRatio="xMidYMid meet">
                    <!-- 背景网格线 -->
                    {#each [0, 50, 100, 150, 200, 250] as gridValue}
                      <line 
                        x1="80" 
                        y1={320 - gridValue * 1.1} 
                        x2="980" 
                        y2={320 - gridValue * 1.1} 
                        stroke="#e5e7eb" 
                        stroke-width="1" 
                        opacity="0.5"
                      />
                      <text 
                        x="70" 
                        y={325 - gridValue * 1.1} 
                        font-size="12" 
                        text-anchor="end" 
                        fill="#666"
                        opacity="0.6"
                      >
                        {gridValue}
                      </text>
                    {/each}
                    
                    <!-- 柱子 -->
                    {#each habits as habit, i}
                      {@const count = (habit.completions || []).length}
                      {@const barWidth = 60}
                      {@const spacing = 900 / habits.length}
                      {@const x = 100 + i * spacing + (spacing - barWidth) / 2}
                      {@const height = count * 1.1}
                      <!-- 柱子背景 -->
                      <rect 
                        x={x} 
                        y={320 - height} 
                        width={barWidth} 
                        height={height} 
                        fill="url(#barGradient{i})"
                        rx="4"
                        class="transition"
                      />
                      <defs>
                        <linearGradient id="barGradient{i}" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" style="stop-color:{habit.color};stop-opacity:1" />
                          <stop offset="100%" style="stop-color:{habit.color};stop-opacity:0.6" />
                        </linearGradient>
                      </defs>
                      <!-- 数值标签 -->
                      <text 
                        x={x + barWidth / 2} 
                        y={300 - height} 
                        font-size="14" 
                        font-weight="bold"
                        text-anchor="middle"
                        fill="#333"
                      >
                        {count}
                      </text>
                      <!-- 习惯图标 -->
                      <text 
                        x={x + barWidth / 2} 
                        y={340} 
                        font-size="16" 
                        text-anchor="middle"
                        fill="#666"
                      >
                        {habit.icon}
                      </text>
                      <!-- 习惯名 -->
                      <text 
                        x={x + barWidth / 2} 
                        y={360} 
                        font-size="11" 
                        text-anchor="middle"
                        fill="#999"
                      >
                        {habit.title.slice(0, 6)}
                      </text>
                    {/each}
                  </svg>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

{#if showDeleteModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black opacity-50 z-40" on:click={() => { showDeleteModal = false; deleteTarget = null; }}></div>
      <div class="relative bg-white rounded-lg shadow-lg z-50 p-6 w-11/12 max-w-md" on:click|stopPropagation>
      <h3 class="text-lg font-semibold mb-2">确认删除习惯</h3>
      <p class="text-sm text-gray-600 mb-4">请在下方输入验证码以确认删除： <span class="font-mono bg-gray-100 px-2 py-1 rounded">{deleteConfirmCode}</span></p>
        <input bind:value={deleteInput} placeholder="输入验证码" class="w-full border rounded px-3 py-2 mb-4" autofocus on:click|stopPropagation />
      <div class="flex justify-end gap-2">
          <button class="px-3 py-2 rounded bg-gray-100" on:click={() => { showDeleteModal = false; deleteTarget = null; }} on:click|stopPropagation>取消</button>
          <button class="px-3 py-2 rounded bg-red-600 text-white" on:click={confirmDelete} on:click|stopPropagation>确认删除</button>
      </div>
    </div>
  </div>
{/if}

{#if showGrowthFX}
  <div class="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
    <div class="relative" style="color:{fxColor}">
      <div class="growth-circle" style="border-color:{fxColor}"></div>
      <div class="growth-circle growth-delay" style="border-color:{fxColor}"></div>
      <div class="text-5xl md:text-6xl growth-pop text-white drop-shadow" style="position:absolute; left:50%; top:50%; transform: translate(-50%, -50%);">
        {fxIcon}
      </div>
    </div>
  </div>
{/if}

{#if showOnboarding}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50" on:click={() => { showOnboarding = false; localStorage.setItem('forest-habbit:onboarded','1');}}></div>
    <div class="relative bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 rounded-xl shadow-xl p-6 w-11/12 max-w-lg z-50">
      <div class="text-xl font-bold mb-2">欢迎来到习惯森林</div>
      {#if onboardingStep === 0}
        <p class="text-sm mb-4">3 步快速上手：添加第一个习惯，打卡一次，看看你的树长出来！</p>
      {:else if onboardingStep === 1}
        <p class="text-sm mb-4">左侧侧边栏可以添加习惯（名称、图标、颜色），每天坚持打卡，你的树会不断成长。</p>
      {:else}
        <p class="text-sm mb-4">到“今日打卡”区点击卡片即可打卡/取消；你还可以在顶部生成森林海报分享给朋友。</p>
      {/if}
      <div class="flex justify-end gap-2">
        <button class="px-3 py-2 rounded-lg bg-gray-100 dark:bg-slate-700" on:click={() => { showOnboarding = false; localStorage.setItem('forest-habbit:onboarded','1'); }}>跳过</button>
        {#if onboardingStep < 2}
          <button class="px-3 py-2 rounded-lg bg-green-600 text-white" on:click={() => { onboardingStep += 1; if (onboardingStep===1) sidebarOpen=true; }}>下一步</button>
        {:else}
          <button class="px-3 py-2 rounded-lg bg-green-600 text-white" on:click={() => { showOnboarding = false; localStorage.setItem('forest-habbit:onboarded','1'); }}>开始使用</button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
  /* 一个轻量的一次性弹跳动画 */
  @keyframes popOnce {
    0% { transform: scale(1); }
    50% { transform: scale(1.06); }
    100% { transform: scale(1); }
  }
  .pop-bounce {
    animation: popOnce 0.3s ease-out;
  }

  /* 成长涟漪特效 */
  @keyframes ripple {
    0% { transform: scale(0); opacity: .8; }
    100% { transform: scale(1.2); opacity: 0; }
  }
  .growth-circle {
    width: 160px;
    height: 160px;
    border-radius: 9999px;
    border-width: 4px;
    border-style: solid;
    animation: ripple .8s ease-out forwards;
  }
  .growth-delay { animation-delay: .15s; }
</style>
