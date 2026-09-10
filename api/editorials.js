const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'icpc-club-secret-key';

async function verifyAdminOrCoordinator(req) {
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
    if (['ADMIN', 'COORDINATOR'].includes(role)) {
      return { ...decoded, role, id: userRes.rows[0].id };
    }
    return null;
  } catch (err) {
    return null;
  }
}

export default async function handler(req, res) {
  const { id } = req.query;

  // GET /api/editorials -> Public list of editorials
  if (req.method === 'GET') {
    try {
      const result = await pool.query(`
        SELECT e.id, e.contest_name, e.problem_title, e.problem_url, e.difficulty,
               e.video_url, e.code_solution, e.explanation, e.language, e.created_at,
               u.name as author_name
        FROM editorials e
        LEFT JOIN users u ON e.created_by = u.id
        ORDER BY e.created_at DESC
      `);
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching editorials:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // Admin / Coordinator authentication for modifications
  const adminUser = await verifyAdminOrCoordinator(req);
  if (!adminUser) {
    return res.status(403).json({ message: 'Forbidden: Admins and Coordinators only' });
  }

  // POST /api/editorials -> Create new contest editorial
  if (req.method === 'POST') {
    const { contest_name, problem_title, problem_url, difficulty, video_url, code_solution, explanation, language } = req.body;

    if (!contest_name || !problem_title || !code_solution) {
      return res.status(400).json({ message: 'Contest Name, Problem Title, and Code Solution are required' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO editorials (contest_name, problem_title, problem_url, difficulty, video_url, code_solution, explanation, language, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          contest_name.trim(),
          problem_title.trim(),
          problem_url ? problem_url.trim() : null,
          difficulty ? difficulty.toUpperCase() : 'MEDIUM',
          video_url ? video_url.trim() : null,
          code_solution.trim(),
          explanation ? explanation.trim() : '',
          language ? language.toLowerCase() : 'cpp',
          adminUser.id
        ]
      );

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating editorial:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  // DELETE /api/editorials?id=X -> Delete editorial
  if (req.method === 'DELETE') {
    const edId = id || req.query.id;
    if (!edId) {
      return res.status(400).json({ message: 'Editorial ID required' });
    }

    try {
      await pool.query('DELETE FROM editorials WHERE id = $1', [edId]);
      return res.status(200).json({ message: 'Editorial deleted successfully' });
    } catch (error) {
      console.error('Error deleting editorial:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
