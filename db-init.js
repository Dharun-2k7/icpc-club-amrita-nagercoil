const fs = require('fs');
const { Pool } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
envContent.split('\n').forEach(line => {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim();
  }
});

const pool = new Pool({
  connectionString: dbUrl,
});

async function initDB() {
  try {
    console.log('Connecting to DB...');
    // Create students table if it doesn't exist (just in case)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        codeforces_handle VARCHAR(255) UNIQUE NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        roll_number VARCHAR(255) UNIQUE NOT NULL,
        class_name VARCHAR(255) NOT NULL,
        batch VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add password_hash and role columns to students table if they don't exist
    await pool.query(`
      ALTER TABLE students 
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'student';
    `);

    // Create sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        date TIMESTAMP NOT NULL,
        type VARCHAR(50) DEFAULT 'session',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create attendance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'present',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, student_id)
      );
    `);

    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    pool.end();
  }
}

initDB();
