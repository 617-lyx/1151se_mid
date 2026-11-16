/* =========================================================
 * 前端 API 呼叫：所有資料都透過後端 REST API 從 MySQL 取得
 * ========================================================= */

const STATUS = Object.freeze({ EDITING: '編輯中', REVIEWING: '審查中', APPROVED: '已通過' });
const ROLE = Object.freeze({ AUTHOR: 'author', EDITOR: 'editor' });

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `請求失敗 (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const api = {
  // 登入
  login: (username, password) => request('POST', '/api/login', { username, password }),
  logout: () => request('POST', '/api/logout'),
  me: () => request('GET', '/api/me'),
  categories: () => request('GET', '/api/categories'),

  // 作者
  myList: () => request('GET', '/api/my/manuscripts'),
  create: (data) => request('POST', '/api/my/manuscripts', data),
  update: (id, data) => request('PUT', `/api/my/manuscripts/${id}`, data),
  remove: (id) => request('DELETE', `/api/my/manuscripts/${id}`),
  submit: (id) => request('POST', `/api/my/manuscripts/${id}/submit`),

  // 編輯
  pending: () => request('GET', '/api/reviews'),
  approve: (id) => request('POST', `/api/reviews/${id}/approve`),
  reject: (id) => request('POST', `/api/reviews/${id}/reject`),

  // 共用
  get: (id) => request('GET', `/api/manuscripts/${id}`),
};
