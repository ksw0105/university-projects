const iconPaths = {
  fridge: '<rect x="6" y="3" width="12" height="17" rx="2"/><path d="M6 10h12M10 6v1m0 6v2M8 20v1m8-1v1"/>',
  utensils: '<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18m12 0V3c-3 2-5 5-5 10h5"/>',
  leaf: '<path d="M5 19C3 9 8 5 20 4c0 10-5 15-13 14m-3 3 10-10"/>',
  egg: '<path d="M20 14a8 8 0 0 1-16 0c0-5 4-11 8-11s8 6 8 11Z"/>',
  grain: '<path d="M3 12h18a9 9 0 0 1-18 0Zm6 8h6M8 8c2-1-1-2 1-4m4 4c2-1-1-2 1-4"/>',
  jar: '<path d="M7 3h10v4H7zM8 7l-2 3v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-9l-2-3M6 13h12"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6 6-6-6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5m10.5 0a7.5 7.5 0 0 0-13-5m-2 5a7.5 7.5 0 0 0 13 5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
};
const icon = (name, size = 19) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;

const app = document.querySelector('#app');
const sheet = document.querySelector('#deduct');
const toast = document.querySelector('.toast');
const fridgeKey = 'kitchen-glance-fridge';
const refreshKey = 'kitchen-glance-refresh';
const namePattern = /^[가-힣]+(?: [가-힣]+)*$/;
let {owned, custom} = readFridge();
let category = 'all';
let query = '';
let offset = 0;
let toastTimer;
const refreshLimit = 5;
const pageSize = 3;
const refreshEnd = '추천 가능한 메뉴를 모두 확인했어요. 재료를 추가해 보세요';
const emptyFridge = '최소 1개 이상의 식재료를 선택해 주세요';
const initials = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

document.querySelectorAll('[data-icon]').forEach(node => {
  node.innerHTML = icon(node.dataset.icon, 17);
});

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function nameKey(name) {
  return name.replace(/ /g, '');
}

function validName(name) {
  return typeof name === 'string' && namePattern.test(name) && nameKey(name).length <= 10;
}

function customId(name) {
  return `custom-${nameKey(name)}`;
}

function readFridge() {
  const stored = readStorage(fridgeKey, []);
  const names = Array.isArray(stored.custom) ? stored.custom.filter(validName) : [];
  const custom = new Map(names.map(name => [customId(name), {name, emoji:'🧺'}]));
  const ids = Array.isArray(stored) ? stored : stored.owned;
  const available = Array.isArray(ids)
    ? ids.filter(id => typeof id === 'string' && (Object.hasOwn(ingredients, id) || custom.has(id))) : [];
  return {owned: new Set([...new Set(available)].slice(0, 30)), custom};
}

function saveFridge(next) {
  try {
    const names = [...next.custom.values()].map(item => item.name);
    localStorage.setItem(fridgeKey, JSON.stringify({owned: [...next.owned], custom: names}));
    ({owned, custom} = next);
    offset = 0;
    return true;
  } catch {
    return false;
  }
}

function ingredientInfo(id) {
  return custom.get(id) ?? ingredients[id];
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => {
    toast.classList.remove('visible');
    toast.textContent = '';
  }, 2000);
}

function symbol(id) {
  return `<span class="emoji" aria-hidden="true">${ingredientInfo(id).emoji}</span>`;
}

function chip(id) {
  return `<button type="button" class="chip" data-ingredient="${id}" aria-pressed="${owned.has(id)}">${symbol(id)}${ingredientInfo(id).name}<span class="check">${icon('check', 14)}</span></button>`;
}

