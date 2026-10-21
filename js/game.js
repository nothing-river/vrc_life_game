let G;
const L = () => G.stage === 'goal' ? LAYOUT2 : LAYOUT;
const mult = p => 1 + p.fame * .1 + (p.fbt ? .3 : 0);
const others = p => G.ps.filter(o => o !== p);
const fame = (p, n) => p.fame = Math.max(0, Math.min(5, p.fame + n));
const score = p => p.money + MONEY_SCALE * ((p.sugar ? 2000 + (p.sugar - 1) * 1000 : 0) + (p.live ? 1000 : 0) + (p.married ? 2000 : 0) + p.fame * 500);

function initUI(ps, turns, ex0) {
  const order = ps.map((_, i) => i); // 手番の順番はランダム（入室順にしない）
  for (let i = order.length - 1; i > 0; i--) { const j = rnd(0, i); [order[i], order[j]] = [order[j], order[i]]; }
  G = { order, oi: 0, ps: ps.map(p => ({ ...p, pos: 0, money: START_MONEY, sugar: 0, friends: 0, exes: ex0 | 0, live: false, married: false, fbt: false, pc: false, fame: 0, skip: 0, items: ['dice2'], done: false, rank: 0 })),
    t: order[0], round: 1, turns: turns || DEFAULT_TURNS, stage: 'main', fin: 0, busy: false, over: false };
  $('#setup').hidden = true; $('#game').hidden = false;
  $('#roll').onclick = () => onRoll(-1);
  $('#items').onclick = e => { const x = e.target.closest('button'); if (x && !x.disabled) onRoll(+x.dataset.i); };
  $('#route').onclick = e => { const x = e.target.closest('button'); if (x && !x.disabled) onPick(+x.dataset.i); };
  $('#stat').onclick = e => { const c = e.target.closest('.chip'), t = $('#tip'); if (c && c.dataset.tip) { t.textContent = c.dataset.tip; t.hidden = false; } else t.hidden = true; };
  $('#editme').hidden = !Net.on; $('#editme').onclick = openProfile; $('#tip').hidden = true;
  setPlayerStyles(); renderLegend(); renderBoard(); renderTokens(); renderStat();
}
function onPick(i) {
  if (!Net.on || Net.host) { if (G.choice && (!Net.on || G.t === Net.seat)) pickRoute(i); } else Net.conn.send({ k: 'pick', i });
}
function afterStart() { log('🎲 手番の順番：' + G.order.map(i => N(G.ps[i])).join(' → ')); announce(); }
function startGame(ps, turns, ex0) { initUI(ps, turns, ex0); afterStart(); }
function onRoll(i = -1) {
  if (!Net.on) return turn(i);
  if (Net.host) { if (G.t === Net.seat) turn(i); } else Net.conn.send({ k: 'roll', i });
}

function announce() {
  const p = G.ps[G.t], left = G.turns - G.round;
  const sub = G.stage === 'goal' ? '🏁 ゴールステージ！目指せゴール'
    : `${G.round}/${G.turns}ターン ` + (left > 0 ? (left <= 5 ? `ゴールステージまであと${left}ターン` : '') : '最終ターン！この後ゴールステージへ');
  say(`${N(p)}の番です\n${sub}`); renderStat();
}

async function rollDice(n = 1) {
  const r = () => [...Array(n)].map(() => rnd(1, 6));
  for (let i = 0; i < 9; i++) { showDice(r().join('+')); await sleep(70); }
  const v = r(), s = v.reduce((a, b) => a + b);
  showDice(n > 1 ? `${v.join('+')}=${s}` : s); return s;
}

function add(p, n, text, fm = 0) {
  n = Math.round(n * MONEY_SCALE / 100) * 100; p.money += n; if (fm) fame(p, fm);
  const f = fm > 0 ? ' ⭐UP' : fm < 0 ? ' ⭐DOWN' : '';
  log(`${N(p)}：${text}（${n >= 0 ? '+' : ''}${yen(n)}${f}）`);
  say(`${text}\n${n >= 0 ? '+' : ''}${yen(n)}${f}`); renderStat();
}
function losesugar(p, n, why) {
  n = Math.min(n, p.sugar); p.sugar -= n; p.exes += n; if (!p.sugar) p.live = false;
  say(`${why}
${n > 1 ? 'お砂糖' + n + '人と' : 'お砂糖と'}破局…💔`); log(`${N(p)}：${why}（お砂糖と破局）`); renderStat();
}
function giveItem(p, id) {
  const it = ITEMS[id];
  if (p.items.length >= 3) return add(p, 300, `${it.icon}${it.name}は持ちきれないので売却`);
  p.items.push(id); say(`${it.icon} ${it.name}をゲット！`); log(`${N(p)}：${it.name}を入手`); renderStat();
}
function useAmulet(p) {
  const i = p.items.indexOf('amulet'); if (i < 0) return false;
  p.items.splice(i, 1); say('🧿 お守りが身代わりに！\nピンチを回避'); log(`${N(p)}：お守りで回避`); renderStat(); return true;
}

