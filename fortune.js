"use strict";
/* 今日のおみくじ：1日1回、その日はじめて開いたときに表示 */
(function () {
  const D = window.FORTUNE_DATA;
  const KEY = "hn10_fortune", SEEN = "hn10_words_seen", STREAK = "hn10_fortune_streak", SOUND = "hn10_sound";
  const get = (k, f) => { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const rnd = n => Math.floor(Math.random() * n);
  const h = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const RANKS = { "大吉": { color: "#e8a317", bg: "linear-gradient(135deg,#fff6c9,#ffd6e7 55%,#d9f2ff)", emoji: "🌈" }, "中吉": { color: "#e2739b", bg: "linear-gradient(135deg,#ffe3ee,#fff4e0)", emoji: "🌸" }, "吉": { color: "#58a37c", bg: "linear-gradient(135deg,#e6f6ec,#fffbe8)", emoji: "🍀" } };

  /* ---------- 見た目 ---------- */
  const css = `
#fortuneCard .fc-new{display:flex;align-items:center;gap:12px;width:100%;border:0;border-radius:22px;padding:16px;background:linear-gradient(120deg,#ffe0ec,#fff1c7,#e0f3ff,#ffe0ec);background-size:300% 300%;animation:fcGrad 4s ease infinite;color:#6b4a5a;text-align:left;box-shadow:0 8px 22px #e79ab544;margin:10px 0}
#fortuneCard .fc-new b{font-size:18px;display:block}#fortuneCard .fc-new small{font-size:12px}
#fortuneCard .fc-new .big{font-size:42px;animation:fcWiggle 1.2s ease-in-out infinite}
@keyframes fcGrad{0%,100%{background-position:0 50%}50%{background-position:100% 50%}}
@keyframes fcWiggle{0%,100%{transform:rotate(0)}20%{transform:rotate(-12deg)}40%{transform:rotate(10deg)}60%{transform:rotate(-6deg)}}
.fc-done{border-radius:22px;padding:15px;margin:10px 0;border:1px solid #f0dce5;box-shadow:0 8px 24px #8d53600d}
.fc-rank{display:inline-block;font-weight:900;font-size:22px;padding:2px 14px;border-radius:30px;background:#fff;margin-right:6px}
.fc-done p{margin:8px 0;font-size:13px;line-height:1.7}
.fc-done .word{background:#ffffffbb;border-radius:14px;padding:9px 11px;margin-top:8px}
.fc-done .row2{display:flex;gap:8px;margin-top:10px}.fc-done .row2 button{flex:1}
#fortuneModal{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;padding:16px;background:#3d2a37cc;backdrop-filter:blur(4px)}
#fortuneModal.open{display:flex}
.fm-box{position:relative;width:100%;max-width:400px;max-height:92vh;overflow-y:auto;border-radius:28px;background:#fff;padding:22px 18px;text-align:center;box-shadow:0 20px 60px #0005}
.fm-sound{position:absolute;z-index:3;right:12px;top:12px;border:0;background:#f6eef2;border-radius:50%;width:36px;height:36px;font-size:17px}
.fm-title{font-size:13px;font-weight:900;letter-spacing:.15em;color:#c9839f}
.fm-h{font-size:24px;font-weight:900;margin:4px 0 14px;color:#514653}
.omikuji{width:120px;height:150px;margin:40px auto 14px;position:relative}
.omikuji .body{position:absolute;inset:18px 6px 0;background:linear-gradient(180deg,#e94b5f,#c6304a);border-radius:14px 14px 18px 18px;box-shadow:inset 0 -8px 0 #a32239,0 10px 20px #c6304a55;display:grid;place-items:center;color:#fff;font-weight:900;font-size:22px;writing-mode:vertical-rl;letter-spacing:.2em}
.omikuji .top{position:absolute;left:0;right:0;top:0;height:30px;background:#ffcf5c;border-radius:12px;box-shadow:inset 0 -5px 0 #e9a92a}
.omikuji .stick{position:absolute;left:50%;top:-30px;width:10px;height:56px;margin-left:-5px;background:#f6dfb1;border-radius:4px;opacity:0;transition:.3s}
.omikuji.idle{animation:fcBob 1.6s ease-in-out infinite}
.omikuji.shake{animation:fcShake .12s linear infinite}
.omikuji.shake .stick{opacity:1;animation:fcStick .12s linear infinite}
@keyframes fcBob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-6px) rotate(3deg)}}
@keyframes fcShake{0%{transform:rotate(-14deg) translateX(-4px)}50%{transform:rotate(14deg) translateX(4px)}100%{transform:rotate(-14deg) translateX(-4px)}}
@keyframes fcStick{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.fm-draw{border:0;border-radius:20px;padding:16px 30px;font-size:21px;font-weight:900;color:#fff;background:linear-gradient(135deg,#ff8fb5,#f4a9c4 50%,#ffb86b);box-shadow:0 6px 0 #d96f98,0 12px 24px #e79ab566;animation:fcPulse 1s ease-in-out infinite}
.fm-draw:active{transform:translateY(4px);box-shadow:0 2px 0 #d96f98}
@keyframes fcPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.jaka{font-size:26px;font-weight:900;color:#e2739b;height:36px;animation:fcJaka .18s linear infinite}
@keyframes fcJaka{0%,100%{transform:translate(0,0) rotate(-2deg)}50%{transform:translate(2px,-3px) rotate(2deg)}}
.slot{width:170px;height:84px;margin:10px auto;border-radius:18px;background:#fff7fa;border:3px dashed #f4a9c4;display:grid;place-items:center;font-size:44px;font-weight:900;color:#d96f98;overflow:hidden}
.slot span{display:block;animation:fcSlot .09s linear}
@keyframes fcSlot{from{transform:translateY(-60%);opacity:.2}to{transform:none;opacity:1}}
.fm-flash{position:fixed;inset:0;background:#fff;z-index:95;pointer-events:none;opacity:0}
.fm-flash.go{animation:fcFlash .6s ease-out}
@keyframes fcFlash{0%{opacity:0}10%{opacity:1}100%{opacity:0}}
.doon{font-size:52px;font-weight:900;color:#514653;animation:fcDoon .6s cubic-bezier(.2,1.6,.4,1) both}
@keyframes fcDoon{0%{transform:scale(3);opacity:0}100%{transform:scale(1);opacity:1}}
.result-wrap{position:relative;padding:8px 0 4px;border-radius:22px;overflow:hidden}
.rays{position:absolute;left:50%;top:70px;width:560px;height:560px;margin:-280px 0 0 -280px;background:repeating-conic-gradient(#ffe48a55 0 10deg,transparent 10deg 20deg);animation:fcSpin 8s linear infinite;pointer-events:none}
@keyframes fcSpin{to{transform:rotate(360deg)}}
.panpaka{position:relative;font-size:22px;font-weight:900;color:#ff7aa2;animation:fcPan .7s cubic-bezier(.2,1.6,.4,1) both}
@keyframes fcPan{0%{transform:translateY(20px) scale(.4);opacity:0}100%{transform:none;opacity:1}}
.stamp{position:relative;display:inline-block;margin:8px auto 4px;font-size:72px;font-weight:900;line-height:1.1;padding:6px 26px;border:6px solid currentColor;border-radius:24px;background:#fff;animation:fcStamp .55s cubic-bezier(.2,1.8,.4,1) both;text-shadow:0 3px 0 #0001}
@keyframes fcStamp{0%{transform:scale(4) rotate(-20deg);opacity:0}60%{transform:scale(.9) rotate(4deg);opacity:1}100%{transform:scale(1) rotate(-4deg)}}
.reveal{opacity:0;transform:translateY(14px);animation:fcUp .5s ease-out forwards}
@keyframes fcUp{to{opacity:1;transform:none}}
.fm-sec{position:relative;background:#fff;border-radius:18px;padding:12px 14px;margin-top:10px;text-align:left;border:1px solid #f0dce5}
.fm-sec .lbl{font-size:11px;font-weight:900;color:#c9839f;letter-spacing:.08em}
.fm-sec .cm{font-size:15px;font-weight:800;line-height:1.7;margin-top:4px;color:#514653}
.fm-luck{display:flex;gap:8px}.fm-luck>div{flex:1}
.fm-luck b{display:block;font-size:15px;margin-top:3px;color:#514653}
.fm-word{font-size:22px;font-weight:900;color:#514653;margin-top:4px}.fm-yomi{font-size:12px;color:#8d808a}
.fm-mean{font-size:13px;line-height:1.75;margin-top:6px;color:#514653}
.fm-new{display:inline-block;background:#ff7aa2;color:#fff;font-size:10px;font-weight:900;border-radius:20px;padding:2px 8px;margin-left:6px;vertical-align:middle;animation:fcPulse .8s infinite}
.fm-close{border:0;width:100%;margin-top:14px;border-radius:18px;padding:15px;font-size:18px;font-weight:900;color:#fff;background:linear-gradient(135deg,#ff8fb5,#ffb86b);box-shadow:0 5px 0 #d96f98}
.zukan{columns:2;font-size:12px;line-height:1.9;margin-top:6px}
@media(prefers-reduced-motion:reduce){.omikuji.shake,.rays,.jaka{animation:none}}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const modal = document.createElement("div"); modal.id = "fortuneModal"; modal.setAttribute("role", "dialog"); modal.setAttribute("aria-label", "今日のおみくじ");
  modal.innerHTML = `<div class="fm-box"><button class="fm-sound" id="fmSound" aria-label="音のオンオフ"></button><div id="fmStage"></div></div>`;
  document.body.appendChild(modal);
  const flash = document.createElement("div"); flash.className = "fm-flash"; document.body.appendChild(flash);
  const stage = () => document.getElementById("fmStage");

  /* ---------- 効果音（Web Audio。ファイル不要） ---------- */
  let ac = null, soundOn = get(SOUND, true);
  function renderSoundBtn() { document.getElementById("fmSound").textContent = soundOn ? "🔊" : "🔈"; }
  document.getElementById("fmSound").addEventListener("click", () => { soundOn = !soundOn; set(SOUND, soundOn); renderSoundBtn(); });
  function audio() { if (!soundOn) return null; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); return ac; } catch (e) { return null; } }
  let noiseBuf = null;
  function noise(a) { if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * 0.3, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = a.createBufferSource(); s.buffer = noiseBuf; return s; }
  function snare(a, t, vol) { const s = noise(a), f = a.createBiquadFilter(), g = a.createGain(); f.type = "bandpass"; f.frequency.value = 1800 + Math.random() * 600; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07); s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + 0.08); }
  function drumRoll(sec) { const a = audio(); if (!a) return; const t0 = a.currentTime; for (let t = 0; t < sec; t += 0.045) snare(a, t0 + t, 0.08 + 0.32 * (t / sec)); }
  function boom() {
    const a = audio(); if (!a) return; const t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain(); o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.5); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.75);
    const s = noise(a), f = a.createBiquadFilter(), g2 = a.createGain(); f.type = "highpass"; f.frequency.value = 3000; g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.28); s.connect(f).connect(g2).connect(a.destination); s.start(t); s.stop(t + 0.3);
  }
  function fanfare(rank) {
    const a = audio(); if (!a) return; const t0 = a.currentTime + 0.05;
    const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, D6 = 1174.66, E6 = 1318.5, G6 = 1568;
    let seq = [[C5, 0, .13], [E5, .14, .13], [G5, .28, .13], [C6, .42, .7]]; // パン・パカ・パー・ン
    if (rank === "中吉") seq = seq.concat([[E6, .9, .12], [G6, 1.03, .45]]);
    if (rank === "大吉") seq = seq.concat([[D6, .9, .12], [E6, 1.03, .12], [G6, 1.16, .12], [E6, 1.3, .12], [G6, 1.43, .9]]);
    for (const [fq, dt, len] of seq) for (const [type, vol, mul] of [["square", .07, 1], ["triangle", .12, 1], ["sine", .05, 2]]) {
      const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = fq * mul; const t = t0 + dt;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.setValueAtTime(vol, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.001, t + len); o.connect(g).connect(a.destination); o.start(t); o.stop(t + len + 0.02);
    }
    if (rank === "大吉") for (let i = 0; i < 12; i++) { const o = a.createOscillator(), g = a.createGain(), t = t0 + 1.6 + i * 0.05; o.type = "sine"; o.frequency.value = 2000 + i * 180; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.3); }
  }
  function tick() { const a = audio(); if (!a) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = "square"; o.frequency.value = 880 + rnd(400); g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.05); }

  /* ---------- 抽選 ---------- */
  function drawFortune() {
    const r = Math.random(), rank = r < 0.25 ? "大吉" : r < 0.65 ? "中吉" : "吉";
    const seen = get(SEEN, []); let unseen = D.words.map((_, i) => i).filter(i => !seen.includes(i));
    if (!unseen.length) unseen = D.words.map((_, i) => i);
    const wi = unseen[rnd(unseen.length)], isNew = !seen.includes(wi);
    if (isNew) { seen.push(wi); set(SEEN, seen); }
    const prev = get(STREAK, { last: "", n: 0 }), d = today();
    const streak = prev.last === d ? prev.n : prev.last === yesterday() ? prev.n + 1 : 1; set(STREAK, { last: d, n: streak });
    const f = { date: d, rank, ci: rnd(D.comments[rank].length), item: D.items[rnd(D.items.length)], color: D.colors[rnd(D.colors.length)], wi, isNew, streak };
    set(KEY, f); return f;
  }
  const todays = () => { const f = get(KEY, null); return f && f.date === today() ? f : null; };

  /* ---------- 画面 ---------- */
  function open() { modal.classList.add("open"); renderSoundBtn(); document.body.style.overflow = "hidden"; }
  function close() { modal.classList.remove("open"); document.body.style.overflow = ""; renderCard(); }
  function showIntro() {
    open();
    stage().innerHTML = `<div class="fm-title">TODAY'S OMIKUJI</div><div class="fm-h">今日のおみくじ</div>
      <div class="omikuji idle" id="omk"><div class="stick"></div><div class="top"></div><div class="body">みくじ</div></div>
      <p class="hint" style="margin:0 0 14px">1日1回だけ引けるよ。どきどき…！</p>
      <button class="fm-draw" id="fmDraw">🎋 おみくじを引く！</button>`;
    document.getElementById("fmDraw").addEventListener("click", roll, { once: true });
  }
  function roll() {
    audio(); // タップの瞬間に音を有効化（iPhone対策）
    const f = drawFortune(), DUR = 2800;
    stage().innerHTML = `<div class="fm-title">TODAY'S OMIKUJI</div><div class="fm-h">今日のおみくじ</div>
      <div class="omikuji shake"><div class="stick"></div><div class="top"></div><div class="body">みくじ</div></div>
      <div class="jaka">ジャカジャカジャカ…</div><div class="slot" id="slot"><span>？</span></div>`;
    drumRoll(DUR / 1000); if (navigator.vibrate) navigator.vibrate([30, 40, 30, 40, 30, 40, 30, 40, 30, 40, 30, 40, 30]);
    const labels = ["吉", "中吉", "大吉"], slot = document.getElementById("slot"); let t = 0, i = 0;
    (function spin() {
      const p = t / DUR, wait = 60 + p * p * 260; // だんだんゆっくり
      if (t + wait >= DUR) return reveal(f);
      slot.innerHTML = `<span>${labels[i++ % 3]}</span>`; tick(); t += wait; setTimeout(spin, wait);
    })();
  }
  function reveal(f, quiet) {
    const R = RANKS[f.rank], w = D.words[f.wi], cm = D.comments[f.rank][f.ci];
    if (!quiet) {
      flash.classList.remove("go"); void flash.offsetWidth; flash.classList.add("go"); boom();
      if (navigator.vibrate) navigator.vibrate(f.rank === "大吉" ? [80, 60, 80, 60, 200] : [120]);
      stage().innerHTML = `<div style="height:280px;display:grid;place-items:center"><div class="doon">ドーン！！</div></div>`;
    }
    setTimeout(() => {
      stage().innerHTML = `<div class="result-wrap" style="background:${R.bg}">${f.rank === "大吉" ? '<div class="rays"></div>' : ""}
        <div class="panpaka">${quiet ? "今日のおみくじ" : "🎺 パンパカパーン！ 🎺"}</div>
        <div class="stamp" style="color:${R.color}">${f.rank}</div>
        <div style="position:relative;font-size:13px;font-weight:800;color:#6b4a5a;margin-bottom:8px">${R.emoji} おみくじ ${f.streak}日連続 ${R.emoji}</div></div>
        <div class="fm-sec reveal" style="animation-delay:.5s"><div class="lbl">💌 今日のメッセージ</div><div class="cm">${h(cm)}</div></div>
        <div class="fm-sec reveal fm-luck" style="animation-delay:.9s"><div><div class="lbl">🍀 ラッキーアイテム</div><b>${h(f.item)}</b></div><div><div class="lbl">🎨 ラッキーカラー</div><b>${h(f.color)}</b></div></div>
        <div class="fm-sec reveal" style="animation-delay:1.3s"><div class="lbl">📜 今日のことば${f.isNew && !quiet ? '<span class="fm-new">NEW!</span>' : ""}</div><div class="fm-word">${h(w[0])}</div><div class="fm-yomi">${h(w[1])}</div><div class="fm-mean">${h(w[2])}</div></div>
        <div class="reveal" style="animation-delay:1.6s;font-size:12px;color:#8d808a;margin-top:10px">📚 ことば図鑑 ${get(SEEN, []).length} / ${D.words.length} 集めたよ</div>
        <button class="fm-close reveal" style="animation-delay:1.8s" id="fmClose">今日もがんばるぞ！💪</button>`;
      document.getElementById("fmClose").addEventListener("click", close);
      if (!quiet) {
        fanfare(f.rank);
        if (typeof celebrate === "function") {
          celebrate(f.rank === "大吉" ? "大吉だ〜！！" : f.rank === "中吉" ? "中吉！やったね！" : "吉！いい日になるよ！", f.rank === "大吉" ? "🌈" : "🎊");
          if (f.rank === "大吉") { setTimeout(() => celebrate("すごーい！！", "👑"), 1400); }
        }
      }
    }, quiet ? 0 : 650);
  }
  function renderCard() {
    const el = document.getElementById("fortuneCard"); if (!el) return;
    const f = todays();
    if (!f) { el.innerHTML = `<button class="fc-new" id="fcOpen"><span class="big">🎋</span><span><b>今日のおみくじを引こう！</b><small>なにが出るかな？ ラッキーアイテムと今日のことばも！</small></span></button>`; document.getElementById("fcOpen").addEventListener("click", showIntro); return; }
    const R = RANKS[f.rank], w = D.words[f.wi], seen = get(SEEN, []);
    el.innerHTML = `<div class="fc-done" style="background:${R.bg}"><span class="fc-rank" style="color:${R.color}">${f.rank}</span><b style="font-size:13px;color:#6b4a5a">今日のおみくじ</b>
      <p>${h(D.comments[f.rank][f.ci])}</p>
      <p style="margin:4px 0">🍀 ${h(f.item)}　🎨 ${h(f.color)}</p>
      <div class="word"><b>📜 ${h(w[0])}</b><div class="hint" style="margin-top:2px">${h(w[2])}</div></div>
      <details style="margin-top:8px"><summary style="font-size:12px;font-weight:800;cursor:pointer">📚 ことば図鑑（${seen.length} / ${D.words.length}）</summary><div class="zukan">${seen.map(i => h(D.words[i][0])).join("<br>")}</div></details>
      <p class="hint" style="margin:6px 0 0;text-align:center">つぎのおみくじは明日だよ。また開いてね！</p></div>`;
  }
  // その日はじめて開いたときに自動で表示
  function check() { renderCard(); if (!todays() && !modal.classList.contains("open")) setTimeout(showIntro, 700); }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  window.FortuneUI = { showIntro, renderCard, reveal: f => { open(); reveal(f || todays(), true); } };
  check();
})();
