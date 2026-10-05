// Recipe Master Frontend Application Logic
let allRecipes = [];
let currentCategory = 'all';
let currentSearch = '';
let currentSort = 'name_asc';
let activeRecipe = null;
let currentScaledYield = null;
let isOfflineMode = false;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const btnClearSearch = document.getElementById('btnClearSearch');
const sortSelect = document.getElementById('sortSelect');
const categoryChips = document.getElementById('categoryChips');
const recipesGrid = document.getElementById('recipesGrid');
const resultsCount = document.getElementById('resultsCount');
const emptyState = document.getElementById('emptyState');

// Modals
const recipeModalBackdrop = document.getElementById('recipeModalBackdrop');
const btnCloseModal = document.getElementById('btnCloseModal');
const editModalBackdrop = document.getElementById('editModalBackdrop');
const btnCloseEditModal = document.getElementById('btnCloseEditModal');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const btnOpenCreate = document.getElementById('btnOpenCreate');

// Scaler Elements
const targetYieldInput = document.getElementById('targetYieldInput');
const scaleFactorBanner = document.getElementById('scaleFactorBanner');
const modalYieldUnit = document.getElementById('modalYieldUnit');
const modalBaseYieldBadge = document.getElementById('modalBaseYieldBadge');
const heroIngCount = document.getElementById('heroIngCount');
const heroIngBreakdown = document.getElementById('heroIngBreakdown');
const ingTableCountBadge = document.getElementById('ingTableCountBadge');
const ingredientsTableBody = document.getElementById('ingredientsTableBody');
const instructionsContent = document.getElementById('instructionsContent');

// Actions
const btnDownloadPdf = document.getElementById('btnDownloadPdf');
const btnModalPdfFooter = document.getElementById('btnModalPdfFooter');
const btnPrintRecipe = document.getElementById('btnPrintRecipe');
const btnEditRecipe = document.getElementById('btnEditRecipe');

// Live Form Counter
const liveFormIngCount = document.getElementById('liveFormIngCount');
const formIngTableBody = document.getElementById('formIngTableBody');

// Toast
const toast = document.getElementById('toast');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check if opened via file:// or if seed data is present
  if (window.location.protocol === 'file:') {
    isOfflineMode = true;
    initOfflineData();
  } else {
    loadStats();
    loadCategories();
    loadRecipes();
  }
  setupEventListeners();
});

function initOfflineData() {
  if (window.SEED_RECIPES && Array.isArray(window.SEED_RECIPES)) {
    allRecipes = window.SEED_RECIPES;
    document.getElementById('statRecipes').textContent = allRecipes.length.toLocaleString();
    
    // Categories count
    const cats = {};
    let totalIng = 0;
    allRecipes.forEach(r => {
      cats[r.category] = (cats[r.category] || 0) + 1;
      totalIng += (r.ingredients ? r.ingredients.length : 0);
    });
    
    document.getElementById('statCategories').textContent = Object.keys(cats).length;
    document.getElementById('statIngredients').textContent = totalIng.toLocaleString();
    document.getElementById('countAll').textContent = allRecipes.length;

    renderCategoryChipsFromMap(cats);
    sortAndRenderRecipes();
  }
}

function renderCategoryChipsFromMap(cats) {
  const chipsHtml = [
    `<button class="chip ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">All Recipes <span class="chip-count" id="countAll">${allRecipes.length}</span></button>`
  ];

  Object.entries(cats).sort((a,b) => a[0].localeCompare(b[0])).forEach(([cat, count]) => {
    const active = currentCategory === cat ? 'active' : '';
    chipsHtml.push(
      `<button class="chip ${active}" data-cat="${cat}">${cat} <span class="chip-count">${count}</span></button>`
    );
  });

  categoryChips.innerHTML = chipsHtml.join('');

  categoryChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      categoryChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.cat;
      filterAndRenderOffline();
    });
  });
}

function filterAndRenderOffline() {
  let filtered = [...allRecipes];
  if (currentCategory !== 'all') {
    filtered = filtered.filter(r => r.category === currentCategory);
  }
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(r => 
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.cuisine && r.cuisine.toLowerCase().includes(q)) ||
      (r.ingredients && r.ingredients.some(i => i.name && i.name.toLowerCase().includes(q)))
    );
  }
  sortAndRenderRecipes(filtered);
}