function renderFridge() {
  app.innerHTML = `
    <section class="hero" aria-labelledby="fridge-title">
      <div class="hero-copy">
        <div class="kicker">${icon('fridge', 17)} 내 냉장고</div>
        <h1 id="fridge-title" tabindex="-1">지훈님, 지금 냉장고에<br>있는 재료를 골라주세요</h1>
        <p>보유한 재료를 선택하면 오늘의 저녁 메뉴를 찾아드려요.</p>
      </div>
    </section>
    <div class="workspace">
      <section class="panel catalog" aria-labelledby="catalog-title">
        <div class="panel-heading">
          <div><h2 id="catalog-title">식재료 선택</h2><p>재료를 눌러 냉장고에 담거나 빼세요.</p></div>
          <span class="count" id="selection-count"></span>
        </div>
        <div class="catalog-tools">
          <div class="search-box">
            ${icon('search', 19)}
            <input id="search" type="text" inputmode="text" autocomplete="off" spellcheck="false" aria-label="식재료 검색" aria-describedby="search-error" placeholder="재료명 또는 초성 검색">
            <button type="button" data-action="clear" aria-label="검색어 지우기" hidden>${icon('close', 17)}</button>
          </div>
          <button type="button" class="secondary add-toggle" data-action="add" aria-controls="ingredient-form" aria-expanded="false">${icon('plus', 16)} 재료 추가</button>
        </div>
        <p id="search-error" class="field-error" role="alert" hidden>한글 10자 이내로 입력해 주세요</p>
        <form id="ingredient-form" class="ingredient-form" hidden>
          <label for="ingredient-name">새 식재료 이름</label>
          <div class="catalog-tools">
            <div class="search-box">
              <input id="ingredient-name" name="ingredient" type="text" autocomplete="off" placeholder="예: 브로콜리" aria-describedby="add-error">
            </div>
            <button type="submit" class="primary add-submit">냉장고에 담기</button>
          </div>
          <p id="add-error" class="field-error" role="alert" hidden></p>
        </form>
        <div class="filters" role="group" aria-label="식재료 카테고리">
        </div>
        <div id="catalog-items"></div>
      </section>
      <aside class="panel summary" aria-labelledby="summary-title">
        <div class="summary-heading">
          <span class="summary-icon">${icon('fridge', 21)}</span>
          <div><h2 id="summary-title">냉장고에 담은 재료</h2><p class="summary-help">최대 30개까지 선택할 수 있어요.</p></div>
        </div>
        <div id="summary-items" class="summary-body"></div>
        <div class="cta-wrap">
          <button type="button" class="primary recommend-cta" data-action="recommend">
            <span>오늘 저녁 메뉴 추천받기 <small id="cta-count"></small></span>${icon('arrow')}
          </button>
        </div>
        <p class="save-note">${icon('check', 14)} 이 브라우저에 자동 저장돼요</p>
      </aside>
    </div>`;
  document.querySelector('#search').value = query;
  document.querySelector('[data-action="clear"]').hidden = !query;
  renderFilters();
  renderCatalog();
  updateFridge();
}

function matches(name) {
  if (!query) return true;
  const pattern = [...query].map(char => {
    if (!initials.includes(char)) return char;
    const start = 0xac00 + initials.indexOf(char) * 588;
    return `[${String.fromCharCode(start)}-${String.fromCharCode(start + 587)}]`;
  }).join('');
  return new RegExp(pattern).test(nameKey(name));
}

function catalogGroups() {
  if (!custom.size) return groups;
  const items = [...custom].map(([id, item]) => [id, item.name]);
  return [['custom', '직접 추가', 'plus', items], ...groups];
}

function renderFilters() {
  document.querySelector('.filters').innerHTML = [['all', '전체'], ...catalogGroups()].map(([id, name]) =>
    `<button type="button" data-category="${id}" aria-pressed="${id === category}">${name}</button>`).join('');
}

