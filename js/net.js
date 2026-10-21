// ===== オンライン対戦（PeerJSによるP2P通信。サーバー不要）=====
// ホストの端末がゲームを進行し、ゲストには画面の更新内容を送る。ゲストは「サイコロを振る」だけ送る。
const Net = {
  on: false, host: false, seat: 0, peer: null, conn: null, conns: [], lobby: [], started: false, over: false,
  bc(m) { if (this.host) this.conns.forEach(c => c.open && c.send(m)); },
  sync() { // ゲーム状態を全員に送る（写真は開始時に1回だけ送るので除く）
    if (!this.host || !this.started || !G) return;
    this.bc({ k: 'state', s: { t: G.t, round: G.round, turns: G.turns, stage: G.stage, choice: G.choice || null, busy: G.busy, over: G.over, ps: G.ps.map(p => ({ ...p, img: undefined })) } });
  }
};
let IMGS = [];

// 合言葉 → 部屋ID（日本語もOK。ハッシュ化してPeerJSのIDにする）
async function roomId(phrase) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vrc-life:' + phrase));
  return 'vrclife-' + [...new Uint8Array(b)].slice(0, 10).map(x => x.toString(16).padStart(2, '0')).join('');
}
const pushLobby = () => Net.bc({ k: 'lobby', list: Net.lobby });

function hostRoom(phrase, me, ui) {
  roomId(phrase).then(id => {
    const peer = new Peer(id);
    Object.assign(Net, { peer, on: true, host: true, seat: 0, lobby: [me], conns: [], started: false });
    peer.on('open', () => ui.update(Net.lobby));
    peer.on('error', e => ui.error(e.type === 'unavailable-id' ? 'その合言葉は使われています。別の合言葉にしてください' : '接続エラー: ' + e.type));
    peer.on('connection', c => {
      c.on('data', m => {
        if (m.k === 'join') {
          if (Net.started || Net.lobby.length >= 4) return c.send({ k: 'deny', why: Net.started ? 'すでに開始しています' : '満員です' });
          c.seat = Net.lobby.length; Net.lobby.push({ name: m.name, img: m.img }); Net.conns.push(c);
          c.send({ k: 'seat', seat: c.seat }); pushLobby(); ui.update(Net.lobby);
        } else if (m.k === 'pick' && G.choice && G.t === c.seat) pickRoute(m.i);
        else if (m.k === 'roll' && Net.started && G.t === c.seat) turn(m.i === undefined ? -1 : m.i);
      });
      c.on('close', () => {
        if (!c.seat) return;
        if (Net.started) { // ゲーム中の退出：自動で進行
          G.ps[c.seat].auto = true; log(`${G.ps[c.seat].name}が退出（自動で進行）`);
          if (G.t === c.seat && !G.busy) turn();
        } else { // 開始前の退出：席を詰める
          const i = Net.conns.indexOf(c); Net.conns.splice(i, 1); Net.lobby.splice(i + 1, 1);
          Net.conns.forEach((x, j) => { x.seat = j + 1; x.open && x.send({ k: 'seat', seat: j + 1 }); });
          pushLobby(); ui.update(Net.lobby);
        }
      });
    });
  });
}

function startOnline() {
  const ps = Net.lobby.map((p, i) => ({ name: p.name, img: p.img, color: COLORS[i] }));
  const turns = clampTurns($('#tn').value);
  Net.started = true; Net.bc({ k: 'start', ps, turns });
  initUI(ps, turns); announce();
}

function joinRoom(phrase, me, ui) {
  roomId(phrase).then(id => {
    const peer = new Peer();
    Object.assign(Net, { peer, on: true, host: false });
    peer.on('error', e => ui.error(e.type === 'peer-unavailable' ? 'ルームが見つかりません。合言葉を確認してください' : '接続エラー: ' + e.type));
    peer.on('open', () => {
      const c = Net.conn = peer.connect(id, { reliable: true });
      c.on('open', () => c.send({ k: 'join', name: me.name, img: me.img }));
      c.on('data', m => onGuestMsg(m, ui));
      c.on('close', () => { if (!Net.over) alert('ホストとの接続が切れました。ページを再読み込みしてください'); });
    });
  });
}

function onGuestMsg(m, ui) {
  switch (m.k) {
    case 'deny': ui.error(m.why); Net.peer.destroy(); break;
    case 'seat': Net.seat = m.seat; break;
    case 'lobby': ui.update(m.list); break;
    case 'start': IMGS = m.ps.map(p => p.img); initUI(m.ps, m.turns); break;
    case 'state':
      const ch = G.stage !== m.s.stage;
      G.t = m.s.t; G.round = m.s.round; G.turns = m.s.turns; G.stage = m.s.stage; G.busy = m.s.busy; G.choice = m.s.choice; G.over = m.s.over;
      if (ch) renderBoard();
      G.ps = m.s.ps.map((p, i) => ({ ...p, img: IMGS[i] })); renderTokens(); renderStat(); break;
    case 'say': _say(m.v); break;
    case 'log': _log(m.v); break;
    case 'dice': $('#dice').textContent = m.v; break;
    case 'end': finish(); break;
  }
}
