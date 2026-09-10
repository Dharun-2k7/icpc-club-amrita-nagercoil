const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'icpc-club-secret-key';

async function verifyUserAndRole(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const userRes = await pool.query(
      'SELECT id, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );
    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) return null;
    return { ...decoded, role: (userRes.rows[0].role || '').toUpperCase() };
  } catch (err) {
    return null;
  }
}

export default async function handler(req, res) {
  const dbUser = await verifyUserAndRole(req);
  const { session_id, action } = req.query;

  // GET /api/attendance?action=me -> Logged in member's own attendance profile & summary
  if (req.method === 'GET' && action === 'me') {
    if (!dbUser) {
      return res.status(401).json({ message: 'Unauthorized: Authentication required' });
    }

    try {
      // Fetch user's club_member_id
      const uRes = await pool.query(`SELECT club_member_id FROM users WHERE id = $1`, [dbUser.id]);
      if (uRes.rows.length === 0) {
        return res.status(404).json({ message: 'Member record not found' });
      }

      const cmId = uRes.rows[0].club_member_id;

      if (!cmId) {
        return res.status(200).json({
          total_sessions: 0,
          present_count: 0,
          absent_count: 0,
          attendance_percentage: 0,
          history: []
        });
      }

      // Attendance history for this member
      const attHistory = await pool.query(
        `SELECT a.id, a.session_id, a.status, a.marked_at,
                s.title as session_title, s.session_type, s.start_time, s.location
         FROM attendance a
         JOIN sessions s ON a.session_id = s.id
         WHERE a.club_member_id = $1
         ORDER BY s.start_time DESC`,
        [cmId]
      );

      // Total completed sessions in club
      const totalSessionsRes = await pool.query(
        `SELECT COUNT(*) FROM sessions WHERE start_time <= CURRENT_TIMESTAMP AND status != 'CANCELLED'`
      );
      const totalSessions = parseInt(totalSessionsRes.rows[0].count, 10);

      const presentCount = attHistory.rows.filter(r => r.status.toUpperCase() === 'PRESENT').length;
      const absentCount = attHistory.rows.filter(r => r.status.toUpperCase() === 'ABSENT').length;
      const percentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

      return res.status(200).json({
        total_sessions: totalSessions,
        present_count: presentCount,
        absent_count: absentCount,
        attendance_percentage: percentage,
        history: attHistory.rows
      });
    } catch (error) {
      console.error('Error fetching member attendance:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // GET /api/attendance?session_id=X -> Admin/Coordinator fetches session attendance roster
  if (req.method === 'GET') {
    const isAllowed = dbUser && ['ADMIN', 'COORDINATOR'].includes(dbUser.role);
    if (!isAllowed) {
      return res.status(403).json({ message: 'Forbidden: Admins & Coordinators only' });
    }

    if (!session_id) {
      return res.status(400).json({ message: 'session_id is required' });
    }

    try {
      const result = await pool.query(
        `SELECT a.id, a.session_id, a.club_member_id, a.status, a.marked_at,
                cm.name as member_name, cm.student_id, cm.email, cm.department, cm.year
         FROM attendance a
         JOIN club_members cm ON a.club_member_id = cm.id
         WHERE a.session_id = $1
         ORDER BY cm.name ASC`,
        [session_id]
      );
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching attendance roster:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // POST /api/attendance -> Admin/Coordinator marks/upserts attendance
  if (req.method === 'POST') {
    const isAllowed = dbUser && ['ADMIN', 'COORDINATOR'].includes(dbUser.role);
    if (!isAllowed) {
      return res.status(403).json({ message: 'Forbidden: Admins & Coordinators only' });
    }

    const { session_id: sId, club_member_id, student_id, status } = req.body;
    const targetSessionId = sId || session_id;

    if (!targetSessionId || (!club_member_id && !student_id)) {
      return res.status(400).json({ message: 'session_id and member identifier (club_member_id or student_id) are required' });
    }

    try {
      let cmId = club_member_id;
      if (!cmId && student_id) {
        const cmRes = await pool.query(`SELECT id FROM club_members WHERE student_id = $1`, [student_id]);
        if (cmRes.rows.length === 0) {
          return res.status(404).json({ message: 'Club member not found with provided student_id' });
        }
        cmId = cmRes.rows[0].id;
      }

      const attStatus = (status || 'PRESENT').toUpperCase();

      const result = await pool.query(
        `INSERT INTO attendance (session_id, club_member_id, status, marked_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id, club_member_id)
         DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [targetSessionId, cmId, attStatus, dbUser.id]
      );

      return res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error marking attendance:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
