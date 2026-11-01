"use strict";
/* おいしい食事ノート v10 */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.warn));
}
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- 保存（v9と同じキーを使い、既存の記録を引き継ぐ） ---------- */
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { toast("保存できなかったよ。空き容量を確認してね"); return false; } },
  getRaw(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  setRaw(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
};
const K = { records: "hn9_records", custom: "hn9_custom", title: "hn9_title", weights: "hn10_weights", kyu: "hn10_kyushoku", kyuEat: "hn10_kyushoku_eat" };

const CATS = [["ごはん・パン・めん", "🍚"], ["汁もの", "🥣"], ["おかず", "🍳"], ["野菜・副菜", "🥦"], ["飲み物", "🥛"], ["デザート・おやつ", "🍓"]];
const MEALS = [["朝ごはん", "🌅"], ["昼ごはん", "☀️"], ["夜ごはん", "🌙"], ["おやつ", "🍪"]];
const PORTIONS = [[0.5, "半分"], [0.75, "少なめ"], [1, "ふつう"], [1.5, "多め"], [2, "2人前"]];
const DEFAULT_QUICK = {
  "朝ごはん": ["ごはん", "卵かけごはん", "食パン（6枚切り）", "納豆", "みそ汁", "目玉焼き", "牛乳", "バナナ", "ヨーグルト（加糖）"],
  "昼ごはん": ["ごはん", "おにぎり（鮭）", "うどん（かけ）", "サンドイッチ（たまご）", "みそ汁", "牛乳"],
  "夜ごはん": ["ごはん", "みそ汁", "鶏のからあげ", "焼き鮭", "ハンバーグ", "野菜サラダ", "カレーライス", "麦茶"],
  "おやつ": ["バナナ", "ヨーグルト（加糖）", "クッキー", "せんべい", "アイスクリーム", "ポテトチップス（ひとつかみ）", "牛乳", "みかん"]
};

/* ---------- データ読み込み ---------- */
function normalizeCustom(f) {
  // v9の自作メニュー（100gあたり形式）を1人前形式に変換
  if (f.kcal == null && f.kcal100 != null) {
    const g = Number(f.servingG) || 100;
    return { id: f.id, name: f.name, category: f.category, kcal: Math.round(f.kcal100 * g / 100), g, unit: f.serving || `${g}g`, aliases: f.aliases || [], custom: true };
  }
  return { ...f, custom: true };
}
let custom = store.get(K.custom, []).map(normalizeCustom);
let db = [];
function rebuildDb() {
  // 古いfood-db.js（100gあたり形式）が読み込まれても計算できるように変換
  db = (window.FOOD_DB || []).map(f => f.kcal == null ? { ...normalizeCustom(f), custom: false } : f).concat(custom);
  if (!window.KANJI_MAP) console.warn("food-db.jsが古い版です");
  FoodSearch.setKanjiMap(window.KANJI_MAP || {});
  FoodSearch.buildIndex(db);
  $("dbCount").textContent = db.length;
}
let records = store.get(K.records, []);
let weights = store.get(K.weights, []);
let kyuImported = store.get(K.kyu, {});
let kyuEat = store.get(K.kyuEat, {});
function kyuDays() { return Object.assign({}, (window.KYUSHOKU_DATA && window.KYUSHOKU_DATA.days) || {}, kyuImported); }

function localDate(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return localDate(d); }
function dayDiff(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
const WD = ["日", "月", "火", "水", "木", "金", "土"];
function fmtDate(s) { const d = parseDate(s); return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`; }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
function persist() { store.set(K.records, records); store.set(K.custom, custom); }

/* ---------- 演出 ---------- */
let toastTimer;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200); }
function celebrate(text = "きろくできた！", emoji = "🎉") {
  const pop = $("pop"); pop.querySelector(".e").textContent = emoji; pop.querySelector(".t").textContent = text;
  pop.classList.remove("show"); void pop.offsetWidth; pop.classList.add("show");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = $("confetti"), ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ["#f4a9c4", "#ffd36e", "#7fb89a", "#a99bf0", "#ff8fa3", "#7cc6f0"], parts = [];
  for (const side of [0, 1]) for (let i = 0; i < 70; i++) {
    parts.push({ x: side ? innerWidth : 0, y: innerHeight * 0.8, vx: (side ? -1 : 1) * (3 + Math.random() * 8), vy: -(10 + Math.random() * 9), w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: colors[i % colors.length] });
  }
  const t0 = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) { p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); }
    if (t - t0 < 2600) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
}

/* ---------- タブ ---------- */
function showTab(id) {
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === id));
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
  if (id === "home") renderHome();
  if (id === "list") renderEntries();
  if (id === "weight") renderWeight();
  if (id === "add") renderAdd();
  scrollTo({ top: 0 });
}
document.querySelectorAll("nav button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (g) showTab(g.dataset.go); });

/* ---------- 食事の記録 ---------- */
let tray = []; // {food, portion}
let meal = guessMeal();
function guessMeal() { const h = new Date().getHours(); return h < 10 ? "朝ごはん" : h < 15 ? "昼ごはん" : h < 17 ? "おやつ" : "夜ごはん"; }
function itemKcal(food, portion) { return Math.round(food.kcal * portion); }
function useCount() {
  const c = {}, cm = {};
  for (const r of records) for (const i of r.items || []) { c[i.name] = (c[i.name] || 0) + 1; const k = r.meal + "|" + i.name; cm[k] = (cm[k] || 0) + 1; }
  return { c, cm };
}
function findFood(name) { return db.find(f => f.name === name); }

function renderAdd() {
  $("mealbar").innerHTML = MEALS.map(([m, e]) => `<button data-meal="${m}" class="${m === meal ? "on" : ""}"><span>${e}</span>${m.replace("ごはん", "")}</button>`).join("");
  renderSuggest(); renderQuick(); renderTray(); renderCats();
}
$("mealbar").addEventListener("click", e => { const b = e.target.closest("[data-meal]"); if (!b) return; meal = b.dataset.meal; renderAdd(); });

function foodRow(f, extra = "") {
  const inTray = tray.some(t => t.food.id === f.id);
  return `<button class="sug ${inTray ? "added" : ""}" data-add="${esc(f.id)}"><span><b>${esc(f.name)}</b><small>${esc(f.unit)} ・ 約${f.kcal}kcal${extra}</small></span><span class="plus">${inTray ? "✓" : "＋"}</span></button>`;
}
function renderSuggest() {
  const q = $("search").value;
  $("clearSearch").classList.toggle("hidden", !q);
  if (!q.trim()) { $("suggest").innerHTML = ""; $("quick").classList.remove("hidden"); return; }
  $("quick").classList.add("hidden");
  const { c } = useCount();
  const res = FoodSearch.search(q, { limit: 8, boost: f => Math.min(40, (c[f.name] || 0) * 4) });
  const list = res;
  let html = list.map(r => foodRow(r.food)).join("");
  if (!list.length) html = `<p class="hint">「${esc(q)}」は見つからなかったよ。別の言葉で探すか、下から登録してね。</p>`;
  html += `<button class="btn ghost full" data-newfood="1">「${esc(q.trim())}」を新しく登録する</button>`;
  $("suggest").innerHTML = html;
}
$("search").addEventListener("input", renderSuggest);
$("clearSearch").addEventListener("click", () => { $("search").value = ""; renderSuggest(); $("search").focus(); });

function renderQuick() {
  const { cm } = useCount();
  const mine = Object.entries(cm).filter(([k]) => k.startsWith(meal + "|")).sort((a, b) => b[1] - a[1]).map(([k]) => k.split("|")[1]);
  const names = [...new Set([...mine, ...DEFAULT_QUICK[meal]])].slice(0, 10);
  const foods = names.map(findFood).filter(Boolean);
  const last = records.find(r => r.meal === meal && !r.kyushoku && (r.items || []).length);
  let html = "";
  if (last) {
    const nm = last.items.map(i => i.name).join("・");
    html += `<button class="btn ghost full" data-repeat="${esc(last.id)}" style="text-align:left">🔁 前回の${meal}と同じにする<br><small style="font-weight:600">${esc(nm.length > 40 ? nm.slice(0, 40) + "…" : nm)}</small></button>`;
  }
  html += `<h3>${mine.length ? "いつもの" + meal : meal + "でよく食べるもの"}</h3><div class="chips">` +
    foods.map(f => `<button class="chip ${tray.some(t => t.food.id === f.id) ? "on" : ""}" data-add="${esc(f.id)}">${esc(f.name)}</button>`).join("") + "</div>";
  $("quick").innerHTML = html;
}

function addToTray(id) {
  const f = db.find(x => x.id === id); if (!f) return;
  const i = tray.findIndex(t => t.food.id === id);
  if (i >= 0) tray.splice(i, 1); else { tray.push({ food: f, portion: 1 }); if (navigator.vibrate) navigator.vibrate(12); }
  if ($("search").value) { $("search").value = ""; }
  renderSuggest(); renderQuick(); renderTray(); renderCatFoods();
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-add]"); if (a) { addToTray(a.dataset.add); return; }
  const r = e.target.closest("[data-repeat]");
  if (r) {
    const rec = records.find(x => x.id === r.dataset.repeat); if (!rec) return;
    for (const it of rec.items) { const f = findFood(it.name); if (f && !tray.some(t => t.food.id === f.id)) tray.push({ food: f, portion: it.portion || 1 }); }
    renderQuick(); renderTray(); toast("前回と同じメニューを入れたよ");
    return;
  }
  const n = e.target.closest("[data-newfood]");
  if (n) { $("customBox").open = true; $("customName").value = $("search").value.trim(); $("customKcal").focus(); return; }
});

let memoDraft = "";
document.addEventListener("input", e => { if (e.target.id === "memo") memoDraft = e.target.value; });
function renderTray() {
  if (!tray.length) { $("tray").innerHTML = `<b>えらんだメニュー</b><p class="hint" style="margin:4px 0 0">上で探すか、ボタンをタップしてね。</p>`; return; }
  const total = tray.reduce((s, t) => s + itemKcal(t.food, t.portion), 0);
  $("tray").innerHTML = `<b>えらんだメニュー（${tray.length}品）</b>` + tray.map((t, i) => `<div class="tray-item"><div class="tray-head"><b>${esc(t.food.name)}</b><span class="k">${itemKcal(t.food, t.portion)}kcal</span><button class="remove" data-rm="${i}" aria-label="${esc(t.food.name)}を外す">×</button></div>
  <div class="portion">${PORTIONS.map(([v, l]) => `<button data-por="${i}:${v}" class="${t.portion === v ? "on" : ""}">${l}</button>`).join("")}</div></div>`).join("") +
    `<div class="total"><span>合計（目安）</span><b>${total} kcal</b></div>
  <details class="more"><summary>📝 メモを書く（任意）</summary><textarea id="memo" placeholder="例：おばあちゃんが作ってくれたよ">${esc(memoDraft)}</textarea></details>
  <button class="btn primary full big" id="saveEntry">${meal}を記録する ✨</button>`;
}
$("tray").addEventListener("click", e => {
  const rm = e.target.closest("[data-rm]"); if (rm) { tray.splice(Number(rm.dataset.rm), 1); renderTray(); renderQuick(); renderSuggest(); return; }
  const p = e.target.closest("[data-por]"); if (p) { const [i, v] = p.dataset.por.split(":"); tray[i].portion = Number(v); renderTray(); return; }
  if (e.target.id === "saveEntry") saveEntry();
});
function saveEntry() {
  if (!tray.length) return;
  const items = tray.map(t => ({ id: t.food.id, name: t.food.name, category: t.food.category, portion: t.portion, grams: Math.round(t.food.g * t.portion), estimatedKcal: itemKcal(t.food, t.portion) }));
  records.unshift({ id: uid(), date: $("date").value || localDate(), meal, items, memo: memoDraft, createdAt: new Date().toISOString() });
  persist(); tray = []; memoDraft = "";
  celebrate(meal + " きろく！", "🍙");
  setTimeout(() => showTab("home"), 600);
}

function renderCats() { if (!activeCat) activeCat = CATS[0][0]; $("categoryGrid").innerHTML = CATS.map(([n, e]) => `<button class="cat ${activeCat === n ? "on" : ""}" data-cat="${n}"><span>${e}</span>${n}</button>`).join(""); renderCatFoods(); }
let activeCat = null;
function renderCatFoods() { $("catFoods").innerHTML = db.filter(f => f.category === activeCat).map(f => foodRow(f)).join(""); }
$("categoryGrid").addEventListener("click", e => { const b = e.target.closest("[data-cat]"); if (b) { activeCat = b.dataset.cat; renderCats(); } });

$("customCategory").innerHTML = CATS.map(([n]) => `<option>${n}</option>`).join("");
$("addCustom").addEventListener("click", () => {
  const name = $("customName").value.trim(), k = Number($("customKcal").value), c = $("customCategory").value;
  if (!name || $("customKcal").value === "" || !Number.isFinite(k) || k < 0 || k > 3000) { toast("メニュー名とカロリーを入れてね"); return; }
  if (db.some(f => f.name === name)) { toast("同じ名前のメニューがもうあるよ"); return; }
  const f = { id: "c" + Date.now(), name, category: c, kcal: Math.round(k), g: 0, unit: "1人前", aliases: [], custom: true };
  custom.push(f); persist(); rebuildDb();
  $("customName").value = ""; $("customKcal").value = ""; $("search").value = ""; $("customBox").open = false;
  tray.push({ food: f, portion: 1 }); renderAdd(); toast("登録して追加したよ！");
});

/* ---------- 給食 ---------- */
function kyuEntry(date) {
  const d = kyuDays()[date]; if (!d) return null;
  const portion = kyuEat[date] ?? 1;
  return { id: "kyu-" + date, date, meal: "昼ごはん", kyushoku: true, portion, menu: d.menu || [], kcalFull: Number(d.kcal) || 0, estimatedKcal: Math.round((Number(d.kcal) || 0) * portion), note: d.note || "" };
}
function kyuEatButtons(date, portion) {
  return `<div class="chips" style="margin-top:8px">${[[1, "ぜんぶ食べた"], [0.5, "半分くらい"], [0, "食べてない・お休み"]].map(([v, l]) => `<button class="chip ${portion === v ? "on" : ""}" data-kyu="${date}:${v}">${l}</button>`).join("")}</div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-kyu]"); if (!b) return;
  const [date, v] = b.dataset.kyu.split(":"); kyuEat[date] = Number(v); store.set(K.kyuEat, kyuEat);
  renderHome(); if ($("list").classList.contains("active")) renderEntries();
});
function renderKyuStatus() {
  const days = Object.keys(kyuDays()).sort();
  $("kyuStatus").textContent = days.length ? `${days.length}日分の給食データがあるよ（${fmtDate(days[0])}〜${fmtDate(days[days.length - 1])}）。給食の日は昼ごはんに自動で入るよ。` : "給食データはまだないよ。献立表から作ったファイルを読み込むと、給食の日の昼ごはんが自動で入るよ。";
}
$("kyuImport").addEventListener("click", () => {
  const file = $("kyuFile").files[0]; if (!file) { toast("ファイルを選んでね"); return; }
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result), days = d.days || d;
      if (typeof days !== "object" || Array.isArray(days)) throw Error();
      let n = 0;
      for (const [date, v] of Object.entries(days)) { if (/^\d{4}-\d{2}-\d{2}$/.test(date) && v && Array.isArray(v.menu)) { kyuImported[date] = { menu: v.menu.map(String), kcal: Number(v.kcal) || 0, note: v.note ? String(v.note) : "" }; n++; } }
      if (!n) throw Error();
      store.set(K.kyu, kyuImported); renderKyuStatus(); renderHome(); toast(`${n}日分の給食を読み込んだよ！`);
    } catch (e) { toast("このファイルは読み込めないみたい"); }
  };
  rd.readAsText(file);
});

