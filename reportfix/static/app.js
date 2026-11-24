/* ReportFix SPA - login flow + dashboards. Stormy morning palette. */

let ME = null, S = null, VIEW = 'login', TAB = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const LOCATIONS = ["CSE Lab 1","CSE Lab 2","CSE Lab 3","CSE Lab 4","EE Lab 1","EE Lab 2",
  "Labs Complex 1","Labs Complex 2","Labs Complex 3","Labs Complex 4","Library",
  "Main Cafeteria","Auditorium","Block A","Block B","Room 101","Room 102","Room 103",
  "Sports Ground","Parking Lot","Campus Corridors"];

const DEMO_ID_HINTS = {
  students: "STU-001 ... STU-007",
  staff: ["STAFF-EE","STAFF-CSE","STAFF-IS","STAFF-LIB","STAFF-CAFE","STAFF-LABS"],
  admin: "ADMIN-01"
};

async function api(path, body) {
  const opt = body ? {method:'POST', headers:{'Content-Type':'application/json'},
                      body: JSON.stringify(body)} : {};
  const r = await fetch(path, opt);
  return r.json();
}

function toast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.style.display = 'block';
  clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 4200);
}

async function loadState() {
  S = await api('/api/state');
}

async function boot() {
  await loadState();
  const saved = JSON.parse(localStorage.getItem('rf_me') || 'null');
  if (saved && S.users.some(u => u.id === saved.id)) {
    ME = S.users.find(u => u.id === saved.id);
    VIEW = 'app';
  }
  render();
  setInterval(async () => { if (VIEW === 'app') await refresh(); }, 5000);
}

async function refresh() {
  await loadState();
  if (ME) ME = S.users.find(u => u.id === ME.id) || ME;
  render();
}

async function act(path, body, okMsg) {
  const r = await api(path, body);
  if (r.ok === false) { toast(r.error || 'Action failed', true); return r; }
  if (okMsg) toast(okMsg);
  await refresh();
  return r;
}

function sig(me) { localStorage.setItem('rf_me', JSON.stringify({id: me.id})); }
function signOut() { localStorage.removeItem('rf_me'); ME = null; VIEW = 'login'; render(); }

/* ============================== LOGIN PAGES ============================== */
function renderLogin(root) {
  root.innerHTML = `
  <div class="loginwrap skyglow">
    <div class="loginbox">
      <div class="brandbig">
        <div class="logo">🌪️</div>
        <h1>ReportFix</h1>
        <p>Report a campus problem. We route it. You verify the fix.</p>
      </div>
      <div class="card">
        <h3>Student sign in</h3>
        <label class="f" for="sid">STUDENT ID</label>
        <input id="sid" placeholder="e.g. STU-001" autocomplete="off">
        <div class="locpick" style="margin-top:14px">
          <button onclick="studentLogin()">Sign in as student</button>
        </div>
        <div class="orline">or</div>
        <div class="center">
          <button class="ghost" onclick="VIEW='stafflogin';render()">I am an admin / staff member</button>
        </div>
      </div>
      ${judgeBar()}
    </div>
  </div>`;
  document.getElementById('sid').addEventListener('keydown',
    e => { if (e.key === 'Enter') studentLogin(); });
}

function renderStaffLogin(root) {
  root.innerHTML = `
  <div class="loginwrap skyglow">
    <div class="loginbox">
      <div class="brandbig">
        <div class="logo">🛡️</div>
        <h1>Staff & Admin Portal</h1>
        <p>Department staff and the Registrar's office sign in here.</p>
      </div>
      <div class="card dark">
        <h3>Staff / admin sign in</h3>
        <label class="f" for="stid">STAFF / ADMIN ID</label>
        <input id="stid" placeholder="e.g. STAFF-EE or ADMIN-01" autocomplete="off">
        <div class="muted" style="margin:8px 0">Demo IDs: ${DEMO_ID_HINTS.staff.join(' · ')} · ${DEMO_ID_HINTS.admin}</div>
        <div class="locpick" style="margin-top:10px">
          <button onclick="staffLogin()">Sign in to dashboard</button>
          <button class="subtle" onclick="VIEW='login';render()">Back to student sign-in</button>
        </div>
      </div>
      ${judgeBar()}
    </div>
  </div>`;
  document.getElementById('stid').addEventListener('keydown',
    e => { if (e.key === 'Enter') staffLogin(); });
}

