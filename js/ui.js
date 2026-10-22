const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[rnd(0, a.length - 1)];
// 色ユーティリティ：背景色に合わせて文字色(白/濃色)を自動で切り替える
const fgOf = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return (.299 * r + .587 * g + .114 * b) > 140 ? '#3d2a4a' : '#fff'; };
const cv = c => `--c:${c};--fg:${fgOf(c)}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = n => {
  const a = Math.abs(n), o = Math.floor(a / 1e8), m = Math.floor(a % 1e8 / 1e4), r = a % 1e4;
  let s = ''; if (o) s += o + '億'; if (m) s += m.toLocaleString() + '万'; if (r || !s) s += r.toLocaleString();
  return (n < 0 ? '-' : '') + s + '円';
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

const tok = p => `<i class="tok" style="${cv(p.color)};${p.img ? `background-image:url(${p.img})` : ''}">${p.img ? '' : esc([...p.name][0])}</i>`;

// 色の指定：カラーピッカー＋RGBスライダー。初期は「デフォルト色」(未指定=null)、いじるとカスタム色
function colorCtl(host, def, onChange) {
  host.innerHTML = `<div class="cc"><input type="color" class="cp" aria-label="プレイヤーの色">
    <details><summary>RGBで調整</summary>${['R', 'G', 'B'].map((n, k) => `<label>${n}<input type="range" min="0" max="255" class="cr"><output></output></label>`).join('')}
    <button type="button" class="creset">デフォルトに戻す</button></details></div>`;
  const cp = host.querySelector('.cp'), rs = [...host.querySelectorAll('.cr')], os = [...host.querySelectorAll('output')];
  let custom = false;
  const show = hex => { cp.value = hex; [1, 3, 5].forEach((p, k) => { rs[k].value = parseInt(hex.slice(p, p + 2), 16); os[k].textContent = rs[k].value; }); };
  const user = hex => { custom = true; show(hex); if (onChange) onChange(); };
  cp.oninput = () => user(cp.value);
  rs.forEach(r => r.oninput = () => user('#' + rs.map(x => (+x.value).toString(16).padStart(2, '0')).join('')));
  host.querySelector('.creset').onclick = () => { custom = false; show(def); if (onChange) onChange(); };
  show(def);
  return { get: () => custom ? cp.value : null, setDefault(h) { def = h; if (!custom) show(h); }, setValue(h) { custom = true; show(h); } };
}
const colorGap = (a, b) => { const f = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const [x, y] = [f(a), f(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

// 写真についての注意書き
const photoNote = online => `<p class="note">📷 写真は保存していません。この端末のブラウザ内で小さく加工して駒に使うだけで、サーバーへのアップロードや保存はしません。${online ? 'オンラインの場合のみ、同じルームの参加者の端末に直接送られます。' : ''}ページを閉じる・再読み込みすると消えます。</p>`;

// ===== セットアップ画面（同じ端末 / ルーム作成 / ルーム入室）=====
const rowHtml = i => `<div class="prow" data-i="${i}">
  <label class="ph" style="--c:${COLORS[i]}"><input type="file" accept="image/*" hidden><span>写真</span></label>
  <input class="nm" maxlength="8" placeholder="プレイヤー${i + 1}の名前"><div class="cwrap"></div></div>`;
function bindRow(r, photos, i, cb) {
  r.querySelector('input[type=file]').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    photos[i] = await loadPhoto(f);
    const ph = r.querySelector('.ph'); ph.style.backgroundImage = `url(${photos[i]})`; ph.querySelector('span').hidden = true; if (cb) cb();
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
      ${photoNote(false)}${turnsHtml}<br><button id="go" class="big">ゲーム開始</button> <button class="back">戻る</button>`;
    const sync = () => {
      el.querySelectorAll('.prow').forEach((r, i) => r.hidden = i >= n);
      el.querySelectorAll('#count button').forEach(b => b.classList.toggle('on', +b.dataset.n === n));
    };
    el.querySelector('#count').onclick = e => { if (e.target.dataset.n) { n = +e.target.dataset.n; sync(); } };
    el.querySelectorAll('.prow').forEach((r, i) => bindRow(r, photos, i));
    const cc = [...el.querySelectorAll('.cwrap')].map((w, i) => colorCtl(w, COLORS[i]));
    el.querySelector('.back').onclick = menu;
    $('#go').onclick = () => onStart([...Array(n)].map((_, i) => ({
      name: el.querySelectorAll('.nm')[i].value.trim() || `P${i + 1}`, img: photos[i], color: cc[i].get() || COLORS[i] })), clampTurns($('#tn').value), $('#fog').checked);
    sync();
  };
  const online = isHost => {
    const photos = [null];
    el.innerHTML = `<h1>${isHost ? 'ルームを作る' : 'ルームに入る'}</h1>
      <p class="lead">${isHost ? '合言葉を決めて、参加する人に伝えてください（2〜4人）。' : 'ホストに教えてもらった合言葉を入力してください。'}</p>
      ${rowHtml(0)}
      ${photoNote(true)}
      <input id="pw" class="nm pw" maxlength="20" placeholder="合言葉（なんでもOK）">${isHost ? turnsHtml : ''}
      <p id="err" class="err" role="alert"></p>
      <button id="go" class="big">${isHost ? 'ルーム作成' : '入室'}</button> <button class="back">戻る</button><div id="lob"></div>`;
    const meNow = () => cleanProfile({ name: el.querySelector('.nm').value.trim(), img: photos[0], color: cc.get() }, isHost ? 'ホスト' : 'ゲスト');
    let pt; // 入室後も名前・写真を変更できる（開始前）。変更はロビーの全員に反映
    const sendProfile = () => { clearTimeout(pt); pt = setTimeout(() => {
      if (Net.started) return;
      if (isHost) { if (Net.lobby.length) { Net.lobby[0] = meNow(); pushLobby(); ui.update(Net.lobby); } }
      else if (Net.conn && Net.conn.open) Net.conn.send({ k: 'profile', ...meNow() });
    }, 350); };
    const cc = colorCtl(el.querySelector('.cwrap'), COLORS[0], sendProfile);
    el.querySelector('.nm').oninput = sendProfile;
    bindRow(el.querySelector('.prow'), photos, 0, sendProfile);
    el.querySelector('.back').onclick = () => { if (Net.peer) Net.peer.destroy(); Net.on = Net.host = false; menu(); };
    const ui = Net.ui = {
      seat: n => cc.setDefault(COLORS[n]),
      error: m => { $('#err').textContent = m; $('#go').disabled = false; },
      update: list => {
        $('#lob').innerHTML = `<h2>参加者 ${list.length}/4</h2>` +
          list.map((p, i) => `<div class="pc">${tok({ ...p, color: p.color || COLORS[i] })}<strong>${esc(p.name)}</strong>${i === 0 ? '（ホスト）' : ''}</div>`).join('') + (list.some((a, i) => list.some((b, j) => j > i && colorGap(a.color || COLORS[i], b.color || COLORS[j]) < 70)) ? '<p class="err">色が近い人がいます。見分けにくいので変更をおすすめします。</p>' : '') + '<p class="lead">名前・写真・色は入室後も上の欄で変更できます。</p>' +
          (isHost ? `<button id="start" class="big" ${list.length < 2 ? 'disabled' : ''}>この人数で開始</button>` : '<p class="lead">ホストの開始を待っています…</p>');
        if (isHost) $('#start').onclick = startOnline;
      }
    };
    $('#go').onclick = () => {
      const pw = $('#pw').value.trim();
      if (!pw) return ui.error('合言葉を入力してください');
      $('#err').textContent = ''; $('#go').disabled = true;
      const me = meNow();
      isHost ? hostRoom(pw, me, ui) : joinRoom(pw, me, ui);
    };
  };
  menu();
}

