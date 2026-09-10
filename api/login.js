const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'icpc-club-secret-key';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { roll_number, email, password } = req.body;
  const identifier = (email || roll_number || '').trim().toLowerCase();

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Email/Roll number and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.club_member_id, u.admin_id, u.email, u.student_id, u.name, u.password_hash, u.role, u.is_active
       FROM users u
       WHERE (LOWER(u.email) = $1 OR LOWER(u.student_id) = $1) AND u.is_active = TRUE`,
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials or account deactivated' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ message: 'Account not set up. Please register first.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const payload = {
      id: user.id,
      club_member_id: user.club_member_id,
      admin_id: user.admin_id,
      email: user.email,
      student_id: user.student_id,
      name: user.name,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

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