function judgeBar() {
  const quick = S.users.map(u =>
    `<button class="subtle" onclick="quickSign(${u.id})">${esc(u.name)}</button>`).join('');
  return `<details class="card judgebar">
    <summary>Judge quick access (one click, no passwords)</summary>
    <div class="row">${quick}</div>
    <div class="row">
      <button onclick="newStudent()">+ New student</button>
      <button class="danger" onclick="resetAll()">Reset all data</button>
    </div>
  </details>`;
}

async function studentLogin() {
  const lid = document.getElementById('sid').value.trim();
  const r = await api('/api/login', {login_id: lid});
  if (r.ok === false) return toast(r.error, true);
  if (r.me.role !== 'student')
    return toast('That ID is not a student account. Use the staff portal below.', true);
  ME = r.me; sig(ME); VIEW = 'app'; TAB = 'report'; render();
  await refresh();
}

async function staffLogin() {
  const lid = document.getElementById('stid').value.trim();
  const r = await api('/api/login', {login_id: lid});
  if (r.ok === false) return toast(r.error, true);
  if (r.me.role === 'student')
    return toast('That is a student ID. Use the student sign-in page.', true);
  ME = r.me; sig(ME); VIEW = 'app';
  TAB = r.me.role === 'staff' ? 'queue' : 'overview';
  render(); await refresh();
}

async function quickSign(id) {
  const r = await act('/api/switch', {user_id: id});
  if (r.me) { ME = r.me; sig(ME); VIEW = 'app';
    TAB = ME.role === 'student' ? 'report' : ME.role === 'staff' ? 'queue' : 'overview';
    toast(`Signed in as ${ME.name}`); }
}
window.newStudent = async () => {
  const r = await act('/api/new_student', {});
  if (r.me) { ME = r.me; sig(ME); VIEW = 'app'; TAB = 'report';
    toast(`New student created — ID ${r.me.login_id}`); }
};
window.resetAll = async () => {
  if (!confirm('Reset ALL data to the demo seed?')) return;
  localStorage.removeItem('rf_me'); ME = null;
  await act('/api/reset', {});
  await loadState(); VIEW = 'login'; toast('All data reset'); render();
};

/* ============================== DASHBOARD ============================== */
function renderApp(root) {
  const roleName = ME.role === 'admin' ? 'Admin' :
    ME.role === 'staff' ? `${ME.dept} staff` : 'Student';
  root.innerHTML = `
  <header>
    <div class="brand">🌪️ ReportFix <span class="sub">${esc(roleName)} dashboard</span></div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="whoami"><span class="trustdot"></span>${esc(ME.name)}
        ${ME.role === 'student' ? ` · ID ${esc(ME.login_id)} · trust ${ME.trust}` : ''}</span>
      <select id="switcher"></select>
      <button class="subtle" onclick="signOut()">Sign out</button>
    </div>
  </header>
  <nav id="tabs" class="skyglow"></nav>
  <main id="main"></main>`;
  const sel = document.getElementById('switcher');
  sel.innerHTML = S.users.map(u => `<option value="${u.id}"
      ${u.id === ME.id ? 'selected' : ''}>${esc(u.name)} (${u.role}${u.dept ? ' · ' + u.dept : ''})</option>`).join('');
  sel.onchange = (e) => quickSign(+e.target.value);
  renderTabs(); renderTab();
}

function tabsFor(role) {
  if (role === 'student')
    return [['report','✍ Report'], ['mine','📋 My Issues'],
            ['board','🔥 Community Board'], ['trust','⭐ My Trust']];
  if (role === 'staff')
    return [['queue','📥 My Queue'], ['trustd','⭐ Trust Board']];
  return [['overview','📊 Overview'], ['queues','🗂 All Queues'],
          ['confid','🔒 Confidential'], ['integrity','🛡 Trust & Integrity']];
}

function renderTabs() {
  document.getElementById('tabs').innerHTML = tabsFor(ME.role).map(([id, label]) =>
    `<button class="${TAB === id ? 'on' : ''}" onclick="window.TAB='${id}'">${label}</button>`).join('');
}

function renderTab() {
  const m = document.getElementById('main');
  m.innerHTML = '';
  ({report: vReport, mine: vMine, board: vBoard, trust: vTrust,
    queue: vQueue, trustd: vTrust, overview: vOverview, queues: vQueues,
    confid: vConfid, integrity: vIntegrity}[TAB] || vReport)(m);
}

/* ---------- priority meter ---------- */
function meter(priority) {
  const levels = ['LOW','MEDIUM','HIGH','CRITICAL'];
  const idx = levels.indexOf(priority);
  return `<div class="meter">` + levels.map((l, i) =>
    `<span class="seg ${i === idx ? 'on lv' + (i + 1) : ''}">${l}</span>`).join('') + `</div>`;
}

