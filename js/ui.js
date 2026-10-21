const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[rnd(0, a.length - 1)];
const yen = n => {
  const a = Math.abs(n), m = Math.floor(a / 10000), r = a % 10000;
  return (n < 0 ? '-' : '') + (m ? m + '万' + (r ? r.toLocaleString() : '') : a.toLocaleString()) + '円';
};

// 写真を正方形に切り抜いて軽量化 (120px JPEG)
function loadPhoto(file) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const s = Math.min(im.width, im.height), c = document.createElement('canvas');
      c.width = c.height = 120;
      c.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 120, 120);
      URL.revokeObjectURL(im.src);
      res(c.toDataURL('image/jpeg', .8));
    };
    im.src = URL.createObjectURL(file);
  });
}

const tok = p => `<i class="tok" style="--c:${p.color};${p.img ? `background-image:url(${p.img})` : ''}">${p.img ? '' : [...p.name][0]}</i>`;

// ===== セットアップ画面（同じ端末 / ルーム作成 / ルーム入室）=====
const rowHtml = i => `<div class="prow" data-i="${i}">
  <label class="ph" style="--c:${COLORS[i]}"><input type="file" accept="image/*" hidden><span>写真</span></label>
  <input class="nm" maxlength="8" placeholder="プレイヤー${i + 1}の名前"></div>`;
function bindRow(r, photos, i) {
  r.querySelector('input[type=file]').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    photos[i] = await loadPhoto(f);
    const ph = r.querySelector('.ph'); ph.style.backgroundImage = `url(${photos[i]})`; ph.querySelector('span').hidden = true;
  };
}

function buildSetup(onStart) {
  const el = $('#setup');
  const menu = () => {
    el.innerHTML = `<h1>VRC人生ゲーム</h1><p class="lead">集会で稼ぎ、お砂糖と出会い、先にゴールを目指そう。</p>
      <div class="menu"><button class="big" data-m="local">同じ端末で遊ぶ</button>
      <button class="big alt" data-m="host">ルームを作る（オンライン）</button>
      <button class="big alt" data-m="join">ルームに入る（オンライン）</button></div>`;
    el.querySelector('.menu').onclick = e => {
      const m = e.target.dataset.m;
      if (m === 'local') local(); else if (m) online(m === 'host');
    };
  };
  const local = () => {
    let n = 2; const photos = [null, null, null, null];
    el.innerHTML = `<h1>同じ端末で遊ぶ</h1><div class="count" id="count">${[2, 3, 4].map(i => `<button data-n="${i}">${i}人</button>`).join('')}</div>
      <div id="rows">${[0, 1, 2, 3].map(rowHtml).join('')}</div>
      ${turnsHtml}<br><button id="go" class="big">ゲーム開始</button> <button class="back">戻る</button>`;
    const sync = () => {
      el.querySelectorAll('.prow').forEach((r, i) => r.hidden = i >= n);
      el.querySelectorAll('#count button').forEach(b => b.classList.toggle('on', +b.dataset.n === n));
    };
    el.querySelector('#count').onclick = e => { if (e.target.dataset.n) { n = +e.target.dataset.n; sync(); } };
    el.querySelectorAll('.prow').forEach((r, i) => bindRow(r, photos, i));
    el.querySelector('.back').onclick = menu;
    $('#go').onclick = () => onStart([...Array(n)].map((_, i) => ({
      name: el.querySelectorAll('.nm')[i].value.trim() || `P${i + 1}`, img: photos[i], color: COLORS[i] })), clampTurns($('#tn').value));
    sync();
  };
  const online = isHost => {
    const photos = [null];
    el.innerHTML = `<h1>${isHost ? 'ルームを作る' : 'ルームに入る'}</h1>
      <p class="lead">${isHost ? '合言葉を決めて、参加する人に伝えてください（2〜4人）。' : 'ホストに教えてもらった合言葉を入力してください。'}</p>
      ${rowHtml(0)}
      <input id="pw" class="nm pw" maxlength="20" placeholder="合言葉（なんでもOK）">${isHost ? turnsHtml : ''}
      <p id="err" class="err" role="alert"></p>
      <button id="go" class="big">${isHost ? 'ルーム作成' : '入室'}</button> <button class="back">戻る</button><div id="lob"></div>`;
    bindRow(el.querySelector('.prow'), photos, 0);
    el.querySelector('.back').onclick = () => { if (Net.peer) Net.peer.destroy(); Net.on = Net.host = false; menu(); };
    const ui = {
      error: m => { $('#err').textContent = m; $('#go').disabled = false; },
      update: list => {
        $('#lob').innerHTML = `<h2>参加者 ${list.length}/4</h2>` +
          list.map((p, i) => `<div class="pc">${tok({ ...p, color: COLORS[i] })}<strong>${p.name}</strong>${i === 0 ? '（ホスト）' : ''}</div>`).join('') +
          (isHost ? `<button id="start" class="big" ${list.length < 2 ? 'disabled' : ''}>この人数で開始</button>` : '<p class="lead">ホストの開始を待っています…</p>');
        if (isHost) $('#start').onclick = startOnline;
      }
    };
    $('#go').onclick = () => {
      const pw = $('#pw').value.trim();
      if (!pw) return ui.error('合言葉を入力してください');
      $('#err').textContent = ''; $('#go').disabled = true;
      const me = { name: el.querySelector('.nm').value.trim() || (isHost ? 'ホスト' : 'ゲスト'), img: photos[0] };
      isHost ? hostRoom(pw, me, ui) : joinRoom(pw, me, ui);
    };
  };
  menu();
}