function renderCatalog() {
  const content = catalogGroups().filter(([id]) => category === 'all' || id === category)
    .map(([id, label, glyph, items]) => {
      const found = items.filter(([, name]) => matches(name));
      if (!found.length) return '';
      return `<section class="category" data-group="${id}"><h3><span class="category-icon">${icon(glyph, 17)}</span>${label}</h3>
        <div class="chips">${found.map(([item]) => chip(item)).join('')}</div></section>`;
    }).join('');
  document.querySelector('#catalog-items').innerHTML = content ||
    '<p class="empty-search" role="status">일치하는 식재료가 없어요. 재료 추가를 눌러 직접 등록할 수 있어요.</p>';
}

function updateFridge() {
  document.querySelectorAll('[data-ingredient]').forEach(button => {
    button.setAttribute('aria-pressed', owned.has(button.dataset.ingredient));
  });
  document.querySelector('#selection-count').textContent = `${owned.size} / 30개`;
  document.querySelector('#cta-count').textContent = `${owned.size}개 선택됨`;
  document.querySelector('#summary-items').innerHTML = owned.size
    ? `<div class="summary-items">${[...owned].map(id => {
      const {name} = ingredientInfo(id);
      return `<button type="button" class="summary-chip" data-remove="${id}" aria-label="${name} 제거">${symbol(id)}${name}${icon('close', 12)}</button>`;
    }).join('')}</div>`
    : `<div class="summary-empty">${icon('fridge', 27)}<span>아직 선택한 재료가 없어요.</span></div>`;
}

function toggleIngredient(id, fromSummary) {
  const next = readFridge();
  if (next.owned.has(id)) {
    next.owned.delete(id);
  } else if (next.owned.size === 30) {
    showToast('식재료는 최대 30개까지 선택할 수 있어요');
    return;
  } else {
    next.owned.add(id);
  }
  if (!saveFridge(next)) {
    showToast('재료 상태를 저장하지 못했어요. 다시 한번 눌러주세요');
    return;
  }
  updateFridge();
  if (fromSummary) {
    (document.querySelector('[data-remove]') || document.querySelector('[data-action="recommend"]')).focus();
  }
}

function showAddError(message) {
  const error = document.querySelector('#add-error');
  const input = document.querySelector('#ingredient-name');
  error.textContent = message;
  error.hidden = !message;
  input.setAttribute('aria-invalid', Boolean(message));
}

function toggleAddForm(button) {
  const form = document.querySelector('#ingredient-form');
  form.hidden = !form.hidden;
  button.setAttribute('aria-expanded', !form.hidden);
  if (!form.hidden) {
    const input = form.elements.ingredient;
    if (!input.value && validName(query)) input.value = query;
    input.focus();
  }
}

function addIngredient(input) {
  const name = input.value.normalize('NFC').trim().replace(/ +/g, ' ');
  if (!validName(name)) {
    showAddError('재료 이름을 한글 10자 이내로 입력해 주세요.');
    input.focus();
    return;
  }
  const next = readFridge();
  const existing = Object.values(ingredients).find(item => nameKey(item.name) === nameKey(name));
  const id = existing?.id ?? customId(name);
  if (next.owned.has(id)) {
    showAddError('이미 냉장고에 담긴 재료예요.');
    return;
  }
  if (next.owned.size === 30) {
    showAddError('재료를 추가하려면 냉장고에서 재료를 하나 빼주세요.');
    return;
  }
  if (!existing && !next.custom.has(id)) next.custom.set(id, {name, emoji:'🧺'});
  next.owned.add(id);
  if (!saveFridge(next)) {
    showAddError('재료를 저장하지 못했어요. 다시 한번 눌러주세요.');
    return;
  }
  query = '';
  category = existing ? 'all' : 'custom';
  renderFridge();
  document.querySelector('[data-action="add"]').focus();
  showToast(`${ingredientInfo(id).name} 재료를 냉장고에 담았어요`);
}