// ===== ボード描画 =====
const isHid = i => !!(G.hid && G.hid.indexOf(i) >= 0);
const cellClass = (i, lay, g) => `cell ${isHid(i) ? 't-fog fog' : 't-' + lay[i]}${g ? '' : `${FORKS[i] ? ' fork' : ''}${MERGES.has(i) ? ' merge' : ''}${i >= PN ? ' br' : ''}`}`;
const cellInfo = (i, lay) => isHid(i) ? { icon: '❔', label: '？？？' } : TYPES[lay[i]];
function renderBoard() {
  const g = G.stage === 'goal', path = g ? PATH2 : PATH, lay = g ? LAYOUT2 : LAYOUT;
  const bd = $('#board'); bd.className = g ? 'g' : '';
  bd.innerHTML = path.map(([x, y], i) => {
    const m = cellInfo(i, lay);
    return `<div class="${cellClass(i, lay, g)}" id="k${i}" style="grid-column:${x + 1};grid-row:${y + 1}"><b>${m.icon}</b><small>${m.label}</small><div class="toks" id="c${i}"></div></div>`;
  }).join('');
}
// 霧モード：公開されたマスだけ表示を更新
function updateFog() {
  if (typeof document.getElementById !== 'function') return;
  const g = G.stage === 'goal', lay = g ? LAYOUT2 : LAYOUT;
  lay.forEach((_, i) => {
    const e = document.getElementById('k' + i); if (!e) return;
    const m = cellInfo(i, lay); e.className = cellClass(i, lay, g);
    e.querySelector('b').textContent = m.icon; e.querySelector('small').textContent = m.label;
  });
}
// 盤面が横スクロールのとき（スマホ等）、手番のプレイヤーの駒が見える位置へ自動スクロール
function followCurrent() {
  if (typeof document.getElementById !== 'function') return;
  const w = $('#boardwrap'), c = G.ps[G.t] && document.getElementById('c' + G.ps[G.t].pos);
  if (!w || !c || !c.parentElement || !w.scrollTo) return;
  const e = c.parentElement;
  w.scrollTo({ left: e.offsetLeft - w.clientWidth / 2 + e.offsetWidth / 2, top: w.scrollHeight > w.clientHeight ? e.offsetTop - w.clientHeight / 2 + e.offsetHeight / 2 : 0, behavior: 'smooth' });
}

