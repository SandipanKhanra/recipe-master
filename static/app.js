// Recipe Master Frontend Application Logic
let allRecipes = [];
let allCategoryObjects = [];
let currentCategory = 'all';
let currentSearch = '';
let currentSort = 'name_asc';
let activeRecipe = null;
let currentScaledYield = null;
let isOfflineMode = false;
let currentLanguage = 'en';

// Pagination & Performance Optimization State
let currentFilteredRecipes = [];
let currentPage = 1;
let pageSize = 24;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const btnClearSearch = document.getElementById('btnClearSearch');
const sortSelect = document.getElementById('sortSelect');
const categoryChips = document.getElementById('categoryChips');
const recipesGrid = document.getElementById('recipesGrid');
const resultsCount = document.getElementById('resultsCount');
const emptyState = document.getElementById('emptyState');

// Pagination Elements
const paginationSection = document.getElementById('paginationSection');
const paginationInfo = document.getElementById('paginationInfo');
const paginationPages = document.getElementById('paginationPages');
const btnPageFirst = document.getElementById('btnPageFirst');
const btnPagePrev = document.getElementById('btnPagePrev');
const btnPageNext = document.getElementById('btnPageNext');
const btnPageLast = document.getElementById('btnPageLast');
const pageSizeSelect = document.getElementById('pageSizeSelect');

// Modals
const recipeModalBackdrop = document.getElementById('recipeModalBackdrop');
const btnCloseModal = document.getElementById('btnCloseModal');

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

// Toast
const toast = document.getElementById('toast');

// Initialize
function initApp() {
  initTheme();
  initLanguage();
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

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
  const dict = (typeof UI_TRANSLATIONS !== 'undefined' && UI_TRANSLATIONS[currentLanguage]) ? UI_TRANSLATIONS[currentLanguage] : {};
  const allLabel = dict.all_recipes || 'All Recipes';
  const chipsHtml = [
    `<button class="chip ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">${allLabel} <span class="chip-count" id="countAll">${allRecipes.length}</span></button>`
  ];

  Object.entries(cats).sort((a,b) => a[0].localeCompare(b[0])).forEach(([cat, count]) => {
    const active = currentCategory === cat ? 'active' : '';
    const localizedCat = (typeof getLocalizedCategory === 'function') ? getLocalizedCategory(cat, currentLanguage) : cat;
    chipsHtml.push(
      `<button class="chip ${active}" data-cat="${cat}">${escapeHtml(localizedCat)} <span class="chip-count">${count}</span></button>`
    );
  });

  categoryChips.innerHTML = chipsHtml.join('');

  categoryChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      categoryChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.cat;
      currentPage = 1;
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
    currentPage = 1;
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
    currentPage = 1;
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
    currentPage = 1;
    sortAndRenderRecipes();
  });

  // Pagination navigation listeners
  if (btnPageFirst) btnPageFirst.addEventListener('click', () => goToPage(1));
  if (btnPagePrev) btnPagePrev.addEventListener('click', () => goToPage(currentPage - 1));
  if (btnPageNext) btnPageNext.addEventListener('click', () => goToPage(currentPage + 1));
  if (btnPageLast) btnPageLast.addEventListener('click', () => goToPage(getTotalPages()));
  if (pageSizeSelect) pageSizeSelect.addEventListener('change', (e) => {
    pageSize = (e.target.value === 'all') ? 'all' : parseInt(e.target.value, 10);
    currentPage = 1;
    renderRecipeGrid();
  });

  // Modals close
  btnCloseModal.addEventListener('click', closeRecipeModal);
  recipeModalBackdrop.addEventListener('click', (e) => {
    if (e.target === recipeModalBackdrop) closeRecipeModal();
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

  // Language Selector Change
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      changeLanguage(e.target.value);
    });
  }

  // Theme Toggle (Dark / Light)
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.onclick = toggleTheme;
  }
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
    allCategoryObjects = categories;
    
    // Update Datalist in form (if present)
    const datalist = document.getElementById('categoryListOptions');
    if (datalist) {
      datalist.innerHTML = categories.map(c => `<option value="${c.category}">`).join('');
    }

    renderCategoryChips(categories);
  } catch (err) {
    console.warn('Error loading categories from API');
  }
}