function rank() {
  if (!owned.size) return [];
  return recipes.map(recipe => {
    const ids = Object.keys(recipe.needs);
    const have = ids.filter(id => owned.has(id));
    const missing = ids.filter(id => !owned.has(id));
    return {recipe, have, missing, score: have.length / ids.length};
  }).filter(item => item.have.length && item.missing.length <= 2)
    .sort((a, b) => b.score - a.score || a.missing.length - b.missing.length || a.recipe.minutes - b.recipe.minutes);
}

function refreshState() {
  const date = new Date();
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const stored = readStorage(refreshKey, {});
  const count = stored.day === day && Number.isInteger(stored.count) ? Math.max(0, Math.min(refreshLimit, stored.count)) : 0;
  return {day, count};
}

function card({recipe, have, missing}) {
  return `<a class="panel card" href="#recipe/${recipe.id}">
    <div class="card-image">
      <img src="assets/${recipe.id}.webp" alt="">
      <span class="status ${missing.length ? 'partial' : ''}">${missing.length ? `재료 ${missing.length}개만 더 있으면 완성` : '바로 조리 가능'}</span>
      <span class="time">${icon('clock', 13)}${recipe.minutes}분</span>
    </div>
    <div class="card-content">
      <div class="card-head"><h2>${recipe.name}</h2><span class="card-arrow">${icon('arrow', 17)}</span></div>
      <p class="card-meta">${recipe.minutes}분 · 난이도 쉬움</p>
      <p class="card-copy">${recipe.description}</p>
      ${have.length ? `<div class="card-items" aria-label="보유 재료">${have.map(id => `<span>${ingredients[id].name}</span>`).join('')}</div>` : ''}
      ${missing.length ? `<span class="missing-badge">부족: ${missing.map(id => ingredients[id].name).join(', ')}</span>` : ''}
    </div></a>`;
}

function renderResults() {
  const ranked = rank();
  if (offset >= ranked.length) offset = 0;
  const visible = ranked.slice(offset, offset + pageSize);
  const remaining = refreshLimit - refreshState().count;
  const blocked = remaining === 0 || offset + pageSize >= ranked.length;
  const title = visible.some(item => !item.missing.length)
    ? '지금 바로 만들 수 있는 저녁 메뉴예요!'
    : '재료만 조금 더 있으면 만들 수 있어요!';
  const emptyCopy = owned.size
    ? '부족한 재료가 2개 이하인 메뉴가 없어요. 냉장고에 있는 재료를 더 담아보세요.'
    : '냉장고에 있는 재료를 먼저 선택해 주세요.';
  app.innerHTML = `<a class="back" href="#fridge">${icon('back', 17)} 내 냉장고</a>
    <header class="route-head">
      <div class="kicker">${icon('utensils', 17)} 오늘의 메뉴 추천</div>
      <h1 tabindex="-1">${visible.length ? title : '오늘의 저녁 메뉴를 찾아볼까요?'}</h1>
      <p>${visible.length ? `냉장고 재료 ${owned.size}개를 기준으로 고른 메뉴 ${visible.length}개예요.` : '냉장고에 있는 재료를 담으면 만들 수 있는 메뉴를 찾아드려요.'}</p>
    </header>
    ${visible.length ? `<div class="cards">${visible.map(card).join('')}</div>
      <div class="result-action"><button type="button" class="secondary" data-action="refresh" aria-disabled="${blocked}">
        ${icon('refresh', 18)} 다른 메뉴 3개 더 보기 (남은 횟수 ${remaining}/5)</button></div>`
      : `<div class="panel empty-result"><h2>추천할 메뉴가 아직 없어요</h2><p>${emptyCopy}</p><a class="primary" href="#fridge">식재료 선택하기</a></div>`}`;
}

function moreResults() {
  const usage = refreshState();
  if (usage.count >= refreshLimit || offset + pageSize >= rank().length) {
    showToast(refreshEnd);
    return;
  }
  try {
    localStorage.setItem(refreshKey, JSON.stringify({...usage, count: usage.count + 1}));
  } catch {
    showToast('새로고침 횟수를 저장하지 못했어요. 다시 시도해 주세요');
    return;
  }
  offset += pageSize;
  renderResults();
  app.querySelector('h1').focus({preventScroll:true});
  window.scrollTo(0, 0);
  if (usage.count + 1 === refreshLimit) showToast(refreshEnd);
}

