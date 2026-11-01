import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

env.useBrowserCache = true;
env.useWasmCache = true;
env.cacheKey = "health-note-food101-v1";

const MODEL_ID = "onnx-community/swin-finetuned-food101-ONNX";
let classifierPromise = null;

const jaLabels = {
  "apple_pie":"アップルパイ","baby_back_ribs":"バックリブ","baklava":"バクラヴァ",
  "beef_carpaccio":"牛肉のカルパッチョ","beef_tartare":"牛肉のタルタル",
  "beet_salad":"ビーツサラダ","beignets":"ベニエ","bibimbap":"ビビンバ",
  "bread_pudding":"ブレッドプディング","breakfast_burrito":"ブレックファストブリトー",
  "bruschetta":"ブルスケッタ","caesar_salad":"シーザーサラダ","cannoli":"カンノーリ",
  "caprese_salad":"カプレーゼ","carrot_cake":"キャロットケーキ","ceviche":"セビーチェ",
  "cheese_plate":"チーズプレート","cheesecake":"チーズケーキ","chicken_curry":"チキンカレー",
  "chicken_quesadilla":"チキンケサディーヤ","chicken_wings":"手羽先料理",
  "chocolate_cake":"チョコレートケーキ","chocolate_mousse":"チョコレートムース",
  "churros":"チュロス","clam_chowder":"クラムチャウダー","club_sandwich":"クラブサンド",
  "crab_cakes":"クラブケーキ","creme_brulee":"クレームブリュレ","croque_madame":"クロックマダム",
  "cup_cakes":"カップケーキ","deviled_eggs":"デビルドエッグ","donuts":"ドーナツ",
  "dumplings":"ダンプリング","edamame":"枝豆","eggs_benedict":"エッグベネディクト",
  "escargots":"エスカルゴ","falafel":"ファラフェル","filet_mignon":"フィレミニョン",
  "fish_and_chips":"フィッシュアンドチップス","foie_gras":"フォアグラ","french_fries":"フライドポテト",
  "french_onion_soup":"オニオングラタンスープ","french_toast":"フレンチトースト",
  "fried_calamari":"イカフライ","fried_rice":"チャーハン","frozen_yogurt":"フローズンヨーグルト",
  "garlic_bread":"ガーリックトースト","gnocchi":"ニョッキ","greek_salad":"ギリシャ風サラダ",
  "grilled_cheese_sandwich":"グリルドチーズサンド","grilled_salmon":"サーモンのグリル",
  "guacamole":"ワカモレ","gyoza":"餃子","hamburger":"ハンバーガー","hot_and_sour_soup":"酸辣湯",
  "hot_dog":"ホットドッグ","huevos_rancheros":"ウエボスランチェロス","hummus":"フムス",
  "ice_cream":"アイスクリーム","lasagna":"ラザニア","lobster_bisque":"ロブスタービスク",
  "lobster_roll_sandwich":"ロブスターロール","macaroni_and_cheese":"マカロニチーズ",
  "macarons":"マカロン","miso_soup":"みそ汁","mussels":"ムール貝","nachos":"ナチョス",
  "omelette":"オムレツ","onion_rings":"オニオンリング","oysters":"カキ料理",
  "pad_thai":"パッタイ","paella":"パエリア","pancakes":"パンケーキ","panna_cotta":"パンナコッタ",
  "peking_duck":"北京ダック","pho":"フォー","pizza":"ピザ","pork_chop":"ポークチョップ",
  "poutine":"プーティン","prime_rib":"プライムリブ","pulled_pork_sandwich":"プルドポークサンド",
  "ramen":"ラーメン","ravioli":"ラビオリ","red_velvet_cake":"レッドベルベットケーキ",
  "risotto":"リゾット","samosa":"サモサ","sashimi":"刺身","scallops":"ホタテ料理",
  "seaweed_salad":"海藻サラダ","shrimp_and_grits":"エビ料理","spaghetti_bolognese":"ミートソーススパゲッティ",
  "spaghetti_carbonara":"カルボナーラ","spring_rolls":"春巻き","steak":"ステーキ",
  "strawberry_shortcake":"いちごショートケーキ","sushi":"寿司","tacos":"タコス",
  "takoyaki":"たこ焼き","tiramisu":"ティラミス","tuna_tartare":"マグロのタルタル",
  "waffles":"ワッフル"
};

const statusEl = document.getElementById("aiStatus");
const button = document.getElementById("aiAnalyzeBtn");
const fileInput = document.getElementById("foodPhoto");
const candidatesEl = document.getElementById("aiCandidates");

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

async function getClassifier() {
  if (!classifierPromise) {
    setStatus("AIモデルを準備中… 初回はモデルのダウンロードに時間がかかるよ。");
    classifierPromise = pipeline("image-classification", MODEL_ID, {
      dtype: "q8",
      progress_callback: (p) => {
        if (p && p.status === "progress" && Number.isFinite(p.progress)) {
          setStatus(`AIモデルをダウンロード中… ${Math.round(p.progress)}%`);
        } else if (p && p.status === "done") {
          setStatus("AIモデルの準備が進んでいるよ…");
        } else if (p && p.status) {
          setStatus(`AIモデルを準備中… ${p.status}`);
        }
      }
    });
  }
  return classifierPromise;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

window.chooseFoodAiCandidate = (label) => {
  const jp = jaLabels[label] || label.replaceAll("_", " ");
  if (typeof window.useAiFood === "function") window.useAiFood(jp);
};

button?.addEventListener("click", async () => {
  const file = fileInput?.files?.[0];
  if (!file) {
    setStatus("先に食事の写真を選んでね。");
    return;
  }
  if (!file.type.startsWith("image/")) {
    setStatus("画像ファイルを選んでね。");
    return;
  }
  button.disabled = true;
  candidatesEl.innerHTML = "";
  try {
    const classifier = await getClassifier();
    setStatus("写真を端末内で判定中…");
    const blobUrl = URL.createObjectURL(file);
    let result;
    try {
      result = await classifier(blobUrl, { top_k: 5 });
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
    if (!Array.isArray(result) || result.length === 0) {
      setStatus("料理候補を見つけられなかったよ。メニューから選んでね。");
      return;
    }
    candidatesEl.innerHTML = "<strong>AIの候補（近い順）</strong>" + result.map((r, i) => {
      const jp = jaLabels[r.label] || r.label.replaceAll("_", " ");
      const pct = Math.round((r.score || 0) * 100);
      return `<button class="candidate" type="button" data-label="${escapeHtml(r.label)}"><span><b>${i+1}. ${escapeHtml(jp)}</b><br><small>${escapeHtml(r.label)}</small></span><strong>${pct}%</strong></button>`;
    }).join("");
    candidatesEl.querySelectorAll("button[data-label]").forEach(b => {
      b.addEventListener("click", () => window.chooseFoodAiCandidate(b.dataset.label));
    });
    setStatus("判定できたよ！正しい候補を選んで、メニューを確認してね。写真はこの端末内で処理したよ。");
  } catch (err) {
    console.error(err);
    setStatus("AIの準備・判定に失敗したよ。初回はネット接続と空き容量を確認して、もう一度試してね。");
    classifierPromise = null;
  } finally {
    button.disabled = false;
  }
});