/* ---------- issue card ---------- */
function pills(i) {
  return `<span class="pill p-${i.priority}">${i.priority}</span>
          <span class="pill s-${i.status.replace(/ /g,'')}">${i.status.replace(/_/g,' ')}</span>`;
}

function issueCard(i, opts = {}) {
  const meAffected = (i.affected_ids || []).includes(ME.id) || (i.affected || []).includes(ME.name);
  const canVote = !i.confidential && ME.role === 'student' && meAffected &&
    ['RESOLVED','REOPENED','CONFIRMED'].includes(i.status) &&
    !i.votes.some(v => v.user_id === ME.id);
  const canJoin = !i.confidential && ME.role === 'student' && !meAffected &&
    ['OPEN','IN_PROGRESS','RESOLVED'].includes(i.status);
  const staffCan = (ME.role === 'staff' && ME.dept === i.dept && !i.confidential) ||
    (ME.role === 'admin' && (i.confidential || !i.confidential));
  const myVotes = i.votes.filter(v => v.flagged === 0);
  const cw = myVotes.filter(v => v.verdict === 'confirm').reduce((a, v) => a + v.weight, 0);
  const dw = myVotes.filter(v => v.verdict === 'dispute').reduce((a, v) => a + v.weight, 0);
  return `<div class="card ${i.confidential ? 'conf' : ''}">
    <h3>${esc(i.title)} ${pills(i)} ${i.confidential ? '<span class="pill p-LOW" style="color:#5b4a86">CONFIDENTIAL</span>' : ''}</h3>
    <div class="kv">Department: <span class="depttag">${esc(i.dept)}</span>
      · Location: <b>${esc(i.location || '?')}</b> · Me-too count: <b>${i.affected_count}</b>
      · Crowd impact: <b>${i.impact.toFixed(1)}</b></div>
    ${meter(i.priority)}
    ${i.alert ? `<div class="alert">⚠ ${esc(i.alert)}</div>` : ''}
    ${i.status === 'NEEDS_CLARIFICATION' ? clarifyBox(i) : ''}
    <div class="reason">${esc(i.reports[0] ? i.reports[0].reason : '')}</div>
    ${i.reports.slice(0, opts.allReports ? 99 : 2).map(r => `
      <div class="kv">📝 "${esc(r.text)}" — <i>${esc(r.by)}</i>, ${esc(r.created_at)}
        ${r.spam ? '<span class="pill p-CRITICAL">SPAM FLAG</span>' : ''}
        ${r.injection ? '<span class="pill p-CRITICAL">INJECTION IGNORED</span>' : ''}
        ${r.injection ? `<div class="reason inj">Instruction-like text ignored (reports are data, not commands): ${esc(r.injection)}</div>` : ''}
      </div>`).join('')}
    <div class="kv">👥 Affected: ${i.confidential ? 'hidden' : esc((i.affected || []).join(', '))}</div>
    ${myVotes.length ? `<div class="kv">🗳 Confirm weight ${cw.toFixed(1)} vs dispute weight ${dw.toFixed(1)} (flagged votes excluded)</div>` : ''}
    <div class="tl">${(i.timeline || []).map(t =>
      `<div>${esc(t.ts)} — <span class="t">${esc(t.text)}</span></div>`).join('')}</div>
    ${(canJoin || canVote || staffCan) ? `<div class="votes">
      ${canJoin ? `<button onclick="joinIssue(${i.id})">👍 Me too</button>` : ''}
      ${canVote ? `<button onclick="vote(${i.id},'confirm')">✔ Fix worked</button>
                   <button class="ghost" onclick="vote(${i.id},'dispute')">✖ Fix didn't work</button>` : ''}
      ${staffCan && ['OPEN','REOPENED'].includes(i.status) ? `<button onclick="setStatus(${i.id},'IN_PROGRESS')">Start work</button>` : ''}
      ${staffCan && ['OPEN','IN_PROGRESS','REOPENED'].includes(i.status) ? `
        <input id="note-${i.id}" placeholder="note (optional)" style="width:170px">
        <button onclick="setStatus(${i.id},'RESOLVED')">Mark resolved</button>` : ''}
      ${ME.role === 'admin' && !i.confidential ? `<button class="danger small" onclick="spam(${i.id})">Mark fake/spam</button>` : ''}
    </div>` : ''}
  </div>`;
}

function clarifyBox(i) {
  return `<div class="reason" style="border-left-color:var(--warn)">
    ❓ We need a location before routing — we don't guess.
    <div class="locpick">
      <select id="loc-${i.id}" style="width:auto;min-width:180px">
        ${LOCATIONS.map(l => `<option>${l}</option>`).join('')}
      </select>
      <button onclick="clarify(${i.id})">Confirm location & send</button>
    </div></div>`;
}