// 分かれ道の選択（本人が選ぶ。退出者は自動、45秒で時間切れ→ランダム）
let routeRes, routeTimer;
function askRoute(p, pos) {
  const opts = FORKS[pos];
  if (p.auto) return Promise.resolve(rnd(0, opts.length - 1));
  return new Promise(res => {
    routeRes = res; G.choice = { opts }; say(`${N(p)}：分かれ道！どちらへ進む？`); renderStat();
    clearTimeout(routeTimer); routeTimer = setTimeout(() => pickRoute(rnd(0, opts.length - 1)), 45000);
  });
}
function pickRoute(i) {
  if (!G.choice) return; clearTimeout(routeTimer);
  const lab = G.choice.opts[i], r = routeRes; G.choice = null;
  log(`${N(G.ps[G.t])}：${lab}を選んだ`); renderStat(); r(i);
}

// 1マスずつ移動。メインは周回ループ＋分岐（1周でボーナス）、ゴールステージはゴールで止まる
async function moveBy(p, n, delay) {
  for (let i = 0; i < n; i++) {
    if (G.stage === 'goal') { if (p.pos >= LAYOUT2.length - 1) break; p.pos++; }
    else {
      const nx = NEXT[p.pos];
      p.pos = nx.length > 1 ? nx[await askRoute(p, p.pos)] : nx[0];
      if (p.pos === 0) { add(p, 1000, 'ログインボーナス（1周）'); await sleep(500); }
    }
    renderTokens(); await sleep(delay);
  }
}

async function turn(ui = -1) {
  if (G.busy || G.over) return;
  const p = G.ps[G.t]; if (p.done) return;
  if (ui >= 0 && (!p.items[ui] || p.items[ui] === 'amulet')) return;
  G.busy = true; renderStat();
  if (p.skip > 0) {
    p.skip--; say(`${N(p)}は足止め中…💤\n今回はお休み`); log(`${N(p)}：お休み`);
    await sleep(1200); return endTurn(p, false);
  }
  const item = ui >= 0 ? p.items.splice(ui, 1)[0] : null;
  let steps, delay = 250;
  if (item) { say(`${ITEMS[item].icon} ${ITEMS[item].name}を使った！`); log(`${N(p)}：${ITEMS[item].name}を使用`); renderStat(); await sleep(800); }
  switch (item) {
    case 'dice2': steps = await rollDice(2); break;
    case 'dice3': steps = await rollDice(3); break;
    case 'bike': steps = 3 + await rollDice(); break;
    case 'plane': steps = 10; delay = 120; break;
    case 'train': steps = 8; delay = 120; break;
    case 'ship': steps = 6; delay = 120; break;
    default: steps = await rollDice();
  }
  await moveBy(p, steps, delay);
  await H[L()[p.pos]](p);
  await sleep(1100);
  await endTurn(p, true);
}

function nextO() {
  const n = G.ps.length;
  for (let i = 1; i <= n; i++) { const oi = (G.oi + i) % n; if (!G.ps[G.order[oi]].done) return oi; }
  return -1;
}
async function endTurn(p, income) {
  if (income && !p.done) {
    if (p.married) add(p, 150, '家計の助け');
    if (p.sugar) add(p, 100 * p.sugar + (p.live ? 100 : 0), p.live ? 'お砂糖と同棲生活' : 'お砂糖とペアワールド巡り');
  }
  await sleep(700);
  const no = nextO();
  if (no < 0) { G.over = true; return finish(); }
  G.oi = no; G.t = G.order[no];
  if (G.stage === 'main' && G.oi === 0 && ++G.round > G.turns) return toGoalStage();
  G.busy = false; announce();
  if (G.ps[G.t].auto) setTimeout(turn, 900); // 退出した人は自動で進行
}

