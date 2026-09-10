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

function computeSessionStatus(start_time, end_time, status) {
  if (!start_time) return null;
  if (status === 'CANCELLED') return 'CANCELLED';
  const now = new Date();
  const start = new Date(start_time);
  const end = new Date(end_time || start.getTime() + 2 * 60 * 60 * 1000);

  if (now < start) return 'UPCOMING';
  if (now >= start && now <= end) return 'ONGOING';
  return 'COMPLETED';
}

export default async function handler(req, res) {
  const { id } = req.query;

  // GET /api/announcements -> Public list of announcements
  if (req.method === 'GET') {
    try {
      const result = await pool.query(`
        SELECT a.id, a.title, a.content, a.announcement_type, a.session_id, a.publish_date, a.expiry_date, a.created_at,
               s.title as session_title, s.start_time as session_start, s.end_time as session_end, s.status as session_manual_status, s.session_type
        FROM announcements a
        LEFT JOIN sessions s ON a.session_id = s.id
        ORDER BY a.publish_date DESC
      `);

      const list = result.rows.map(item => ({
        ...item,
        session_status: item.session_id ? computeSessionStatus(item.session_start, item.session_end, item.session_manual_status) : null
      }));

      return res.status(200).json(list);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // Admin authorization for modification requests
  const admin = await verifyAdmin(req);
  if (!admin) {
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }

  // POST /api/announcements -> Create announcement
  if (req.method === 'POST') {
    const { title, content, announcement_type, session_id, publish_date, expiry_date } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO announcements (title, content, announcement_type, session_id, publish_date, expiry_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          title.trim(),
          content.trim(),
          announcement_type || 'GENERAL',
          session_id || null,
          publish_date ? new Date(publish_date).toISOString() : new Date().toISOString(),
          expiry_date ? new Date(expiry_date).toISOString() : null,
          admin.id
        ]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating announcement:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // PUT /api/announcements?id=X -> Edit announcement
  if (req.method === 'PUT') {
    const announcementId = id || req.body.id;
    const { title, content, announcement_type, session_id, publish_date, expiry_date } = req.body;

    if (!announcementId) {
      return res.status(400).json({ message: 'Announcement ID required' });
    }

    try {
      const result = await pool.query(
        `UPDATE announcements
         SET title = COALESCE($1, title),
             content = COALESCE($2, content),
             announcement_type = COALESCE($3, announcement_type),
             session_id = $4,
             publish_date = COALESCE($5, publish_date),
             expiry_date = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 RETURNING *`,
        [title, content, announcement_type, session_id || null, publish_date, expiry_date || null, announcementId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Announcement not found' });
      }
      return res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error updating announcement:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // DELETE /api/announcements?id=X -> Delete announcement
  if (req.method === 'DELETE') {
    const announcementId = id || req.query.id;
    if (!announcementId) {
      return res.status(400).json({ message: 'Announcement ID required' });
    }

    try {
      await pool.query('DELETE FROM announcements WHERE id = $1', [announcementId]);
      return res.status(200).json({ message: 'Announcement deleted successfully' });
    } catch (error) {
      console.error('Error deleting announcement:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
