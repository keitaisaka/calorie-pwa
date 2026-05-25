// ==========================================================
// PFC 管理 PWA — 入力 / グラフ / 設定
// 保存は localStorage が一次ソース。GAS URL があれば同期。
// ==========================================================

const STORAGE_KEYS = {
  meals:    'cal_meals',
  weights:  'cal_weights',
  exercises:'cal_exercises',
  presets:  'cal_presets',
  targets:  'cal_targets',
  gasUrl:   'cal_gas_url',
  gasToken: 'cal_gas_token',
  pendingSync: 'cal_pending_sync',
};

const DEFAULT_TARGETS = {
  daily_kcal:    2000,
  daily_protein: 120,
  daily_fat:     55,
};

const MEAL_LABELS = {
  breakfast: '朝食',
  lunch:     '昼食',
  dinner:    '夕食',
  snack:     '間食',
};
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

// ---- 状態 ----
const state = {
  meals:     [],
  weights:   [],
  exercises: [],
  presets:   [],
  targets: { ...DEFAULT_TARGETS },
  gasUrl:  '',
  gasToken: '',
  viewDate: null,        // 'YYYY-MM-DD'
  calMonth: null,        // 'YYYY-MM'
  activeTab: 'entry',    // entry/calendar/settings
  meal: {
    editingId: null,
    meal: 'breakfast',
  },
  exercise: {
    editingId: null,
  },
  preset: {
    editingId: null,
  },
};

// ---- 永続化 ----
const loadErrors = [];
function safeParse(key, fallback, validator) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (validator && !validator(parsed)) {
      loadErrors.push(key);
      return fallback;
    }
    return parsed;
  } catch {
    loadErrors.push(key);
    return fallback;
  }
}
const isArray = v => Array.isArray(v);
const isObject = v => v && typeof v === 'object' && !Array.isArray(v);

function load() {
  const rawMeals = safeParse(STORAGE_KEYS.meals, [], isArray);
  state.meals = rawMeals
    .filter(m => m && m.id != null)
    .map(m => ({
      id: m.id,
      ts: Number(m.ts) || Date.now(),
      date: m.date || ymd(new Date(Number(m.ts) || Date.now())),
      meal: MEAL_ORDER.includes(m.meal) ? m.meal : 'snack',
      note: m.note || '',
      protein: Number(m.protein) || 0,
      fat:     Number(m.fat) || 0,
      carb:    Number(m.carb) || 0,
      kcal:    Number(m.kcal) || 0,
    }));

  const rawWeights = safeParse(STORAGE_KEYS.weights, [], isArray);
  state.weights = rawWeights
    .filter(w => w && w.id != null)
    .map(w => ({
      id: w.id,
      ts: Number(w.ts) || Date.now(),
      date: w.date || ymd(new Date(Number(w.ts) || Date.now())),
      weight:  w.weight  != null && w.weight  !== '' ? Number(w.weight)  : null,
      muscle:  w.muscle  != null && w.muscle  !== '' ? Number(w.muscle)  : null,
      bodyFat: w.bodyFat != null && w.bodyFat !== '' ? Number(w.bodyFat) : null,
    }));

  const rawEx = safeParse(STORAGE_KEYS.exercises, [], isArray);
  state.exercises = rawEx
    .filter(e => e && e.id != null)
    .map(e => ({
      id: e.id,
      ts: Number(e.ts) || Date.now(),
      date: e.date || ymd(new Date(Number(e.ts) || Date.now())),
      name: e.name || '',
      duration: e.duration != null && e.duration !== '' ? Number(e.duration) : null,
      kcal: Number(e.kcal) || 0,
    }));

  const rawPresets = safeParse(STORAGE_KEYS.presets, [], isArray);
  state.presets = rawPresets
    .filter(p => p && p.id != null)
    .map(p => ({
      id: p.id,
      name:    p.name || '',
      protein: Number(p.protein) || 0,
      fat:     Number(p.fat) || 0,
      carb:    Number(p.carb) || 0,
      kcal:    Number(p.kcal) || 0,
    }));

  const t = safeParse(STORAGE_KEYS.targets, null, isObject);
  state.targets = { ...DEFAULT_TARGETS, ...(t || {}) };

  state.gasUrl = localStorage.getItem(STORAGE_KEYS.gasUrl) || '';
  state.gasToken = localStorage.getItem(STORAGE_KEYS.gasToken) || '';
  state.viewDate = ymd(today());
  const now = today();
  state.calMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function persist() {
  localStorage.setItem(STORAGE_KEYS.meals, JSON.stringify(state.meals));
  localStorage.setItem(STORAGE_KEYS.weights, JSON.stringify(state.weights));
  localStorage.setItem(STORAGE_KEYS.exercises, JSON.stringify(state.exercises));
  localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(state.presets));
  localStorage.setItem(STORAGE_KEYS.targets, JSON.stringify(state.targets));
  localStorage.setItem(STORAGE_KEYS.gasUrl, state.gasUrl);
  localStorage.setItem(STORAGE_KEYS.gasToken, state.gasToken);
}

