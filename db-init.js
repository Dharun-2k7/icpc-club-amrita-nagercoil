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

    // 1. Create club_members table
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

    // 2. Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        club_member_id INTEGER UNIQUE REFERENCES club_members(id) ON DELETE CASCADE,
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

    // 3. Create sessions table
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

    // 4. Create attendance table
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

    // 5. Create announcements table
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

    // 6. Migrate existing data from old `students` table if present
    const tableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'students'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('Migrating existing student records from legacy students table...');
      const existingStudents = await pool.query(`SELECT * FROM students`);
      
      for (const st of existingStudents.rows) {
        // Form email if missing
        const email = st.roll_number ? `${st.roll_number.toLowerCase()}@amrita.edu` : `${st.codeforces_handle}@icpc.club`;
        
        // Insert into club_members
        const cmRes = await pool.query(
          `INSERT INTO club_members (email, student_id, name, department, year, codeforces_handle)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (email) DO UPDATE SET 
             student_id = EXCLUDED.student_id,
             name = EXCLUDED.name,
             codeforces_handle = EXCLUDED.codeforces_handle
           RETURNING id`,
          [email, st.roll_number, st.student_name, st.class_name, st.batch, st.codeforces_handle]
        );

        const cmId = cmRes.rows[0].id;

        // If user had a password, insert into users
        if (st.password_hash) {
          const userRole = (st.role === 'admin' || st.student_name.toLowerCase().includes('sanya')) ? 'ADMIN' : 'MEMBER';
          await pool.query(
            `INSERT INTO users (club_member_id, email, student_id, name, password_hash, role)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (email) DO UPDATE SET 
               password_hash = EXCLUDED.password_hash,
               role = EXCLUDED.role`,
            [cmId, email, st.roll_number, st.student_name, st.password_hash, userRole]
          );
        }
      }
    }

    // 7. Seed Initial Approved Club Members if list is empty
    const countMembers = await pool.query(`SELECT COUNT(*) FROM club_members`);
    if (parseInt(countMembers.rows[0].count, 10) === 0) {
      console.log('Seeding initial approved club members list...');
      const defaultMembers = [
        { name: 'Sanya Singh', email: 'sanyasingh20070406@gmail.com', student_id: 'NC.SC.U4CSE25140', department: 'B.Tech CSE', year: '2026-2030', handle: 'sanya_s04' },
        { name: 'Dharun Kaarthick S', email: 'nc.sc.u4cse24012@amrita.edu', student_id: 'NC.SC.U4CSE24012', department: 'BTech CSE', year: '2024-2028', handle: 'erikasa' },
        { name: 'Aditya Kumar', email: 'aditya.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25001', department: 'B.Tech CSE', year: '2025-2029', handle: 'aditya_icpc' },
        { name: 'Kavya R', email: 'kavya.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25002', department: 'B.Tech CYS', year: '2025-2029', handle: 'kavya_code' },
        { name: 'Rahul M', email: 'rahul.icpc@amrita.edu', student_id: 'NC.SC.U4CSE25003', department: 'B.Tech AIE', year: '2025-2029', handle: 'rahul_algo' }
      ];

      for (const m of defaultMembers) {
        await pool.query(
          `INSERT INTO club_members (email, student_id, name, department, year, codeforces_handle)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
          [m.email, m.student_id, m.name, m.department, m.year, m.handle]
        );
      }
    }

    // 8. Seed Default Admin User if no admin exists
    const countAdmins = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'ADMIN'`);
    if (parseInt(countAdmins.rows[0].count, 10) === 0) {
      console.log('Creating default admin account...');
      const adminEmail = 'sanyasingh20070406@gmail.com';
      const adminMember = await pool.query(`SELECT * FROM club_members WHERE email = $1 OR student_id = 'NC.SC.U4CSE25140'`, [adminEmail]);
      
      let cmId;
      if (adminMember.rows.length === 0) {
        const insCM = await pool.query(
          `INSERT INTO club_members (email, student_id, name, department, year, codeforces_handle)
           VALUES ($1, 'NC.SC.U4CSE25140', 'Sanya', 'B.Tech CSE', '2026-2030', 'sanya_s04')
           RETURNING id`,
          [adminEmail]
        );
        cmId = insCM.rows[0].id;
      } else {
        cmId = adminMember.rows[0].id;
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('admin123', salt);
      
      await pool.query(
        `INSERT INTO users (club_member_id, email, student_id, name, password_hash, role)
         VALUES ($1, $2, 'NC.SC.U4CSE25140', 'Sanya', $3, 'ADMIN')
         ON CONFLICT (email) DO UPDATE SET role = 'ADMIN', password_hash = EXCLUDED.password_hash`,
        [cmId, adminEmail, hash]
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