function renderRecipe(recipe) {
  const backLink = `<a class="back" href="#recommend">${icon('back', 17)} 메뉴 추천으로 돌아가기</a>`;
  if (!recipe) {
    app.innerHTML = `${backLink}<div class="panel empty-result"><h1 tabindex="-1">레시피 정보를 불러오는 중 문제가 발생했어요</h1><p>추천 화면에서 다른 메뉴를 골라보세요.</p><a class="primary" href="#recommend">이전 화면으로 돌아가기</a></div>`;
    return;
  }
  app.innerHTML = `<article class="detail">
    ${backLink}
    <header class="panel detail-hero">
      <img class="detail-image" src="assets/${recipe.id}.webp" alt="${recipe.name}">
      <div class="detail-heading"><h1 tabindex="-1">${recipe.name}</h1>
        <p>${icon('clock', 16)} 조리시간 ${recipe.minutes}분 · 난이도 쉬움</p><p>${recipe.description}</p>
      </div>
    </header>
    <div class="detail-columns">
      <section class="panel detail-section"><h2>필요한 식재료 · 1인분</h2><ul>
        ${Object.entries(recipe.needs).map(([id, amount]) =>
          `<li class="need">${symbol(id)}<span>${ingredients[id].name} ${amount}</span>
          ${owned.has(id) ? '<strong>보유</strong>' : '<strong class="missing">부족</strong>'}</li>`).join('')}
      </ul></section>
      <section class="panel detail-section"><h2>조리 순서</h2><ol>
        ${recipe.steps.map(([label, copy], i) => `<li class="step"><span class="step-number" aria-hidden="true">${i+1}</span>
          <div><strong>${label}</strong><p>${copy}</p></div></li>`).join('')}
      </ol></section>
    </div>
    <div class="detail-action"><button type="button" class="primary" data-action="complete" data-recipe="${recipe.id}">
      ${icon('check')} 요리 완료! 사용한 재료 정리하기</button></div>
    </article>`;
}

function openSheet(recipe) {
  const used = Object.keys(recipe.needs).filter(id => owned.has(id));
  sheet.innerHTML = `<div class="handle" aria-hidden="true"></div>
    <h2 id="sheet-title">맛있게 드셨나요?</h2>
    <p class="sheet-copy">다 써서 없어진 재료를 체크해 주세요.</p>
    <p class="sheet-error" role="alert" hidden>재료 상태를 저장하지 못했어요. 다시 한번 눌러주세요</p>
    ${used.length ? used.map(id => `<label class="sheet-row">
      <input type="checkbox" value="${id}">${symbol(id)}
      <span><strong>${ingredients[id].name}</strong><small>냉장고에 보관 유지</small></span>
    </label>`).join('') : '<p class="sheet-copy">냉장고에서 차감할 재료가 없어요.</p>'}
    <p class="sheet-tip">실수로 차감해도 내 냉장고에서 다시 등록할 수 있어요.</p>
    <div class="sheet-actions">
      <button type="button" class="secondary" data-action="keep">그대로 유지</button>
      <button type="button" class="primary" data-action="deduct">${icon('trash', 17)} <span>차감 완료 (0개 비우기)</span></button>
    </div>`;
  sheet.showModal();
}

function finishCooking(remove) {
  const checked = [...sheet.querySelectorAll('input:checked')];
  if (remove && checked.length) {
    const next = readFridge();
    checked.forEach(input => next.owned.delete(input.value));
    if (!saveFridge(next)) {
      sheet.querySelector('.sheet-error').hidden = false;
      return;
    }
    showToast(`소진된 재료 ${checked.length}개를 냉장고에서 뺐어요`);
  } else if (remove) {
    showToast('소진된 재료가 없어 기존 냉장고 상태를 그대로 유지합니다');
  }
  sheet.close();
  category = 'all';
  query = '';
  location.hash = 'fridge';
}