// ---- 日付ユーティリティ ----
const today = () => new Date();
function ymd(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function ymdToDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function shiftDate(ymdStr, deltaDays) {
  const d = ymdToDate(ymdStr);
  d.setDate(d.getDate() + deltaDays);
  return ymd(d);
}
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
function dateLabel(ymdStr) {
  const d = ymdToDate(ymdStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${WEEKDAYS[d.getDay()]})`;
}
// 月曜開始の週
function startOfWeek(ymdStr) {
  const d = ymdToDate(ymdStr);
  const day = d.getDay();              // 0=Sun ... 6=Sat
  const offset = day === 0 ? -6 : 1 - day;  // 月曜まで戻す
  d.setDate(d.getDate() + offset);
  return ymd(d);
}
function endOfWeek(ymdStr) {
  return shiftDate(startOfWeek(ymdStr), 6);
}
function shortDate(ymdStr) {
  const d = ymdToDate(ymdStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
const fmt = n => {
  const r = Math.round(n * 10) / 10;
  return (Number.isInteger(r) ? r.toString() : r.toFixed(1));
};
const fmtInt = n => Math.round(n).toLocaleString('ja-JP');

// kcal 自動計算（炭水化物は管理外。Pは4、Fは9で概算）
function calcKcal(p, f) {
  return Math.round((Number(p) || 0) * 4 + (Number(f) || 0) * 9);
}

// ---- 集計 ----
function mealsOnDate(ymdStr) {
  return state.meals.filter(m => m.date === ymdStr);
}
function mealsInRange(startYmd, endYmd) {
  return state.meals.filter(m => m.date >= startYmd && m.date <= endYmd);
}
function exercisesOnDate(ymdStr) {
  return state.exercises.filter(e => e.date === ymdStr);
}
function exercisesInRange(startYmd, endYmd) {
  return state.exercises.filter(e => e.date >= startYmd && e.date <= endYmd);
}
function weightsInRange(startYmd, endYmd) {
  return state.weights.filter(w => w.date >= startYmd && w.date <= endYmd);
}
function weightOnOrBefore(ymdStr) {
  const list = state.weights.filter(w => w.date <= ymdStr).sort((a, b) => (a.date + a.ts).localeCompare(b.date + b.ts));
  return list[list.length - 1] || null;
}
function sumPFC(meals) {
  return meals.reduce((acc, m) => ({
    kcal:    acc.kcal    + (m.kcal    || 0),
    protein: acc.protein + (m.protein || 0),
    fat:     acc.fat     + (m.fat     || 0),
  }), { kcal: 0, protein: 0, fat: 0 });
}
function sumBurn(exs) {
  return exs.reduce((s, e) => s + (e.kcal || 0), 0);
}

// ==========================================================
// レンダリング
// ==========================================================

function renderAll() {
  document.getElementById('dayNavLabel').textContent = dateLabel(state.viewDate);
  if (state.activeTab === 'entry') renderEntry();
  if (state.activeTab === 'calendar') renderCalendar();
  if (state.activeTab === 'settings') renderSettings();
}

// ---- 入力タブ ----
function renderEntry() {
  renderDailySummary();
  renderWeeklySummary();
  renderMealSections();
  renderExerciseSections();
}

function renderDailySummary() {
  const root = document.getElementById('dailySummary');
  const totals = sumPFC(mealsOnDate(state.viewDate));
  const burn = sumBurn(exercisesOnDate(state.viewDate));
  const t = state.targets;

  // 実質摂取 = 摂取 - 消費
  const netKcal = totals.kcal - burn;

  const intakeSub = burn > 0
    ? `摂取 ${fmtInt(totals.kcal)} − 消費 ${fmtInt(burn)} = ${fmtInt(netKcal)} kcal`
    : `摂取 ${fmtInt(totals.kcal)} kcal`;

  root.innerHTML = `
    <div class="summary-card-head">
      <span class="summary-card-title">今日の残り</span>
      <span class="summary-card-sub">${intakeSub}</span>
    </div>
    ${progressRow('カロリー',   'kcal', netKcal,        t.daily_kcal,    'kcal', 'cap')}
    ${progressRow('たんぱく質', 'p',    totals.protein, t.daily_protein, 'g',    'min')}
    ${progressRow('脂質',       'f',    totals.fat,     t.daily_fat,     'g',    'cap')}
    ${renderEvenBanner(netKcal, burn, t.daily_kcal)}
  `;
}

// 進捗行（バー付き）
// mode: 'cap' = 上限（少ない方が良い）、'min' = 最低必達
function progressRow(label, cls, consumed, target, unit, mode) {
  if (!target) {
    return `
      <div class="summary-row">
        <span class="summary-row-label ${cls}">${label}</span>
        <div class="summary-bar"><div class="summary-bar-fill ${cls}" style="width:0%"></div></div>
        <span class="summary-row-value muted">—</span>
      </div>
    `;
  }
  const pct = (consumed / target) * 100;
  const fmtVal = v => unit === 'kcal' ? fmtInt(v) : fmt(v) + unit;
  let valueHtml, valueCls = '', over = false;
  if (mode === 'cap') {
    const remain = target - consumed;
    if (remain >= 0) {
      valueHtml = `あと ${fmtVal(remain)}`;
      valueCls = remain < target * 0.2 ? 'warn' : '';
    } else {
      valueHtml = `超過 +${fmtVal(-remain)}`;
      valueCls = 'negative';
      over = true;
    }
  } else {
    const remain = target - consumed;
    if (remain > 0) {
      valueHtml = `あと ${fmtVal(remain)}`;
      valueCls = 'warn';
    } else {
      valueHtml = `達成 +${fmtVal(-remain)}`;
      valueCls = 'pos';
    }
  }
  return `
    <div class="summary-row">
      <span class="summary-row-label ${cls}">${label}</span>
      <div class="summary-bar"><div class="summary-bar-fill ${cls}${over ? ' over' : ''}" style="width:${Math.min(100, Math.max(0, pct))}%"></div></div>
      <span class="summary-row-value ${valueCls}">${valueHtml}<span class="summary-row-sub">/ ${fmtVal(target)} (${pct.toFixed(0)}%)</span></span>
    </div>
  `;
}

// 「目標達成までの追加運動 kcal」バナー
// netKcal: 実質摂取（摂取 − 消費）
// burn:    既に消費した運動 kcal
// goal:    1日上限。未設定なら表示しない
function renderEvenBanner(netKcal, burn, goal) {
  if (!goal) return '';
  const over = netKcal - goal;
  if (over > 0) {
    return `
      <div class="summary-cta cta-warn">
        <span class="cta-text">あと <b>${fmtInt(over)}</b> kcal 消費で目標達成</span>
      </div>
    `;
  }
  return `
    <div class="summary-cta cta-pos">
      <span class="cta-text">目標内に収まっています（残り <b>${fmtInt(-over)}</b> kcal）</span>
    </div>
  `;
}

function renderWeeklySummary() {
  const root = document.getElementById('weeklySummary');
  const ws = startOfWeek(state.viewDate);
  const we = endOfWeek(state.viewDate);
  const totals = sumPFC(mealsInRange(ws, we));
  const burn = sumBurn(exercisesInRange(ws, we));
  const t = state.targets;

  const netKcal = totals.kcal - burn;
  const recoveryHtml = buildRecoveryPlan(state.viewDate, ws, we, t.daily_kcal);
  root.innerHTML = `
    <div class="summary-card-head">
      <span class="summary-card-title">今週の進捗（${shortDate(ws)} – ${shortDate(we)}）</span>
      ${burn > 0 ? `<span class="summary-card-sub">消費 ${fmtInt(burn)} kcal</span>` : ''}
    </div>
    ${progressRow('カロリー',   'kcal', netKcal,        (t.daily_kcal    || 0) * 7, 'kcal', 'cap')}
    ${progressRow('たんぱく質', 'p',    totals.protein, (t.daily_protein || 0) * 7, 'g',    'min')}
    ${progressRow('脂質',       'f',    totals.fat,     (t.daily_fat     || 0) * 7, 'g',    'cap')}
    ${recoveryHtml}
  `;
}

// 「明日から残り N 日 / 1 日あたり M kcal 以内」のリカバリプランを返す
// 「今日まで」の実績を分子から引いた上で、明日以降の日数で割る
function buildRecoveryPlan(_viewDate, ws, we, dailyGoal) {
  if (!dailyGoal) return '';
  const todayYmd = ymd(today());
  if (todayYmd < ws || todayYmd > we) return '';

  const dayMs = 86400000;
  // 今日を含む「これまで」の実績
  const intakeSoFar = sumPFC(mealsInRange(ws, todayYmd)).kcal;
  const burnSoFar   = sumBurn(exercisesInRange(ws, todayYmd));
  const usedNet     = intakeSoFar - burnSoFar;

  // 残り = 明日 〜 週末
  const tomorrow = shiftDate(todayYmd, 1);
  const remainDays = Math.max(
    0,
    Math.round((ymdToDate(we).getTime() - ymdToDate(tomorrow).getTime()) / dayMs) + 1,
  );
  if (remainDays <= 0) return ''; // 今日が週末（we）なら表示しない

  const weekGoal     = dailyGoal * 7;
  const remainBudget = weekGoal - usedNet;

  if (remainBudget >= 0) {
    const perDay = remainBudget / remainDays;
    return `
      <div class="summary-cta cta-recovery">
        <span class="cta-text">明日から 1 日あたり <b>${fmtInt(perDay)}</b> kcal 以内で週目標達成</span>
      </div>
    `;
  }
  const overShoot = -remainBudget;
  return `
    <div class="summary-cta cta-warn">
      <span class="cta-text">既に週予算 <b>${fmtInt(overShoot)}</b> kcal 超過。1 日あたり <b>+${fmtInt(overShoot / remainDays)}</b> kcal の運動でリカバリ</span>
    </div>
  `;
}

function renderMealSections() {
  const root = document.getElementById('mealSections');
  root.innerHTML = '';
  const meals = mealsOnDate(state.viewDate);

  MEAL_ORDER.forEach(key => {
    const list = meals.filter(m => m.meal === key).sort((a, b) => a.ts - b.ts);
    const sub = sumPFC(list);

    const section = document.createElement('div');
    section.className = 'meal-section';
    const sumText = list.length === 0
      ? '0 kcal'
      : `${fmtInt(sub.kcal)} kcal ／ たんぱく質 ${fmt(sub.protein)}g・脂質 ${fmt(sub.fat)}g`;
    section.innerHTML = `
      <div class="meal-section-head">
        <span class="meal-section-title">${MEAL_LABELS[key]}</span>
        <span class="meal-section-sub">${sumText}</span>
      </div>
    `;

    list.forEach(m => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'meal-row';
      row.dataset.id = m.id;
      const noteHtml = m.note ? `<div class="meal-row-note">${escapeHtml(m.note)}</div>` : '';
      row.innerHTML = `
        <div class="meal-row-left">
          ${noteHtml}
          <div class="meal-row-pfc">
            <span class="p">たんぱく質 <b>${fmt(m.protein)}</b>g</span>
            <span class="f">脂質 <b>${fmt(m.fat)}</b>g</span>
          </div>
        </div>
        <div class="meal-row-kcal">${fmtInt(m.kcal)}<span class="meal-row-kcal-unit">kcal</span></div>
      `;
      row.addEventListener('click', () => openMealModal({ editingId: m.id }));
      section.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'meal-section-add';
    addBtn.textContent = `＋ ${MEAL_LABELS[key]}を追加`;
    addBtn.addEventListener('click', () => openMealModal({ meal: key }));
    section.appendChild(addBtn);

    root.appendChild(section);
  });
}

function renderExerciseSections() {
  const root = document.getElementById('exerciseSections');
  root.innerHTML = '';
  const list = exercisesOnDate(state.viewDate).slice().sort((a, b) => a.ts - b.ts);

  const section = document.createElement('div');
  section.className = 'meal-section';
  const sub = sumBurn(list);
  section.innerHTML = `
    <div class="meal-section-head">
      <span class="meal-section-title">運動の記録</span>
      <span class="meal-section-sub">${list.length === 0 ? '記録なし' : `合計 ${fmtInt(sub)} kcal`}</span>
    </div>
  `;

  list.forEach(e => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'meal-row';
    row.dataset.id = e.id;
    const nameHtml = e.name ? `<div class="meal-row-note">${escapeHtml(e.name)}</div>` : '';
    row.innerHTML = `
      <div class="meal-row-left">
        ${nameHtml}
      </div>
      <div class="meal-row-kcal">${fmtInt(e.kcal)}<span class="meal-row-kcal-unit">kcal</span></div>
    `;
    row.addEventListener('click', () => openExerciseModal({ editingId: e.id }));
    section.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'meal-section-add';
  addBtn.textContent = '＋ 運動を追加';
  addBtn.addEventListener('click', () => openExerciseModal({}));
  section.appendChild(addBtn);

  root.appendChild(section);
}

// （体組成タブは廃止）

// ==========================================================
// 入力モーダル（食事）
// ==========================================================
function openMealModal({ editingId = null, meal = 'breakfast' } = {}) {
  state.meal.editingId = editingId;
  let rec = null;
  if (editingId) {
    rec = state.meals.find(m => m.id === editingId);
    if (!rec) return;
  }
  state.meal.meal = rec ? rec.meal : meal;

  document.getElementById('mealModalTitle').textContent = rec ? '食事を編集' : '食事を追加';
  document.getElementById('mealModalBadge').textContent = MEAL_LABELS[state.meal.meal];
  document.getElementById('mealProtein').value = rec ? (rec.protein || '') : '';
  document.getElementById('mealFat').value     = rec ? (rec.fat     || '') : '';
  document.getElementById('mealKcal').value    = rec ? (rec.kcal    || '') : '';
  document.getElementById('deleteMealBtn').hidden = !rec;
  document.getElementById('saveMealBtn').textContent = rec ? '更新する' : '記録する';
  renderMealPresetChips();
  document.getElementById('mealModal').hidden = false;
}
function closeMealModal() {
  document.getElementById('mealModal').hidden = true;
  state.meal.editingId = null;
}
function renderMealPresetChips() {
  const root = document.getElementById('mealPresetChips');
  if (!root) return;
  root.innerHTML = '';
  if (state.presets.length === 0) {
    root.innerHTML = '<span class="preset-chips-empty">食事テンプレートを設定モードで登録するとここから呼び出せます</span>';
    return;
  }
  state.presets.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-chip';
    btn.innerHTML = `${escapeHtml(p.name || 'テンプレート')} <span class="preset-chip-kcal">${fmtInt(p.kcal)}kcal</span>`;
    btn.addEventListener('click', () => applyPresetToMealForm(p));
    root.appendChild(btn);
  });
}
function applyPresetToMealForm(p) {
  document.getElementById('mealProtein').value = p.protein || '';
  document.getElementById('mealFat').value     = p.fat || '';
  document.getElementById('mealKcal').value    = p.kcal || '';
}
function readMealForm() {
  const protein = Number(document.getElementById('mealProtein').value) || 0;
  const fat     = Number(document.getElementById('mealFat').value)     || 0;
  const kcalRaw = document.getElementById('mealKcal').value;
  const kcal = kcalRaw === '' ? calcKcal(protein, fat) : (Number(kcalRaw) || 0);
  return { note: '', protein, fat, carb: 0, kcal };
}
function saveMeal() {
  const data = readMealForm();
  if (data.kcal <= 0) {
    alert('カロリーを入力してください');
    return;
  }
  if (state.meal.editingId) {
    const idx = state.meals.findIndex(m => m.id === state.meal.editingId);
    if (idx < 0) { closeMealModal(); return; }
    const updated = { ...state.meals[idx], ...data, meal: state.meal.meal };
    state.meals[idx] = updated;
    persist();
    flashSync('更新しました');
    closeMealModal();
    renderAll();
    syncDelete('meal', updated.id)
      .then(() => syncAdd('meal', updated))
      .catch(() => queuePending('add_meal', updated));
    return;
  }
  const rec = {
    id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    ts: Date.now(),
    date: state.viewDate,
    meal: state.meal.meal,
    ...data,
  };
  state.meals.push(rec);
  persist();
  flashSync('記録しました');
  closeMealModal();
  renderAll();
  syncAdd('meal', rec).catch(() => queuePending('add_meal', rec));
}
function deleteMeal() {
  const id = state.meal.editingId;
  if (!id) return;
  if (!confirm('この記録を削除しますか？')) return;
  state.meals = state.meals.filter(m => m.id !== id);
  persist();
  flashSync('削除しました');
  closeMealModal();
  renderAll();
  syncDelete('meal', id).catch(() => {});
}

// ==========================================================
// 入力モーダル（運動）
// ==========================================================
function openExerciseModal({ editingId = null } = {}) {
  state.exercise.editingId = editingId;
  let rec = null;
  if (editingId) {
    rec = state.exercises.find(e => e.id === editingId);
    if (!rec) return;
  }
  document.getElementById('exerciseModalTitle').textContent = rec ? '運動を編集' : '運動を追加';
  document.getElementById('exerciseName').value     = rec ? rec.name : '';
  document.getElementById('exerciseKcal').value     = rec ? (rec.kcal || '') : '';
  document.getElementById('deleteExerciseBtn').hidden = !rec;
  document.getElementById('saveExerciseBtn').textContent = rec ? '更新する' : '記録する';
  document.getElementById('exerciseModal').hidden = false;
}
function closeExerciseModal() {
  document.getElementById('exerciseModal').hidden = true;
  state.exercise.editingId = null;
}
function readExerciseForm() {
  const name = document.getElementById('exerciseName').value.trim();
  const kcal = Number(document.getElementById('exerciseKcal').value) || 0;
  return { name, kcal };
}
function saveExercise() {
  const data = readExerciseForm();
  if (data.kcal <= 0) {
    alert('消費カロリーを入力してください');
    return;
  }
  if (state.exercise.editingId) {
    const idx = state.exercises.findIndex(e => e.id === state.exercise.editingId);
    if (idx < 0) { closeExerciseModal(); return; }
    const updated = { ...state.exercises[idx], ...data };
    state.exercises[idx] = updated;
    persist();
    flashSync('更新しました');
    closeExerciseModal();
    renderAll();
    syncDelete('exercise', updated.id)
      .then(() => syncAdd('exercise', updated))
      .catch(() => queuePending('add_exercise', updated));
    return;
  }
  const rec = {
    id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    ts: Date.now(),
    date: state.viewDate,
    ...data,
  };
  state.exercises.push(rec);
  persist();
  flashSync('記録しました');
  closeExerciseModal();
  renderAll();
  syncAdd('exercise', rec).catch(() => queuePending('add_exercise', rec));
}
function deleteExercise() {
  const id = state.exercise.editingId;
  if (!id) return;
  if (!confirm('この記録を削除しますか？')) return;
  state.exercises = state.exercises.filter(e => e.id !== id);
  persist();
  flashSync('削除しました');
  closeExerciseModal();
  renderAll();
  syncDelete('exercise', id).catch(() => {});
}

// ==========================================================
// セット登録
// ==========================================================
function openPresetModal({ editingId = null } = {}) {
  state.preset.editingId = editingId;
  let rec = null;
  if (editingId) {
    rec = state.presets.find(p => p.id === editingId);
    if (!rec) return;
  }
  document.getElementById('presetModalTitle').textContent = rec ? '食事テンプレートを編集' : '食事テンプレートを登録';
  document.getElementById('presetName').value    = rec ? rec.name : '';
  document.getElementById('presetProtein').value = rec ? (rec.protein || '') : '';
  document.getElementById('presetFat').value     = rec ? (rec.fat     || '') : '';
  document.getElementById('presetKcal').value    = rec ? (rec.kcal    || '') : '';
  document.getElementById('deletePresetBtn').hidden = !rec;
  document.getElementById('savePresetBtn').textContent = rec ? '更新する' : '保存';
  document.getElementById('presetModal').hidden = false;
}
function closePresetModal() {
  document.getElementById('presetModal').hidden = true;
  state.preset.editingId = null;
}
function readPresetForm() {
  const name = document.getElementById('presetName').value.trim();
  const protein = Number(document.getElementById('presetProtein').value) || 0;
  const fat     = Number(document.getElementById('presetFat').value)     || 0;
  const kcalRaw = document.getElementById('presetKcal').value;
  const kcal = kcalRaw === '' ? calcKcal(protein, fat) : (Number(kcalRaw) || 0);
  return { name, protein, fat, carb: 0, kcal };
}
function savePreset() {
  const data = readPresetForm();
  if (!data.name) {
    alert('名前を入力してください');
    return;
  }
  if (data.kcal <= 0) {
    alert('カロリーを入力してください');
    return;
  }
  let rec;
  if (state.preset.editingId) {
    const idx = state.presets.findIndex(p => p.id === state.preset.editingId);
    if (idx < 0) { closePresetModal(); return; }
    rec = { ...state.presets[idx], ...data };
    state.presets[idx] = rec;
    persist();
    closePresetModal();
    renderSettings();
    flashSync('保存しました', 'success');
    syncDelete('preset', rec.id)
      .then(() => syncAdd('preset', rec))
      .catch(() => queuePending('add_preset', rec));
    return;
  }
  rec = {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    ...data,
  };
  state.presets.push(rec);
  persist();
  closePresetModal();
  renderSettings();
  flashSync('保存しました', 'success');
  syncAdd('preset', rec).catch(() => queuePending('add_preset', rec));
}
function deletePreset() {
  const id = state.preset.editingId;
  if (!id) return;
  if (!confirm('この食事テンプレートを削除しますか？')) return;
  state.presets = state.presets.filter(p => p.id !== id);
  persist();
  closePresetModal();
  renderSettings();
  syncDelete('preset', id).catch(() => {});
}

// ==========================================================
// カレンダータブ
// ==========================================================
function renderCalendar() {
  const [y, m] = state.calMonth.split('-').map(Number);
  document.getElementById('calMonthLabel').textContent = `${y}年${m}月`;

  // 曜日ヘッダ
  const dowsEl = document.getElementById('calDows');
  if (!dowsEl.children.length) {
    const dows = ['日', '月', '火', '水', '木', '金', '土'];
    dowsEl.innerHTML = dows.map((d, i) => {
      const cls = i === 0 ? 'sun' : i === 6 ? 'sat' : '';
      return `<span class="cal-dow ${cls}">${d}</span>`;
    }).join('');
  }

  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const daysInMonth = last.getDate();
  const startDow = first.getDay();
  const t = state.targets;
  const todayYmd = ymd(new Date());

  let monthIntake = 0;
  let monthBurn = 0;
  let monthProtein = 0;
  let monthFat = 0;
  let recordedDays = 0;
  let overDays = 0;
  let okDays = 0;

  const grid = document.getElementById('calGrid');
  let html = '';
  for (let i = 0; i < startDow; i++) html += '<div class="cal-cell empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const ymdStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayPfc = sumPFC(mealsOnDate(ymdStr));
    const intake = dayPfc.kcal;
    const burn = sumBurn(exercisesOnDate(ymdStr));
    const net = intake - burn;
    const hasData = intake > 0 || burn > 0;
    if (hasData) {
      monthIntake += intake;
      monthBurn += burn;
      monthProtein += dayPfc.protein;
      monthFat += dayPfc.fat;
      recordedDays++;
    }

    let stateCls = '';
    let pct = 0;
    if (hasData && t.daily_kcal) {
      pct = Math.min(100, (net / t.daily_kcal) * 100);
      if (net <= t.daily_kcal) { stateCls = 'ok'; okDays++; }
      else { stateCls = 'over'; overDays++; }
    } else if (hasData) {
      stateCls = 'recorded';
    }

    const isToday = ymdStr === todayYmd;
    const isView  = ymdStr === state.viewDate;
    const kcalLabel = hasData ? `<span class="cal-cell-kcal">${fmtInt(net)}</span>` : '';
    const barHtml = hasData && t.daily_kcal
      ? `<div class="cal-cell-bar"><div class="cal-cell-bar-fill" style="width:${pct}%"></div></div>`
      : '';

    html += `
      <button type="button" class="cal-cell ${stateCls}${isToday ? ' today' : ''}${isView ? ' selected' : ''}" data-date="${ymdStr}">
        <span class="cal-cell-day">${d}</span>
        ${kcalLabel}
        ${barHtml}
      </button>
    `;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.cal-cell[data-date]').forEach(c => {
    c.addEventListener('click', () => {
      state.viewDate = c.dataset.date;
      switchTab('entry');
    });
  });

  // 月サマリー（月目標 vs 実績）
  const sum = document.getElementById('calMonthSummary');
  const netKcal = monthIntake - monthBurn;
  sum.innerHTML = `
    <div class="summary-card-head">
      <span class="summary-card-title">${m}月のサマリー</span>
      <span class="summary-card-sub">${daysInMonth} 日 / 記録 ${recordedDays} 日</span>
    </div>
    ${progressRow('カロリー',   'kcal', netKcal,      (t.daily_kcal    || 0) * daysInMonth, 'kcal', 'cap')}
    ${progressRow('たんぱく質', 'p',    monthProtein, (t.daily_protein || 0) * daysInMonth, 'g',    'min')}
    ${progressRow('脂質',       'f',    monthFat,     (t.daily_fat     || 0) * daysInMonth, 'g',    'cap')}
  `;
}

function shiftMonth(delta) {
  const [y, m] = state.calMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderCalendar();
}

// （グラフタブは廃止 — サマリーのバーで進捗可視化）


// ==========================================================
// 設定タブ
// ==========================================================
function renderSettings() {
  document.getElementById('targetKcal').value     = state.targets.daily_kcal || '';
  document.getElementById('targetProtein').value  = state.targets.daily_protein || '';
  document.getElementById('targetFat').value      = state.targets.daily_fat || '';
  document.getElementById('gasUrlInput').value    = state.gasUrl;
  document.getElementById('gasTokenInput').value  = state.gasToken;
  renderPresetList();
}

function renderPresetList() {
  const root = document.getElementById('presetList');
  if (!root) return;
  root.innerHTML = '';
  if (state.presets.length === 0) {
    root.innerHTML = '<div class="preset-list-empty">まだ食事テンプレートがありません。「＋ 新規登録」から追加してください。</div>';
    return;
  }
  state.presets.forEach(p => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'preset-row';
    row.innerHTML = `
      <div>
        <div class="preset-row-name">${escapeHtml(p.name || '名前なし')}</div>
        <div class="preset-row-pfc">
          <span class="p">たんぱく質 <b>${fmt(p.protein)}</b>g</span>
          <span class="f">脂質 <b>${fmt(p.fat)}</b>g</span>
        </div>
      </div>
      <div class="preset-row-kcal">${fmtInt(p.kcal)}<span class="preset-row-kcal-unit">kcal</span></div>
    `;
    row.addEventListener('click', () => openPresetModal({ editingId: p.id }));
    root.appendChild(row);
  });
}

function saveTargets() {
  const num = id => Number(document.getElementById(id).value) || 0;
  state.targets = {
    daily_kcal:    num('targetKcal'),
    daily_protein: num('targetProtein'),
    daily_fat:     num('targetFat'),
  };
  persist();
  flashSync('目標を保存しました', 'success');
}
function saveGasUrl() {
  const url = document.getElementById('gasUrlInput').value.trim();
  const token = document.getElementById('gasTokenInput').value.trim();
  if (url && !/^https:\/\/script\.google\.com\//.test(url)) {
    if (!confirm('URLが script.google.com で始まっていません。続行しますか？')) return;
  }
  state.gasUrl = url;
  state.gasToken = token;
  persist();
  flashSync('GAS 設定を保存しました', 'success');
  flushPending();
}
function exportData() {
  const data = {
    meals:     state.meals,
    weights:   state.weights,
    exercises: state.exercises,
    presets:   state.presets,
    targets:   state.targets,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `calorie-${ymd(today())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================================
// GAS 同期
// ==========================================================
const ADD_ACTIONS = {
  meal:     'add_meal',
  weight:   'add_weight',
  exercise: 'add_exercise',
  preset:   'add_preset',
};
const DEL_ACTIONS = {
  meal:     'delete_meal',
  weight:   'delete_weight',
  exercise: 'delete_exercise',
  preset:   'delete_preset',
};

async function syncAdd(kind, payload) {
  if (!state.gasUrl) return;
  const action = ADD_ACTIONS[kind];
  if (!action) return;
  const res = await fetch(state.gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: state.gasToken, record: payload }),
  });
  if (!res.ok) throw new Error('sync failed');
  const body = await res.json().catch(() => ({}));
  if (body && body.ok === false) throw new Error(body.error || 'sync failed');
  flashSync('スプレッドシートへ同期 ✓', 'success');
}
async function syncDelete(kind, id) {
  if (!state.gasUrl) return;
  const action = DEL_ACTIONS[kind];
  if (!action) return;
  const res = await fetch(state.gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: state.gasToken, id }),
  });
  if (!res.ok) throw new Error('sync failed');
  const body = await res.json().catch(() => ({}));
  if (body && body.ok === false) throw new Error(body.error || 'sync failed');
}

