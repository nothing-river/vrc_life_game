let G;
const mult = p => 1 + p.fame * .1 + (p.fbt ? .3 : 0);
const others = p => G.ps.filter(o => o !== p);
const fame = (p, n) => p.fame = Math.max(0, Math.min(5, p.fame + n));

function startGame(ps) {
  G = { ps: ps.map(p => ({ ...p, pos: 0, money: START_MONEY, sugar: false, live: false, married: false, fbt: false, pc: false, fame: 0, skip: 0 })), t: 0, round: 1, busy: false, over: false };
  renderBoard(); renderTokens(); renderStat();
  $('#roll').onclick = turn;
  announce();
}
function announce() {
  const left = GATE_TURN - G.round;
  const note = left > 0 ? (left <= 5 ? `ゴールゲートまであと${left}ターン` : '') : '最終ターン！この後ゴールゲート開放';
  say(`${G.ps[G.t].name}の番です\n${G.round}/${GATE_TURN}ターン ${note}`); renderStat();
}

async function rollDice() {
  const d = $('#dice');
  for (let i = 0; i < 9; i++) { d.textContent = rnd(1, 6); await sleep(70); }
  const v = rnd(1, 6); d.textContent = v; return v;
}

function add(p, n, text, fm = 0) {
  n = Math.round(n / 10) * 10; p.money += n; if (fm) fame(p, fm);
  const f = fm > 0 ? ' ⭐UP' : fm < 0 ? ' ⭐DOWN' : '';
  log(`${p.name}：${text}（${n >= 0 ? '+' : ''}${yen(n)}${f}）`);
  say(`${text}\n${n >= 0 ? '+' : ''}${yen(n)}${f}`); renderStat();
}
function breakup(p) { p.sugar = p.live = false; say('お砂糖と破局…🍬💔'); log(`${p.name}：お砂糖と破局`); renderStat(); }

async function turn() {
  if (G.busy || G.over) return;
  G.busy = true; $('#roll').disabled = true;
  const p = G.ps[G.t];
  if (p.skip > 0) {
    p.skip--; say(`${p.name}は足止め中…💤\n今回はお休み`); log(`${p.name}：お休み`);
    await sleep(1200); return endTurn(p, false);
  }
  const d = await rollDice();
  for (let i = 0; i < d && p.pos < GOAL; i++) { p.pos++; renderTokens(); await sleep(250); }
  await H[LAYOUT[p.pos]](p);
  await sleep(1100);
  if (G.over) return finish();
  await endTurn(p, true);
}
async function endTurn(p, income) {
  if (income) {
    if (p.married) add(p, 150, '家計の助け');
    if (p.sugar) add(p, p.live ? 200 : 100, p.live ? 'お砂糖と同棲生活' : 'お砂糖とペアワールド巡り');
  }
  await sleep(700);
  G.t = (G.t + 1) % G.ps.length;
  if (G.t === 0 && ++G.round > GATE_TURN) return gate();
  G.busy = false; $('#roll').disabled = false; announce();
}

// ゴールゲート：全員がゴールへワープ。先頭(同位置なら所持金が多い人)がゴールテープを切る
async function gate() {
  say('🌌 ゴールゲート開放！\n全員ゴールへワープ！'); log('ゴールゲートが開いた');
  await sleep(1500);
  G.goalBy = [...G.ps].sort((a, b) => b.pos - a.pos || b.money - a.money)[0];
  G.ps.forEach(p => p.pos = GOAL); renderTokens();
  G.over = G.gate = true; await sleep(1200); finish();
}