/* ---------- student views ---------- */
function vReport(m) {
  m.innerHTML = `
  <h2>Report a campus problem</h2>
  <div class="card">
    <textarea id="repText" placeholder="Describe the problem in English, Roman Urdu, or a mix. e.g. 'lab 3 ka wifi chal nahi raha'"></textarea>
    <div class="locpick"><button onclick="submitReport()">Send report</button>
      <span class="muted">The engine detects the department and priority from your words — SHOUTING or "URGENT" won't move the meter.</span></div>
  </div>
  <div id="repOut"></div>`;
  window.submitReport = async () => {
    const text = document.getElementById('repText').value.trim();
    if (!text) return toast('Write something first', true);
    const r = await act('/api/report', {user_id: ME.id, text});
    if (r.ok) {
      document.getElementById('repText').value = '';
      const a = r.analysis;
      document.getElementById('repOut').innerHTML =
        `<div class="card"><h3>What the engine understood</h3>
         <div class="reason">${esc(a.reason)}</div>
         <div class="kv">→ Department <b>${esc(a.dept)}</b> · Priority <b>${esc(a.priority)}</b>
           · Location <b>${esc(a.location || 'not sure yet')}</b></div>
         ${meter(a.priority)}
         <div class="kv">${esc(r.message)}</div></div>`;
    }
  };
  const pend = S.issues.filter(i => i.status === 'NEEDS_CLARIFICATION' &&
    i.reports.some(r => r.by === ME.name));
  if (pend.length)
    m.insertAdjacentHTML('beforeend',
      `<h2>Waiting for your clarification</h2>` + pend.map(i => issueCard(i)).join(''));
}

function vMine(m) {
  const mine = S.issues.filter(i =>
    i.mine || i.reports.some(r => r.by === ME.name) || i.affected.includes(ME.name));
  m.innerHTML = `<h2>My issues (live status)</h2>` +
    (mine.length ? mine.map(i => issueCard(i, {allReports: true})).join('')
                 : '<div class="muted">Nothing yet — report something or join an issue.</div>');
}

function vBoard(m) {
  const pub = S.issues.filter(i => !i.confidential);
  const trend = [...pub].sort((a, b) => (b.impact - a.impact) ||
    (b.updated_at || '').localeCompare(a.updated_at || ''));
  m.innerHTML = `<h2>Community board — trending by crowd impact</h2>
    <div class="muted">Confidential reports never appear here. Impact = sum of credibility
    weights of distinct affected students (one high-trust student maxes at 2.0).</div>
    <div class="grid">${trend.map(i => issueCard(i)).join('')}</div>`;
}

function vTrust(m) {
  const logs = S.trust_log.filter(t => t.user_id === ME.id);
  m.innerHTML = `<h2>My trust score: ${ME.trust}</h2>
    <div class="card"><div class="trustbar"><i style="width:${ME.trust}%"></i></div>
    <div class="kv">Weight of my reports & votes: <b>${ME.trust < 30 ? '0.5' : ME.trust < 70 ? '1.0' : ME.trust < 85 ? '1.5' : '2.0'}</b></div>
    <table><tr><th>When</th><th>Change</th><th>Why</th></tr>
    ${logs.map(l => `<tr><td>${esc(l.created_at)}</td>
      <td style="color:${l.delta >= 0 ? 'var(--good)' : 'var(--crit)'}">${l.delta >= 0 ? '+' : ''}${l.delta}</td>
      <td>${esc(l.reason)}</td></tr>`).join('') || '<tr><td colspan="3">No events yet</td></tr>'}
    </table></div>`;
}

/* ---------- staff views ---------- */
function vQueue(m) {
  const q = S.issues.filter(i => i.dept === ME.dept);
  m.innerHTML = `<h2>${esc(ME.dept)} department queue — only your department sees this</h2>
    <div class="muted">Confidential and other departments' issues are not sent to this view.</div>
    ${q.length ? q.map(i => issueCard(i)).join('') : '<div class="muted">Queue empty.</div>'}`;
}

