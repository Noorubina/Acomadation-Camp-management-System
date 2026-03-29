import bcrypt from 'bcryptjs';
import pool from './config/db.js';

const NEW_EMAIL = 'admin@naajco.com';
const NEW_PASSWORD = 'Naajco2024!';

async function updateRenderDatabase() {
  try {
    console.log('🔄 Updating Render database credentials...\n');

    // Hash the new password
    console.log('1. Hashing new password...');
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
    console.log('   ✅ Password hashed successfully\n');

    // Update the database
    console.log('2. Updating database...');
    const result = await pool.query(
      'UPDATE users SET email = $1, password = $2 WHERE id = 1',
      [NEW_EMAIL, hashedPassword]
    );

    if (result.rowCount > 0) {
      console.log('   ✅ Database updated successfully\n');
    } else {
      console.log('   ⚠️  No user found with ID 1, creating new user...\n');

      // If no user exists, create one
      await pool.query(
        'INSERT INTO users (email, password) VALUES ($1, $2)',
        [NEW_EMAIL, hashedPassword]
      );
      console.log('   ✅ New user created successfully\n');
    }

    console.log('🎉 Render database updated successfully!');
    console.log('📧 New Email:', NEW_EMAIL);
    console.log('🔒 New Password:', NEW_PASSWORD);
    console.log('\n💡 The deployed application should now work with these credentials.');

  } catch (error) {
    console.error('❌ Error updating Render database:', error);
  } finally {
    await pool.end();
  }
}

updateRenderDatabase();
