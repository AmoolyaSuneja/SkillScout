const Database = require('better-sqlite3');
const path = require('path');

let dbInstance = null;

function getDb() {
    if (dbInstance) return dbInstance;
    const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.prepare(`
        CREATE TABLE IF NOT EXISTS skills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            last_refreshed_at INTEGER
        );
    `).run();
    db.prepare(`
        CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            skill_name TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            source TEXT,
            type TEXT,
            price TEXT,
            description TEXT,
            rating REAL,
            num_reviews INTEGER,
            published_at INTEGER,
            fetched_at INTEGER NOT NULL,
            UNIQUE(skill_name, url)
        );
    `).run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_resources_skill ON resources(skill_name);').run();
    dbInstance = db;
    return dbInstance;
}

module.exports = { getDb };


