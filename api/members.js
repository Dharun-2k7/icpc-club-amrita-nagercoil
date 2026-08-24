const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'icpc-club-secret-key';

function verifyAdmin(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized: Token required' });
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'ADMIN') {
      res.status(403).json({ message: 'Forbidden: Admins only' });
      return null;
    }
    return decoded;
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return null;
  }
}

export default async function handler(req, res) {
  const admin = verifyAdmin(req, res);
  if (!admin) return;

  const { action, id } = req.query;

  // GET /api/members -> Fetch all approved club members with registration status
  if (req.method === 'GET') {
    try {
      const result = await pool.query(`
        SELECT cm.id, cm.email, cm.student_id, cm.name, cm.department, cm.year, 
               cm.codeforces_handle, cm.is_active, cm.created_at,
               CASE WHEN u.id IS NOT NULL THEN TRUE ELSE FALSE END as is_registered,
               u.role as user_role
        FROM club_members cm
        LEFT JOIN users u ON cm.id = u.club_member_id
        ORDER BY cm.name ASC
      `);
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching members:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // POST /api/members -> Add single member or bulk CSV import
  if (req.method === 'POST') {
    if (action === 'import-csv') {
      const { members } = req.body; // Array of { name, email, student_id, department, year, codeforces_handle }
      if (!Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ message: 'No valid member list provided' });
      }

      let addedCount = 0;
      try {
        for (const m of members) {
          if (m.email && m.student_id && m.name) {
            await pool.query(
              `INSERT INTO club_members (email, student_id, name, department, year, codeforces_handle)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (email) DO UPDATE SET
                 student_id = EXCLUDED.student_id,
                 name = EXCLUDED.name,
                 department = COALESCE(EXCLUDED.department, club_members.department),
                 year = COALESCE(EXCLUDED.year, club_members.year),
                 codeforces_handle = COALESCE(EXCLUDED.codeforces_handle, club_members.codeforces_handle)`,
              [
                m.email.trim().toLowerCase(),
                m.student_id.trim(),
                m.name.trim(),
                m.department ? m.department.trim() : null,
                m.year ? m.year.trim() : null,
                m.codeforces_handle ? m.codeforces_handle.trim() : null
              ]
            );
            addedCount++;
          }
        }
        return res.status(200).json({ message: `Successfully imported/updated ${addedCount} members.` });
      } catch (error) {
        console.error('CSV Import Error:', error);
        return res.status(500).json({ message: 'Error processing member import' });
      }
    }

    // Add single member
    const { name, email, student_id, department, year, codeforces_handle } = req.body;
    if (!name || !email || !student_id) {
      return res.status(400).json({ message: 'Name, Email, and Student ID are required' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO club_members (email, student_id, name, department, year, codeforces_handle)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          email.trim().toLowerCase(),
          student_id.trim(),
          name.trim(),
          department ? department.trim() : null,
          year ? year.trim() : null,
          codeforces_handle ? codeforces_handle.trim() : null
        ]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error adding member:', error);
      if (error.code === '23505') {
        return res.status(409).json({ message: 'A member with this email or student ID already exists.' });
      }
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // PUT /api/members?id=X -> Edit member details
  if (req.method === 'PUT') {
    const memberId = id || req.body.id;
    const { name, email, student_id, department, year, codeforces_handle, is_active } = req.body;

    if (!memberId) {
      return res.status(400).json({ message: 'Member ID required' });
    }

    try {
      const result = await pool.query(
        `UPDATE club_members 
         SET name = COALESCE($1, name),
             email = COALESCE($2, email),
             student_id = COALESCE($3, student_id),
             department = COALESCE($4, department),
             year = COALESCE($5, year),
             codeforces_handle = COALESCE($6, codeforces_handle),
             is_active = COALESCE($7, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 RETURNING *`,
        [name, email, student_id, department, year, codeforces_handle, is_active, memberId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Member not found' });
      }

      // Also update linked user status if deactivated
      if (is_active !== undefined) {
        await pool.query(
          `UPDATE users SET is_active = $1 WHERE club_member_id = $2`,
          [is_active, memberId]
        );
      }

      return res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error updating member:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // DELETE /api/members?id=X -> Deactivate member (Soft delete)
  if (req.method === 'DELETE') {
    const memberId = id || req.query.id;
    if (!memberId) {
      return res.status(400).json({ message: 'Member ID required' });
    }

    try {
      await pool.query(`UPDATE club_members SET is_active = FALSE WHERE id = $1`, [memberId]);
      await pool.query(`UPDATE users SET is_active = FALSE WHERE club_member_id = $1`, [memberId]);
      return res.status(200).json({ message: 'Member deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating member:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
