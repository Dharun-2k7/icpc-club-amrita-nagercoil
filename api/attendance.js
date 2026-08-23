const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const secret = process.env.JWT_SECRET || 'icpc-club-secret-key';

export default async function handler(req, res) {
  // Middleware to check admin token for POST requests
  let decodedUser = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      decodedUser = jwt.verify(token, secret);
    } catch (err) {
      // invalid token, leave decodedUser as null
    }
  }

  if (req.method === 'GET') {
    const { session_id, student_id } = req.query;
    
    try {
      if (session_id && student_id) {
        // Fetch specific student's attendance for a session
        const result = await pool.query(
          'SELECT status FROM attendance WHERE session_id = $1 AND student_id = $2',
          [session_id, student_id]
        );
        return res.status(200).json(result.rows[0] || { status: 'absent' });
      } else if (session_id) {
        // Fetch all attendance for a session (admin only ideally, but we'll allow it or check role)
        const result = await pool.query(
          `SELECT a.id, a.session_id, a.student_id, a.status, s.student_name, s.roll_number 
           FROM attendance a 
           JOIN students s ON a.student_id = s.id 
           WHERE a.session_id = $1`,
          [session_id]
        );
        return res.status(200).json(result.rows);
      }
      return res.status(400).json({ message: 'Missing session_id' });
    } catch (error) {
      console.error('Error fetching attendance:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  if (req.method === 'POST') {
    if (!decodedUser || decodedUser.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admins only' });
    }

    const { session_id, student_id, status } = req.body;
    if (!session_id || !student_id) {
      return res.status(400).json({ message: 'session_id and student_id are required' });
    }

    try {
      // Upsert attendance
      const result = await pool.query(
        `INSERT INTO attendance (session_id, student_id, status) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (session_id, student_id) 
         DO UPDATE SET status = EXCLUDED.status RETURNING *`,
        [session_id, student_id, status || 'present']
      );
      return res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error updating attendance:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