// 全データを一括置換（既存データの救済 / 完全同期）
async function pushAllToGas() {
  if (!state.gasUrl) {
    alert('先に GAS Web App URL を保存してください。');
    return;
  }
  const counts = {
    meals:     state.meals.length,
    weights:   state.weights.length,
    exercises: state.exercises.length,
    presets:   state.presets.length,
  };
  const msg =
    '⚠️ 全データをスプレッドシートへ上書きします。\n' +
    `（食事 ${counts.meals} / 体組成 ${counts.weights} / 運動 ${counts.exercises} / 食事テンプレート ${counts.presets}）\n\n` +
    'スプレッドシート側の同じシートの内容は消えます。続行しますか？';
  if (!confirm(msg)) return;

  flashSync('送信中…');
  try {
    const res = await fetch(state.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'bulk_replace',
        token: state.gasToken,
        payload: {
          meals:     state.meals,
          weights:   state.weights,
          exercises: state.exercises,
          presets:   state.presets,
        },
      }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const body = await res.json().catch(() => ({}));
    if (body.ok === false) throw new Error(body.error || 'sync failed');
    const c = body.counts || counts;
    flashSync(`一括同期 ✓（食事${c.meals||0}/体組成${c.weights||0}/運動${c.exercises||0}/テンプレート${c.presets||0}）`, 'success');
  } catch (err) {
    alert('一括同期に失敗しました: ' + err.message);
    flashSync('失敗', 'error');
  }
}
function queuePending(action, payload) {
  const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.pendingSync) || '[]');
  queue.push({ action, payload });
  localStorage.setItem(STORAGE_KEYS.pendingSync, JSON.stringify(queue));
  flashSync('オフライン: あとで同期します', 'error');
}
async function flushPending() {
  if (!state.gasUrl) return;
  const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.pendingSync) || '[]');
  const remaining = [];
  const ADD_TO_KIND = {
    add_meal: 'meal', add_weight: 'weight', add_exercise: 'exercise', add_preset: 'preset',
  };
  for (const item of queue) {
    try {
      const kind = ADD_TO_KIND[item.action];
      if (kind) await syncAdd(kind, item.payload);
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(STORAGE_KEYS.pendingSync, JSON.stringify(remaining));
}
function flashSync(msg, cls = '') {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'sync-status ' + cls;
  clearTimeout(flashSync._t);
  flashSync._t = setTimeout(() => { el.textContent = ''; el.className = 'sync-status'; }, 2500);
}


// ==========================================================
// イベント / 初期化
// ==========================================================
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderAll();
}
function shiftViewDay(delta) {
  state.viewDate = shiftDate(state.viewDate, delta);
  renderAll();
}

