const fs = require('fs');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    if (line.startsWith('DATABASE_URL=')) {
      dbUrl = line.split('=')[1].trim();
    }
  });
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  try {
    console.log('Connecting to Neon PostgreSQL database...');

    // 1. Create admin_roster table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_roster (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        student_id VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'ADMIN',
        department VARCHAR(255),
        year VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create club_members table (Approved normal members whitelist)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS club_members (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        student_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        department VARCHAR(255),
        year VARCHAR(50),
        codeforces_handle VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        club_member_id INTEGER UNIQUE REFERENCES club_members(id) ON DELETE CASCADE,
        admin_id INTEGER UNIQUE REFERENCES admin_roster(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        student_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'MEMBER',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add admin_id column to users if table already existed without it
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS admin_id INTEGER UNIQUE REFERENCES admin_roster(id) ON DELETE CASCADE;
    `);

    // 4. Create sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        session_type VARCHAR(50) DEFAULT 'WORKSHOP',
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'UPCOMING',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Create attendance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
        club_member_id INTEGER REFERENCES club_members(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'PRESENT',
        marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, club_member_id)
      );
    `);

    // 6. Create announcements table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        announcement_type VARCHAR(50) DEFAULT 'GENERAL',
        session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
        publish_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expiry_date TIMESTAMP,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Seed Official Admin / Coordinator List
    console.log('Seeding official Admin / Coordinator roster...');
    const adminRosterData = [
      { name: 'Thannamal Indu V', title: 'Head Coordinator', role: 'COORDINATOR', email: 'indu.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25008', department: 'B.Tech CSE', year: '2025-2029' },
      { name: 'Supriya Mam', title: 'Faculty Coordinator', role: 'FACULTY', email: 'supriya.icpc@amrita.edu', student_id: 'NC.SC.FAC25009', department: 'Faculty', year: 'Staff' },
      { name: 'Mr Dharun Kaarthick', title: 'ICPC Club Coordinator', role: 'ADMIN', email: 'nc.sc.u4cse24012@nc.students.amrita.edu', student_id: 'NC.SC.U4CSE24012', department: 'BTech CSE', year: '2024-2028' },
      { name: 'Suhashini K', title: 'Vice Lead', role: 'ADMIN', email: 'suhashini.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25010', department: 'B.Tech CSE', year: '2025-2029' },
      { name: 'Babideeran G', title: 'Vice Lead', role: 'ADMIN', email: 'babideeran.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25011', department: 'B.Tech CSE', year: '2025-2029' },
      { name: 'Sanya Singh', title: 'Technical Lead', role: 'ADMIN', email: 'nc.sc.u4cse25140@nc.students.amrita.edu', student_id: 'NC.SC.U4CSE25140', department: 'B.Tech CSE', year: '2026-2030' },
      { name: 'Sumanth Varada', title: 'Technical Lead', role: 'ADMIN', email: 'sumanth.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25012', department: 'B.Tech CSE', year: '2025-2029' },
      { name: 'S Sheik Wasim', title: 'Technical Lead', role: 'ADMIN', email: 'sheik.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25013', department: 'B.Tech CYS', year: '2025-2029' },
      { name: 'Theetchith T', title: 'Problem Setter Lead', role: 'ADMIN', email: 'theetchith.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25014', department: 'B.Tech CSE', year: '2025-2029' },
      { name: 'Sonam Kumari', title: 'Problem Setter Lead', role: 'ADMIN', email: 'sonam.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25015', department: 'B.Tech CSE', year: '2025-2029' },
      { name: 'Dharshana Senthilkumar', title: 'Training & Mentorship Lead', role: 'ADMIN', email: 'dharshana.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25016', department: 'B.Tech AIE', year: '2025-2029' },
      { name: 'Kappala Shashank', title: 'Training & Mentorship Lead', role: 'ADMIN', email: 'shashank.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25017', department: 'B.Tech CSE', year: '2025-2029' },
      { name: 'Deep Shikha', title: 'Training & Mentorship Lead', role: 'ADMIN', email: 'deepshikha.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25018', department: 'B.Tech CSE', year: '2025-2029' },
      { name: 'F Samuel Jabanezer', title: 'Contest Lead', role: 'ADMIN', email: 'samuel.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25019', department: 'B.Tech CSE', year: '2025-2029' },
      { name: 'Chinmayi Krishna Vybhavi Mangipudi', title: 'Contest Lead', role: 'ADMIN', email: 'chinmayi.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25020', department: 'B.Tech CSE', year: '2025-2029' },
      { name: 'Mari Balaji AS', title: 'Events & Operations Lead', role: 'ADMIN', email: 'maribalaji.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25021', department: 'B.Tech CSE', year: '2025-2029' },
      { name: 'Ganeshkumar V', title: 'Research & Resources Lead', role: 'ADMIN', email: 'ganeshkumar.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25022', department: 'B.Tech CSE', year: '2025-2029' }
    ];

    for (const a of adminRosterData) {
      await pool.query(
        `INSERT INTO admin_roster (name, email, student_id, title, role, department, year)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (student_id) DO UPDATE SET 
           email = EXCLUDED.email,
           name = EXCLUDED.name,
           title = EXCLUDED.title,
           role = EXCLUDED.role,
           department = EXCLUDED.department,
           year = EXCLUDED.year`,
        [a.name, a.email, a.student_id, a.title, a.role, a.department, a.year]
      );

      // Clean up: Remove admin/coordinator from club_members so they are separated
      await pool.query(
        `DELETE FROM club_members WHERE LOWER(email) = LOWER($1) OR LOWER(student_id) = LOWER($2)`,
        [a.email, a.student_id]
      );
    }

    // 8. Seed Approved Club Members whitelist (for normal student public registration)
    console.log('Seeding approved club members whitelist...');
    const approvedMembers = [
      { name: 'Aditya Kumar', email: 'aditya.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25001', department: 'B.Tech CSE', year: '2025-2029', handle: 'aditya_icpc' },
      { name: 'Kavya R', email: 'kavya.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25002', department: 'B.Tech CYS', year: '2025-2029', handle: 'kavya_code' },
      { name: 'Rahul M', email: 'rahul.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25003', department: 'B.Tech AIE', year: '2025-2029', handle: 'rahul_algo' },
      { name: 'Priya S', email: 'priya.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25004', department: 'B.Tech CSE', year: '2025-2029', handle: 'priya_p' },
      { name: 'Karthik N', email: 'karthik.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25005', department: 'B.Tech CSE', year: '2025-2029', handle: 'karthik_n' }
    ];

    for (const m of approvedMembers) {
      await pool.query(
        `INSERT INTO club_members (email, student_id, name, department, year, codeforces_handle)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET 
           student_id = EXCLUDED.student_id,
           name = EXCLUDED.name,
           codeforces_handle = EXCLUDED.codeforces_handle`,
        [m.email, m.student_id, m.name, m.department, m.year, m.handle || '']
      );
    }

    // 9. Provision Admin Accounts for Sanya Singh & Dharun Kaarthick
    console.log('Provisioning Admin User Accounts for Sanya Singh & Dharun Kaarthick...');
    const salt = await bcrypt.genSalt(10);
    const defaultHash = await bcrypt.hash('admin123', salt);

    // Sanya Singh Admin Account
    const sanyaAdmin = await pool.query(`SELECT id FROM admin_roster WHERE student_id = 'NC.SC.U4CSE25140' OR LOWER(email) LIKE '%sanya%'`);
    const sanyaArId = sanyaAdmin.rows.length > 0 ? sanyaAdmin.rows[0].id : null;
    const sanyaEmail = 'nc.sc.u4cse25140@nc.students.amrita.edu';

    await pool.query(
      `INSERT INTO users (admin_id, email, student_id, name, password_hash, role)
       VALUES ($1, $2, 'NC.SC.U4CSE25140', 'Sanya Singh', $3, 'ADMIN')
       ON CONFLICT (student_id) DO UPDATE SET 
         role = 'ADMIN', 
         email = EXCLUDED.email, 
         password_hash = EXCLUDED.password_hash, 
         admin_id = EXCLUDED.admin_id`,
      [sanyaArId, sanyaEmail, defaultHash]
    );

    // Dharun Kaarthick Admin Account
    const dharunAdmin = await pool.query(`SELECT id FROM admin_roster WHERE student_id = 'NC.SC.U4CSE24012' OR LOWER(email) LIKE '%dharun%'`);
    const dharunArId = dharunAdmin.rows.length > 0 ? dharunAdmin.rows[0].id : null;
    const dharunEmail = 'nc.sc.u4cse24012@nc.students.amrita.edu';

    await pool.query(
      `INSERT INTO users (admin_id, email, student_id, name, password_hash, role)
       VALUES ($1, $2, 'NC.SC.U4CSE24012', 'Dharun Kaarthick', $3, 'ADMIN')
       ON CONFLICT (student_id) DO UPDATE SET 
         role = 'ADMIN', 
         email = EXCLUDED.email, 
         password_hash = EXCLUDED.password_hash, 
         admin_id = EXCLUDED.admin_id`,
      [dharunArId, dharunEmail, defaultHash]
    );

    // 10. Keep ONLY ONE single Beginner Friendly Online CP Session for today (18:00 - 19:00 of 28/08/26)
    console.log('Ensuring ONLY ONE single Beginner Friendly Online CP Session exists for 28/08/26 18:00 - 19:00...');
    const startTimeISO = '2026-08-28T12:30:00.000Z'; // 18:00 IST
    const endTimeISO = '2026-08-28T13:30:00.000Z';   // 19:00 IST

    const beginnerSessions = await pool.query(`SELECT id FROM sessions WHERE LOWER(title) LIKE '%beginner%' ORDER BY id ASC`);
    
    if (beginnerSessions.rows.length > 0) {
      const keepId = beginnerSessions.rows[0].id;
      // Delete any duplicate sessions
      if (beginnerSessions.rows.length > 1) {
        const deleteIds = beginnerSessions.rows.slice(1).map(r => r.id);
        await pool.query(`DELETE FROM sessions WHERE id = ANY($1::int[])`, [deleteIds]);
      }

      await pool.query(
        `UPDATE sessions 
         SET title = 'Beginner Friendly Online CP Session',
             description = 'An interactive, beginner-friendly online session introducing competitive programming fundamentals, problem-solving techniques, C++/Python setups, and Codeforces practice paths.',
             session_type = 'ONLINE_SESSION',
             start_time = $1,
             end_time = $2,
             location = 'Online (Google Meet)'
         WHERE id = $3`,
        [startTimeISO, endTimeISO, keepId]
      );
    } else {
      await pool.query(
        `INSERT INTO sessions (title, description, session_type, start_time, end_time, location, status)
         VALUES ('Beginner Friendly Online CP Session', 'An interactive, beginner-friendly online session introducing competitive programming fundamentals, problem-solving techniques, C++/Python setups, and Codeforces practice paths.', 'ONLINE_SESSION', $1, $2, 'Online (Google Meet)', 'UPCOMING')`,
        [startTimeISO, endTimeISO]
      );
    }

    // Clean up duplicate announcements as well
    const beginnerAnns = await pool.query(`SELECT id FROM announcements WHERE LOWER(title) LIKE '%beginner%' ORDER BY id ASC`);
    if (beginnerAnns.rows.length > 1) {
      const deleteAnnIds = beginnerAnns.rows.slice(1).map(r => r.id);
      await pool.query(`DELETE FROM announcements WHERE id = ANY($1::int[])`, [deleteAnnIds]);
    }
    if (beginnerAnns.rows.length > 0) {
      await pool.query(
        `UPDATE announcements 
         SET title = 'Beginner Friendly Online CP Session Today (18:00 - 19:00)',
             content = 'Join us today, Friday 28/08/26 from 18:00 to 19:00 IST for an interactive Beginner Friendly Online CP Session.'
         WHERE id = $1`,
        [beginnerAnns.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO announcements (title, content, announcement_type, publish_date)
         VALUES ('Beginner Friendly Online CP Session Today (18:00 - 19:00)', 'Join us today, Friday 28/08/26 from 18:00 to 19:00 IST for an interactive Beginner Friendly Online CP Session.', 'SESSION', CURRENT_TIMESTAMP)`
      );
    }

    console.log('Database initialization & migrations completed successfully!');
  } catch (error) {
    console.error('Database initialization error:', error);
  } finally {
    pool.end();
  }
}

initDB();