function renderCategoryChips(categories) {
  const dict = (typeof UI_TRANSLATIONS !== 'undefined' && UI_TRANSLATIONS[currentLanguage]) ? UI_TRANSLATIONS[currentLanguage] : {};
  const allLabel = dict.all_recipes || 'All Recipes';
  const chipsHtml = [
    `<button class="chip ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">${allLabel} <span class="chip-count" id="countAll">${allRecipes.length || '446'}</span></button>`
  ];

  categories.forEach(c => {
    const active = currentCategory === c.category ? 'active' : '';
    const localizedCat = (typeof getLocalizedCategory === 'function') ? getLocalizedCategory(c.category, currentLanguage) : c.category;
    chipsHtml.push(
      `<button class="chip ${active}" data-cat="${c.category}">${escapeHtml(localizedCat)} <span class="chip-count">${c.recipe_count}</span></button>`
    );
  });

  categoryChips.innerHTML = chipsHtml.join('');

  categoryChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      categoryChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.cat;
      currentPage = 1;
      if (isOfflineMode) {
        filterAndRenderOffline();
      } else {
        loadRecipes();
      }
    });
  });
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

  currentFilteredRecipes = list;
  renderRecipeGrid();
}

function getTotalPages() {
  const totalItems = currentFilteredRecipes.length;
  if (pageSize === 'all') return 1;
  const perPage = parseInt(pageSize, 10) || 24;
  return Math.max(1, Math.ceil(totalItems / perPage));
}

