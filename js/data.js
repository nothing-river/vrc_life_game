// ===== ボード定義 =====
const COLS = 14, ROWS = 9;
const PATH = [];
for (let c = 0; c < COLS; c++) PATH.push([c, 0]);
for (let r = 1; r < ROWS; r++) PATH.push([COLS - 1, r]);
for (let c = COLS - 2; c >= 0; c--) PATH.push([c, ROWS - 1]);
for (let r = ROWS - 2; r >= 1; r--) PATH.push([0, r]);
const GOAL = PATH.length - 1; // 41

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
  quiz:{icon:'❓',label:'クイズ'}
};

const LAYOUT = ['start','world','pay','shukai','sugar','shop','loss','event','job','gacha','photo','shukai','date','trouble',
 'dj','marry','pay','collab','warp','quiz','sugar','event','loss','job','social','shukai','rest','world','gacha','sugar',
 'date','trouble','event','shop','marry','dj','photo','collab','job','warp','pay','goal'];

const TEXT = {
  pay:['ワールド売上が入った','アバター販売が好調','BOOTHで投げ銭をもらった','フレンドに奢ってもらった','お年玉イベで大量ゲット','衣装の受注制作が完売','Vket出展が大盛況','配信の投げ銭が止まらない'],
  loss:['回線が落ちて有料イベを逃した','フルトラがズレて機材を買い直し','課金アバターを衝動買い','PCが熱暴走して修理','HMDのケーブルを踏んで断線','イベ用の会場費を払った','コントローラーを床に叩きつけた'],
  job:['ワールド制作の納品','バーテンダーのバイト','ダンサーの出演料','ショップ店員の給料日','アバター改変の依頼','ライブ配信のスタッフ業'],
  world:[['夜景ワールドで友達と合流',300,0],['隠しギミックを見つけて話題に',200,1],['初見さんを案内してあげた',400,0],['ワールドのいいねが伸びた',500,1],['ミラーで自撮りしまくった',0,1],['迷子になって時間を溶かした',-200,0],['イベワールドで偶然フレンドと再会',300,0],['プライベートでまったり',400,0],['絶景ポイントで寝転んだ',300,0]],
  trouble:[['荒らしに絡まれてブロックした',-200,0,0],['マイクが入りっぱなしで独り言が流出',-300,-1,0],['改変アバターが透明になった',-300,0,0],['インスタンスが満員で待ちぼうけ',0,0,1],['炎上しかけたが謝罪で収まった',-400,-1,0],['グラボが逝った',-600,0,0],['変な噂を流された',-200,-1,0],['アップデートで入れなくなった',0,0,1]],
  gacha:[['大当たり！限定アバターを引いた',2000,1],['当たり！',800,0],['ハズレ…',-300,0],['ダブりばかり',-100,0],['SSR確定演出！',1500,0],['課金しすぎた',-600,0],['ミミックに噛まれた',-200,0]],
  date:[['お揃いアバターでデート',300,1],['記念日を祝った',800,0],['夜景ワールドで寝落ち通話',200,0],['ペアでフォトコンに入賞',900,1]]
};

const START_MONEY = 3000;
const COLORS = ['#ff8fb8', '#7fe3d0', '#ffd166', '#a99bff'];

// 全員がこのターン数を遊び終えると「ゴールゲート」が開き、全員ゴールへワープして終了
const GATE_TURN = 30;