/* ---------- ホーム ---------- */
function dayRecords(date) {
  const arr = records.filter(r => r.date === date);
  const k = kyuEntry(date); if (k && date <= localDate()) arr.push(k);
  return arr;
}
function recKcal(r) { return r.kyushoku ? r.estimatedKcal : (r.items || []).reduce((s, i) => s + (Number(i.estimatedKcal) || 0), 0); }
function renderHome() {
  const today = localDate(), arr = dayRecords(today);
  const h = new Date().getHours();
  $("helloText").textContent = (h < 10 ? "おはよう！" : h < 17 ? "こんにちは！" : "こんばんは！") + " 🌼";
  $("kcalToday").textContent = arr.reduce((s, r) => s + recKcal(r), 0);
  $("mealCount").textContent = arr.filter(r => !r.kyushoku || r.portion > 0).length;
  const lw = [...weights].sort((a, b) => a.date < b.date ? 1 : -1)[0];
  $("wtLatestHome").textContent = lw ? lw.kg.toFixed(1) : "--";
  const kyu = kyuEntry(today);
  if (kyu) {
    $("kyuToday").classList.remove("hidden");
    $("kyuToday").innerHTML = `<span class="tag kyu">🍱 今日の給食（自動で記録）</span><p style="margin:8px 0 2px;font-size:14px;font-weight:700">${esc(kyu.menu.join("・"))}</p><p class="hint" style="margin:0">献立表の目安 ${kyu.kcalFull}kcal${kyu.note ? "　" + esc(kyu.note) : ""}</p>${kyuEatButtons(today, kyu.portion)}`;
  } else $("kyuToday").classList.add("hidden");
  const order = MEALS.map(m => m[0]);
  const sorted = arr.filter(r => !r.kyushoku).sort((a, b) => order.indexOf(a.meal) - order.indexOf(b.meal));
  $("todayList").innerHTML = sorted.length || kyu ? sorted.map(r => `<div class="meal-line"><span><b>${esc(r.meal)}</b>　${esc(r.items.map(i => i.name).join("・"))}</span><span class="k">${recKcal(r)}kcal</span></div>`).join("") + (kyu ? `<div class="meal-line"><span><b>給食</b>　${esc(kyu.menu.join("・"))}</span><span class="k">${kyu.estimatedKcal}kcal</span></div>` : "") : "まだ記録がないよ。食べたものを記録してみよう。";
  const wd = new Set(weights.map(w => w.date)); let days = "";
  for (let n = 6; n >= 0; n--) { const k = addDays(today, -n), d = parseDate(k); const food = records.some(r => r.date === k); days += `<div class="day"><b>${WD[d.getDay()]}</b><span>${food ? "🍙" : "・"}${wd.has(k) ? "<br>⚖️" : ""}</span></div>`; }
  $("week").innerHTML = days;
}