// 規定ターン終了：ゴールステージへ。所持金の多い順にスタート位置が前になる
async function toGoalStage() {
  say('🏁 ゴールステージへ！\nここからは一本道。ゴールを目指せ！'); log('ゴールステージ開始');
  await sleep(1800);
  [...G.ps].sort((a, b) => score(b) - score(a)).forEach((p, i) => p.pos = G.ps.length - 1 - i);
  G.stage = 'goal'; G.oi = 0; G.t = G.order[0];
  renderBoard(); renderTokens(); renderStat();
  log('所持金の多い順にスタート位置が前になった');
  G.busy = false; announce();
  if (G.ps[G.t].auto) setTimeout(turn, 900);
}

// ===== 各マスの効果 =====
const H = {
  start: async () => {},
  pay: async p => add(p, rnd(3, 12) * 100, pick(TEXT.pay)),
  loss: async p => {
    if (useAmulet(p)) return;
    add(p, -rnd(2, 9) * 100 * (p.pc ? .5 : 1), pick(TEXT.loss));
    if (p.sugar && rnd(1, 4) === 1) { await sleep(800); losesugar(p, 1, 'ピンチで心がすれ違った'); }
  },
  job: async p => add(p, 1000, pick(TEXT.job)),
  world: async p => { const [t, m, f] = pick(TEXT.world); add(p, m, t, f); },
  trouble: async p => {
    if (useAmulet(p)) return;
    const [t, m, f, s] = pick(TEXT.trouble); p.skip += s; add(p, m, t, f);
  },
  gacha: async p => {
    if (rnd(1, 4) === 1) return giveItem(p, pick(ITEM_POOL));
    const [t, m, f] = pick(TEXT.gacha); add(p, m, t, f);
  },
  item: async p => giveItem(p, pick(ITEM_POOL)),
  shukai: async p => {
    say('集会を開催！参加者は…？'); const d = await rollDice();
    add(p, d * 400 * mult(p) * (p.sugar ? 1.5 : 1), d === 1 ? '集会は過疎気味…' : `集会に${d * 5}人が来場！${p.sugar ? 'お砂糖が運営を手伝った' : ''}`, d >= 5 ? 1 : 0);
  },
  event: async p => {
    say('個人イベを開催！結果は…？'); const d = await rollDice();
    const g = [-300, 800, 800, 1500, 1500, 3000][d - 1];
    add(p, g > 0 ? g * mult(p) : g, ['誰も来なかった…', '小さなライブ', '小さなライブ', '大盛況', '大盛況', 'バズって大成功！'][d - 1], d === 6 ? 1 : 0);
  },
  dj: async p => {
    say('DJイベ！フロアの反応は？'); const d = await rollDice();
    d >= 4 ? add(p, d * 350 * mult(p), 'フロアが大盛り上がり！', 1) : add(p, 200, '選曲がハマらなかった…');
  },
  photo: async p => {
    say('撮影会を開催！'); const d = await rollDice();
    add(p, d * 200 * mult(p), d >= 5 ? '写真集がバズった！' : '撮影会が無事終了', d >= 5 ? 1 : 0);
  },
  quiz: async p => {
    say('ワールドクイズ！偶数なら正解'); const d = await rollDice();
    d % 2 === 0 ? add(p, 1200, '正解！賞金ゲット') : add(p, -400, '不正解…参加費だけ取られた');
  },
  shop: async p => {
    say('BOOTHでお買い物…'); const d = await rollDice();
    if (d <= 2) add(p, -200, '小物をポチった');
    else if (d === 3) p.fbt ? add(p, 300, '余ったフルトラを譲った') : (p.fbt = true, add(p, -800, 'フルトラ購入！イベ収入UP🕺'));
    else if (d === 4) p.pc ? add(p, 300, '古いPCを売った') : (p.pc = true, add(p, -800, '高性能PCに買い替え！ピンチ半減💻'));
    else if (d === 5) add(p, -600, '新アバターをお迎え！', 1);
    else add(p, 1500, '福袋が大当たり！');
  },
  warp: async p => {
    say('ワールドジャンプ！'); const d = await rollDice(), goal = G.stage === 'goal'; let t;
    const back = k => { for (let i = 0; i < k; i++) p.pos = goal ? Math.max(1, p.pos - 1) : PREV[p.pos][0]; };
    const fwd = k => { for (let i = 0; i < k; i++) p.pos = goal ? Math.min(LAYOUT2.length - 2, p.pos + 1) : NEXT[p.pos][0]; };
    if (d <= 2) { back(3); t = 'ワープ事故で3マス戻る'; }
    else if (d <= 4) { fwd(2); t = '2マス進んだ！'; }
    else if (d === 5) { fwd(4); t = '近道発見！4マス進む'; }
    else {
      const os = others(p).filter(o => !o.done);
      if (os.length) { const o = pick(os); [p.pos, o.pos] = [o.pos, p.pos]; t = `${N(o)}と位置が入れ替わった！`; } else t = '誰もいなかった…';
    }
    renderTokens(); say(t); log(`${N(p)}：${t}`);
  },
  rest: async p => { p.skip = 1; add(p, 100, 'ベッドで寝落ち…次回お休み💤'); },
  collab: async p => {
    const o = pick(others(p)); add(o, 500, `${N(p)}とコラボ！`, 1); add(p, 500, `${N(o)}とコラボ！`, 1);
  },
  social: async p => {
    const os = others(p);
    if (rnd(0, 1)) { os.forEach(o => add(o, 200, `${N(p)}にドリンクをおごられた`)); add(p, -200 * os.length, '全員にドリンクをおごった', 1); }
    else { os.forEach(o => add(o, -200, `${N(p)}の誕生日会に参加`)); add(p, 200 * os.length, '誕生日会を開いてもらった！'); }
  },
  sugar: async p => {
    if (p.friends > 0 && rnd(1, 2) === 1) { p.friends--; p.sugar++; say(`友達からお砂糖に変化！🍬${p.sugar > 1 ? '\n（多糖に…）' : ''}`); log(`${N(p)}：友達がお砂糖に`); return renderStat(); }
    if (p.sugar >= 3) return add(p, 200, 'お砂糖たちとラブラブ報告（バレないように…）');
    say(p.sugar ? 'もう一人…？お砂糖チャンス！3以上で成功' : 'お砂糖チャンス！成功の目は3以上');
    const d = await rollDice();
    if (d >= 3) { p.sugar++; say(p.sugar > 1 ? '多糖になった…！🍬🍬\nバレないように気をつけて' : 'お砂糖ゲット！🍬'); log(`${N(p)}：お砂糖が${p.sugar}人に`); renderStat(); }
    else { say('今回は縁がなかった…'); log(`${N(p)}：お砂糖ならず`); }
  },
  date: async p => {
    if (!p.sugar) {
      if (rnd(1, 4) === 1) { p.sugar = 1; say('ひとりワールド巡り中に運命の出会い！🍬'); log(`${N(p)}：出会ってお砂糖に`); return renderStat(); }
      return add(p, 100, 'お砂糖がいないのでひとりワールド巡り…');
    }
    if (p.sugar > 1 && rnd(1, 3) === 1) {
      add(p, -500, 'デートがダブルブッキング！');
      if (rnd(0, 1)) { await sleep(900); losesugar(p, 1, 'ブッキングがバレた'); }
      return;
    }
    const r = rnd(1, 6);
    if (r === 5) { p.live = true; return add(p, -500, '同棲ワールドを建てた🏠'); }
    if (r === 6) { add(p, -300, 'ケンカしてしまった'); if (rnd(1, 3) === 1) { await sleep(800); losesugar(p, 1, 'ケンカが決定打になった'); } return; }
    const [t, m, f] = pick(TEXT.date); add(p, m, t, f);
  },
  marry: async p => {
    if (p.married) return add(p, 200, '結婚記念日');
    if (p.sugar > 1) { losesugar(p, p.sugar - 1, '結婚で多糖が発覚…他のお砂糖とは別れた'); await sleep(1000); }
    p.married = true; let gift = 0;
    others(p).forEach(o => { o.money -= 300 * MONEY_SCALE; gift += 300; });
    add(p, gift, '結婚！みんなから祝儀'); renderStat();
  },
  ex: async p => {
    if (p.exes <= 0) { say('元お砂糖はいない…\n今回は何も起きなかった'); return log(`${N(p)}：元お砂糖がいないので何も起きなかった`); }
    say('元お砂糖とばったり遭遇…！'); const d = await rollDice();
    if (d === 1) add(p, -rnd(4, 12) * 100, '元お砂糖にお金をたかられた…');
    else if (d === 2) { if (p.sugar) losesugar(p, 1, '元お砂糖と会っていたのが現お砂糖にバレた'); else add(p, -300, '気まずくて逃げ出した…', -1); }
    else if (d === 3) add(p, -200, '気まずい再会…目を合わせられない', -1);
    else if (d === 4) { p.exes--; p.friends++; add(p, 200, '和解して友達に戻った'); }
    else if (d === 5) { p.exes--; p.sugar++; say(`元お砂糖と復縁！🍬${p.sugar > 1 ? '\n多糖に…' : ''}`); log(`${N(p)}：元お砂糖と復縁`); renderStat(); }
    else add(p, 500, '元お砂糖が仕事を紹介してくれた', 1);
  },
  past: async p => {
    if (!p.sugar) return add(p, 100, '他人のお砂糖の過去話を聞いてしまった…');
    say('お砂糖の過去を知ってしまった…'); const d = await rollDice();
    if (d <= 2) { await sleep(500); losesugar(p, 1, '過去を知ってショックで別れた'); }
    else if (d <= 4) add(p, 200, '過去は過去。気にしないと決めた');
    else add(p, 600, '過去を受け止めて絆が深まった', 1);
  },
  friend: async p => {
    const d = rnd(1, 6);
    if (d <= 2) { p.friends++; say('フレンド申請が通った！👫'); log(`${N(p)}：友達が増えた`); renderStat(); }
    else if (d === 3) add(p, 300, '友達とワールド巡り');
    else if (d === 4) {
      if (p.friends > 0) { p.friends--; p.sugar++; say(`友達がお砂糖に変化！🍬${p.sugar > 1 ? '\n多糖に…' : ''}`); log(`${N(p)}：友達がお砂糖に`); }
      else { p.friends++; say('新しい友達ができた👫'); }
      renderStat();
    }
    else if (d === 5) add(p, -300, '友達にお金を貸した…');
    else add(p, 600, '友達が集会を手伝ってくれた');
  },
  offkai: async p => {
    say('リアルでオフ会！結果は…？'); const d = await rollDice();
    if (d === 1) add(p, -600, '交通費と宿代がかさんだ…');
    else if (d === 2) {
      if (p.sugar) { add(p, -300, 'お砂糖と初オフ…解釈違いで空気が悪く'); await sleep(900); losesugar(p, 1, 'リアルで会って別れた'); }
      else add(p, -300, 'オフ会で話が弾まなかった');
    }
    else if (d === 3) add(p, 500, 'オフ会が盛り上がった！', 1);
    else if (d === 4) {
      if (p.friends > 0) { p.friends--; p.sugar++; say(`オフ会で友達と急接近！お砂糖に🍬${p.sugar > 1 ? '\n多糖に…' : ''}`); log(`${N(p)}：オフ会で友達がお砂糖に`); renderStat(); }
      else { p.friends++; add(p, 100, 'オフ会で友達ができた👫'); }
    }
    else if (d === 5) {
      if (p.sugar) { if (rnd(0, 1)) p.live = true; add(p, 800, `リアルでも相性抜群！${p.live ? '同棲へ🏠' : ''}`, 1); }
      else add(p, 300, 'オフ会でみんなに奢ってもらった');
    }
    else if (p.sugar > 1) { add(p, -800, 'オフ会で多糖ブッキング…修羅場！'); await sleep(900); losesugar(p, 1, '修羅場で1人と破局'); }
    else add(p, 1200, 'オフ会ビンゴ大会で優勝！');
  },
  tata: async p => {
    if (p.sugar < 2) {
      say('お砂糖が増えそうな予感…'); const d = await rollDice();
      if (d >= 5) { p.sugar++; say(p.sugar > 1 ? '多糖になった！？🍬🍬' : 'お砂糖ができた🍬'); log(`${N(p)}：お砂糖が${p.sugar}人に`); renderStat(); }
      else add(p, 100, '平穏な日々');
      return;
    }
    say('多糖がバレるか…？'); const d = await rollDice();
    if (d === 1) { add(p, -1000, '全員にバレて大修羅場！', -2); await sleep(900); losesugar(p, p.sugar, '全員にバレた'); }
    else if (d <= 3) { add(p, -500, 'お砂糖の1人にバレた…'); await sleep(900); losesugar(p, 1, '多糖がバレた'); }
    else if (d <= 5) add(p, 600 * p.sugar, 'うまく両立できている…！');
    else add(p, 1500, '全員公認の仲良しグループに！', 1);
  },
  sns: async p => {
    const d = rnd(1, 6);
    if (d === 1) add(p, -300, '匂わせ投稿が炎上…', -1);
    else if (d === 2) { if (p.exes > 0 && p.sugar) add(p, -500, '元お砂糖がSNSで特定して絡んできた'); else add(p, -200, 'エゴサして落ち込んだ'); }
    else if (d <= 4) add(p, 400, '投稿がバズった！', 1);
    else if (d === 5) { if (p.sugar > 1) add(p, -300, '多糖がバレかけて慌てて投稿削除'); else add(p, 600, '投げ銭が集まった'); }
    else add(p, 1000, '大バズり！', 1);
  },
  goal: async p => {
    if (p.done) return;
    p.done = true; p.rank = ++G.fin;
    add(p, GOAL_BONUS[p.rank - 1], `${p.rank}位でゴール！🏁`);
  }
};

