import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

export const db = new Database(process.env.DB_PATH || './data.sqlite');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    login TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'moderator')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS monitors (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 5555,
    startup_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ip, port)
  );
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_login TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    ok INTEGER NOT NULL DEFAULT 1
  );
`);

// Databases created before startup_url existed
if (!db.prepare('PRAGMA table_info(monitors)').all().some((c) => c.name === 'startup_url')) {
  db.exec("ALTER TABLE monitors ADD COLUMN startup_url TEXT NOT NULL DEFAULT ''");
}

export function seedAdmin() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (c > 0) return;
  const login = process.env.ADMIN_LOGIN || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password === 'change-me') {
    throw new Error('Set ADMIN_PASSWORD in .env to create the first admin');
  }
  db.prepare('INSERT INTO users (login, name, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(login, 'Администратор', bcrypt.hashSync(password, 10), 'admin');
  console.log(`Created admin user "${login}"`);
}

export function addLog(userLogin, action, target = '', ok = true) {
  db.prepare('INSERT INTO logs (user_login, action, target, ok) VALUES (?, ?, ?, ?)')
    .run(userLogin, action, target, ok ? 1 : 0);
}

export const adminCount = () =>
  db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
