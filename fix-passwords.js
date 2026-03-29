import bcrypt from 'bcryptjs';
import pool from './config/db.js';

const fixPasswords = async () => {
  console.log('🔧 Starting password fix process...');

  try {
    // Get all users
    const users = await pool.query('SELECT id, email, password FROM users');
    console.log(`📊 Found ${users.rows.length} users`);

    for (const user of users.rows) {
      const { id, email, password } = user;

      // Check if password is already hashed (bcrypt hashes start with $2)
      if (password.startsWith('$2')) {
        console.log(`✅ ${email}: Password already hashed`);
        continue;
      }

      // Hash the plain text password
      console.log(`🔒 ${email}: Hashing plain text password`);
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update the user with hashed password
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
      console.log(`✅ ${email}: Password updated successfully`);
    }

    console.log('🎉 Password fix process completed!');

  } catch (err) {
    console.error('❌ Error fixing passwords:', err.message);
  } finally {
    pool.end();
  }
};

fixPasswords();