function setupEventListeners() {
  // Search
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.trim();
    btnClearSearch.style.display = currentSearch ? 'block' : 'none';
    if (isOfflineMode) {
      filterAndRenderOffline();
    } else {
      debounce(loadRecipes, 250)();
    }
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    currentSearch = '';
    btnClearSearch.style.display = 'none';
    if (isOfflineMode) {
      filterAndRenderOffline();
    } else {
      loadRecipes();
    }
  });

  // Sort
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    sortAndRenderRecipes();
  });

  // Modals close
  btnCloseModal.addEventListener('click', closeRecipeModal);
  recipeModalBackdrop.addEventListener('click', (e) => {
    if (e.target === recipeModalBackdrop) closeRecipeModal();
  });

  btnCloseEditModal.addEventListener('click', closeEditModal);
  btnCancelEdit.addEventListener('click', closeEditModal);
  editModalBackdrop.addEventListener('click', (e) => {
    if (e.target === editModalBackdrop) closeEditModal();
  });

  // Open Create Modal
  btnOpenCreate.addEventListener('click', () => {
    openCreateModal();
  });

  // Target yield change
  targetYieldInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (val > 0) {
      applyScaling(val);
      updateQuickScaleActiveState(val);
    }
  });

  // Quick scale buttons
  document.querySelectorAll('.btn-scale-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!activeRecipe) return;
      document.querySelectorAll('.btn-scale-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const factor = parseFloat(btn.dataset.factor);
      const newYield = (activeRecipe.base_yield || 100) * factor;
      targetYieldInput.value = roundNumber(newYield, 2);
      applyScaling(newYield);
    });
  });

  // PDF Download
  btnDownloadPdf.addEventListener('click', downloadCurrentPdf);
  btnModalPdfFooter.addEventListener('click', downloadCurrentPdf);

  // Print
  btnPrintRecipe.addEventListener('click', () => {
    window.print();
  });

  // Edit from view modal
  btnEditRecipe.addEventListener('click', () => {
    if (!activeRecipe) return;
    closeRecipeModal();
    openEditModal(activeRecipe);
  });
}

// Fetch Stats
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error();
    const data = await res.json();
    document.getElementById('statRecipes').textContent = data.total_recipes.toLocaleString();
    document.getElementById('statCategories').textContent = data.total_categories;
    document.getElementById('statIngredients').textContent = data.total_ingredients.toLocaleString();
    document.getElementById('countAll').textContent = data.total_recipes;
  } catch (err) {
    console.warn('API offline, switching to embedded seed data fallback');
    isOfflineMode = true;
    initOfflineData();
  }
}

// Fetch Categories
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error();
    const categories = await res.json();
    
    // Update Datalist in form
    const datalist = document.getElementById('categoryListOptions');
    datalist.innerHTML = categories.map(c => `<option value="${c.category}">`).join('');

    // Render chips
    const chipsHtml = [
      `<button class="chip ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">All Recipes <span class="chip-count" id="countAll">${allRecipes.length || '446'}</span></button>`
    ];

    categories.forEach(c => {
      const active = currentCategory === c.category ? 'active' : '';
      chipsHtml.push(
        `<button class="chip ${active}" data-cat="${c.category}">${c.category} <span class="chip-count">${c.recipe_count}</span></button>`
      );
    });

    categoryChips.innerHTML = chipsHtml.join('');

    categoryChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        categoryChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentCategory = chip.dataset.cat;
        loadRecipes();
      });
    });
  } catch (err) {
    console.warn('Error loading categories from API');
  }
}

