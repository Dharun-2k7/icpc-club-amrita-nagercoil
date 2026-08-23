const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { roll_number, secret_key } = req.body;

  // Change 'admin123' to whatever secret key you want
  if (secret_key !== 'icpc2026admin') {
    return res.status(401).json({ message: 'Invalid secret key' });
  }

  try {
    const result = await pool.query(
      "UPDATE students SET role = 'admin' WHERE roll_number = $1 RETURNING student_name, role",
      [roll_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ message: 'User elevated to admin successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Error elevating user:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
