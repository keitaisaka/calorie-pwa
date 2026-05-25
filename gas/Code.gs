// =====================================================
// PFC 管理 PWA — Google Apps Script バックエンド
// このスクリプトを Google スプレッドシートに紐づけて
// 「ウェブアプリ」としてデプロイし、URL を PWA の設定に貼る
//
// ★ 認証（推奨）:
//   GAS エディタ右上の「歯車 → スクリプトプロパティ」で
//   プロパティ名: SHARED_SECRET
//   値: 任意のランダム文字列を登録すると、
//   その値を持つクライアントのみ書き込み可能になる。
//   PWA 側の設定モードで「共有シークレット」欄に同じ文字列を入れる。
//   未設定なら認証スキップ（後方互換）。
// =====================================================

const MEAL_SHEET     = 'meals';
const WEIGHT_SHEET   = 'weights';
const EXERCISE_SHEET = 'exercises';
const PRESET_SHEET   = 'presets';

function getSecret_() {
  return PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
}
function authOk_(token) {
  const expected = getSecret_();
  if (!expected) return true;
  return typeof token === 'string' && token === expected;
}

function getMealSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(MEAL_SHEET);
  if (!sh) {
    sh = ss.insertSheet(MEAL_SHEET);
    sh.appendRow(['id', 'timestamp', 'date', 'meal', 'note', 'protein_g', 'fat_g', 'carb_g', 'kcal']);
    sh.setFrozenRows(1);
  }
  return sh;
}
function getWeightSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(WEIGHT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(WEIGHT_SHEET);
    sh.appendRow(['id', 'timestamp', 'date', 'weight_kg', 'muscle_kg', 'body_fat_pct']);
    sh.setFrozenRows(1);
  }
  return sh;
}
function getExerciseSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(EXERCISE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(EXERCISE_SHEET);
    sh.appendRow(['id', 'timestamp', 'date', 'name', 'duration_min', 'kcal']);
    sh.setFrozenRows(1);
  }
  return sh;
}
function getPresetSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(PRESET_SHEET);
  if (!sh) {
    sh = ss.insertSheet(PRESET_SHEET);
    sh.appendRow(['id', 'name', 'protein_g', 'fat_g', 'carb_g', 'kcal']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 全件取得（バックアップ／復元用）
// クエリ ?token=xxx[&kind=meals|weights|exercises|presets]
function doGet(e) {
  try {
    const token = e && e.parameter ? e.parameter.token : null;
    if (!authOk_(token)) {
      return jsonOut_({ ok: false, error: 'unauthorized' });
    }
    const kind = e && e.parameter && e.parameter.kind;
    const result = { ok: true };
    if (!kind || kind === 'meals') {
      result.meals = readSheet_(getMealSheet_()).map(r => ({
        id: r.id,
        ts: r.timestamp instanceof Date ? r.timestamp.getTime() : Number(r.timestamp),
        date: r.date,
        meal: r.meal,
        note: r.note || '',
        protein: Number(r.protein_g) || 0,
        fat: Number(r.fat_g) || 0,
        carb: Number(r.carb_g) || 0,
        kcal: Number(r.kcal) || 0,
      }));
    }
    if (!kind || kind === 'weights') {
      result.weights = readSheet_(getWeightSheet_()).map(r => ({
        id: r.id,
        ts: r.timestamp instanceof Date ? r.timestamp.getTime() : Number(r.timestamp),
        date: r.date,
        weight: r.weight_kg === '' ? null : Number(r.weight_kg),
        muscle: r.muscle_kg === '' ? null : Number(r.muscle_kg),
        bodyFat: r.body_fat_pct === '' ? null : Number(r.body_fat_pct),
      }));
    }
    if (!kind || kind === 'exercises') {
      result.exercises = readSheet_(getExerciseSheet_()).map(r => ({
        id: r.id,
        ts: r.timestamp instanceof Date ? r.timestamp.getTime() : Number(r.timestamp),
        date: r.date,
        name: r.name || '',
        duration: r.duration_min === '' ? null : Number(r.duration_min),
        kcal: Number(r.kcal) || 0,
      }));
    }
    if (!kind || kind === 'presets') {
      result.presets = readSheet_(getPresetSheet_()).map(r => ({
        id: r.id,
        name: r.name || '',
        protein: Number(r.protein_g) || 0,
        fat: Number(r.fat_g) || 0,
        carb: Number(r.carb_g) || 0,
        kcal: Number(r.kcal) || 0,
      }));
    }
    return jsonOut_(result);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function readSheet_(sh) {
  const values = sh.getDataRange().getValues();
  const [header, ...rows] = values;
  return rows.map(r => {
    const o = {};
    header.forEach((h, i) => { o[h] = r[i]; });
    return o;
  });
}

// 1 行を各シート形式に変換
function mealRow_(x) {
  const dt = new Date(x.ts || Date.now());
  const dateStr = x.date || Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return [
    x.id, dt, dateStr, x.meal || '', x.note || '',
    Number(x.protein) || 0, Number(x.fat) || 0, Number(x.carb) || 0, Number(x.kcal) || 0,
  ];
}
function weightRow_(x) {
  const dt = new Date(x.ts || Date.now());
  const dateStr = x.date || Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return [
    x.id, dt, dateStr,
    x.weight  == null ? '' : Number(x.weight),
    x.muscle  == null ? '' : Number(x.muscle),
    x.bodyFat == null ? '' : Number(x.bodyFat),
  ];
}
function exerciseRow_(x) {
  const dt = new Date(x.ts || Date.now());
  const dateStr = x.date || Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return [
    x.id, dt, dateStr, x.name || '',
    x.duration == null ? '' : Number(x.duration),
    Number(x.kcal) || 0,
  ];
}
function presetRow_(x) {
  return [
    x.id, x.name || '',
    Number(x.protein) || 0, Number(x.fat) || 0, Number(x.carb) || 0, Number(x.kcal) || 0,
  ];
}

// シートを clear して header + records で再構成
function replaceSheet_(sh, header, rows) {
  sh.clearContents();
  sh.appendRow(header);
  sh.setFrozenRows(1);
  if (rows.length > 0) {
    sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  }
}

// 追加 / 削除 / 一括置換
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!authOk_(body && body.token)) {
      return jsonOut_({ ok: false, error: 'unauthorized' });
    }

    if (body.action === 'add_meal') {
      getMealSheet_().appendRow(mealRow_(body.record));
      return jsonOut_({ ok: true });
    }
    if (body.action === 'add_weight') {
      getWeightSheet_().appendRow(weightRow_(body.record));
      return jsonOut_({ ok: true });
    }
    if (body.action === 'add_exercise') {
      getExerciseSheet_().appendRow(exerciseRow_(body.record));
      return jsonOut_({ ok: true });
    }
    if (body.action === 'add_preset') {
      getPresetSheet_().appendRow(presetRow_(body.record));
      return jsonOut_({ ok: true });
    }

    if (body.action === 'delete_meal'   ||
        body.action === 'delete_weight' ||
        body.action === 'delete_exercise' ||
        body.action === 'delete_preset') {
      const sh =
        body.action === 'delete_meal'     ? getMealSheet_() :
        body.action === 'delete_weight'   ? getWeightSheet_() :
        body.action === 'delete_exercise' ? getExerciseSheet_() :
                                            getPresetSheet_();
      const id = body.id;
      const data = sh.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === id) {
          sh.deleteRow(i + 1);
          return jsonOut_({ ok: true });
        }
      }
      return jsonOut_({ ok: false, error: 'id not found' });
    }

    // 一括置換: PWA に貯まった全データを一気にスプレッドシートへ反映
    // body.payload = { meals: [...], weights: [...], exercises: [...], presets: [...] }
    if (body.action === 'bulk_replace') {
      const p = body.payload || {};
      const counts = {};
      if (Array.isArray(p.meals)) {
        replaceSheet_(getMealSheet_(),
          ['id', 'timestamp', 'date', 'meal', 'note', 'protein_g', 'fat_g', 'carb_g', 'kcal'],
          p.meals.map(mealRow_));
        counts.meals = p.meals.length;
      }
      if (Array.isArray(p.weights)) {
        replaceSheet_(getWeightSheet_(),
          ['id', 'timestamp', 'date', 'weight_kg', 'muscle_kg', 'body_fat_pct'],
          p.weights.map(weightRow_));
        counts.weights = p.weights.length;
      }
      if (Array.isArray(p.exercises)) {
        replaceSheet_(getExerciseSheet_(),
          ['id', 'timestamp', 'date', 'name', 'duration_min', 'kcal'],
          p.exercises.map(exerciseRow_));
        counts.exercises = p.exercises.length;
      }
      if (Array.isArray(p.presets)) {
        replaceSheet_(getPresetSheet_(),
          ['id', 'name', 'protein_g', 'fat_g', 'carb_g', 'kcal'],
          p.presets.map(presetRow_));
        counts.presets = p.presets.length;
      }
      return jsonOut_({ ok: true, counts });
    }

    return jsonOut_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}
