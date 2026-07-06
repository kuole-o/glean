import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'glean.db');

let db;

export function getDb() {
  if (db) return db;

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');   // Better concurrent reads
  db.pragma('foreign_keys = ON');

  // Create table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS sentences (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      hitokoto    TEXT    NOT NULL,
      type        TEXT    DEFAULT 'other',
      from_source TEXT    DEFAULT '',
      from_who    TEXT    DEFAULT '',
      created_at  TEXT    DEFAULT (datetime('now','localtime')),
      updated_at  TEXT    DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_type ON sentences(type);
  `);

  return db;
}

// Sentence CRUD operations
export function getAllSentences({ type, keyword, page = 1, size = 20 } = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (type) {
    const types = type.split(',').map(t => t.trim()).filter(Boolean);
    if (types.length > 0) {
      conditions.push(`type IN (${types.map(() => '?').join(',')})`);
      params.push(...types);
    }
  }

  if (keyword) {
    conditions.push('(hitokoto LIKE ? OR from_source LIKE ? OR from_who LIKE ?)');
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * size;

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM sentences ${where}`).get(...params);
  const rows = db.prepare(`SELECT * FROM sentences ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, size, offset);

  return {
    total: countRow.total,
    page,
    size,
    totalPages: Math.ceil(countRow.total / size),
    data: rows,
  };
}

export function getRandomSentence(type) {
  const db = getDb();
  if (type) {
    const types = type.split(',').map(t => t.trim()).filter(Boolean);
    if (types.length > 0) {
      const placeholders = types.map(() => '?').join(',');
      return db.prepare(`SELECT * FROM sentences WHERE type IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`).get(...types) || null;
    }
  }
  return db.prepare('SELECT * FROM sentences ORDER BY RANDOM() LIMIT 1').get() || null;
}

export function getSentenceById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM sentences WHERE id = ?').get(id);
}

export function createSentence({ hitokoto, type, from_source, from_who }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sentences (hitokoto, type, from_source, from_who)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(hitokoto, type || 'other', from_source || '', from_who || '');
  return getSentenceById(result.lastInsertRowid);
}

export function updateSentence(id, { hitokoto, type, from_source, from_who }) {
  const db = getDb();
  const existing = getSentenceById(id);
  if (!existing) return null;

  db.prepare(`
    UPDATE sentences SET hitokoto=?, type=?, from_source=?, from_who=?, updated_at=datetime('now','localtime')
    WHERE id=?
  `).run(
    hitokoto ?? existing.hitokoto,
    type ?? existing.type,
    from_source ?? existing.from_source,
    from_who ?? existing.from_who,
    id
  );
  return getSentenceById(id);
}

export function deleteSentence(id) {
  const db = getDb();
  const existing = getSentenceById(id);
  if (!existing) return false;
  db.prepare('DELETE FROM sentences WHERE id = ?').run(id);
  return true;
}

export function getStats() {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM sentences').get().count;
  const types = db.prepare('SELECT type, COUNT(*) as count FROM sentences GROUP BY type ORDER BY count DESC').all();
  return { total, types };
}