// Render Grid (Optimized with Progressive Pagination Slice)
function renderRecipeGrid(recipes = null) {
  if (recipes) {
    currentFilteredRecipes = recipes;
  }
  const totalItems = currentFilteredRecipes.length;
  const dict = (typeof UI_TRANSLATIONS !== 'undefined' && UI_TRANSLATIONS[currentLanguage]) ? UI_TRANSLATIONS[currentLanguage] : {};
  
  if (totalItems === 0) {
    recipesGrid.innerHTML = '';
    emptyState.style.display = 'block';
    resultsCount.textContent = '0 recipes found';
    if (paginationSection) paginationSection.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';

  // Calculate pagination bounds
  const totalPages = getTotalPages();
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const itemsPerPage = (pageSize === 'all') ? totalItems : parseInt(pageSize, 10);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const pageRecipes = (pageSize === 'all') ? currentFilteredRecipes : currentFilteredRecipes.slice(startIndex, endIndex);

  // Status Header with localized category & item range
  const localizedCatHeader = (typeof getLocalizedCategory === 'function') ? getLocalizedCategory(currentCategory, currentLanguage) : currentCategory;
  const inCatText = currentCategory !== 'all' ? (dict.in_category ? dict.in_category.replace('{cat}', escapeHtml(localizedCatHeader)) : `in <em>${escapeHtml(localizedCatHeader)}</em>`) : '';
  
  let showingText = '';
  if (pageSize === 'all' || totalItems <= itemsPerPage) {
    showingText = dict.showing_recipes ? dict.showing_recipes.replace('{count}', totalItems) : `Showing <strong>${totalItems}</strong> recipes`;
  } else {
    showingText = `Showing <strong>${startIndex + 1}–${endIndex}</strong> of <strong>${totalItems}</strong> recipes <span class="page-count-badge">Page ${currentPage} of ${totalPages}</span>`;
  }
  resultsCount.innerHTML = `${showingText} ${inCatText}`;

  // Render cards only for the active page slice (Maximum performance)
  const cardsHtml = pageRecipes.map(r => {
    const ingCount = r.ingredients_count || (r.ingredients ? r.ingredients.length : 0);
    const cuisineTag = r.cuisine ? `<span class="badge badge-cuisine">${escapeHtml(r.cuisine)}</span>` : '';
    const localizedCat = (typeof getLocalizedCategory === 'function') ? getLocalizedCategory(r.category, currentLanguage) : r.category;
    
    return `
      <div class="recipe-card" onclick="viewRecipe('${r.id}')">
        <div class="card-top">
          <div class="card-badges">
            <span class="badge badge-cat">${escapeHtml(localizedCat)}</span>
            ${cuisineTag}
          </div>
          <h3 class="recipe-title">${escapeHtml(r.title)}</h3>
          
          <!-- High-Visibility Ingredients Count Badge -->
          <div class="card-metrics-row">
            <span class="ing-count-pill" title="Total Ingredients in this recipe">
              🌿 <strong>${ingCount} ${dict.ingredients || 'Ingredients'}</strong>
            </span>
            <span class="yield-pill" title="Base Yield">
              Yield: ${r.base_yield} ${escapeHtml(r.yield_unit || '')}
            </span>
          </div>
        </div>

        <div class="card-footer" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-card-scale" onclick="viewRecipe('${r.id}')">
            ${dict.view_scale || '⚡ View & Scale'}
          </button>
          <button class="btn btn-sm btn-card-pdf" onclick="directPdfDownload('${r.id}', ${r.base_yield})" title="Direct PDF Download">
            ${dict.pdf || '📄 PDF'}
          </button>
          <a href="https://www.google.com/search?q=${encodeURIComponent(r.title + ' recipe')}" target="_blank" rel="noopener noreferrer" class="btn-card-search" title="Google Search '${escapeHtml(r.title)}'">
            🔍
          </a>
        </div>
      </div>
    `;
  }).join('');

  recipesGrid.innerHTML = cardsHtml;
  renderPagination(totalItems, totalPages, startIndex, endIndex);
}

function renderPagination(totalItems, totalPages, startIndex, endIndex) {
  if (!paginationSection) return;

  if (totalItems <= 0) {
    paginationSection.style.display = 'none';
    return;
  }

  paginationSection.style.display = 'flex';
  
  if (pageSize === 'all' || totalPages <= 1) {
    paginationInfo.innerHTML = `Showing all <strong>${totalItems}</strong> recipes`;
    btnPageFirst.disabled = true;
    btnPagePrev.disabled = true;
    btnPageNext.disabled = true;
    btnPageLast.disabled = true;
    paginationPages.innerHTML = `<button class="btn-page active">1</button>`;
    return;
  }

  paginationInfo.innerHTML = `Showing <strong>${startIndex + 1}–${endIndex}</strong> of <strong>${totalItems}</strong> recipes`;
  btnPageFirst.disabled = (currentPage === 1);
  btnPagePrev.disabled = (currentPage === 1);
  btnPageNext.disabled = (currentPage === totalPages);
  btnPageLast.disabled = (currentPage === totalPages);

  const range = getPaginationRange(currentPage, totalPages);
  let pagesHtml = '';
  range.forEach(p => {
    if (p === '...') {
      pagesHtml += `<span class="page-ellipsis">…</span>`;
    } else {
      const active = (p === currentPage) ? 'active' : '';
      pagesHtml += `<button class="btn-page ${active}" onclick="goToPage(${p})">${p}</button>`;
    }
  });
  paginationPages.innerHTML = pagesHtml;
}

function getPaginationRange(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

function goToPage(page) {
  const totalPages = getTotalPages();
  if (page < 1 || page > totalPages || page === currentPage) return;
  currentPage = page;
  renderRecipeGrid();
  
  // Smooth scroll up to recipe grid or controls
  const targetEl = document.querySelector('.controls-section') || recipesGrid;
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
window.goToPage = goToPage;

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
    const localizedCat = (typeof getLocalizedCategory === 'function') ? getLocalizedCategory(recipe.category, currentLanguage) : recipe.category;
    document.getElementById('modalRecipeTitle').textContent = recipe.title;
    document.getElementById('modalRecipeCuisine').textContent = recipe.cuisine ? `Cuisine / Style: ${recipe.cuisine}` : `Category: ${localizedCat}`;
    
    // Set Google Search Link for Recipe
    const googleSearchBtn = document.getElementById('btnGoogleSearchRecipe');
    if (googleSearchBtn) {
      googleSearchBtn.href = `https://www.google.com/search?q=${encodeURIComponent(recipe.title + ' recipe')}`;
      googleSearchBtn.title = `Search "${recipe.title}" on Google`;
    }

    document.getElementById('modalCategoryBadges').innerHTML = `
      <span class="badge badge-cat">${escapeHtml(localizedCat)}</span>
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
    const stageSummary = Object.entries(stages).map(([stg, cnt]) => {
      const locStg = (typeof getLocalizedStage === 'function') ? getLocalizedStage(stg, currentLanguage) : stg;
      return `<strong>${cnt}</strong> ${locStg}`;
    }).join(' • ');
    const dict = (typeof UI_TRANSLATIONS !== 'undefined' && UI_TRANSLATIONS[currentLanguage]) ? UI_TRANSLATIONS[currentLanguage] : {};
    heroIngBreakdown.innerHTML = stageSummary ? `${dict.breakdown || 'Breakdown:'} ${stageSummary}` : 'All ingredients categorized under Main.';

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
      instructionsContent.innerHTML = `<p style="color: var(--text-muted); font-style: italic;">${dict.no_instructions || 'No specific cooking instructions listed. Follow standard kitchen procedures.'}</p>`;
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
  const dict = (typeof UI_TRANSLATIONS !== 'undefined' && UI_TRANSLATIONS[currentLanguage]) ? UI_TRANSLATIONS[currentLanguage] : {};

  scaleFactorBanner.innerHTML = `${dict.multiplier || 'Multiplier:'} <strong>${scaleFactor.toFixed(2)}x</strong> (Target: ${roundNumber(targetYield, 2)} ${activeRecipe.yield_unit} ÷ Base: ${baseYield} ${activeRecipe.yield_unit})`;

  const ingredients = activeRecipe.ingredients || [];
  const rowsHtml = ingredients.map((ing, idx) => {
    const baseQty = ing.quantity !== undefined ? ing.quantity : 0;
    const scaledQty = baseQty * scaleFactor;
    const locStg = (typeof getLocalizedStage === 'function') ? getLocalizedStage(ing.stage || 'Main', currentLanguage) : (ing.stage || 'Main');
    
    return `
      <tr id="ingRow_${idx}">
        <td style="text-align: center;">
          <input type="checkbox" class="ing-prep-check" onchange="toggleRowCheck(${idx}, this.checked)" title="${dict.check_when_prepped || 'Check when prepped'}" />
        </td>
        <td><span class="ing-stage-tag">${escapeHtml(locStg)}</span></td>
        <td>
          <div class="ing-name-row">
            <span class="ing-name-label">${escapeHtml(ing.name)}</span>
            <a href="https://www.google.com/search?q=${encodeURIComponent(ing.name)}" target="_blank" rel="noopener noreferrer" class="ing-google-link" title="Google Search: ${escapeHtml(ing.name)}" onclick="event.stopPropagation()">
              <span>🔍 Search</span>
            </a>
          </div>
        </td>
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

// Modal control helpers
function closeRecipeModal() {
  recipeModalBackdrop.classList.remove('show');
  activeRecipe = null;
}

function resetFilters() {
  currentCategory = 'all';
  currentSearch = '';
  currentPage = 1;
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

// Language Support & Auto-Translation
function initLanguage() {
  const savedLang = localStorage.getItem('recipe_language') || 'en';
  currentLanguage = savedLang;
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.value = savedLang;
  }
  if (savedLang !== 'en') {
    applyDictionary(savedLang);
    document.cookie = `googtrans=/en/${savedLang}; path=/;`;
    document.cookie = `googtrans=/en/${savedLang}; domain=${window.location.hostname}; path=/;`;
    syncGoogleTranslate(savedLang);
  }
}

function changeLanguage(langCode) {
  currentLanguage = langCode;
  localStorage.setItem('recipe_language', langCode);

  // 1. Instant native dictionary UI update
  applyDictionary(langCode);

  // 2. Set / clear Google Translate cookie
  if (langCode === 'en') {
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=' + window.location.hostname + '; path=/;';
    document.cookie = 'googtrans=/en/en; path=/;';
  } else {
    document.cookie = `googtrans=/en/${langCode}; path=/;`;
    document.cookie = `googtrans=/en/${langCode}; domain=${window.location.hostname}; path=/;`;
  }

  // 3. Trigger Google Translate combo element
  syncGoogleTranslate(langCode);

  // 4. Re-render categories & recipe cards
  if (allCategoryObjects && allCategoryObjects.length > 0) {
    renderCategoryChips(allCategoryObjects);
  } else if (isOfflineMode) {
    initOfflineData();
  }

  if (isOfflineMode) {
    filterAndRenderOffline();
  } else {
    sortAndRenderRecipes();
  }

  // 5. If modal is open, re-render its localized parts
  if (activeRecipe) {
    const localizedCat = (typeof getLocalizedCategory === 'function') ? getLocalizedCategory(activeRecipe.category, currentLanguage) : activeRecipe.category;
    document.getElementById('modalRecipeCuisine').textContent = activeRecipe.cuisine ? `Cuisine / Style: ${activeRecipe.cuisine}` : `Category: ${localizedCat}`;
    document.getElementById('modalCategoryBadges').innerHTML = `
      <span class="badge badge-cat">${escapeHtml(localizedCat)}</span>
      ${activeRecipe.cuisine ? `<span class="badge badge-cuisine">${escapeHtml(activeRecipe.cuisine)}</span>` : ''}
    `;
    applyScaling(currentScaledYield || activeRecipe.base_yield || 100);
  }

  showToast(`Language set to ${getLanguageName(langCode)}`);
}

function getLanguageName(code) {
  const map = {
    en: 'English',
    hi: 'हिन्दी (Hindi)',
    bn: 'বাংলা (Bengali)',
    gu: 'ગુજરાતી (Gujarati)',
    mr: 'मराठी (Marathi)',
    ta: 'தமிழ் (Tamil)',
    te: 'తెలుగు (Telugu)',
    kn: 'ಕನ್ನಡ (Kannada)',
    pa: 'ਪੰਜਾਬੀ (Punjabi)',
    es: 'Español',
    fr: 'Français'
  };
  return map[code] || code;
}

function applyDictionary(lang) {
  if (typeof UI_TRANSLATIONS === 'undefined') return;
  const dict = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS['en'];

  // Update elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // Update elements with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) {
      el.placeholder = dict[key];
    }
  });
}

