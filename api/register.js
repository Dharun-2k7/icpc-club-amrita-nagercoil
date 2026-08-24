const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, student_name, roll_number, class_name, batch, password, codeforces_handle } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'Password is required' });
  }

  const userEmail = (email || '').trim().toLowerCase();
  const rollNumber = (roll_number || '').trim();

  if (!userEmail && !rollNumber) {
    return res.status(400).json({ message: 'Email or Roll Number is required for verification' });
  }

  try {
    // 1. Verify against approved club_members roster
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
      return res.status(403).json({
        message: 'Registration denied: You are not in the approved ICPC Club member roster. Please contact the admin.'
      });
    }

    const clubMember = memberRes.rows[0];

    // 2. Check if user account already exists
    const existingUser = await pool.query(
      `SELECT id FROM users WHERE club_member_id = $1 OR LOWER(email) = $2 OR LOWER(student_id) = LOWER($3)`,
      [clubMember.id, clubMember.email, clubMember.student_id]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: 'An account already exists for this member. Please log in.'
      });
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Update codeforces_handle in club_members if provided
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
      message: 'Registration successful! Welcome to ICPC Club.',
      user: newUser.rows[0]
    });

  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
