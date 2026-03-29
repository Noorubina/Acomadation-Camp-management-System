# Acomadation Camp Management System 🏕️


[![Node.js](https://img.shields.io/badge/Node.js-22.12+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)

Full-stack camp management application for employee check-in/out, room occupancy tracking, and reporting.

## ✨ Features
- 👤 Employee check-in/out with CSV bulk import
- 🏠 Real-time room & bed occupancy dashboard
- 📊 Export reports (CSV) by company/building/status
- 🔐 Secure JWT auth, rate limiting, input validation
- 📱 Responsive React frontend (Vite)
- 🗄️ PostgreSQL database

## 🛠️ Tech Stack
- **Backend:** Node.js, Express, PostgreSQL
- **Frontend:** React 19, Vite, React Router
- **Security:** Helmet, bcrypt, JWT, rate-limiter
- **Deployment:** Render (free tier supported)

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js ≥22.12.0
- PostgreSQL + database (`camp_db`)

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/naajvid-camp-manager.git
cd naajvid-camp-manager
npm install
cd frontend && npm install && cd ..
```

### 2. Environment (.env)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/camp_db
JWT_SECRET=your-super-secret-jwt-key-min32chars
PORT=5000
```

### 3. Database Setup
```bash
npm run dev  # Backend first
```
Browser: `POST http://localhost:5000/api/admin/init-database`

**Demo login:** `admin@naajco.com` / `Naajco2024!`

### 4. Run Servers
**Backend:** `npm run dev` → http://localhost:5000  
**Frontend:** `cd frontend && npm run dev` → http://localhost:5173

## ☁️ Deploy to Render (Recommended)

### Backend (Web Service)
```
Build: npm install
Start: node server.js
Env: DATABASE_URL, JWT_SECRET
```

### Frontend (Static Site)
```
Build: npm install && npm run build
Publish: frontend/dist
```

### Database (PostgreSQL)
- Connect via `DATABASE_URL`
- Run schema via Render console or API endpoint

## 🛡️ Security Checklist
✅ Helmet CSP/Headers  
✅ Rate limiting (auth/API)  
✅ bcrypt password hashing  
✅ JWT tokens (15m expiry)  
✅ SQL injection prevention (pg params)  
✅ CORS (prod origins)  
⚠️ Change demo password/JWT_SECRET for production

## 📁 Project Structure
```
.
├── server.js          # Express API
├── config/db.js       # PostgreSQL pool
├── frontend/          # React + Vite
├── render-db-init.sql # DB schema
├── Procfile           # Render deploy
└── README.md
```

## 🔍 API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | - | JWT login |
| GET | `/api/dashboard/stats` | ✅ | Occupancy stats |
| POST | `/api/employees/checkin` | ✅ | Single check-in |
| POST | `/api/employees/bulk-checkin` | ✅ | CSV bulk check-in |
| GET | `/api/employees/export-csv` | ✅ | CSV export |

## 🤝 Contributing
1. Fork & clone
2. `npm install`
3. Create feature branch
4. PR to `main`

## 📄 License
MIT License - see [LICENSE](LICENSE) file.



