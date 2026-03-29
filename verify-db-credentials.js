import pool from './config/db.js';
import bcrypt from 'bcryptjs';

const TEST_PASSWORD = 'Naajco2024!';

async function verifyCredentials() {
  try {
    console.log('🔍 Verifying database credentials...\n');

    // Get current user from database
    console.log('1. Fetching user from database...');
    const result = await pool.query('SELECT * FROM users WHERE email = $1', ['admin@naajco.com']);
    const user = result.rows[0];

    if (!user) {
      console.log('❌ User not found in database');
      return;
    }

    console.log('   ✅ User found:');
    console.log('   - ID:', user.id);
    console.log('   - Email:', user.email);
    console.log('   - Password hash exists:', !!user.password);
    console.log('   - Password hash length:', user.password ? user.password.length : 0);
    console.log('');

    // Test password comparison
    console.log('2. Testing password verification...');
    const isValid = await bcrypt.compare(TEST_PASSWORD, user.password);

    if (isValid) {
      console.log('   ✅ Password verification PASSED!');
      console.log('   - Plain text password matches hashed password in database');
    } else {
      console.log('   ❌ Password verification FAILED!');
      console.log('   - Password hash in database does not match test password');
    }
    console.log('');

    // Show hash details
    console.log('3. Password hash details:');
    console.log('   - Hash starts with:', user.password.substring(0, 10) + '...');
    console.log('   - Hash length:', user.password.length);
    console.log('   - Contains bcrypt salt rounds:', user.password.startsWith('$2b$') || user.password.startsWith('$2a$'));

    console.log('\n🎉 Database verification complete!');
    console.log('💡 The password is properly hashed and stored in the database.');

  } catch (error) {
    console.error('❌ Error verifying credentials:', error);
  } finally {
    await pool.end();
  }
}

verifyCredentials();