// Fetch Recipes
async function loadRecipes() {
  resultsCount.textContent = 'Searching recipes...';
  try {
    let url = `/api/recipes?limit=500&category=${encodeURIComponent(currentCategory)}`;
    if (currentSearch) {
      url += `&search=${encodeURIComponent(currentSearch)}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    allRecipes = data.recipes || [];
    sortAndRenderRecipes();
  } catch (err) {
    console.warn('Error connecting to backend API, using offline fallback');
    isOfflineMode = true;
    initOfflineData();
  }
}

// Sort & Render
function sortAndRenderRecipes(customList = null) {
  let list = customList ? [...customList] : [...allRecipes];

  if (currentSort === 'name_asc') {
    list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (currentSort === 'name_desc') {
    list.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
  } else if (currentSort === 'ing_desc') {
    list.sort((a, b) => (b.ingredients_count || (b.ingredients ? b.ingredients.length : 0)) - (a.ingredients_count || (a.ingredients ? a.ingredients.length : 0)));
  } else if (currentSort === 'ing_asc') {
    list.sort((a, b) => (a.ingredients_count || (a.ingredients ? a.ingredients.length : 0)) - (b.ingredients_count || (b.ingredients ? b.ingredients.length : 0)));
  } else if (currentSort === 'yield_desc') {
    list.sort((a, b) => (b.base_yield || 0) - (a.base_yield || 0));
  }

  renderRecipeGrid(list);
}

// Render Grid
function renderRecipeGrid(recipes) {
  if (recipes.length === 0) {
    recipesGrid.innerHTML = '';
    emptyState.style.display = 'block';
    resultsCount.textContent = '0 recipes found';
    return;
  }

  emptyState.style.display = 'none';
  resultsCount.innerHTML = `Showing <strong>${recipes.length}</strong> recipes ${currentCategory !== 'all' ? `in <em>${currentCategory}</em>` : ''}`;

  const cardsHtml = recipes.map(r => {
    const ingCount = r.ingredients_count || (r.ingredients ? r.ingredients.length : 0);
    const cuisineTag = r.cuisine ? `<span class="badge badge-cuisine">${escapeHtml(r.cuisine)}</span>` : '';
    
    return `
      <div class="recipe-card" onclick="viewRecipe('${r.id}')">
        <div class="card-top">
          <div class="card-badges">
            <span class="badge badge-cat">${escapeHtml(r.category)}</span>
            ${cuisineTag}
          </div>
          <h3 class="recipe-title">${escapeHtml(r.title)}</h3>
          
          <!-- High-Visibility Ingredients Count Badge -->
          <div class="card-metrics-row">
            <span class="ing-count-pill" title="Total Ingredients in this recipe">
              🌿 <strong>${ingCount} Ingredients</strong>
            </span>
            <span class="yield-pill" title="Base Yield">
              Yield: ${r.base_yield} ${escapeHtml(r.yield_unit || '')}
            </span>
          </div>
        </div>

        <div class="card-footer" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-card-scale" onclick="viewRecipe('${r.id}')">
            ⚡ View & Scale
          </button>
          <button class="btn btn-sm btn-card-pdf" onclick="directPdfDownload('${r.id}', ${r.base_yield})" title="Direct PDF Download">
            📄 PDF
          </button>
        </div>
      </div>
    `;
  }).join('');

  recipesGrid.innerHTML = cardsHtml;
}

// View Recipe Details & Scaler
async function viewRecipe(recipeId) {
  try {
    let recipe = null;
    if (isOfflineMode) {
      recipe = allRecipes.find(r => r.id === recipeId);
    } else {
      const res = await fetch(`/api/recipes/${recipeId}`);
      if (res.ok) {
        recipe = await res.json();
      } else {
        recipe = allRecipes.find(r => r.id === recipeId);
      }
    }

    if (!recipe) throw new Error('Recipe not found');
    activeRecipe = recipe;
    currentScaledYield = recipe.base_yield || 100;

    // Set Modal Header
    document.getElementById('modalRecipeTitle').textContent = recipe.title;
    document.getElementById('modalRecipeCuisine').textContent = recipe.cuisine ? `Cuisine / Style: ${recipe.cuisine}` : `Category: ${recipe.category}`;
    
    document.getElementById('modalCategoryBadges').innerHTML = `
      <span class="badge badge-cat">${escapeHtml(recipe.category)}</span>
      ${recipe.cuisine ? `<span class="badge badge-cuisine">${escapeHtml(recipe.cuisine)}</span>` : ''}
    `;

    // Base Yield
    modalBaseYieldBadge.textContent = `Base: ${recipe.base_yield} ${recipe.yield_unit}`;
    modalYieldUnit.textContent = recipe.yield_unit;
    targetYieldInput.value = recipe.base_yield;

    // Reset quick chips
    document.querySelectorAll('.btn-scale-chip').forEach(b => b.classList.remove('active'));
    document.querySelector('.btn-scale-chip[data-factor="1.0"]')?.classList.add('active');

    // Ingredients Count Hero
    const ingCount = recipe.ingredients ? recipe.ingredients.length : 0;
    heroIngCount.textContent = ingCount;
    ingTableCountBadge.textContent = `${ingCount} Items`;

    // Grouping by stage
    const stages = {};
    (recipe.ingredients || []).forEach(i => {
      const s = i.stage || 'Main';
      stages[s] = (stages[s] || 0) + 1;
    });
    const stageSummary = Object.entries(stages).map(([stg, cnt]) => `<strong>${cnt}</strong> ${stg}`).join(' • ');
    heroIngBreakdown.innerHTML = stageSummary ? `Breakdown: ${stageSummary}` : 'All ingredients categorized under Main.';

    // Populate Ingredients Table
    applyScaling(recipe.base_yield);

    // Cooking Instructions
    const instructions = recipe.instructions || [];
    if (instructions.length > 0) {
      instructionsContent.innerHTML = instructions.map((step, idx) => `
        <div class="instruction-step">
          <span class="step-num">${idx + 1}.</span>
          <span class="step-text">${escapeHtml(step)}</span>
        </div>
      `).join('');
    } else {
      instructionsContent.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">No specific cooking instructions listed. Follow standard kitchen procedures.</p>';
    }

    recipeModalBackdrop.classList.add('show');
  } catch (err) {
    alert('Error opening recipe details');
    console.error(err);
  }
}

// Live Dynamic Scaling Calculation
function applyScaling(targetYield) {
  if (!activeRecipe) return;
  currentScaledYield = targetYield;
  const baseYield = activeRecipe.base_yield || 100;
  const scaleFactor = targetYield / baseYield;

  scaleFactorBanner.innerHTML = `Multiplier: <strong>${scaleFactor.toFixed(2)}x</strong> (Target: ${roundNumber(targetYield, 2)} ${activeRecipe.yield_unit} ÷ Base: ${baseYield} ${activeRecipe.yield_unit})`;

  const ingredients = activeRecipe.ingredients || [];
  const rowsHtml = ingredients.map((ing, idx) => {
    const baseQty = ing.quantity !== undefined ? ing.quantity : 0;
    const scaledQty = baseQty * scaleFactor;
    
    return `
      <tr id="ingRow_${idx}">
        <td style="text-align: center;">
          <input type="checkbox" class="ing-prep-check" onchange="toggleRowCheck(${idx}, this.checked)" title="Check when prepped" />
        </td>
        <td><span class="ing-stage-tag">${escapeHtml(ing.stage || 'Main')}</span></td>
        <td><strong>${escapeHtml(ing.name)}</strong></td>
        <td style="text-align: right;" class="qty-base">${formatQty(baseQty)}</td>
        <td style="text-align: right;" class="qty-val">${formatQty(scaledQty)}</td>
        <td>${escapeHtml(ing.unit || '')}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${escapeHtml(ing.notes || '')}</td>
      </tr>
    `;
  }).join('');

  ingredientsTableBody.innerHTML = rowsHtml;
}

function toggleRowCheck(idx, isChecked) {
  const row = document.getElementById(`ingRow_${idx}`);
  if (row) {
    if (isChecked) {
      row.classList.add('checked-row');
    } else {
      row.classList.remove('checked-row');
    }
  }
}

function updateQuickScaleActiveState(targetYield) {
  if (!activeRecipe) return;
  const factor = targetYield / (activeRecipe.base_yield || 100);
  document.querySelectorAll('.btn-scale-chip').forEach(b => {
    const bFact = parseFloat(b.dataset.factor);
    if (Math.abs(bFact - factor) < 0.01) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

function formatQty(qty) {
  if (qty === null || qty === undefined || isNaN(qty)) return '0';
  if (qty >= 100) return qty.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (qty >= 1) return qty.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (qty > 0) return qty.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return '0';
}

function roundNumber(num, dec) {
  return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
}

// Download Scaled PDF
function downloadCurrentPdf() {
  if (!activeRecipe) return;
  const targetYield = currentScaledYield || activeRecipe.base_yield;
  if (isOfflineMode) {
    window.print();
    return;
  }
  const url = `/api/recipes/${activeRecipe.id}/pdf?target_yield=${encodeURIComponent(targetYield)}`;
  window.location.href = url;
  showToast(`Generating PDF for ${activeRecipe.title}...`);
}

function directPdfDownload(recipeId, baseYield) {
  if (isOfflineMode) {
    viewRecipe(recipeId);
    setTimeout(() => window.print(), 300);
    return;
  }
  const url = `/api/recipes/${recipeId}/pdf?target_yield=${encodeURIComponent(baseYield)}`;
  window.location.href = url;
  showToast('Generating recipe PDF...');
}

// Create & Edit Modal
function openCreateModal() {
  document.getElementById('editModalTitle').textContent = 'Create New Recipe';
  document.getElementById('editRecipeId').value = '';
  document.getElementById('recipeForm').reset();
  formIngTableBody.innerHTML = '';
  for (let i = 0; i < 4; i++) addIngredientRow();
  updateLiveFormIngCount();
  editModalBackdrop.classList.add('show');
}

function openEditModal(recipe) {
  document.getElementById('editModalTitle').textContent = `Edit Recipe: ${recipe.title}`;
  document.getElementById('editRecipeId').value = recipe.id;
  document.getElementById('formTitle').value = recipe.title;
  document.getElementById('formCategory').value = recipe.category;
  document.getElementById('formCuisine').value = recipe.cuisine || '';
  document.getElementById('formBaseYield').value = recipe.base_yield || 100;
  document.getElementById('formYieldUnit').value = recipe.yield_unit || 'Kg';
  document.getElementById('formInstructions').value = (recipe.instructions || []).join('\n');

  formIngTableBody.innerHTML = '';
  (recipe.ingredients || []).forEach(ing => {
    addIngredientRow(ing);
  });
  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    addIngredientRow();
  }
  updateLiveFormIngCount();
  editModalBackdrop.classList.add('show');
}

function addIngredientRow(data = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="ing-stage-input">
        <option value="Main" ${data.stage === 'Main' ? 'selected' : ''}>Main</option>
        <option value="Chaunk / Tadka" ${data.stage && data.stage.includes('Chaunk') ? 'selected' : ''}>Chaunk / Tadka</option>
        <option value="Paste" ${data.stage === 'Paste' ? 'selected' : ''}>Paste</option>
        <option value="Seasoning" ${data.stage === 'Seasoning' ? 'selected' : ''}>Seasoning</option>
        <option value="Garnish" ${data.stage === 'Garnish' ? 'selected' : ''}>Garnish</option>
      </select>
    </td>
    <td>
      <input type="text" class="ing-name-input" required placeholder="e.g. Cumin Seeds" value="${escapeHtml(data.name || '')}" oninput="updateLiveFormIngCount()" />
    </td>
    <td>
      <input type="number" step="any" min="0" class="ing-qty-input" placeholder="Qty" value="${data.quantity !== undefined ? data.quantity : ''}" />
    </td>
    <td>
      <select class="ing-unit-input">
        <option value="gm" ${data.unit === 'gm' ? 'selected' : ''}>gm</option>
        <option value="Kg" ${data.unit === 'Kg' ? 'selected' : ''}>Kg</option>
        <option value="L" ${data.unit === 'L' ? 'selected' : ''}>L</option>
        <option value="ml" ${data.unit === 'ml' ? 'selected' : ''}>ml</option>
        <option value="Nos." ${data.unit === 'Nos.' ? 'selected' : ''}>Nos.</option>
        <option value="pcs" ${data.unit === 'pcs' ? 'selected' : ''}>pcs</option>
        <option value="gaddi" ${data.unit === 'gaddi' ? 'selected' : ''}>gaddi</option>
        <option value="tbsp" ${data.unit === 'tbsp' ? 'selected' : ''}>tbsp</option>
      </select>
    </td>
    <td>
      <input type="text" class="ing-notes-input" placeholder="Prep notes (e.g. soak overnight)" value="${escapeHtml(data.notes || '')}" />
    </td>
    <td style="text-align: center;">
      <button type="button" class="btn-remove-row" onclick="removeIngredientRow(this)" title="Remove Ingredient">✕</button>
    </td>
  `;
  formIngTableBody.appendChild(tr);
  updateLiveFormIngCount();
}

function removeIngredientRow(btn) {
  const row = btn.closest('tr');
  if (row) {
    row.remove();
    updateLiveFormIngCount();
  }
}

function updateLiveFormIngCount() {
  const rows = formIngTableBody.querySelectorAll('tr');
  let filledCount = 0;
  rows.forEach(r => {
    const nameVal = r.querySelector('.ing-name-input')?.value.trim();
    if (nameVal) filledCount++;
  });
  liveFormIngCount.textContent = `Ingredients Count: ${filledCount} (${rows.length} rows)`;
}

// Save Recipe Handler
async function handleSaveRecipe(e) {
  e.preventDefault();
  const recipeId = document.getElementById('editRecipeId').value;
  const isEditing = !!recipeId;

  const title = document.getElementById('formTitle').value.trim();
  const category = document.getElementById('formCategory').value.trim();
  const cuisine = document.getElementById('formCuisine').value.trim();
  const baseYield = parseFloat(document.getElementById('formBaseYield').value) || 100;
  const yieldUnit = document.getElementById('formYieldUnit').value;
  const instructionsRaw = document.getElementById('formInstructions').value;
  const instructions = instructionsRaw.split('\n').map(s => s.trim()).filter(s => s.length > 0);

  const ingredients = [];
  const rows = formIngTableBody.querySelectorAll('tr');
  rows.forEach(r => {
    const name = r.querySelector('.ing-name-input')?.value.trim();
    if (name) {
      const stage = r.querySelector('.ing-stage-input')?.value || 'Main';
      const qty = parseFloat(r.querySelector('.ing-qty-input')?.value) || 0.0;
      const unit = r.querySelector('.ing-unit-input')?.value || 'gm';
      const notes = r.querySelector('.ing-notes-input')?.value.trim() || '';
      ingredients.push({ name, stage, quantity: qty, unit, notes });
    }
  });

  const payload = {
    title,
    category,
    cuisine,
    base_yield: baseYield,
    yield_unit: yieldUnit,
    ingredients,
    instructions
  };

  if (isOfflineMode) {
    if (isEditing) {
      const idx = allRecipes.findIndex(r => r.id === recipeId);
      if (idx !== -1) {
        allRecipes[idx] = { ...allRecipes[idx], ...payload, ingredients_count: ingredients.length };
      }
    } else {
      const newRec = {
        id: 'custom_' + Date.now(),
        ...payload,
        ingredients_count: ingredients.length
      };
      allRecipes.unshift(newRec);
    }
    closeEditModal();
    showToast(`Recipe "${title}" saved successfully with ${ingredients.length} ingredients!`);
    filterAndRenderOffline();
    return;
  }

  try {
    const url = isEditing ? `/api/recipes/${recipeId}` : '/api/recipes';
    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Failed to save recipe');
    const saved = await res.json();

    closeEditModal();
    showToast(`Recipe "${saved.title}" saved successfully with ${saved.ingredients_count} ingredients!`);
    loadRecipes();
    loadStats();
    loadCategories();
    
    if (isEditing && activeRecipe && activeRecipe.id === recipeId) {
      viewRecipe(recipeId);
    }
  } catch (err) {
    alert('Error saving recipe: ' + err.message);
  }
}

// Modal control helpers
function closeRecipeModal() {
  recipeModalBackdrop.classList.remove('show');
  activeRecipe = null;
}

function closeEditModal() {
  editModalBackdrop.classList.remove('show');
}

function resetFilters() {
  currentCategory = 'all';
  currentSearch = '';
  searchInput.value = '';
  btnClearSearch.style.display = 'none';
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  document.querySelector('.chip[data-cat="all"]')?.classList.add('active');
  if (isOfflineMode) {
    filterAndRenderOffline();
  } else {
    loadRecipes();
  }
}

// Toast helper
function showToast(msg) {
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