function bindEvents() {
  document.querySelectorAll('.bnav-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
  document.getElementById('prevDay').addEventListener('click', () => shiftViewDay(-1));
  document.getElementById('nextDay').addEventListener('click', () => shiftViewDay(1));
  document.getElementById('prevMonth').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => shiftMonth(1));

  // 食事モーダル
  document.getElementById('saveMealBtn').addEventListener('click', saveMeal);
  document.getElementById('deleteMealBtn').addEventListener('click', deleteMeal);
  document.getElementById('closeMealBtn').addEventListener('click', closeMealModal);
  document.getElementById('mealModal').addEventListener('click', e => {
    if (e.target.id === 'mealModal') closeMealModal();
  });

  // 運動モーダル
  document.getElementById('saveExerciseBtn').addEventListener('click', saveExercise);
  document.getElementById('deleteExerciseBtn').addEventListener('click', deleteExercise);
  document.getElementById('closeExerciseBtn').addEventListener('click', closeExerciseModal);
  document.getElementById('exerciseModal').addEventListener('click', e => {
    if (e.target.id === 'exerciseModal') closeExerciseModal();
  });

  // セットモーダル
  document.getElementById('savePresetBtn').addEventListener('click', savePreset);
  document.getElementById('deletePresetBtn').addEventListener('click', deletePreset);
  document.getElementById('closePresetBtn').addEventListener('click', closePresetModal);
  document.getElementById('presetModal').addEventListener('click', e => {
    if (e.target.id === 'presetModal') closePresetModal();
  });
  document.getElementById('addPresetBtn').addEventListener('click', () => openPresetModal({}));

  // 設定
  document.getElementById('saveTargetsBtn').addEventListener('click', saveTargets);
  document.getElementById('saveGasUrlBtn').addEventListener('click', saveGasUrl);
  document.getElementById('pushAllBtn').addEventListener('click', pushAllToGas);
  document.getElementById('exportData').addEventListener('click', exportData);

}

function init() {
  load();
  bindEvents();
  renderAll();
  if (loadErrors.length > 0) {
    setTimeout(() => {
      alert(
        `データ読込エラーが発生しました。\n\n対象キー: ${loadErrors.join(', ')}\n\n` +
        '当該データはデフォルト値で起動しています。\n' +
        'ブラウザの開発ツールから元データを退避してから上書きしてください。'
      );
    }, 100);
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('online', flushPending);
  flushPending();
}
init();
