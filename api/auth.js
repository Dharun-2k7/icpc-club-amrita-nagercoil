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
        `SELECT u.id, u.club_member_id, u.admin_id, u.email, u.student_id, u.name, u.role, u.is_active,
                COALESCE(cm.department, ar.department, 'N/A') as department,
                COALESCE(cm.year, ar.year, 'N/A') as year,
                cm.codeforces_handle
         FROM users u
         LEFT JOIN club_members cm ON u.club_member_id = cm.id
         LEFT JOIN admin_roster ar ON u.admin_id = ar.id
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

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const userEmail = (email || '').trim().toLowerCase();
    const rollNumber = (roll_number || '').trim();
    const studentName = (student_name || '').trim();

    if (!userEmail && !rollNumber && !studentName) {
      return res.status(400).json({ message: 'Email, Roll Number, or Name is required' });
    }

    const cleanName = (n) => (n || '').replace(/^(mr|ms|mrs|dr|prof)\.?\s+/i, '').replace(/\s+(mam|sir)$/i, '').trim().toLowerCase();

    try {
      // 1. FIRST CHECK: Check if person is in the ADMIN / COORDINATOR list
      const adminQuery = `
        SELECT * FROM admin_roster 
        WHERE (LOWER(email) = $1 AND $1 != '')
           OR (LOWER(student_id) = LOWER($2) AND $2 != '')
           OR (LOWER(name) = LOWER($3) AND $3 != '')
           OR (LOWER(name) = $4 AND $4 != '')
      `;
      const adminMatch = await pool.query(adminQuery, [userEmail, rollNumber, studentName, cleanName(studentName)]);

      if (adminMatch.rows.length > 0) {
        // Case A: Admin/Coordinator -> Block public registration
        return res.status(403).json({
          error: 'ADMIN_ACCOUNT',
          message: 'Admin Account\n\nThis account is managed by the ICPC Club administration. Please contact the club coordinator for account access.'
        });
      }

      // 2. SECOND CHECK: Verify email/roll against approved club_members list
      let memberRes = null;
      if (userEmail) {
        memberRes = await pool.query(
          `SELECT * FROM club_members WHERE LOWER(email) = $1 AND is_active = TRUE`,
          [userEmail]
        );
      }

      if ((!memberRes || memberRes.rows.length === 0) && rollNumber) {
        memberRes = await pool.query(
          `SELECT * FROM club_members WHERE LOWER(student_id) = LOWER($1) AND is_active = TRUE`,
          [rollNumber]
        );
      }

      if (!memberRes || memberRes.rows.length === 0) {
        // Case D: Not in admin list and not in member roster -> Invalid Credentials
        return res.status(403).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid Credentials'
        });
      }

      const clubMember = memberRes.rows[0];

      // 3. THIRD CHECK: Check if user account already exists
      const existingUser = await pool.query(
        `SELECT id FROM users WHERE club_member_id = $1 OR LOWER(email) = $2 OR LOWER(student_id) = LOWER($3)`,
        [clubMember.id, clubMember.email, clubMember.student_id]
      );

      if (existingUser.rows.length > 0) {
        // Case B: Account already exists
        return res.status(409).json({
          error: 'ACCOUNT_EXISTS',
          message: 'An account already exists for this member. Please log in.'
        });
      }

      // 4. Case C: Approved normal member, no account -> Hash password & Create user account
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      if (codeforces_handle) {
        await pool.query(
          `UPDATE club_members SET codeforces_handle = $1 WHERE id = $2`,
          [codeforces_handle.trim(), clubMember.id]
        );
      }

      const newUser = await pool.query(
        `INSERT INTO users (club_member_id, email, student_id, name, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, 'MEMBER')
         RETURNING id, name, email, role`,
        [clubMember.id, clubMember.email, clubMember.student_id, studentName || clubMember.name, password_hash]
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
        `SELECT u.id, u.club_member_id, u.admin_id, u.email, u.student_id, u.name, u.password_hash, u.role, u.is_active
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
      console.error('Login error:', error);
      return res.status(500).json({ message: 'Internal Server Error during login' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
