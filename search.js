// あいまい検索：ひらがな・カタカナ・漢字の表記ゆれ、小さい文字、濁点、1〜2文字の打ちまちがいに対応
(function (g) {
  "use strict";
  const KANJI_RE = /[一-鿿々〆]/;
  let kmap = {}, maxKeyLen = 1;
  function setKanjiMap(m) {
    kmap = m || {};
    maxKeyLen = Math.max(1, ...Object.keys(kmap).map(k => k.length));
  }
  function toHira(s) {
    return s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  }
  function kanjiToKana(s) {
    if (!KANJI_RE.test(s)) return s;
    let out = "", i = 0;
    while (i < s.length) {
      let hit = null;
      for (let L = Math.min(maxKeyLen, s.length - i); L >= 1; L--) {
        const part = s.substr(i, L);
        if (kmap[part] !== undefined && KANJI_RE.test(part)) { hit = part; break; }
      }
      if (hit) { out += kmap[hit]; i += hit.length; } else { out += s[i]; i++; }
    }
    return out;
  }
  // 厳密キー：記号と空白を除き、漢字→かな、カタカナ→ひらがな
  function strict(s) {
    s = String(s || "").normalize("NFKC").toLowerCase();
    s = s.replace(/[\s　・、。，．,.!！?？「」『』（）()［］\[\]〜~\-‐－―_/／:：;；'"＂’”]/g, "");
    return toHira(kanjiToKana(s));
  }
  const SMALL = { "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お", "っ": "つ", "ゃ": "や", "ゅ": "ゆ", "ょ": "よ", "ゎ": "わ", "ゕ": "か", "ゖ": "け" };
  // ゆるいキー：のばし棒・小さい文字・濁点/半濁点・を/お などの違いを無視
  function loose(s) {
    s = s.replace(/ー/g, "").replace(/[ぁぃぅぇぉっゃゅょゎゕゖ]/g, c => SMALL[c]);
    s = s.normalize("NFD").replace(/[゙゚]/g, "").normalize("NFC");
    return s.replace(/を/g, "お").replace(/ゑ/g, "え").replace(/ゐ/g, "い");
  }
  // 文字列tの中のどこかの部分とqとの最小編集距離（部分一致型のレーベンシュタイン距離）
  function subDistance(q, t) {
    const m = q.length, n = t.length;
    let prev = new Array(n + 1).fill(0), cur = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = q[i - 1] === t[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, cur] = [cur, prev];
    }
    let best = m;
    for (let j = 0; j <= n; j++) if (prev[j] < best) best = prev[j];
    return best;
  }
  function fullDistance(a, b) {
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, cur] = [cur, prev];
    }
    return prev[n];
  }
  function allowance(len) { return len <= 2 ? 0 : len <= 4 ? 1 : len <= 8 ? 2 : 3; }

  let index = [];
  function buildIndex(foods) {
    index = foods.map(f => {
      const raw = [f.name, ...(f.aliases || []), ...(f.yomi || [])];
      const keys = [...new Set(raw.map(strict).filter(Boolean))];
      return { food: f, keys, lkeys: keys.map(loose) };
    });
  }
  function scoreKeys(q, lq, entry) {
    let best = 0;
    const allow = allowance(lq.length);
    for (let i = 0; i < entry.keys.length; i++) {
      const k = entry.keys[i], lk = entry.lkeys[i];
      let s = 0;
      if (k === q) s = 1000;
      else if (k.startsWith(q)) s = 900 - (k.length - q.length);
      else if (k.includes(q)) s = 800 - (k.length - q.length);
      else if (lk === lq) s = 760;
      else if (lk.startsWith(lq)) s = 720 - (lk.length - lq.length);
      else if (lk.includes(lq)) s = 650 - (lk.length - lq.length);
      else if (allow > 0) {
        const dFull = fullDistance(lq, lk);
        if (dFull <= allow) s = 600 - dFull * 60 - Math.abs(lk.length - lq.length);
        else if (lq.length >= 3) {
          const dSub = subDistance(lq, lk);
          if (dSub <= allow) s = 500 - dSub * 60 - (lk.length - lq.length);
        }
      }
      if (s > best) best = s;
    }
    return best;
  }
  // boost(food) で使用回数などの加点ができる
  function search(query, opts = {}) {
    const q = strict(query);
    if (!q) return [];
    const lq = loose(q), limit = opts.limit || 8, boost = opts.boost || (() => 0);
    const out = [];
    for (const e of index) {
      const s = scoreKeys(q, lq, e);
      if (s > 0) out.push({ food: e.food, score: s + boost(e.food) });
    }
    out.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length);
    return out.slice(0, limit);
  }
  g.FoodSearch = { setKanjiMap, buildIndex, search, strict, loose };
})(typeof window !== "undefined" ? window : globalThis);
