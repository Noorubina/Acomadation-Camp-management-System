import express from 'express';
import https from 'https';
import http from 'http';
import dotenv from 'dotenv';
import pool from './config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { body, validationResult } from 'express-validator';

import fs from 'fs';
import getSSLConfig from './ssl-config.js';

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// ===== SECURITY MIDDLEWARE =====

// Trust proxy for accurate IP detection behind load balancers
app.set('trust proxy', 1);

// Force HTTPS in production
if (isProduction) {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// CORS configuration - MUST come before helmet
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = isProduction
      ? (process.env.ALLOWED_ORIGINS?.split(',') || ['https://naajco-camp-frontend.onrender.com'])
      : ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:3000', 'http://localhost:8080'];

    // Allow all localhost origins in development AND for local testing in production
    if (!isProduction || (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log the rejected origin for debugging
    console.log('CORS blocked origin:', origin);
    console.log('Allowed origins:', allowedOrigins);
    console.log('Environment:', isProduction ? 'production' : 'development');

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Enhanced security headers - comes after CORS to avoid interference
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: isProduction
        ? ["'self'", "https://api.example.com"]
        : ["'self'", "http://localhost:5000", "http://localhost:5173", "http://localhost:5175", "http://localhost:3000", "http://localhost:8080"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  hsts: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Body parsing with security limits
app.use(express.json({
  limit: '10mb',
  strict: true,
  verify: (req, res, buf) => {
    // Prevent large payloads that could cause DoS
    if (buf.length > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('Request entity too large');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Enhanced rate limiting
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks and localhost testing
      const isLocalhost = req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';
      return req.path === '/health' || req.path === '/' || (!isProduction && isLocalhost);
    }
  });
};

// General rate limiting
const generalLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  1000, // 1000 requests per window
  'Too many requests from this IP, please try again later.'
);

// Auth rate limiting (stricter)
const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  50, // Increased from 5 to 50 auth attempts per window for testing
  'Too many authentication attempts, please try again later.'
);

// API rate limiting (moderate)
const apiLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  500, // 500 API calls per window
  'API rate limit exceeded, please try again later.'
);

// Apply rate limiters
app.use('/', generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);


// ===== ADD THIS CODE AFTER YOUR MIDDLEWARE =====

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const cookieToken = req.cookies?.token;

    console.log('Auth middleware:', { authHeader, token, cookieToken, cookies: req.cookies });

    const tokenToVerify = token || cookieToken;

    if (!tokenToVerify) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    jwt.verify(tokenToVerify, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
};

// ===== ADD THIS CODE AFTER YOUR EXISTING ROUTES =====

// Protected route example - Dashboard data
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        // You can fetch user-specific data here
        const userData = await pool.query(
            'SELECT id, email FROM users WHERE id = $1', 
            [req.user.id]
        );
        
        res.json({
            success: true,
            message: 'Welcome to your dashboard!',
            user: userData.rows[0],
            dashboardData: {
                totalEmployees: 25,
                availableRooms: 12,
                occupiedBeds: 48,
                pendingCheckouts: 3
            }
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching dashboard data' 
        });
    }
});

// Logout route (optional - for token invalidation if needed)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    // In a real app, you might blacklist the token here
    res.json({ 
        success: true, 
        message: 'Logged out successfully' 
    });
});

// Password change route
app.post('/api/auth/change-password', authLimiter, authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id; // From JWT token

  // Validation
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ 
      success: false, 
      message: 'Current password and new password are required' 
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'New password must be at least 6 characters long' 
    });
  }

  try {
    console.log('Password change attempt for user ID:', userId);
    
    // Get user from database
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User  not found' 
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, userId]);

    console.log('Password updated successfully for user ID:', userId);
    
    res.json({ 
      success: true,
      message: 'Password changed successfully' 
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during password change' 
    });
  }

});