function renderRoute(focus = false) {
  if (sheet.open) sheet.close();
  const route = location.hash.slice(1);
  const recipeRoute = route.startsWith('recipe/');
  const page = route === 'recommend' || recipeRoute ? 'recommend' : 'fridge';
  const recipe = recipeRoute && recipes.find(item => item.id === route.slice(7));
  if (recipeRoute) renderRecipe(recipe);
  else if (page === 'recommend') renderResults();
  else renderFridge();
  document.title = `Kitchen Glance · ${recipe?.name || (page === 'recommend' ? '메뉴 추천' : '내 냉장고')}`;
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (focus) {
    app.querySelector('h1')?.focus({preventScroll:true});
    window.scrollTo(0, 0);
  }
}

function updateQuery(input) {
  const raw = input.value.normalize('NFC');
  const clean = raw.replace(/[^가-힣ㄱ-ㅎ]/g, '').slice(0, 10);
  const invalid = raw.replace(/\s/g, '') !== clean;
  input.value = clean;
  input.setAttribute('aria-invalid', invalid);
  document.querySelector('#search-error').hidden = !invalid;
  document.querySelector('[data-action="clear"]').hidden = !clean;
  query = clean;
  renderCatalog();
}

app.addEventListener('input', event => {
  if (event.target.id === 'search' && !event.isComposing) updateQuery(event.target);
  if (event.target.id === 'ingredient-name') showAddError('');
});
app.addEventListener('compositionend', event => {
  if (event.target.id === 'search') updateQuery(event.target);
});
app.addEventListener('submit', event => {
  if (event.target.id !== 'ingredient-form') return;
  event.preventDefault();
  addIngredient(event.target.elements.ingredient);
});

app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const {action, ingredient, remove, category: filter, recipe} = button.dataset;
  if (ingredient || remove) toggleIngredient(ingredient || remove, Boolean(remove));
  if (filter) {
    category = filter;
    app.querySelectorAll('[data-category]').forEach(item => item.setAttribute('aria-pressed', item === button));
    renderCatalog();
  }
  if (action === 'clear') {
    const input = document.querySelector('#search');
    input.value = '';
    updateQuery(input);
    input.focus();
  }
  if (action === 'add') toggleAddForm(button);
  if (action === 'recommend') {
    if (!owned.size) showToast(emptyFridge);
    else {
      offset = 0;
      location.hash = 'recommend';
    }
  }
  if (action === 'refresh') moreResults();
  if (action === 'complete') openSheet(recipes.find(item => item.id === recipe));
});

sheet.addEventListener('change', event => {
  if (event.target.type !== 'checkbox') return;
  event.target.closest('.sheet-row').querySelector('small').textContent = event.target.checked
    ? '소진됨 · 냉장고에서 제거 예정' : '냉장고에 보관 유지';
  const count = sheet.querySelectorAll('input:checked').length;
  sheet.querySelector('[data-action="deduct"] span').textContent = `차감 완료 (${count}개 비우기)`;
});
sheet.addEventListener('click', event => {
  const action = event.target.closest('button')?.dataset.action;
  if (action) finishCooking(action === 'deduct');
});

window.addEventListener('hashchange', () => renderRoute(true));
window.addEventListener('storage', event => {
  if (event.key === fridgeKey || event.key === null) {
    ({owned, custom} = readFridge());
    offset = 0;
    if (document.querySelector('#summary-items')) {
      if (!custom.size && category === 'custom') category = 'all';
      renderFilters();
      renderCatalog();
      updateFridge();
    } else renderRoute();
  }
});
renderRoute();