/* ---------- 日記 ---------- */
function renderEntries() {
  const month = $("monthFilter").value, mf = $("mealFilter").value, today = localDate();
  const dates = new Set(records.map(r => r.date));
  for (const d of Object.keys(kyuDays())) if (d <= today) dates.add(d);
  const list = [...dates].filter(d => !month || d.startsWith(month)).sort().reverse();
  let html = "";
  for (const d of list) {
    const arr = dayRecords(d).filter(r => !mf || r.meal === mf); if (!arr.length) continue;
    const order = MEALS.map(m => m[0]); arr.sort((a, b) => order.indexOf(a.meal) - order.indexOf(b.meal));
    html += `<div class="dayhead"><span>${fmtDate(d)}</span><span>${arr.reduce((s, r) => s + recKcal(r), 0)}kcal</span></div>`;
    html += arr.map(r => r.kyushoku
      ? `<div class="entry"><div class="entryhead"><b>昼ごはん <span class="tag kyu">給食</span></b><span class="muted">${r.estimatedKcal}kcal</span></div><div class="hint">${esc(r.menu.join("・"))}</div>${kyuEatButtons(d, r.portion)}</div>`
      : `<div class="entry"><div class="entryhead"><b>${esc(r.meal)}</b><button class="remove" data-del="${esc(r.id)}">削除</button></div><ul>${(r.items || []).map(i => `<li>${esc(i.name)}${i.portion && i.portion !== 1 ? `（${esc((PORTIONS.find(p => p[0] === i.portion) || [0, i.portion + "倍"])[1])}）` : ""} <span class="muted">${Number(i.estimatedKcal) || 0}kcal</span></li>`).join("")}</ul>${r.memo ? `<div class="hint">メモ：${esc(r.memo)}</div>` : ""}</div>`).join("");
  }
  $("entries").innerHTML = html || '<p class="hint">この月の記録はまだないよ。</p>';
}
$("entries").addEventListener("click", e => { const b = e.target.closest("[data-del]"); if (b && confirm("この記録を削除する？")) { records = records.filter(x => x.id !== b.dataset.del); persist(); renderEntries(); } });
$("monthFilter").addEventListener("change", renderEntries); $("mealFilter").addEventListener("change", renderEntries);