function finish() {
  Net.over = true; Net.bc({ k: 'end' });
  const K = MONEY_SCALE;
  const lines = p => {
    const r = [['💰 所持金（ゴール順ボーナス込み）', p.money, false]];
    if (p.sugar) r.push([`🍬 お砂糖 ${p.sugar}人`, K * (2000 + (p.sugar - 1) * 1000), true]);
    if (p.live) r.push(['🏠 同棲', K * 1000, true]);
    if (p.married) r.push(['💍 結婚', K * 2000, true]);
    if (p.fame) r.push([`⭐ 人気度 ${p.fame}`, K * 500 * p.fame, true]);
    return r;
  };
  const mx = f => Math.max(...G.ps.map(f));
  const titles = p => [
    p.rank === 1 && '🏁 ゴール一番乗り', p.money === mx(q => q.money) && '💰 所持金トップ',
    p.sugar >= 2 && p.sugar === mx(q => q.sugar) && '🍬 多糖王', p.fame >= 1 && p.fame === mx(q => q.fame) && '⭐ 人気者',
    p.exes >= 2 && p.exes === mx(q => q.exes) && '💔 破局王'].filter(Boolean);
  const rank = [...G.ps].sort((a, b) => score(b) - score(a)), medal = ['🥇', '🥈', '🥉', '4位'];
  $('#result').innerHTML = `<h2>🎉 ゲーム終了！結果発表</h2>
    <p class="lead">最終得点＝所持金（ゴール順ボーナス込み）＋お砂糖・同棲・結婚・人気度のボーナス</p>
    <ol class="rl">${rank.map((p, i) => `<li class="rc" style="${cv(p.color)}">
      <div class="rh"><span class="medal">${medal[i]}</span>${tok(p)}<strong>${esc(p.name)}</strong><em>${yen(score(p))}</em></div>
      <div class="rsub">🏁 ゴール ${p.rank}位${titles(p).map(t => `<span class="ttl">${t}</span>`).join('')}</div>
      <table>${lines(p).map(([l, v, b]) => `<tr><td>${l}</td><td>${b ? '+' : ''}${yen(v)}</td></tr>`).join('')}
        <tr class="sum"><td>最終得点</td><td>${yen(score(p))}</td></tr></table>
      <div class="chips">${chips(p)}</div></li>`).join('')}</ol>
    <details class="how" open><summary>📖 結果の見かた</summary>
      <p>💰 所持金：ゲーム中に稼いだお金（ゴール順ボーナス込み）。ゴール順ボーナスは1位${yen(GOAL_BONUS[0] * K)} / 2位${yen(GOAL_BONUS[1] * K)} / 3位${yen(GOAL_BONUS[2] * K)} / 4位${yen(GOAL_BONUS[3] * K)}</p>
      <p>🍬 お砂糖：1人目 ${yen(2000 * K)}、2人目以降は1人 ${yen(1000 * K)} のボーナス　🏠 同棲 ${yen(1000 * K)}　💍 結婚 ${yen(2000 * K)}　⭐ 人気度1つ ${yen(500 * K)}</p>
      <p>下のアイコンは終了時の持ち物・ステータス（カーソルを合わせると説明が出ます）。友達👫・元お砂糖💔は加点なしです。</p></details>
    <div class="endbtns"><button class="big" onclick="backToRoom()">${Net.on ? (Net.host ? 'ルームに戻って再戦する' : 'ルームに戻る') : 'もう一度遊ぶ（設定に戻る）'}</button>
    <button onclick="location.reload()">トップに戻る</button></div>
    ${Net.on ? '<p class="lead">ホストが「ルームに戻る」を押すと、戻ってきた人が同じルームに集まります。</p>' : ''}`;
  $('#result').showModal();
}
