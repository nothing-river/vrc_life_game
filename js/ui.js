const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[rnd(0, a.length - 1)];
const yen = n => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString() + '円';

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

// ===== セットアップ画面 =====
function buildSetup(onStart) {
  let n = 2;
  const photos = [null, null, null, null];
  const el = $('#setup');
  el.innerHTML = `
    <h1>VRC人生ゲーム</h1>
    <p class="lead">集会で稼ぎ、お砂糖と出会い、先にゴールを目指そう。</p>
    <div class="count" id="count">${[2, 3, 4].map(i => `<button data-n="${i}">${i}人</button>`).join('')}</div>
    <div id="rows">${[0, 1, 2, 3].map(i => `
      <div class="prow" data-i="${i}">
        <label class="ph" style="--c:${COLORS[i]}"><input type="file" accept="image/*" hidden><span>写真</span></label>
        <input class="nm" maxlength="8" placeholder="プレイヤー${i + 1}の名前" value="">
      </div>`).join('')}</div>
    <button id="go" class="big">ゲーム開始</button>`;
  const sync = () => {
    el.querySelectorAll('.prow').forEach((r, i) => r.hidden = i >= n);
    el.querySelectorAll('#count button').forEach(b => b.classList.toggle('on', +b.dataset.n === n));
  };
  el.querySelector('#count').onclick = e => { if (e.target.dataset.n) { n = +e.target.dataset.n; sync(); } };
  el.querySelectorAll('.prow').forEach((r, i) => {
    r.querySelector('input[type=file]').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      photos[i] = await loadPhoto(f);
      const ph = r.querySelector('.ph');
      ph.style.backgroundImage = `url(${photos[i]})`; ph.querySelector('span').hidden = true;
    };
  });
  $('#go').onclick = () => {
    const ps = [...Array(n)].map((_, i) => ({
      name: el.querySelectorAll('.nm')[i].value.trim() || `P${i + 1}`, img: photos[i], color: COLORS[i]
    }));
    el.hidden = true; $('#game').hidden = false; onStart(ps);
  };
  sync();
}

// ===== ボード描画 =====
function renderBoard() {
  const b = $('#board');
  b.innerHTML = PATH.map(([x, y], i) => {
    const t = LAYOUT[i], m = TYPES[t];
    return `<div class="cell t-${t}" style="grid-column:${x + 1};grid-row:${y + 1}"><b>${m.icon}</b><small>${m.label}</small><div class="toks" id="c${i}"></div></div>`;
  }).join('') + `<div id="panel">
    <div id="stat"></div><div id="msg"></div>
    <div class="ctl"><div id="dice">🎲</div><button id="roll" class="big">サイコロを振る</button></div>
    <ol id="log"></ol></div>`;
}

function renderTokens() {
  document.querySelectorAll('.toks').forEach(e => e.innerHTML = '');
  G.ps.forEach(p => $('#c' + p.pos).insertAdjacentHTML('beforeend', tok(p)));
}

function renderStat() {
  $('#stat').innerHTML = G.ps.map((p, i) => `
    <div class="pc ${i === G.t ? 'now' : ''}">${tok(p)}<div><strong>${p.name}</strong>
    <span>${yen(p.money)} ${p.sugar ? '🍬' : ''}${p.live ? '🏠' : ''}${p.married ? '💍' : ''}${p.fbt ? '🕺' : ''}${p.pc ? '💻' : ''}${'⭐'.repeat(p.fame)}</span></div></div>`).join('');
}

const log = t => $('#log').insertAdjacentHTML('afterbegin', `<li>${t}</li>`);
const say = t => $('#msg').textContent = t;
