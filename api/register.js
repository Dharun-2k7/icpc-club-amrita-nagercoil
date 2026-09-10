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
  const studentName = (student_name || '').trim();

  if (!userEmail && !rollNumber && !studentName) {
    return res.status(400).json({ message: 'Email, Roll Number, or Name is required for registration verification' });
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
      const adminRecord = adminMatch.rows[0];

      // Check if user account already exists in users table
      const existingUser = await pool.query(
        `SELECT id FROM users WHERE admin_id = $1 OR LOWER(email) = $2 OR LOWER(student_id) = LOWER($3)`,
        [adminRecord.id, userEmail || adminRecord.email, rollNumber || adminRecord.student_id]
      );

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      const assignedRole = (adminRecord.role || 'ADMIN').toUpperCase();

      if (existingUser.rows.length > 0) {
        // Activate & update password/credentials for existing Admin account
        const updatedUser = await pool.query(
          `UPDATE users 
           SET password_hash = $1, role = $2, admin_id = $3, email = COALESCE(NULLIF($4, ''), email), is_active = TRUE
           WHERE id = $5
           RETURNING id, name, email, role`,
          [password_hash, assignedRole, adminRecord.id, userEmail, existingUser.rows[0].id]
        );

        return res.status(200).json({
          message: 'Admin account successfully registered and activated! You can now log in.',
          user: updatedUser.rows[0]
        });
      }

      // Create new Admin user account with full ADMIN access
      const newUser = await pool.query(
        `INSERT INTO users (admin_id, email, student_id, name, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id, name, email, role`,
        [
          adminRecord.id,
          userEmail || adminRecord.email,
          rollNumber || adminRecord.student_id,
          studentName || adminRecord.name,
          password_hash,
          assignedRole
        ]
      );

      return res.status(201).json({
        message: 'Admin account successfully registered! You can now log in.',
        user: newUser.rows[0]
      });
    }

    // 2. SECOND CHECK: Verify against approved club_members roster
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
      message: 'Registration successful! Welcome to ICPC Club.',
      user: newUser.rows[0]
    });

  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
