/* =========================================================
 * 畫面層 (View / Controller)
 * 以 hash 路由切換頁面：
 *   #/login               登入
 *   #/author              作者：我的稿件清單
 *   #/author/new          作者：新增投稿
 *   #/author/edit/:id     作者：編輯投稿
 *   #/view/:id            查看稿件內容（作者、編輯共用）
 *   #/editor              編輯：待審查清單
 * ========================================================= */

let currentUser = null;
const $app = document.getElementById('app');

/* ---------------- 工具函式 ---------------- */

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function badge(status) {
  return `<span class="badge s-${esc(status)}">${esc(status)}</span>`;
}

function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' err' : '');
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 2200);
}

function confirmDialog(title, body) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal');
    const okBtn = document.getElementById('modal-ok');
    const cancelBtn = document.getElementById('modal-cancel');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').textContent = body;
    modal.hidden = false;
    const done = (ok) => {
      modal.hidden = true;
      okBtn.onclick = cancelBtn.onclick = null;
      resolve(ok);
    };
    okBtn.onclick = () => done(true);
    cancelBtn.onclick = () => done(false);
  });
}

/** 執行 API 動作並統一處理錯誤訊息；成功回傳 true */
async function attempt(fn, successMsg) {
  try {
    await fn();
    if (successMsg) toast(successMsg);
    return true;
  } catch (e) {
    handleError(e);
    return false;
  }
}

function handleError(e) {
  if (e.status === 401) {
    currentUser = null;
    toast('登入已過期，請重新登入', true);
    go('#/login');
  } else {
    toast(e.message, true);
  }
}

function go(hash) {
  if (location.hash === hash) router();
  else location.hash = hash;
}

function homeOf(user) {
  return user.role === ROLE.EDITOR ? '#/editor' : '#/author';
}

function renderUserbox() {
  const box = document.getElementById('userbox');
  const u = currentUser;
  if (!u) { box.innerHTML = ''; return; }
  box.innerHTML = `
    <span>${esc(u.name)}</span>
    <span class="role">${u.role === ROLE.EDITOR ? '編輯' : '作者'}</span>
    <button class="btn link" id="logout">登出</button>`;
  document.getElementById('logout').onclick = async () => {
    await api.logout().catch(() => {});
    currentUser = null;
    go('#/login');
  };
}

/* ---------------- 路由 ---------------- */

async function router() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const user = currentUser;
  renderUserbox();

  if (!user) return renderLogin();

  const [page, sub, id] = parts;
  try {
    if (page === 'author' && user.role === ROLE.AUTHOR) {
      if (sub === 'new') return await renderEditForm(null);
      if (sub === 'edit') return await renderEditForm(Number(id));
      return await renderAuthorList();
    }
    if (page === 'editor' && user.role === ROLE.EDITOR) return await renderPendingList();
    if (page === 'view') return await renderView(Number(sub));
  } catch (e) {
    handleError(e);
    if (e.status !== 401) go(homeOf(user));
    return;
  }
  go(homeOf(user));
}

/* ---------------- 登入 ---------------- */

function renderLogin() {
  $app.innerHTML = `
    <div class="card login">
      <h2>登入</h2>
      <p class="muted">請以作者或編輯身分登入</p>
      <form id="login-form">
        <div class="form-row"><label for="username">帳號</label><input id="username" autocomplete="username" required /></div>
        <div class="form-row"><label for="password">密碼</label><input id="password" type="password" autocomplete="current-password" required /></div>
        <div class="error" id="login-error"></div>
        <button class="btn primary" style="width:100%">登入</button>
      </form>
      <div class="demo-accounts">
        測試帳號（密碼皆為 <code>1234</code>）：<br/>
        作者：<code>author1</code>、<code>author2</code>　編輯：<code>editor1</code>
      </div>
    </div>`;

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      currentUser = await api.login(
        document.getElementById('username').value.trim(),
        document.getElementById('password').value
      );
      go(homeOf(currentUser));
    } catch (err) {
      document.getElementById('login-error').textContent = err.message;
    }
  };
}

/* ---------------- 作者：稿件清單 ---------------- */

let authorFilter = '全部';