// ===== 各マスの効果 =====
const H = {
  start: async () => {},
  pay: async p => add(p, rnd(3, 12) * 100, pick(TEXT.pay)),
  loss: async p => {
    add(p, -rnd(2, 9) * 100 * (p.pc ? .5 : 1), pick(TEXT.loss));
    if (p.sugar && rnd(1, 4) === 1) { await sleep(800); breakup(p); }
  },
  job: async p => add(p, 1000, pick(TEXT.job)),
  world: async p => { const [t, m, f] = pick(TEXT.world); add(p, m, t, f); },
  trouble: async p => { const [t, m, f, s] = pick(TEXT.trouble); p.skip += s; add(p, m, t, f); },
  gacha: async p => { const [t, m, f] = pick(TEXT.gacha); add(p, m, t, f); },
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
    say('ワールドジャンプ！'); const d = await rollDice(); let t;
    if (d <= 2) { p.pos = Math.max(1, p.pos - 3); t = 'ワープ事故で3マス戻る'; }
    else if (d <= 4) { p.pos = Math.min(GOAL - 1, p.pos + 2); t = '2マス進んだ！'; }
    else if (d === 5) { p.pos = Math.min(GOAL - 1, p.pos + 4); t = '近道発見！4マス進む'; }
    else { const o = pick(others(p)); [p.pos, o.pos] = [o.pos, p.pos]; t = `${o.name}と位置が入れ替わった！`; }
    renderTokens(); say(t); log(`${p.name}：${t}`);
  },
  rest: async p => { p.skip = 1; add(p, 100, 'ベッドで寝落ち…次回お休み💤'); },
  collab: async p => {
    const o = pick(others(p)); add(o, 500, `${p.name}とコラボ！`, 1); add(p, 500, `${o.name}とコラボ！`, 1);
  },
  social: async p => {
    const os = others(p);
    if (rnd(0, 1)) { os.forEach(o => add(o, 200, `${p.name}にドリンクをおごられた`)); add(p, -200 * os.length, '全員にドリンクをおごった', 1); }
    else { os.forEach(o => add(o, -200, `${p.name}の誕生日会に参加`)); add(p, 200 * os.length, '誕生日会を開いてもらった！'); }
  },
  sugar: async p => {
    if (p.sugar) return add(p, 200, 'お砂糖とラブラブ報告');
    say('お砂糖チャンス！成功の目は3以上'); const d = await rollDice();
    if (d >= 3) { p.sugar = true; say('お砂糖ゲット！🍬'); log(`${p.name}：お砂糖ができた`); renderStat(); }
    else { say('今回は縁がなかった…'); log(`${p.name}：お砂糖ならず`); }
  },
  date: async p => {
    if (!p.sugar) {
      if (rnd(1, 4) === 1) { p.sugar = true; say('ひとりワールド巡り中に運命の出会い！🍬'); log(`${p.name}：出会ってお砂糖に`); return renderStat(); }
      return add(p, 100, 'お砂糖がいないのでひとりワールド巡り…');
    }
    const r = rnd(1, 6);
    if (r === 5) { p.live = true; return add(p, -500, '同棲ワールドを建てた🏠'); }
    if (r === 6) { add(p, -300, 'ケンカしてしまった'); if (rnd(1, 3) === 1) { await sleep(800); breakup(p); } return; }
    const [t, m, f] = pick(TEXT.date); add(p, m, t, f);
  },
  marry: async p => {
    if (p.married) return add(p, 200, '結婚記念日');
    p.married = true; let gift = 0;
    others(p).forEach(o => { o.money -= 300; gift += 300; });
    add(p, gift, '結婚！みんなから祝儀'); renderStat();
  },
  goal: async p => { G.over = true; G.goalBy = p; log(`${p.name}がゴール！`); }
};

function finish() {
  const score = p => p.money + (p.sugar ? 2000 : 0) + (p.live ? 1000 : 0) + (p.married ? 2000 : 0) + p.fame * 500 + (p === G.goalBy ? 5000 : 0);
  const rank = [...G.ps].sort((a, b) => score(b) - score(a));
  $('#result').innerHTML = `<h2>ゲーム終了！</h2><p class="lead">${G.goalBy.name}が${G.gate ? 'ゲート開放時に先頭で' : ''}ゴール(+5,000円)。ボーナス：お砂糖+2,000円、同棲+1,000円、結婚+2,000円、人気度⭐1つにつき+500円。</p>
    <ol>${rank.map(p => `<li>${tok(p)}<strong>${p.name}</strong><span>${yen(score(p))}</span></li>`).join('')}</ol>
    <button class="big" onclick="location.reload()">もう一度遊ぶ</button>`;
  $('#result').showModal();
}
