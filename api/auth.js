const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'icpc-club-secret-key';

export default async function handler(req, res) {
  const { action } = req.query;

  // Handle GET /api/auth?action=me
  if (req.method === 'GET' && action === 'me') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: Missing token' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const userRes = await pool.query(
        `SELECT u.id, u.club_member_id, u.email, u.student_id, u.name, u.role, u.is_active,
                cm.department, cm.year, cm.codeforces_handle
         FROM users u
         JOIN club_members cm ON u.club_member_id = cm.id
         WHERE u.id = $1 AND u.is_active = TRUE`,
        [decoded.id]
      );

      if (userRes.rows.length === 0) {
        return res.status(404).json({ message: 'User account not found or deactivated' });
      }

      return res.status(200).json(userRes.rows[0]);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  }

  // Handle POST /api/auth?action=register
  if (req.method === 'POST' && action === 'register') {
    const { email, roll_number, password, student_name, codeforces_handle } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedRoll = roll_number ? roll_number.trim() : null;

    try {
      // 1. Verify email against approved club_members list
      let memberRes = await pool.query(
        `SELECT * FROM club_members WHERE LOWER(email) = $1 AND is_active = TRUE`,
        [trimmedEmail]
      );

      // If not found by email, attempt match by student_id / roll_number if provided
      if (memberRes.rows.length === 0 && trimmedRoll) {
        memberRes = await pool.query(
          `SELECT * FROM club_members WHERE LOWER(student_id) = LOWER($1) AND is_active = TRUE`,
          [trimmedRoll]
        );
      }

      if (memberRes.rows.length === 0) {
        return res.status(403).json({
          message: 'Registration denied: Your email is not in the approved ICPC Club roster. Please contact the administrator.'
        });
      }

      const clubMember = memberRes.rows[0];

      // 2. Check if user account already exists
      const existingUser = await pool.query(
        `SELECT id FROM users WHERE club_member_id = $1 OR LOWER(email) = $2`,
        [clubMember.id, trimmedEmail]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          message: 'An account already exists for this member. Please log in.'
        });
      }

      // 3. Hash password
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      // Update codeforces handle in club_members if provided
      if (codeforces_handle) {
        await pool.query(
          `UPDATE club_members SET codeforces_handle = $1 WHERE id = $2`,
          [codeforces_handle.trim(), clubMember.id]
        );
      }

      // 4. Create user account
      const newUser = await pool.query(
        `INSERT INTO users (club_member_id, email, student_id, name, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, 'MEMBER')
         RETURNING id, name, email, role`,
        [clubMember.id, clubMember.email, clubMember.student_id, student_name || clubMember.name, password_hash]
      );

      return res.status(201).json({
        message: 'Account created successfully! Welcome to ICPC Club.',
        user: newUser.rows[0]
      });

    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ message: 'Internal Server Error during registration' });
    }
  }

  // Handle POST /api/auth?action=login
  if (req.method === 'POST' && (action === 'login' || !action)) {
    const { email, roll_number, password } = req.body;
    const identifier = (email || roll_number || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/Roll Number and Password are required' });
    }

    try {
      const userRes = await pool.query(
        `SELECT u.id, u.club_member_id, u.email, u.student_id, u.name, u.password_hash, u.role, u.is_active
         FROM users u
         WHERE (LOWER(u.email) = $1 OR LOWER(u.student_id) = $1) AND u.is_active = TRUE`,
        [identifier]
      );

      if (userRes.rows.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials or account deactivated' });
      }

      const user = userRes.rows[0];

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const payload = {
        id: user.id,
        club_member_id: user.club_member_id,
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
      console.error('Login error:', error);
      return res.status(500).json({ message: 'Internal Server Error during login' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
