<script>
  import { onMount } from 'svelte';
  
  let habits = [];
  let newHabitName = '';
  let selectedDate = new Date().toISOString().split('T')[0];
  let isMobile = false;

  onMount(() => {
    loadHabits();
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  });

  function checkMobile() {
    isMobile = window.innerWidth < 768;
  }

  function loadHabits() {
    const stored = localStorage.getItem('habits');
    if (stored) {
      habits = JSON.parse(stored);
    }
  }

  function saveHabits() {
    localStorage.setItem('habits', JSON.stringify(habits));
  }

  function addHabit() {
    if (newHabitName.trim()) {
      habits = [...habits, {
        id: Date.now(),
        name: newHabitName.trim(),
        completions: {}
      }];
      newHabitName = '';
      saveHabits();
    }
  }

  function toggleCompletion(habitId) {
    habits = habits.map(habit => {
      if (habit.id === habitId) {
        const completions = { ...habit.completions };
        if (completions[selectedDate]) {
          delete completions[selectedDate];
        } else {
          completions[selectedDate] = true;
        }
        return { ...habit, completions };
      }
      return habit;
    });
    saveHabits();
  }

  function deleteHabit(habitId) {
    habits = habits.filter(h => h.id !== habitId);
    saveHabits();
  }

  function getTreeHeight(habit) {
    const completionCount = Object.keys(habit.completions).length;
    return Math.min(50 + completionCount * 10, 200);
  }

  function getTreeColor(habit) {
    const completionCount = Object.keys(habit.completions).length;
    if (completionCount === 0) return '#8B4513';
    if (completionCount < 5) return '#90EE90';
    if (completionCount < 10) return '#32CD32';
    if (completionCount < 20) return '#228B22';
    return '#006400';
  }
</script>

<div class="container">
  <h1>🌲 Habit Forest 🌲</h1>
  
  <div class="controls">
    <input
      type="text"
      bind:value={newHabitName}
      placeholder="New habit name"
      on:keypress={(e) => e.key === 'Enter' && addHabit()}
    />
    <button on:click={addHabit}>Add Habit</button>
  </div>

  <div class="date-selector">
    <label>
      Select Date:
      <input type="date" bind:value={selectedDate} />
    </label>
  </div>

  <div class="habits-list">
    {#each habits as habit}
      <div class="habit-item">
        <input
          type="checkbox"
          checked={habit.completions[selectedDate] || false}
          on:change={() => toggleCompletion(habit.id)}
        />
        <span>{habit.name}</span>
        <span class="completion-count">({Object.keys(habit.completions).length} days)</span>
        <button class="delete-btn" on:click={() => deleteHabit(habit.id)}>Delete</button>
      </div>
    {/each}
  </div>

  <div class="forest-container overflow-x-auto">
    <svg 
      viewBox={isMobile ? "0 0 700 420" : `0 0 ${Math.max(800, habits.length * 180)} 400`}
      class="forest"
    >
      <rect width="100%" height="100%" fill="#87CEEB"/>
      <rect y="300" width="100%" height="100" fill="#8B7355"/>
      
      {#each habits as habit, i}
        {@const x = isMobile ? (50 + i * 200) : i * 180 + 100}
        {@const height = getTreeHeight(habit)}
        {@const color = getTreeColor(habit)}
        {@const isCompleted = habit.completions[selectedDate]}
        
        <g transform={`translate(${x}, ${300 - height})`}>
          <rect
            x="-15"
            y={height - 30}
            width="30"
            height="30"
            fill="#8B4513"
          />
          
          <polygon
            points="-40,{height - 30} 0,{height - 80} 40,{height - 30}"
            fill={color}
          />
          <polygon
            points="-35,{height - 60} 0,{height - 110} 35,{height - 60}"
            fill={color}
          />
          <polygon
            points="-30,{height - 90} 0,{height - 130} 30,{height - 90}"
            fill={color}
          />
          
          {#if isCompleted}
            <circle cx="0" cy={height - 140} r="20" fill="#FFD700" opacity="0.8"/>
            <text
              x="0"
              y={height - 135}
              text-anchor="middle"
              font-size={isMobile ? "28" : "24"}
              fill="#FFF"
            >⭐</text>
          {/if}
          
          <text
            x="0"
            y={height + 20}
            text-anchor="middle"
            font-size={isMobile ? "16" : "12"}
            fill="#333"
          >{habit.name}</text>
        </g>
      {/each}
    </svg>
  </div>
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
  }

  h1 {
    text-align: center;
    color: #2d5016;
    margin-bottom: 30px;
  }

  .controls {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }

  input[type="text"] {
    flex: 1;
    padding: 10px;
    border: 2px solid #ccc;
    border-radius: 4px;
    font-size: 16px;
  }

  button {
    padding: 10px 20px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
  }

  button:hover {
    background-color: #45a049;
  }

  .date-selector {
    margin-bottom: 20px;
  }

  .date-selector label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: bold;
  }

  .date-selector input[type="date"] {
    padding: 8px;
    border: 2px solid #ccc;
    border-radius: 4px;
    font-size: 16px;
  }

  .habits-list {
    margin-bottom: 30px;
  }

  .habit-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background-color: #f5f5f5;
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .habit-item input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }

  .habit-item span {
    flex: 1;
  }

  .completion-count {
    color: #666;
    font-size: 14px;
  }

  .delete-btn {
    background-color: #f44336;
    padding: 5px 15px;
  }

  .delete-btn:hover {
    background-color: #da190b;
  }

  .forest-container {
    background-color: #f0f0f0;
    border-radius: 8px;
    padding: 20px;
    margin-top: 20px;
  }

  .overflow-x-auto {
    overflow-x: auto;
  }

  .forest {
    width: 100%;
    height: auto;
    border: 2px solid #ccc;
    border-radius: 4px;
  }

  @media (max-width: 768px) {
    .container {
      padding: 10px;
    }

    h1 {
      font-size: 24px;
    }

    .controls {
      flex-direction: column;
    }

    .forest-container {
      padding: 10px;
    }
  }
</style>