function renderTokens() {
  document.querySelectorAll('.toks').forEach(e => e.innerHTML = '');
  G.ps.forEach(p => $('#c' + p.pos).insertAdjacentHTML('beforeend', tok(p)));
  followCurrent(); Net.sync();
}

const chip = (b, suffix = '') => `<span class="chip" data-tip="${esc(b.name)}：${esc(b.desc)}" title="${esc(b.name)}：${esc(b.desc)}">${b.icon}${b.name}${suffix}</span>`;
function chips(p) {
  const c = [];
  if (p.sugar) c.push(chip(BADGES.sugar, '×' + p.sugar));
  if (p.live) c.push(chip(BADGES.live));
  if (p.married) c.push(chip(BADGES.married));
  if (p.friends) c.push(chip(BADGES.friends, '×' + p.friends));
  if (p.exes) c.push(chip(BADGES.exes, '×' + p.exes));
  if (p.fame) c.push(chip(BADGES.fame, '×' + p.fame));
  if (p.fbt) c.push(chip(BADGES.fbt));
  if (p.pc) c.push(chip(BADGES.pc));
  p.items.forEach(k => c.push(`<span class="chip it" data-tip="${ITEMS[k].name}：${ITEMS[k].desc}" title="${ITEMS[k].name}：${ITEMS[k].desc}">${ITEMS[k].icon}${ITEMS[k].name}</span>`));
  return c.join('') || '<span class="chip none">なし</span>';
}
function renderLegend() {
  $('#legendBody').innerHTML = '<h4>ステータス</h4>' + Object.values(BADGES).map(b => `<p><b>${b.icon} ${b.name}</b>　${b.desc}</p>`).join('')
    + '<h4>アイテム（自分の番に使う）</h4>' + Object.values(ITEMS).map(i => `<p><b>${i.icon} ${i.name}</b>　${i.desc}</p>`).join('')
    + '<h4>マスの種類</h4><p class="sq">' + Object.values(TYPES).map(t => `${t.icon}${t.label}`).join('　') + '</p>';
}
function renderTurn() {
  const cp = G.ps[G.t], n = G.ps.length, k = (G.order || []).indexOf(G.t) + 1, goal = G.stage === 'goal', left = G.turns - G.round;
  const head1 = goal ? '<b class="big1">🏁 ゴールステージ</b><span>ゴールまで一本道！</span>'
    : `<b class="big1">第 ${G.round} / ${G.turns} ターン</b><span>${left > 0 ? (left <= 5 ? `ゴールステージまであと${left}ターン` : `残り${left}ターン`) : '最終ターン！この後ゴールステージへ'}</span>`;
  const bar = goal ? '' : `<div class="bar"><i style="width:${Math.min(100, (G.round - 1 + k / n) / G.turns * 100)}%"></i></div>`;
  $('#turn').innerHTML = `<div class="t1">${head1}</div>${bar}<div class="t2" style="${cv(cp.color)}">${tok(cp)}<strong>${esc(cp.name)}</strong> の番<small>（手番 ${k}/${n}）</small></div>`;
}
function renderStat() {
  renderTurn();
  $('#stat').innerHTML = (G.order || G.ps.map((_, i) => i)).map((si, k) => { const p = G.ps[si]; return `
    <div class="pc ${si === G.t ? 'now' : ''}" style="${cv(p.color)}"><div class="pt">${tok(p)}<div><strong><i class="ord">${k + 1}</i>${esc(p.name)}${p.done ? ' 🏁' + p.rank + '位' : ''}</strong>
    <span class="mny">${yen(p.money)}</span></div></div><div class="chips">${chips(p)}</div></div>`; }).join('');
  const cp = G.ps[G.t], own = !(Net.on && G.t !== Net.seat), mine = !G.busy && !G.over && !cp.done && own;
  $('#items').innerHTML = cp.items.map((k, i) => `<button data-i="${i}" ${mine && k !== 'amulet' ? '' : 'disabled'} title="${ITEMS[k].desc}">${ITEMS[k].icon} ${ITEMS[k].name}<small> ${ITEMS[k].desc}</small></button>`).join('');
  $('#route').innerHTML = G.choice ? G.choice.opts.map((o, i) => `<button class="rt" data-i="${i}" ${own ? '' : 'disabled'}>${o}</button>`).join('') : '';
  updateBtn(); Net.sync();
}
const clampTurns = v => Math.max(5, Math.min(99, parseInt(v) || DEFAULT_TURNS));
const turnsHtml = `<label class="tn">ターン数（メインステージ） <input id="tn" class="nm" type="number" min="5" max="99" value="${DEFAULT_TURNS}"> ターン</label>
  <label class="tn chk"><input type="checkbox" id="fog"> 🌫️ 霧モード（マスの一部が見えない。誰かが止まると公開）</label>`;

