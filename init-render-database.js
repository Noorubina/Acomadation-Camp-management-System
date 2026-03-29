import bcrypt from 'bcryptjs';
import pool from './config/db.js';

const initializeDatabase = async () => {
  console.log('🚀 Initializing Render Database...');

  try {
    // Create users table if it doesn't exist
    console.log('📋 Creating users table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table ready');

    // Create admin user
    console.log('👤 Creating admin user...');
    const adminEmail = 'admin@naajco.com';
    const adminPassword = 'Naajco2024!';

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET password = $2
       RETURNING *`,
      [adminEmail, hashedPassword]
    );

    console.log('✅ Admin user created/updated:');
    console.log('   📧 Email:', result.rows[0].email);
    console.log('   🔑 Password hash stored');

    // Verify the password works
    const isValid = await bcrypt.compare(adminPassword, result.rows[0].password);
    console.log('   🔍 Password verification:', isValid ? 'SUCCESS' : 'FAILED');

    // Show all users in database
    console.log('\n📊 Current users in database:');
    const users = await pool.query('SELECT id, email, created_at FROM users');
    users.rows.forEach(user => {
      console.log(`   ${user.id}. ${user.email} (created: ${user.created_at})`);
    });

    console.log('\n🎉 Database initialization complete!');
    console.log('🔐 Login credentials:');
    console.log('   Email: admin@ncamp.com');
    console.log('   Password: password');

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('🔍 Full error:', error);
  } finally {
    pool.end();
  }
};

initializeDatabase();
