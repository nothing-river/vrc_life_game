// ===== ボード定義 =====
// ===== メインステージ：外周ループ＋3つの分かれ道（分岐→合流）=====
const COLS = 14, ROWS = 9;
const PATH = [], NEXT = [], FORKS = {}, MERGES = new Set();
for (let c = 0; c < COLS; c++) PATH.push([c, 0]);
for (let r = 1; r < ROWS; r++) PATH.push([COLS - 1, r]);
for (let c = COLS - 2; c >= 0; c--) PATH.push([c, ROWS - 1]);
for (let r = ROWS - 2; r >= 1; r--) PATH.push([0, r]);
const PN = PATH.length; // 外周42マス
for (let i = 0; i < PN; i++) NEXT[i] = [(i + 1) % PN];
const PREV = [];

const TYPES = {
  start:{icon:'🚪',label:'ログイン'}, goal:{icon:'🏁',label:'ゴール'},
  pay:{icon:'💰',label:'臨時収入'}, loss:{icon:'💸',label:'ピンチ'},
  world:{icon:'🌍',label:'ワールド'}, job:{icon:'🛠️',label:'お仕事'},
  shukai:{icon:'🎪',label:'集会'}, event:{icon:'🎤',label:'個人イベ'},
  sugar:{icon:'🍬',label:'お砂糖'}, marry:{icon:'💍',label:'結婚'},
  date:{icon:'💞',label:'お砂糖デート'}, dj:{icon:'🎧',label:'DJイベ'},
  photo:{icon:'📸',label:'撮影会'}, shop:{icon:'🛒',label:'BOOTH'},
  trouble:{icon:'⚠️',label:'トラブル'}, gacha:{icon:'🎰',label:'ガチャ'},
  warp:{icon:'🌀',label:'ワープ'}, rest:{icon:'💤',label:'寝落ち'},
  collab:{icon:'🤝',label:'コラボ'}, social:{icon:'🍹',label:'交流'},
  quiz:{icon:'❓',label:'クイズ'}, item:{icon:'🎁',label:'アイテム'},
  ex:{icon:'💔',label:'元お砂糖'}, past:{icon:'🕵️',label:'お砂糖の過去'}, friend:{icon:'👫',label:'友達'},
  offkai:{icon:'🍻',label:'オフ会'}, tata:{icon:'🌪️',label:'多糖・修羅場'}, sns:{icon:'📱',label:'SNS'}
};

const LAYOUT = ['start','world','pay','shukai','sugar','shop','friend','event','job','item','photo','shukai','date','trouble',
 'dj','marry','pay','collab','warp','quiz','sugar','offkai','loss','job','social','shukai','rest','world','gacha','past',
 'date','trouble','event','shop','ex','dj','photo','collab','job','warp','sns','item'];
// 分かれ道：from=分岐マス / to=合流マス / cells=寄り道の座標 / types=各マスの種類 / opts=選択肢の名前（先頭は本道）
const BRANCHES = [
  { from: 38, to: 17, opts: ['外周を進む', '🌉近道ブリッジ（短縮・ドラマ多め）'],
    cells: [...Array(12)].map((_, i) => [i + 1, 4]),
    types: ['friend','ex','past','offkai','item','sugar','tata','event','sns','shukai','date','pay'] },
  { from: 4, to: 7, opts: ['直進', '💎お宝の寄り道（稼げる）'],
    cells: [[4,1],[4,2],[5,2],[6,2],[7,2],[7,1]], types: ['shukai','event','item','dj','photo','gacha'] },
  { from: 24, to: 27, opts: ['直進', '🌙ラブ寄り道（恋愛イベ多め）'],
    cells: [[10,7],[10,6],[9,6],[8,6],[7,6],[7,7]], types: ['date','sugar','sns','offkai','world','pay'] }
];
BRANCHES.forEach(b => {
  let prev = b.from;
  b.cells.forEach((xy, k) => { const id = PATH.length; PATH.push(xy); LAYOUT.push(b.types[k]); NEXT[id] = []; NEXT[prev].push(id); prev = id; });
  NEXT[prev].push(b.to); FORKS[b.from] = b.opts; MERGES.add(b.to);
});
NEXT.forEach((ns, i) => ns.forEach(j => (PREV[j] = PREV[j] || []).push(i)));