// ===== ボード描画 =====
function renderBoard() {
  const g = G.stage === 'goal', path = g ? PATH2 : PATH, lay = g ? LAYOUT2 : LAYOUT;
  const bd = $('#board'); bd.className = g ? 'g' : '';
  bd.innerHTML = path.map(([x, y], i) => {
    const t = lay[i], m = TYPES[t];
    const cls = g ? '' : `${FORKS[i] ? ' fork' : ''}${MERGES.has(i) ? ' merge' : ''}${i >= PN ? ' br' : ''}`;
    return `<div class="cell t-${t}${cls}" style="grid-column:${x + 1};grid-row:${y + 1}"><b>${m.icon}</b><small>${m.label}</small><div class="toks" id="c${i}"></div></div>`;
  }).join('');
}

function renderTokens() {
  document.querySelectorAll('.toks').forEach(e => e.innerHTML = '');
  G.ps.forEach(p => $('#c' + p.pos).insertAdjacentHTML('beforeend', tok(p)));
  Net.sync();
}

function renderStat() {
  $('#stat').innerHTML = G.ps.map((p, i) => `
    <div class="pc ${i === G.t ? 'now' : ''}">${tok(p)}<div><strong>${p.name}${p.done ? ' 🏁' + p.rank + '位' : ''}</strong>
    <span>${yen(p.money)} ${'🍬'.repeat(p.sugar)}${p.live ? '🏠' : ''}${p.married ? '💍' : ''}${p.fbt ? '🕺' : ''}${p.pc ? '💻' : ''}${'⭐'.repeat(p.fame)}${p.friends ? ' 👫' + p.friends : ''}${p.exes ? ' 💔' + p.exes : ''}<br>${p.items.map(k => ITEMS[k].icon).join(' ')}</span></div></div>`).join('');
  const cp = G.ps[G.t], own = !(Net.on && G.t !== Net.seat), mine = !G.busy && !G.over && !cp.done && own;
  $('#items').innerHTML = cp.items.map((k, i) => `<button data-i="${i}" ${mine && k !== 'amulet' ? '' : 'disabled'} title="${ITEMS[k].desc}">${ITEMS[k].icon} ${ITEMS[k].name}<small> ${ITEMS[k].desc}</small></button>`).join('');
  $('#route').innerHTML = G.choice ? G.choice.opts.map((o, i) => `<button class="rt" data-i="${i}" ${own ? '' : 'disabled'}>${o}</button>`).join('') : '';
  updateBtn(); Net.sync();
}
const clampTurns = v => Math.max(5, Math.min(99, parseInt(v) || DEFAULT_TURNS));
const turnsHtml = `<label class="tn">ターン数（メインステージ） <input id="tn" class="nm" type="number" min="5" max="99" value="${DEFAULT_TURNS}"> ターン</label>`;

const _log = t => $('#log').insertAdjacentHTML('afterbegin', `<li>${t}</li>`);
const _say = t => $('#msg').textContent = t;
const log = t => { _log(t); Net.bc({ k: 'log', v: t }); };
const say = t => { _say(t); Net.bc({ k: 'say', v: t }); };
const showDice = v => { $('#dice').textContent = v; Net.bc({ k: 'dice', v }); };
// ロールボタン：自分の番のときだけ押せる（オンライン時）
const updateBtn = () => { const b = $('#roll'); if (b) b.disabled = G.busy || G.over || (Net.on && G.t !== Net.seat); };
