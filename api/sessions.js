const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const secret = process.env.JWT_SECRET || 'icpc-club-secret-key';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM sessions ORDER BY date DESC');
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  } 
  
  if (req.method === 'POST') {
    // Verify Admin Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, secret);
      if (decoded.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admins only' });
      }
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Create session
    const { title, description, date, type } = req.body;
    if (!title || !date) {
      return res.status(400).json({ message: 'Title and date are required' });
    }

    try {
      const result = await pool.query(
        'INSERT INTO sessions (title, description, date, type) VALUES ($1, $2, $3, $4) RETURNING *',
        [title, description || '', date, type || 'session']
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating session:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