async function renderAuthorList() {
  const all = await api.myList();
  const rows = authorFilter === '全部' ? all : all.filter((m) => m.status === authorFilter);
  const count = (s) => all.filter((m) => m.status === s).length;

  $app.innerHTML = `
    <div class="page-head">
      <div>
        <h2>我的投稿</h2>
        <div class="muted">共 ${all.length} 篇</div>
      </div>
      <button class="btn primary" id="new-btn">＋ 新增投稿</button>
    </div>
    <div class="filters" style="margin-bottom:12px">
      ${['全部', STATUS.EDITING, STATUS.REVIEWING, STATUS.APPROVED].map((s) => `
        <button class="btn small ${s === authorFilter ? 'active' : ''}" data-filter="${s}">
          ${s}${s === '全部' ? '' : ` (${count(s)})`}
        </button>`).join('')}
    </div>
    <div class="card" style="padding:0">
      <table>
        <thead><tr><th>類別</th><th>標題</th><th>審查狀態</th><th>最後更新</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? `<tr><td colspan="5" class="empty">目前沒有稿件</td></tr>` : rows.map((m) => `
            <tr>
              <td>${esc(m.category)}</td>
              <td>${esc(m.title)}</td>
              <td>${badge(m.status)}</td>
              <td class="muted">${esc(m.updated_at)}</td>
              <td class="actions">
                <button class="btn small" data-act="view" data-id="${m.id}">查看</button>
                ${m.status === STATUS.EDITING ? `
                  <button class="btn small" data-act="edit" data-id="${m.id}">編輯</button>
                  <button class="btn small primary" data-act="submit" data-id="${m.id}">送出投稿</button>
                  <button class="btn small danger" data-act="delete" data-id="${m.id}">刪除</button>` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  document.getElementById('new-btn').onclick = () => go('#/author/new');
  $app.querySelectorAll('[data-filter]').forEach((b) => {
    b.onclick = () => { authorFilter = b.dataset.filter; router(); };
  });
  $app.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = () => authorAction(b.dataset.act, Number(b.dataset.id));
  });
}

async function authorAction(act, id) {
  if (act === 'view') return go(`#/view/${id}`);
  if (act === 'edit') return go(`#/author/edit/${id}`);
  if (act === 'submit') {
    if (await confirmDialog('送出投稿', '送出後稿件將進入「審查中」，無法再編輯。確定送出？')) {
      await attempt(() => api.submit(id), '已送出投稿');
    }
  }
  if (act === 'delete') {
    if (await confirmDialog('刪除稿件', '刪除後無法復原，確定刪除？')) {
      await attempt(() => api.remove(id), '稿件已刪除');
    }
  }
  router();
}

/* ---------------- 作者：新增 / 編輯投稿 ---------------- */

async function renderEditForm(id) {
  let m = { category_id: '', title: '', content: '' };
  if (id) {
    m = await api.get(id);
    if (m.status !== STATUS.EDITING) {
      toast('只有「編輯中」的稿件可以編輯', true);
      return go('#/author');
    }
  }
  const cats = await api.categories();

  $app.innerHTML = `
    <div class="page-head">
      <div>
        <h2>${id ? '編輯投稿' : '新增投稿'}</h2>
        <div class="muted">狀態：${badge(STATUS.EDITING)}</div>
      </div>
    </div>
    <form class="card" id="ms-form">
      <div class="form-row">
        <label for="category">類別</label>
        <select id="category" required>
          <option value="">— 請選擇 —</option>
          ${cats.map((c) => `<option value="${c.id}" ${c.id === m.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label for="title">標題</label>
        <input id="title" maxlength="100" value="${esc(m.title)}" required />
      </div>
      <div class="form-row">
        <label for="content">文章內容</label>
        <textarea id="content">${esc(m.content)}</textarea>
      </div>
      <div class="error" id="form-error"></div>
      <div class="form-actions">
        <button type="button" class="btn" id="cancel">取消</button>
        <button type="submit" class="btn" id="save">儲存（編輯中）</button>
        <button type="button" class="btn primary" id="save-submit">儲存並送出投稿</button>
      </div>
    </form>`;

  const readForm = () => ({
    categoryId: Number(document.getElementById('category').value) || null,
    title: document.getElementById('title').value,
    content: document.getElementById('content').value,
  });

  /** 儲存後回傳稿件 id；失敗回傳 null */
  const save = async () => {
    try {
      if (id) { await api.update(id, readForm()); return id; }
      const res = await api.create(readForm());
      id = res.id; // 之後再儲存會變成更新，而不是重複新增
      return id;
    } catch (e) {
      if (e.status === 401) handleError(e);
      else document.getElementById('form-error').textContent = e.message;
      return null;
    }
  };

  document.getElementById('cancel').onclick = () => go('#/author');
  document.getElementById('ms-form').onsubmit = async (e) => {
    e.preventDefault();
    if (await save()) { toast('已儲存'); go('#/author'); }
  };
  document.getElementById('save-submit').onclick = async () => {
    const savedId = await save();
    if (!savedId) return;
    if (await confirmDialog('送出投稿', '送出後稿件將進入「審查中」，無法再編輯。確定送出？')) {
      if (await attempt(() => api.submit(savedId), '已送出投稿')) go('#/author');
    } else {
      toast('已儲存（尚未送出）');
    }
  };
}

/* ---------------- 編輯：待審查清單 ---------------- */

async function renderPendingList() {
  const rows = await api.pending();
  $app.innerHTML = `
    <div class="page-head">
      <div>
        <h2>待審查清單</h2>
        <div class="muted">共 ${rows.length} 篇待審查</div>
      </div>
    </div>
    <div class="card" style="padding:0">
      <table>
        <thead><tr><th>作者</th><th>類別</th><th>標題</th><th>送審時間</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? `<tr><td colspan="5" class="empty">目前沒有待審查的稿件</td></tr>` : rows.map((m) => `
            <tr>
              <td>${esc(m.author)}</td>
              <td>${esc(m.category)}</td>
              <td>${esc(m.title)}</td>
              <td class="muted">${esc(m.updated_at)}</td>
              <td class="actions"><button class="btn small primary" data-id="${m.id}">查看稿件</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  $app.querySelectorAll('[data-id]').forEach((b) => {
    b.onclick = () => go(`#/view/${b.dataset.id}`);
  });
}

