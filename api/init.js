const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  try {
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

    return res.status(200).json({ message: 'Database initialized successfully.' });
  } catch (error) {
    console.error('Error initializing database:', error);
    return res.status(500).json({ message: 'Error initializing database', error: error.message });
  }
}