/* ---------- 体重 ---------- */
let wtRange = 30;
function sortedW() { return [...weights].sort((a, b) => a.date < b.date ? -1 : 1); }
function avgBetween(from, to) { const a = weights.filter(w => w.date >= from && w.date <= to); return a.length ? { avg: a.reduce((s, w) => s + w.kg, 0) / a.length, n: a.length } : null; }
function streakDays() { const set = new Set(weights.map(w => w.date)); let d = localDate(), n = 0; if (!set.has(d)) d = addDays(d, -1); while (set.has(d)) { n++; d = addDays(d, -1); } return n; }
const pick = a => a[Math.floor(Math.random() * a.length)];
function weightComment(prevDate) {
  const n = streakDays(), today = localDate();
  if (weights.length === 1) return "はじめての記録だね！これからいっしょにふりかえっていこう 🎉";
  if (prevDate && dayDiff(prevDate, today) >= 4) return "おかえり！また記録してくれてうれしいな 🌷";
  if (n >= 30 && n % 10 === 0) return `${n}日連続！すごすぎる…！記録の名人だね 🏆`;
  if (n === 7 || n === 14 || n === 21) return `${n}日連続で記録できたよ！1週間ずつコツコツ、かっこいい 🌟`;
  const cur = avgBetween(addDays(today, -6), today), prev = avgBetween(addDays(today, -13), addDays(today, -7));
  const pool = [
    "記録できたね！えらい！ 🎉",
    "今日もナイス記録！明日もまってるね 🐣",
    "毎日コツコツ、かっこいい！ 🌈",
    "体重は水分で毎日少しずつ変わるよ。緑の平均の線を見てみよう 📈",
    "よく寝て、よく食べて、よく遊ぶのがいちばん！ ☀️",
    "記録をつづけると、自分の体のリズムがわかってくるよ 🔍",
    "朝ごはん、しっかり食べられたかな？ 🍙",
    "なわとびやおさんぽ、体を動かすと気持ちいいね 🏃",
    "野菜も、ごはんも、おかずも。いろいろ食べると元気が出るよ 🥦",
    "今日の自分にはなまる！ 💮"
  ];
  if (n >= 3) pool.push(`${n}日連続で記録中！その調子 ✨`);
  if (cur && prev && cur.n >= 3 && prev.n >= 3) {
    const d = cur.avg - prev.avg;
    if (Math.abs(d) < 0.2) pool.push("この7日の平均は、前の7日とほぼ同じ。安定してるね 👍");
    else if (d < 0) pool.push(`この7日の平均は、前の7日より${Math.abs(d).toFixed(1)}kg少なめ。ごはんはしっかり食べながら続けようね 🍚`);
    else pool.push(`この7日の平均は、前の7日より${d.toFixed(1)}kg多め。背がのびる時期は体重もふえるよ。気にしすぎないでね 🌱`);
  }
  return pick(pool);
}
$("wtSave").addEventListener("click", () => {
  const kg = Math.round(Number($("wtValue").value) * 10) / 10, date = $("wtDate").value || localDate();
  if (!Number.isFinite(kg) || kg < 10 || kg > 150) { toast("体重を「32.5」のように入れてね"); return; }
  const prev = sortedW().filter(w => w.date < date).pop();
  weights = weights.filter(w => w.date !== date); weights.push({ date, kg });
  if (!store.set(K.weights, weights)) return;
  $("wtValue").value = "";
  const msg = weightComment(prev && prev.date);
  $("wtComment").textContent = msg; $("wtComment").classList.remove("hidden");
  const n = streakDays();
  celebrate(n >= 2 ? `${n}日連続！` : "きろくできた！", pick(["🎉", "🎊", "🥳", "✨"]));
  renderWeight(true);
});
function renderWeight(keepComment) {
  if (!keepComment) $("wtComment").classList.add("hidden");
  if (!$("wtDate").value) $("wtDate").value = localDate();
  const s = sortedW(), today = localDate(), last = s[s.length - 1];
  $("wtLatest").textContent = last ? last.kg.toFixed(1) : "--";
  const cur = avgBetween(addDays(today, -6), today), prev = avgBetween(addDays(today, -13), addDays(today, -7));
  $("wtAvg7").textContent = cur ? cur.avg.toFixed(1) : "--";
  if (cur && prev) { const d = cur.avg - prev.avg; $("wtDiff").textContent = Math.abs(d) < 0.05 ? "同じくらい" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}kg`; } else $("wtDiff").textContent = "--";
  const n = streakDays(); $("wtStreak").textContent = n ? `🔥 ${n}日連続で記録中` : (s.length ? "今日の体重を記録しよう" : "");
  $("wtRange").innerHTML = [[30, "1か月"], [90, "3か月"], [0, "ぜんぶ"]].map(([v, l]) => `<button class="chip ${wtRange === v ? "on" : ""}" data-wr="${v}">${l}</button>`).join("");
  $("wtHistory").innerHTML = s.length ? [...s].reverse().slice(0, 14).map(w => `<div class="hist"><span>${fmtDate(w.date)}</span><b>${w.kg.toFixed(1)} kg</b><button class="remove" data-wdel="${w.date}">削除</button></div>`).join("") : "まだ記録がないよ。";
  drawChart(s);
}
$("wtRange").addEventListener("click", e => { const b = e.target.closest("[data-wr]"); if (b) { wtRange = Number(b.dataset.wr); renderWeight(true); } });
$("wtHistory").addEventListener("click", e => { const b = e.target.closest("[data-wdel]"); if (b && confirm(fmtDate(b.dataset.wdel) + "の体重を削除する？")) { weights = weights.filter(w => w.date !== b.dataset.wdel); store.set(K.weights, weights); renderWeight(true); } });
function drawChart(s) {
  const el = $("wtChart");
  if (s.length < 1) { el.innerHTML = '<p class="hint" style="text-align:center;padding:30px 0">記録するとグラフがここに出るよ 📈</p>'; return; }
  const today = localDate();
  const start = wtRange ? addDays(today, -(wtRange - 1)) : s[0].date;
  const pts = s.filter(w => w.date >= start); if (!pts.length) { el.innerHTML = '<p class="hint" style="text-align:center;padding:30px 0">この期間の記録はまだないよ</p>'; return; }
  const span = Math.max(1, dayDiff(start, today));
  const ma = pts.map(p => { const a = avgBetween(addDays(p.date, -6), p.date); return { date: p.date, kg: a.avg }; });
  const vals = pts.map(p => p.kg).concat(ma.map(m => m.kg));
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max(0.5, (hi - lo) * 0.2); lo -= pad; hi += pad;
  const W = 340, H = 200, L = 34, R = 10, T = 12, B = 26;
  const x = d => L + (W - L - R) * (dayDiff(start, d) / span), y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  let g = "";
  const step = (hi - lo) > 4 ? 1 : 0.5;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#f3e6ec"/><text x="${L - 5}" y="${y(v) + 3.5}" font-size="9" text-anchor="end" fill="#a99aa4">${v.toFixed(step < 1 ? 1 : 0)}</text>`;
  const ticks = 4; for (let i = 0; i <= ticks; i++) { const d = addDays(start, Math.round(span * i / ticks)), dd = parseDate(d); g += `<text x="${x(d)}" y="${H - 8}" font-size="9" text-anchor="middle" fill="#a99aa4">${dd.getMonth() + 1}/${dd.getDate()}</text>`; }
  const line = arr => arr.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join("");
  g += `<path d="${line(pts)}" fill="none" stroke="#f4a9c4" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  if (ma.length > 1) g += `<path d="${line(ma)}" fill="none" stroke="#7fb89a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  g += pts.map(p => `<circle cx="${x(p.date)}" cy="${y(p.kg)}" r="3.5" fill="#fff" stroke="#e48aae" stroke-width="2"><title>${fmtDate(p.date)} ${p.kg.toFixed(1)}kg</title></circle>`).join("");
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="体重のグラフ">${g}</svg>`;
}

/* ---------- 設定 ---------- */
function applyTitle() { const t = store.getRaw(K.title); if (t) { $("appTitle").textContent = t + " 🌷"; $("titleInput").value = t; document.title = t; } }
$("saveTitle").addEventListener("click", () => { const t = $("titleInput").value.trim(); if (t) { store.setRaw(K.title, t); applyTitle(); toast("名前を保存したよ"); } });
$("exportBtn").addEventListener("click", () => {
  const data = { app: "health-note-app", version: 10, exportedAt: new Date().toISOString(), records, customFoods: custom, weights, kyushoku: kyuImported, kyushokuEat: kyuEat, title: store.getRaw(K.title) || "" };
  const a = document.createElement("a"), u = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.href = u; a.download = `health-note-backup-${localDate()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
});
$("importBtn").addEventListener("click", () => {
  const file = $("importFile").files[0]; if (!file) { toast("バックアップファイルを選んでね"); return; }
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!Array.isArray(d.records) || !Array.isArray(d.customFoods)) throw Error();
      if (!confirm("いまの記録をバックアップの内容で置き換える？")) return;
      records = d.records; custom = d.customFoods.map(normalizeCustom);
      if (Array.isArray(d.weights)) { weights = d.weights.filter(w => w && w.date && Number.isFinite(Number(w.kg))).map(w => ({ date: w.date, kg: Number(w.kg) })); store.set(K.weights, weights); }
      if (d.kyushoku && typeof d.kyushoku === "object") { kyuImported = d.kyushoku; store.set(K.kyu, kyuImported); }
      if (d.kyushokuEat && typeof d.kyushokuEat === "object") { kyuEat = d.kyushokuEat; store.set(K.kyuEat, kyuEat); }
      if (d.title) { store.setRaw(K.title, d.title); applyTitle(); }
      persist(); rebuildDb(); renderKyuStatus(); renderHome(); toast("復元したよ！");
    } catch (e) { toast("このファイルは読み込めないみたい"); }
  };
  rd.readAsText(file);
});
$("clearAll").addEventListener("click", () => {
  if (!confirm("この端末の食事・体重・給食・登録メニューをすべて消す？（もとに戻せないよ）")) return;
  records = []; custom = []; weights = []; kyuImported = {}; kyuEat = {};
  persist(); store.set(K.weights, weights); store.set(K.kyu, kyuImported); store.set(K.kyuEat, kyuEat);
  rebuildDb(); renderKyuStatus(); renderHome(); toast("記録を消したよ");
});

/* ---------- 写真AI（ai.js）から呼ばれる ---------- */
window.useAiFood = function (name) {
  showTab("add"); $("search").value = name; renderSuggest();
  $("search").scrollIntoView({ behavior: "smooth", block: "center" });
  $("aiStatus").textContent = "AI候補で検索したよ。メニューを選んで、量を確認してね。";
};
$("foodPhoto").addEventListener("change", () => { const f = $("foodPhoto").files[0], img = $("photoPreview"); if (!f) { img.classList.add("hidden"); return; } const u = URL.createObjectURL(f); img.onload = () => URL.revokeObjectURL(u); img.src = u; img.classList.remove("hidden"); });

/* ---------- 起動 ---------- */
$("date").value = localDate(); $("monthFilter").value = localDate().slice(0, 7);
rebuildDb(); applyTitle(); renderKyuStatus(); renderHome(); renderAdd();