/* ---------- admin views ---------- */
function vOverview(m) {
  api('/api/summary').then(({summary}) => {
    const pub = S.issues.filter(i => !i.confidential);
    const open = pub.filter(i => ['OPEN','IN_PROGRESS','REOPENED','NEEDS_CLARIFICATION'].includes(i.status));
    m.innerHTML = `<h2>Admin overview</h2>
      <div class="card"><h3>AI situation summary</h3><pre style="white-space:pre-wrap;font-family:inherit;margin:0">${esc(summary)}</pre></div>
      <div class="card"><h3>Trending</h3>${open.sort((a,b)=>b.impact-a.impact).slice(0,5).map(i =>
        `<div class="kv">🔥 ${esc(i.title)} — impact ${i.impact.toFixed(1)}, ${i.affected_count} students</div>`).join('') || '<div class="muted">quiet campus</div>'}</div>
      ${S.issues.filter(i => i.alert).map(i => `<div class="alert">⚠ ${esc(i.title)}: ${esc(i.alert)}</div>`).join('')}
      <h2>All non-confidential issues</h2>${pub.map(i => issueCard(i)).join('')}`;
  });
}

function vQueues(m) {
  const depts = ['EE','CSE','IS','LIBRARY','CAFETERIA','LABS','ADMIN'];
  m.innerHTML = depts.map(d => {
    const q = S.issues.filter(i => i.dept === d && !i.confidential);
    return `<h2>${d}</h2>` + (q.length ? q.map(i => issueCard(i)).join('')
      : '<div class="muted">empty</div>');
  }).join('');
}

function vConfid(m) {
  const c = S.issues.filter(i => i.confidential);
  m.innerHTML = `<h2>🔒 Confidential queue (admin-only)</h2>
    <div class="muted">Harassment/ragging reports. No public board, no department queue,
    reporter identity is never shown — not even here.</div>
    ${c.length ? c.map(i => issueCard(i)).join('') : '<div class="muted">None.</div>'}`;
}

function vIntegrity(m) {
  m.innerHTML = `<h2>🛡 Trust & integrity</h2>
    <div class="card"><h3>Students</h3>
    <table><tr><th>Student</th><th>ID</th><th>Trust</th><th>Vote weight</th><th>Fresh account</th></tr>
    ${S.users.filter(u => u.role === 'student').map(u => `<tr>
      <td>${esc(u.name)}</td><td>${esc(u.login_id)}</td><td><b>${u.trust}</b>
        <div class="trustbar"><i style="width:${u.trust}%"></i></div></td>
      <td>${u.trust < 30 ? '0.5' : u.trust < 70 ? '1.0' : u.trust < 85 ? '1.5' : '2.0'}</td>
      <td>${u.fresh ? '⚠ brand-new' : 'no'}</td></tr>`).join('')}</table></div>
    <div class="card"><h3>Why anyone has their score (full audit log)</h3>
    <table><tr><th>Student</th><th>When</th><th>Change</th><th>Reason</th></tr>
    ${S.trust_log.map(l => `<tr><td>${esc(l.name)}</td><td>${esc(l.created_at)}</td>
      <td style="color:${l.delta >= 0 ? 'var(--good)' : 'var(--crit)'}">${l.delta >= 0 ? '+' : ''}${l.delta}</td>
      <td>${esc(l.reason)}</td></tr>`).join('')}</table></div>
    ${S.issues.filter(i => i.alert).map(i => `<div class="alert">Brigading: ${esc(i.alert)}</div>`).join('')}`;
}

/* ---------- actions ---------- */
window.joinIssue = (id) => act('/api/join', {user_id: ME.id, issue_id: id}, "Joined as 'me too'");
window.vote = (id, verdict) =>
  act('/api/vote', {user_id: ME.id, issue_id: id, verdict},
      verdict === 'confirm' ? 'Confirmed — thanks for verifying' : 'Dispute recorded');
window.setStatus = (id, status) =>
  act('/api/status', {user_id: ME.id, issue_id: id, status,
      note: (document.getElementById('note-' + id) || {}).value || ''},
      'Status updated');
window.spam = (id) => act('/api/spam', {user_id: ME.id, issue_id: id},
      'Marked as spam — reporters penalized');
window.clarify = async (id) => {
  const loc = document.getElementById('loc-' + id).value;
  await act('/api/clarify', {user_id: ME.id, issue_id: id, location: loc},
      'Location confirmed — report routed');
};

Object.defineProperty(window, 'TAB', {
  set(v){ TAB = v; renderTabs(); renderTab(); }, get(){ return TAB; } });
Object.defineProperty(window, 'VIEW', {
  set(v){ VIEW = v; render(); }, get(){ return VIEW; } });

function render() {
  const root = document.getElementById('root');
  if (VIEW === 'login') return renderLogin(root);
  if (VIEW === 'stafflogin') return renderStaffLogin(root);
  if (ME) return renderApp(root);
  renderLogin(root);
}

boot();
