import Database from 'better-sqlite3';
import { createRequire } from 'module';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Database path (stored in project root)
const DB_PATH = join(__dirname, '..', '..', 'revit-data.db');

function createDatabase(dbPath: string): Database.Database {
  try {
    return new Database(dbPath);
  } catch {
    // Fallback to Node.js built-in node:sqlite (Node 22.5+ / Node 26+) when better-sqlite3 native bindings are unavailable
    const { DatabaseSync } = require('node:sqlite');
    const sqliteDb = new DatabaseSync(dbPath);
    return {
      exec: (sql: string) => sqliteDb.exec(sql),
      pragma: (str: string) => sqliteDb.exec(`PRAGMA ${str}`),
      prepare: (sql: string) => sqliteDb.prepare(sql),
      transaction: <T extends (...args: any[]) => any>(fn: T): T => {
        return ((...args: any[]) => {
          sqliteDb.exec('BEGIN');
          try {
            const result = fn(...args);
            sqliteDb.exec('COMMIT');
            return result;
          } catch (err) {
            sqliteDb.exec('ROLLBACK');
            throw err;
          }
        }) as T;
      }
    } as unknown as Database.Database;
  }
}

// Initialize database connection
export const db = createDatabase(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  // Create projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      project_path TEXT,
      project_number TEXT,
      project_address TEXT,
      client_name TEXT,
      project_status TEXT,
      author TEXT,
      timestamp INTEGER NOT NULL,
      last_updated INTEGER NOT NULL,
      metadata TEXT
    )
  `);

  // Create rooms table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      room_id TEXT NOT NULL,
      room_name TEXT,
      room_number TEXT,
      department TEXT,
      level TEXT,
      area REAL,
      perimeter REAL,
      occupancy TEXT,
      comments TEXT,
      timestamp INTEGER NOT NULL,
      metadata TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, room_id)
    )
  `);

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(project_name);
    CREATE INDEX IF NOT EXISTS idx_projects_timestamp ON projects(timestamp);
    CREATE INDEX IF NOT EXISTS idx_rooms_project_id ON rooms(project_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number);
  `);
}

// Initialize on module load
initializeDatabase();

export default db;
