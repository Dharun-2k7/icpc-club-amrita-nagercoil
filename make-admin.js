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

async function makeAdmin() {
  try {
    const res = await pool.query("UPDATE students SET role = 'admin' WHERE id = (SELECT id FROM students ORDER BY id ASC LIMIT 1) RETURNING *");
    if (res.rows.length > 0) {
      console.log('Made user an admin:', res.rows[0].student_name);
    } else {
      console.log('No users found in database to make admin.');
    }
  } catch (error) {
    console.error(error);
  } finally {
    pool.end();
  }
}

makeAdmin();
