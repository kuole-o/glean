const BASE = ''  // same origin

let authToken = null

export function getToken() {
  if (!authToken) {
    authToken = sessionStorage.getItem('glean_token')
  }
  return authToken
}

export function setToken(token) {
  authToken = token
  try { sessionStorage.setItem('glean_token', token) } catch(e) {}
}

export function clearToken() {
  authToken = null
  try { sessionStorage.removeItem('glean_token') } catch(e) {}
}

async function request(url, options = {}) {
  const token = getToken()
  if (token) {
    options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` }
  }
  const res = await fetch(BASE + url, options)
  if (res.status === 401) {
    clearToken()
    throw new AuthError(res)
  }
  return res
}

export class AuthError extends Error {
  constructor(response) {
    super('未登录')
    this.response = response
    this.status = 401
  }
}

// ---- Auth ----
export async function login(username, password) {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return res.json()
}

export async function verifyToken() {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(BASE + '/api/auth/verify', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const j = await res.json()
    if (j.code === 200) return j.data
    return null
  } catch {
    return null
  }
}

// ---- Sentences ----
export async function getSentences(params = {}) {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', params.page)
  if (params.size) qs.set('size', params.size)
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.type) qs.set('type', params.type)
  const res = await request('/api/sentences?' + qs.toString())
  return res.json()
}

export async function getSentence(id) {
  const res = await request('/api/sentences/' + id)
  return res.json()
}

export async function createSentence(data) {
  const res = await request('/api/sentences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function updateSentence(id, data) {
  const res = await request('/api/sentences/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function deleteSentence(id) {
  const res = await request('/api/sentences/' + id, { method: 'DELETE' })
  return res.json()
}

export async function getStats() {
  const res = await request('/api/stats')
  return res.json()
}

export async function getCategories() {
  const res = await request('/api/categories')
  return res.json()
}

export async function getSiteInfo() {
  const res = await fetch(BASE + '/api/site-info')
  return res.json()
}