/* ---------------- 查看稿件內容 ---------------- */

async function renderView(id) {
  const user = currentUser;
  const m = await api.get(id);
  const back = homeOf(user);

  let actions = '';
  if (user.role === ROLE.EDITOR && m.status === STATUS.REVIEWING) {
    actions = `
      <button class="btn danger" id="reject">退回稿件</button>
      <button class="btn success" id="approve">選擇通過</button>`;
  } else if (user.role === ROLE.AUTHOR && m.status === STATUS.EDITING) {
    actions = `
      <button class="btn" id="edit">編輯</button>
      <button class="btn primary" id="submit">送出投稿</button>`;
  }

  $app.innerHTML = `
    <div class="page-head">
      <button class="btn" id="back">← 返回</button>
      <div class="form-actions">${actions}</div>
    </div>
    <article class="card">
      <h2>${esc(m.title)}</h2>
      <div class="meta">
        <span>作者：${esc(m.author)}</span>
        <span>類別：${esc(m.category)}</span>
        <span>狀態：${badge(m.status)}</span>
        <span>最後更新：${esc(m.updated_at)}</span>
      </div>
      <div class="article">${esc(m.content) || '<span class="muted">（無內容）</span>'}</div>
    </article>
    ${m.logs.length ? `
    <div class="card">
      <h3>審查紀錄</h3>
      <ul class="logs">
        ${m.logs.map((l) => `<li>${esc(l.created_at)}　${esc(l.user)}　${esc(l.action)}：${esc(l.from_status)} → ${esc(l.to_status)}</li>`).join('')}
      </ul>
    </div>` : ''}`;

  document.getElementById('back').onclick = () => go(back);

  const bind = (elId, fn) => { const el = document.getElementById(elId); if (el) el.onclick = fn; };
  bind('approve', async () => {
    if (await confirmDialog('通過稿件', `確定讓「${m.title}」通過審查？`)) {
      if (await attempt(() => api.approve(id), '稿件已通過')) go(back);
    }
  });
  bind('reject', async () => {
    if (await confirmDialog('退回稿件', `確定退回「${m.title}」？稿件將回到「編輯中」。`)) {
      if (await attempt(() => api.reject(id), '稿件已退回')) go(back);
    }
  });
  bind('edit', () => go(`#/author/edit/${id}`));
  bind('submit', async () => {
    if (await confirmDialog('送出投稿', '送出後稿件將進入「審查中」，無法再編輯。確定送出？')) {
      if (await attempt(() => api.submit(id), '已送出投稿')) go(back);
    }
  });
}

/* ---------------- 啟動 ---------------- */

(async function main() {
  document.getElementById('brand').onclick = () =>
    go(currentUser ? homeOf(currentUser) : '#/login');
  window.addEventListener('hashchange', router);
  try {
    currentUser = await api.me();
  } catch (e) {
    $app.innerHTML = `<div class="card error">無法連線到伺服器，請確認已執行 npm start。</div>`;
    return;
  }
  router();
})();