// 名前は N(p) の目印で文章に埋め込み、表示時に「プレイヤー色のバッジ」(ログ) / 通常の文字(メッセージ) に変換する
const N = p => `\u0001${G.ps.indexOf(p)}\u0002`;
const fmt = (t, html) => String(t).replace(/\u0001(\d+)\u0002/g, (_, i) => {
  const p = G.ps[+i]; if (!p) return '';
  return html ? `<b class="who" style="${cv(p.color)}"><i class="tok pi${+i}" style="${cv(p.color)}">${p.img ? '' : esc([...p.name][0])}</i>${esc(p.name)}</b>` : p.name;
});
const _log = t => {
  const ol = $('#log'); ol.insertAdjacentHTML('afterbegin', `<li${String(t).startsWith('▶') ? ' class="sep"' : ''}>${fmt(t, true)}</li>`);
  while (ol.children && ol.children.length > 300) ol.lastChild.remove(); // 直近300件を保持（スクロールで過去ログを確認）
};
const _head = t => $('#evh').textContent = fmt(t, false);
const head = t => { _head(t); Net.bc({ k: 'head', v: t }); };
const _say = t => $('#msg').textContent = fmt(t, false);
const log = t => { _log(t); Net.bc({ k: 'log', v: t }); };
const say = t => { _say(t); Net.bc({ k: 'say', v: t }); };
const showDice = v => { $('#dice').textContent = v; Net.bc({ k: 'dice', v }); };
// ロールボタン：自分の番のときだけ押せる（オンライン時）
const updateBtn = () => { const b = $('#roll'); if (b) b.disabled = G.busy || G.over || (Net.on && G.t !== Net.seat); };

// プレイヤー画像をCSSクラス(.pi0〜)として登録（ログ内の小アイコンを軽量にするため）
function setPlayerStyles() {
  if (!document.head) return;
  let s = document.getElementById('pstyle');
  if (!s) { s = document.createElement('style'); s.id = 'pstyle'; document.head.appendChild(s); }
  s.textContent = G.ps.map((p, i) => p.img ? `.pi${i}{background-image:url(${p.img})}` : '').join('');
}

// ゲーム中の名前・写真の変更
function openProfile() {
  const me = G.ps[Net.seat], d = $('#prof'); let img = me.img;
  d.innerHTML = `<h3>名前・写真を変更</h3><div class="prow"><label class="ph" style="--c:${me.color};${img ? `background-image:url(${img})` : ''}"><input type="file" accept="image/*" hidden><span ${img ? 'hidden' : ''}>写真</span></label>
    <input class="nm" maxlength="8" value="${esc(me.name)}"><div class="cwrap"></div></div>${photoNote(Net.on)}<div class="row"><button class="big" id="psave">保存</button><button id="pcancel">キャンセル</button></div>`;
  d.querySelector('input[type=file]').onchange = async e => {
    const f = e.target.files[0]; if (!f) return; img = await loadPhoto(f);
    const ph = d.querySelector('.ph'); ph.style.backgroundImage = `url(${img})`; ph.querySelector('span').hidden = true;
  };
  const cc = colorCtl(d.querySelector('.cwrap'), COLORS[Net.seat]); if (me.color !== COLORS[Net.seat]) cc.setValue(me.color);
  $('#pcancel').onclick = () => d.close();
  $('#psave').onclick = () => { d.close(); applyProfile(cleanProfile({ name: d.querySelector('.nm').value.trim(), img, color: cc.get() }, me.name)); };
  d.showModal();
}
window.VER_UI = '2026.10.22-b';
