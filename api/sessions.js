const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'icpc-club-secret-key';

async function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const userRes = await pool.query(
      'SELECT id, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );
    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) return null;
    const role = (userRes.rows[0].role || '').toUpperCase();
    return role === 'ADMIN' ? { ...decoded, role } : null;
  } catch (err) {
    return null;
  }
}

// Compute dynamic status relative to server timestamp
function computeStatus(session) {
  if (session.status === 'CANCELLED') return 'CANCELLED';
  const now = new Date();
  const start = new Date(session.start_time);
  const end = new Date(session.end_time);

  if (now < start) return 'UPCOMING';
  if (now >= start && now <= end) return 'ONGOING';
  return 'COMPLETED';
}

export default async function handler(req, res) {
  const { id } = req.query;

  // GET /api/sessions -> Returns all sessions with dynamic status
  if (req.method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM sessions ORDER BY start_time DESC');
      const sessionsWithStatus = result.rows.map(s => ({
        ...s,
        calculated_status: computeStatus(s)
      }));
      return res.status(200).json(sessionsWithStatus);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // Admin Verification for modifying requests
  const admin = await verifyAdmin(req);
  if (!admin) {
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }

  // POST /api/sessions -> Create session
  if (req.method === 'POST') {
    const { title, description, session_type, start_time, end_time, location } = req.body;

    if (!title || !start_time) {
      return res.status(400).json({ message: 'Title and start_time are required' });
    }

    const startDate = new Date(start_time);
    // Default end time to 2 hours after start if not provided
    const endDate = end_time ? new Date(end_time) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    try {
      const result = await pool.query(
        `INSERT INTO sessions (title, description, session_type, start_time, end_time, location, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          title.trim(),
          description || '',
          session_type || 'WORKSHOP',
          startDate.toISOString(),
          endDate.toISOString(),
          location || 'Main Auditorium',
          admin.id
        ]
      );

      const session = result.rows[0];
      return res.status(201).json({
        ...session,
        calculated_status: computeStatus(session)
      });
    } catch (error) {
      console.error('Error creating session:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // PUT /api/sessions?id=X -> Update session or set status to CANCELLED
  if (req.method === 'PUT') {
    const sessionId = id || req.body.id;
    const { title, description, session_type, start_time, end_time, location, status } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    try {
      const result = await pool.query(
        `UPDATE sessions
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             session_type = COALESCE($3, session_type),
             start_time = COALESCE($4, start_time),
             end_time = COALESCE($5, end_time),
             location = COALESCE($6, location),
             status = COALESCE($7, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 RETURNING *`,
        [title, description, session_type, start_time, end_time, location, status, sessionId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Session not found' });
      }

      const session = result.rows[0];
      return res.status(200).json({
        ...session,
        calculated_status: computeStatus(session)
      });
    } catch (error) {
      console.error('Error updating session:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // DELETE /api/sessions?id=X -> Delete session
  if (req.method === 'DELETE') {
    const sessionId = id || req.query.id;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    try {
      await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
      return res.status(200).json({ message: 'Session deleted successfully' });
    } catch (error) {
      console.error('Error deleting session:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
