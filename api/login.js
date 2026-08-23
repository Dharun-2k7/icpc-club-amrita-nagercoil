const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { roll_number, password } = req.body;

  if (!roll_number || !password) {
    return res.status(400).json({ message: 'Roll number and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, student_name, roll_number, password_hash, role FROM students WHERE roll_number = $1`,
      [roll_number]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    if (!user.password_hash) {
      return res.status(401).json({ message: 'Account not fully set up. Please re-register or reset password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create JWT
    const payload = {
      id: user.id,
      name: user.student_name,
      roll_number: user.roll_number,
      role: user.role
    };

    // Use a hardcoded secret if JWT_SECRET is not set (for simplicity in this project)
    const secret = process.env.JWT_SECRET || 'icpc-club-secret-key';
    const token = jwt.sign(payload, secret, { expiresIn: '7d' });

    return res.status(200).json({ 
      message: 'Login successful', 
      token,
      user: payload
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
