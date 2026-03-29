import bcrypt from 'bcryptjs';
import pool from './config/db.js';

const createAdminUser = async () => {
  console.log('🔧 Creating admin user...');

  const email = 'admin@naajco.com';
  const password = 'Naajco2024!';

  try {
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('💾 Inserting admin user into database...');
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password = $2 RETURNING *',
      [email, hashedPassword]
    );

    console.log('✅ Admin user created/updated successfully:');
    console.log('📧 Email:', result.rows[0].email);
    console.log('🔑 Password hash stored');

    // Test the login immediately
    console.log('\n🧪 Testing login with new credentials...');
    const isValid = await bcrypt.compare(password, result.rows[0].password);
    console.log('🔍 Password verification:', isValid ? 'SUCCESS' : 'FAILED');

  } catch (err) {
    console.error('❌ Error creating admin user:', err.message);
    console.error('🔍 Full error:', err);
  } finally {
    pool.end();
  }
};

createAdminUser();