const TEXT = {
  pay:['ワールド売上が入った','アバター販売が好調','BOOTHで投げ銭をもらった','フレンドに奢ってもらった','お年玉イベで大量ゲット','衣装の受注制作が完売','Vket出展が大盛況','配信の投げ銭が止まらない'],
  loss:['回線が落ちて有料イベを逃した','フルトラがズレて機材を買い直し','課金アバターを衝動買い','PCが熱暴走して修理','HMDのケーブルを踏んで断線','イベ用の会場費を払った','コントローラーを床に叩きつけた'],
  job:['ワールド制作の納品','バーテンダーのバイト','ダンサーの出演料','ショップ店員の給料日','アバター改変の依頼','ライブ配信のスタッフ業'],
  world:[['夜景ワールドで友達と合流',300,0],['隠しギミックを見つけて話題に',200,1],['初見さんを案内してあげた',400,0],['ワールドのいいねが伸びた',500,1],['ミラーで自撮りしまくった',0,1],['迷子になって時間を溶かした',-200,0],['イベワールドで偶然フレンドと再会',300,0],['プライベートでまったり',400,0],['絶景ポイントで寝転んだ',300,0]],
  trouble:[['荒らしに絡まれてブロックした',-200,0,0],['マイクが入りっぱなしで独り言が流出',-300,-1,0],['改変アバターが透明になった',-300,0,0],['インスタンスが満員で待ちぼうけ',0,0,1],['炎上しかけたが謝罪で収まった',-400,-1,0],['グラボが逝った',-600,0,0],['変な噂を流された',-200,-1,0],['アップデートで入れなくなった',0,0,1]],
  gacha:[['大当たり！限定アバターを引いた',2000,1],['当たり！',800,0],['ハズレ…',-300,0],['ダブりばかり',-100,0],['SSR確定演出！',1500,0],['課金しすぎた',-600,0],['ミミックに噛まれた',-200,0]],
  date:[['お揃いアバターでデート',300,1],['記念日を祝った',800,0],['夜景ワールドで寝落ち通話',200,0],['ペアでフォトコンに入賞',900,1]]
};

// ゲーム内のお金の規模。数字を変えると全イベントの金額が一括で増減します（1000＝開始300万円・1回の収入が数十万〜数百万円。20なら数万円規模）
const MONEY_SCALE = 1000;
const START_MONEY = 3000 * MONEY_SCALE;
const COLORS = ['#ff9ec4', '#7cc4ff', '#ffd35c', '#9be08f']; // ピンク・水色・黄・緑（ログの名前バッジなどに使用）


const DEFAULT_TURNS = 30; // ルーム作成者が変更可能（5〜99）

// ===== ゴールステージ（一本道・8列×3段の蛇行）=====
const PATH2 = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) PATH2.push([r % 2 ? 7 - c : c, r]);
const LAYOUT2 = ['start','world','pay','shukai','item','sugar','event','shop','gacha','dj','ex','date','photo','collab','item','trouble',
 'marry','event','tata','job','offkai','warp','pay','goal'];
const GOAL_BONUS = [5000, 3000, 1500, 500]; // 基準額（add()でMONEY_SCALE倍される） // ゴール順ボーナス

// ===== アイテム =====
const ITEMS = {
  dice2:{icon:'🎲🎲',name:'ダブルダイス',desc:'サイコロ2個'},
  dice3:{icon:'🎲🎲🎲',name:'トリプルダイス',desc:'サイコロ3個'},
  plane:{icon:'✈️',name:'飛行機',desc:'10マス進む'},
  train:{icon:'🚄',name:'新幹線',desc:'8マス進む'},
  ship:{icon:'🚢',name:'船',desc:'6マス進む'},
  bike:{icon:'🛵',name:'バイク',desc:'出目+3'},
  amulet:{icon:'🧿',name:'お守り',desc:'ピンチ・トラブルを1回無効(自動)'}
};
const ITEM_POOL = ['dice2','dice2','dice2','dice3','plane','train','ship','ship','bike','bike','amulet','amulet'];

// ===== ステータスアイコンの説明（プレイヤー欄・凡例に表示）=====
const BADGES = {
  sugar:  { icon: '🍬', name: 'お砂糖', desc: '恋人。毎ターン収入が入る。2人以上（多糖）だと稼げるがバレるリスクも' },
  live:   { icon: '🏠', name: '同棲', desc: 'お砂糖と同棲中。毎ターンの収入アップ' },
  married:{ icon: '💍', name: '結婚', desc: '毎ターン家計の収入。多糖のまま結婚するとお砂糖が1人に絞られる' },
  friends:{ icon: '👫', name: '友達', desc: 'お砂糖に変化することがある' },
  exes:   { icon: '💔', name: '元お砂糖', desc: '遭遇イベで金を取られたり、復縁・和解することも' },
  fame:   { icon: '⭐', name: '人気度', desc: '1つにつきイベ収入+10%（最大5）。終了時に加点' },
  fbt:    { icon: '🕺', name: 'フルトラ', desc: '集会・イベ・DJなどの収入+30%' },
  pc:     { icon: '💻', name: '高性能PC', desc: 'ピンチ・損失が半分になる' }
};
