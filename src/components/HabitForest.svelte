<script>
  import { onMount } from 'svelte';
  import { habitStore } from '../stores/habitStore';
  
  let habits = [];
  let isMobile = false;
  
  onMount(() => {
    // Check if device is mobile
    isMobile = window.innerWidth < 768;
    
    // Update on resize
    const handleResize = () => {
      isMobile = window.innerWidth < 768;
    };
    
    window.addEventListener('resize', handleResize);
    
    habitStore.subscribe(value => {
      habits = value;
    });
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });
  
  // Dynamic spacing based on screen size
  $: treeSpacing = isMobile ? 220 : 180;
  $: svgWidth = isMobile ? 700 : 1400;
  $: treesPerRow = isMobile ? 3 : 7;
  $: treeScale = isMobile ? 1.2 : 1;
  $: baseFontSize = isMobile ? 16 : 14;
  
  // Calculate tree positions with dynamic layout
  function getTreePosition(index) {
    const row = Math.floor(index / treesPerRow);
    const col = index % treesPerRow;
    const x = 100 + (col * treeSpacing);
    const y = 100 + (row * 200);
    return { x, y };
  }
  
  // Tree health based on streak
  function getTreeHealth(streak) {
    if (streak >= 30) return 'thriving';
    if (streak >= 14) return 'healthy';
    if (streak >= 7) return 'growing';
    if (streak >= 3) return 'sprout';
    return 'seed';
  }
  
  // Tree color based on health
  function getTreeColor(health) {
    switch(health) {
      case 'thriving': return '#2d5016';
      case 'healthy': return '#4a7c2c';
      case 'growing': return '#6b9d3a';
      case 'sprout': return '#8fb569';
      default: return '#b8c9a8';
    }
  }
  
  // Tree size based on health
  function getTreeSize(health) {
    const baseScale = treeScale;
    switch(health) {
      case 'thriving': return 1.5 * baseScale;
      case 'healthy': return 1.3 * baseScale;
      case 'growing': return 1.1 * baseScale;
      case 'sprout': return 0.8 * baseScale;
      default: return 0.5 * baseScale;
    }
  }
</script>

<div class="forest-container">
  <h2 class="text-2xl font-bold mb-4 text-green-800">Your Habit Forest</h2>
  
  <div class="{isMobile ? 'h-[500px]' : 'h-[350px]'} overflow-auto bg-gradient-to-b from-sky-200 to-green-100 rounded-lg shadow-inner p-4">
    <svg 
      viewBox="0 0 {svgWidth} {Math.ceil(habits.length / treesPerRow) * 200 + 100}" 
      class="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Ground -->
      <rect 
        x="0" 
        y="{Math.ceil(habits.length / treesPerRow) * 200 + 80}" 
        width="{svgWidth}" 
        height="50" 
        fill="#8b7355" 
      />
      
      <!-- Trees -->
      {#each habits as habit, index}
        {@const position = getTreePosition(index)}
        {@const health = getTreeHealth(habit.streak)}
        {@const color = getTreeColor(health)}
        {@const size = getTreeSize(health)}
        
        <g transform="translate({position.x}, {position.y}) scale({size})">
          <!-- Tree trunk -->
          <rect 
            x="-8" 
            y="20" 
            width="16" 
            height="40" 
            fill="#654321" 
            rx="2"
          />
          
          <!-- Tree foliage -->
          {#if health === 'seed'}
            <circle cx="0" cy="25" r="15" fill={color} opacity="0.5" />
          {:else if health === 'sprout'}
            <circle cx="0" cy="15" r="20" fill={color} opacity="0.7" />
            <circle cx="-10" cy="20" r="15" fill={color} opacity="0.6" />
            <circle cx="10" cy="20" r="15" fill={color} opacity="0.6" />
          {:else}
            <!-- Main canopy -->
            <circle cx="0" cy="10" r="35" fill={color} />
            <circle cx="-20" cy="15" r="28" fill={color} />
            <circle cx="20" cy="15" r="28" fill={color} />
            <circle cx="-15" cy="-5" r="25" fill={color} opacity="0.9" />
            <circle cx="15" cy="-5" r="25" fill={color} opacity="0.9" />
            <circle cx="0" cy="-15" r="22" fill={color} opacity="0.85" />
          {/if}
          
          <!-- Habit name -->
          <text 
            x="0" 
            y="75" 
            text-anchor="middle" 
            font-size="{baseFontSize}" 
            font-weight="600"
            fill="#333"
            class="select-none"
          >
            {habit.name.length > (isMobile ? 10 : 12) ? habit.name.substring(0, (isMobile ? 10 : 12)) + '...' : habit.name}
          </text>
          
          <!-- Streak count -->
          <text 
            x="0" 
            y="90" 
            text-anchor="middle" 
            font-size="{baseFontSize - 2}" 
            fill="#666"
            class="select-none"
          >
            {habit.streak} days
          </text>
        </g>
      {/each}
      
      <!-- Empty state message -->
      {#if habits.length === 0}
        <text 
          x="{svgWidth / 2}" 
          y="150" 
          text-anchor="middle" 
          font-size="{baseFontSize + 4}" 
          fill="#666"
          class="select-none"
        >
          Start tracking habits to grow your forest! 🌱
        </text>
      {/if}
    </svg>
  </div>
  
  <!-- Legend -->
  <div class="mt-4 flex flex-wrap gap-4 text-sm {isMobile ? 'justify-center' : ''}">
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 rounded-full bg-[#2d5016]"></div>
      <span>Thriving (30+ days)</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 rounded-full bg-[#4a7c2c]"></div>
      <span>Healthy (14+ days)</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 rounded-full bg-[#6b9d3a]"></div>
      <span>Growing (7+ days)</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 rounded-full bg-[#8fb569]"></div>
      <span>Sprout (3+ days)</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 rounded-full bg-[#b8c9a8]"></div>
      <span>Seed (0-2 days)</span>
    </div>
  </div>
</div>

<style>
  .forest-container {
    max-width: 100%;
    padding: 1rem;
  }
  
  @media (max-width: 768px) {
    .forest-container {
      padding: 0.5rem;
    }
  }
</style>