// Seed database endpoint
app.post('/api/movies/seed', async (req, res) => {
  try {
    const sql = fs.readFileSync('populate.sql', 'utf8');
    await pool.query(sql);
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error seeding database' });
  }
});

// Login route - THIS IS WHAT WAS MISSING
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email and password are required' 
    });
  }

  try {
    console.log('Login attempt for email:', email);
    
    // Check if user exists
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Compare password with hashed password in the database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid password' 
      });
    }

    // Generate a token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });

    // Send successful response
    res.json({ 
      success: true,
      message: 'Login successful',
      token,
      user: { 
        id: user.id, 
        email: user.email 
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

// Test database connection route
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.send(`Database time: ${result.rows[0].now}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Database initialization endpoint
app.post('/api/admin/init-database', async (req, res) => {
  try {
    console.log('Starting database initialization...');

    // Read and execute init.sql
    console.log('Creating database schema...');
    const initSQL = fs.readFileSync('init.sql', 'utf8');
    await pool.query(initSQL);
    console.log('✅ Database schema created');

    // Read and execute populate.sql
    console.log('Populating initial data...');
    const populateSQL = fs.readFileSync('populate.sql', 'utf8');
    await pool.query(populateSQL);
    console.log('✅ Initial data populated');

    // Create test user
    console.log('Creating test user...');
    const hashedPassword = await bcrypt.hash('solar$', 10);

    await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
      ['test@example.com', hashedPassword]
    );
    console.log('✅ Test user created');

    res.json({
      success: true,
      message: 'Database initialized successfully',
      testUser: 'test@example.com',
      testPassword: 'solar$'
    });

  } catch (err) {
    console.error('Database initialization error:', err);
    res.status(500).json({
      success: false,
      message: 'Database initialization failed',
      error: err.message
    });
  }
});


// ===== DASHBOARD ROUTES =====

// Get dashboard statistics
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const roomsResult = await pool.query(`
      SELECT COUNT(*) as total_rooms, 
             SUM(total_beds) as total_beds,
             SUM(occupied_beds) as occupied_beds
      FROM rooms
    `);
    
    // Sort buildings by camp and then by building name
    const buildingsResult = await pool.query(`
      SELECT b.name, COUNT(r.id) as rooms, 
             SUM(r.total_beds) as total_beds,
             SUM(r.occupied_beds) as occupied_beds
      FROM buildings b
      LEFT JOIN rooms r ON b.id = r.building_id
      GROUP BY b.id, b.name
      ORDER BY 
        CASE 
          WHEN b.name LIKE 'Camp 1%' THEN 1
          WHEN b.name LIKE 'Camp 2%' THEN 2
          ELSE 3
        END,
        b.name
    `);

    const stats = roomsResult.rows[0];
    const buildings = buildingsResult.rows;

    res.json({
      success: true,
      data: {
        totalRooms: parseInt(stats.total_rooms),
        totalBeds: parseInt(stats.total_beds),
        occupiedBeds: parseInt(stats.occupied_beds),
        vacantBeds: parseInt(stats.total_beds) - parseInt(stats.occupied_beds),
        buildings: buildings.map(b => ({
          name: b.name,
          rooms: parseInt(b.rooms),
          totalBeds: parseInt(b.total_beds),
          occupiedBeds: parseInt(b.occupied_beds),
          vacantBeds: parseInt(b.total_beds) - parseInt(b.occupied_beds)
        }))
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all rooms with details
app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, b.name as building_name 
      FROM rooms r 
      JOIN buildings b ON r.building_id = b.id 
      ORDER BY b.name, r.room_number
    `);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Rooms fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Check in employee
app.post('/api/employees/checkin', authenticateToken, async (req, res) => {
    const { roomId, employeeName, employeeEmail, employeePhone, company_name, id_no } = req.body;

    try {
        // Check if room has available beds
        const roomResult = await pool.query(
            'SELECT total_beds, occupied_beds FROM rooms WHERE id = $1',
            [roomId]
        );
        
        const room = roomResult.rows[0];
        if (room.occupied_beds >= room.total_beds) {
            return res.status(400).json({ 
                success: false, 
                message: 'Room is full' 
            });
        }

        // Create employee
        const employeeResult = await pool.query(
            `INSERT INTO employees (name, phone, check_in_time, room_id, email, company_name, id_no)
             VALUES ($1, $2, NOW(), $3, $4, $5, $6) RETURNING *`,
            [employeeName, employeePhone, roomId, employeeEmail || null, company_name, id_no]
        );

        // Update room occupancy
        await pool.query(
            'UPDATE rooms SET occupied_beds = occupied_beds + 1 WHERE id = $1',
            [roomId]
        );

        res.json({ 
            success: true, 
            message: 'Employee checked in successfully',
            data: employeeResult.rows[0]
        });
    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// Check out employee
app.post('/api/employees/checkout', authenticateToken, async (req, res) => {
    const { employeeId, phone } = req.body;

    try {
        // Get employee and room info - search by id_no instead of id
        const employeeResult = await pool.query(
            'SELECT * FROM employees WHERE id_no = $1 AND check_out_time IS NULL',
            [employeeId]
        );
        
        const employee = employeeResult.rows[0];
        if (!employee) {
            return res.status(404).json({ 
                success: false, 
                message: 'Employee not found or already checked out' 
            });
        }

        // Calculate total days stayed
        const checkInTime = employee.check_in_time;
        const checkOutTime = new Date();
        const totalDaysStayed = Math.ceil((checkOutTime - new Date(checkInTime)) / (1000 * 60 * 60 * 24));

        // Update employee check-out time and phone
        await pool.query(
            'UPDATE employees SET check_out_time = $1, phone = $2 WHERE id_no = $3',
            [checkOutTime, phone, employeeId]
        );

        // Update room occupancy
        await pool.query(
            'UPDATE rooms SET occupied_beds = GREATEST(0, occupied_beds - 1) WHERE id = $1',
            [employee.room_id]
        );

        res.json({ 
            success: true, 
            message: 'Employee checked out successfully',
            totalDaysStayed
        });
    } catch (error) {
        console.error('Check-out error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});



    
    // Get all buildings
app.get('/api/buildings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM buildings ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Buildings fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



    // Get building-specific statistics
// Get building-specific statistics with camp filtering
app.get('/api/dashboard/stats/:buildingType', authenticateToken, async (req, res) => {
    try {
        const { buildingType } = req.params;
        let buildingQuery = '';
        let queryParams = [];
        
        switch(buildingType) {
            case 'u-building':
                buildingQuery = `AND b.id = 4 AND r.room_number LIKE 'U%'`;
                break;
            case 'b-building':
                buildingQuery = `AND b.id = 5 AND r.room_number LIKE 'B%'`;
                break;
            case 'd-building':
                buildingQuery = `AND b.id = 6 AND r.room_number LIKE 'D%'`;
                break;
            case 'c-building':
                buildingQuery = `AND b.id = 7 AND r.room_number LIKE 'C%'`;
                break;
            case 'office-01-82':
                buildingQuery = `AND b.id = 8 AND r.room_number ~ '^[0-9]{1,2}$' AND r.room_number::integer BETWEEN 1 AND 82`;
                break;
            case 'office-a01-a18':
                buildingQuery = `AND b.id = 9 AND r.room_number LIKE 'A%'`;
                break;
            case 'building-1':
                buildingQuery = `AND b.id = 10 AND r.room_number::integer BETWEEN 91 AND 122`;
                break;
            case 'building-2':
                buildingQuery = `AND b.id = 11 AND r.room_number::integer BETWEEN 63 AND 90`;
                break;
            case 'building-3':
                buildingQuery = `AND b.id = 12 AND r.room_number::integer BETWEEN 30 AND 61`;
                break;
            case 'building-4':
                buildingQuery = `AND b.id = 13 AND r.room_number::integer BETWEEN 1 AND 29`;
                break;
            case 'extra-room':
                buildingQuery = `AND b.id = 14 AND r.room_number = '62'`;
                break;
            default:
                buildingQuery = '';
        }
        
        const statsResult = await pool.query(`
            SELECT COUNT(*) as total_rooms, 
                   SUM(r.total_beds) as total_beds,
                   SUM(r.occupied_beds) as occupied_beds
            FROM rooms r
            JOIN buildings b ON r.building_id = b.id
            WHERE 1=1 ${buildingQuery}
        `, queryParams);
        
        const roomsResult = await pool.query(`
            SELECT r.*, b.name as building_name 
            FROM rooms r 
            JOIN buildings b ON r.building_id = b.id 
            WHERE 1=1 ${buildingQuery}
            ORDER BY 
                CASE 
                    WHEN r.room_number ~ '^[0-9]+$' THEN r.room_number::integer
                    ELSE 99999
                END,
                r.room_number
        `, queryParams);

        const stats = statsResult.rows[0];
        
        res.json({
            success: true,
            data: {
                totalRooms: parseInt(stats.total_rooms),
                totalBeds: parseInt(stats.total_beds),
                occupiedBeds: parseInt(stats.occupied_beds),
                vacantBeds: parseInt(stats.total_beds) - parseInt(stats.occupied_beds),
                rooms: roomsResult.rows
            }
        });
    } catch (error) {
        console.error('Building stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ===== EMPLOYEE LIST ENDPOINTS =====

// Get checked-in employees
app.get('/api/employees/checked-in', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT e.*, r.room_number, b.name as building_name 
             FROM employees e 
             LEFT JOIN rooms r ON e.room_id = r.id 
             LEFT JOIN buildings b ON r.building_id = b.id 
             WHERE e.check_in_time IS NOT NULL AND e.check_out_time IS NULL
             ORDER BY e.check_in_time DESC`
        );
        
        // Calculate total days stayed for each employee
        const currentDate = new Date();
        const employeesWithDaysStayed = result.rows.map(employee => {
            const checkInTime = new Date(employee.check_in_time);
            const totalDaysStayed = Math.ceil((currentDate - checkInTime) / (1000 * 60 * 60 * 24));
            return {
                ...employee,
                totalDaysStayed
            };
        });
        
        res.json({ success: true, data: employeesWithDaysStayed });
    } catch (error) {
        console.error('Error fetching checked-in employees:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get checked-out employees
app.get('/api/employees/checked-out', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT e.*, r.room_number, b.name as building_name 
             FROM employees e 
             LEFT JOIN rooms r ON e.room_id = r.id 
             LEFT JOIN buildings b ON r.building_id = b.id 
             WHERE e.check_out_time IS NOT NULL
             ORDER BY e.check_out_time DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching checked-out employees:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get checked-in employees by building
app.get('/api/employees/checked-in/:buildingId', authenticateToken, async (req, res) => {
    try {
        const { buildingId } = req.params;
        const result = await pool.query(
            `SELECT e.*, r.room_number, b.name as building_name 
             FROM employees e 
             LEFT JOIN rooms r ON e.room_id = r.id 
             LEFT JOIN buildings b ON r.building_id = b.id 
             WHERE e.check_in_time IS NOT NULL AND e.check_out_time IS NULL
             AND b.id = $1
             ORDER BY e.check_in_time DESC`,
            [buildingId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching checked-in employees by building:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get checked-out employees by building
app.get('/api/employees/checked-out/:buildingId', authenticateToken, async (req, res) => {
    try {
        const { buildingId } = req.params;
        const result = await pool.query(
            `SELECT e.*, r.room_number, b.name as building_name 
             FROM employees e 
             LEFT JOIN rooms r ON e.room_id = r.id 
             LEFT JOIN buildings b ON r.building_id = b.id 
             WHERE e.check_out_time IS NOT NULL
             AND b.id = $1
             ORDER BY e.check_out_time DESC`,
            [buildingId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching checked-out employees by building:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});



// ===== BED MANAGEMENT ENDPOINTS =====

// Add a bed to a room
app.post('/api/rooms/add-bed', authenticateToken, async (req, res) => {
    const { roomId } = req.body;

    try {
        // Check if room exists
        const roomResult = await pool.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Room not found' });
        }

        await pool.query(
            'UPDATE rooms SET total_beds = total_beds + 1 WHERE id = $1',
            [roomId]
        );
        
        res.json({ success: true, message: 'Bed added successfully' });
    } catch (error) {
        console.error('Error adding bed:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Remove a bed from a room
app.post('/api/rooms/remove-bed', authenticateToken, async (req, res) => {
    const { roomId } = req.body;

    try {
        // Check if room exists and has available beds to remove
        const roomResult = await pool.query(
            'SELECT * FROM rooms WHERE id = $1 AND total_beds > occupied_beds AND total_beds > 0',
            [roomId]
        );
        
        if (roomResult.rows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot remove bed. Either room not found or no available beds to remove.' 
            });
        }

        await pool.query(
            'UPDATE rooms SET total_beds = total_beds - 1 WHERE id = $1',
            [roomId]
        );
        
        res.json({ success: true, message: 'Bed removed successfully' });
    } catch (error) {
        console.error('Error removing bed:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ===== ADDITIONAL SECURITY FEATURES =====

// Input validation middleware
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  // Handle different types of errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      message: 'Database connection failed'
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    message: isProduction ? 'Internal server error' : err.message
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    uptime: process.uptime()
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

// ===== SERVER STARTUP =====

// SSL Configuration
const enableSSL = process.env.ENABLE_SSL === 'true';
const sslPort = process.env.SSL_PORT || 443;
const httpPort = process.env.HTTP_PORT || PORT;

// Create HTTP server
const httpServer = http.createServer(app);

// Create HTTPS server if SSL is enabled
let httpsServer = null;
if (enableSSL) {
  try {
    const sslOptions = getSSLConfig();
    httpsServer = https.createServer(sslOptions, app);
    console.log('🔐 SSL certificates loaded successfully');
  } catch (error) {
    console.error('❌ SSL configuration error:', error.message);
    console.log('⚠️  Starting HTTP server only');
  }
}

// Start HTTP server
httpServer.listen(httpPort, () => {
  console.log(`🚀 HTTP Server running on http://localhost:${httpPort}`);
  console.log(`📧 Login endpoint: http://localhost:${httpPort}/api/auth/login`);
  console.log(`🔒 Security features enabled: CSP, rate limiting, input validation`);
  console.log(`🏥 Health check: http://localhost:${httpPort}/health`);
});

// Start HTTPS server if configured
if (httpsServer) {
  httpsServer.listen(sslPort, () => {
    console.log(`🔒 HTTPS Server running on https://localhost:${sslPort}`);
    console.log(`🔐 SSL/TLS encryption enabled`);
    console.log(`📧 Secure login endpoint: https://localhost:${sslPort}/api/auth/login`);
    console.log(`🏥 Secure health check: https://localhost:${sslPort}/health`);

    // Redirect HTTP to HTTPS in production
    if (isProduction) {
      console.log(`🔄 HTTP traffic will be redirected to HTTPS`);
    }
  });
}

// Graceful shutdown for both servers
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received, shutting down gracefully`);

  const shutdownPromises = [];

  if (httpServer) {
    shutdownPromises.push(new Promise((resolve) => {
      httpServer.close(() => {
        console.log('HTTP server closed');
        resolve();
      });
    }));
  }

  if (httpsServer) {
    shutdownPromises.push(new Promise((resolve) => {
      httpsServer.close(() => {
        console.log('HTTPS server closed');
        resolve();
      });
    }));
  }

  Promise.all(shutdownPromises).then(() => {
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