function syncGoogleTranslate(lang) {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    const teCombo = document.querySelector('.goog-te-combo');
    if (teCombo) {
      if (teCombo.value !== lang) {
        teCombo.value = (lang === 'en') ? 'en' : lang;
        teCombo.dispatchEvent(new Event('change'));
      }
      clearInterval(interval);
    } else if (attempts > 20) {
      clearInterval(interval);
    }
  }, 250);
}

// Dark / Light Theme Handling
function initTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('recipe_theme') || 'light';
  applyTheme(currentTheme);
}

function toggleTheme() {
  const isCurrentDark = document.documentElement.getAttribute('data-theme') === 'dark'
    || document.documentElement.classList.contains('dark')
    || (document.body && document.body.getAttribute('data-theme') === 'dark');
  const newTheme = isCurrentDark ? 'light' : 'dark';
  applyTheme(newTheme);
  try {
    localStorage.setItem('recipe_theme', newTheme);
  } catch (e) {
    console.warn('Could not save theme to localStorage:', e);
  }
  showToast(newTheme === 'dark' ? '🌙 Dark theme enabled' : '☀️ Light theme enabled');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  if (document.body) {
    document.body.setAttribute('data-theme', theme);
    document.body.classList.toggle('dark-theme', theme === 'dark');
  }
  const icon = document.getElementById('themeToggleIcon');
  if (icon) {
    icon.textContent = (theme === 'dark') ? '☀️' : '🌙';
  }
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.title = (theme === 'dark') ? 'Switch to Light Theme' : 'Switch to Dark Theme';
    btn.setAttribute('aria-label', (theme === 'dark') ? 'Switch to Light Theme' : 'Switch to Dark Theme');
  }
}

window.toggleTheme = toggleTheme;
window.applyTheme = applyTheme;
