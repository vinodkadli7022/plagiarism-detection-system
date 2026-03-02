# Document Similarity & Plagiarism Detection System

A full-stack project built for resume/interview use, focused on algorithmic plagiarism detection with production-style backend architecture.

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **Authentication:** JWT + bcrypt
- **Upload:** Multer
- **Algorithm:** k-gram fingerprinting + Jaccard similarity

## Features

- User registration/login with secure password hashing
- JWT-protected document APIs
- Upload `.txt` and `.md` documents (2MB max by default)
- Text preprocessing (lowercase, punctuation removal, whitespace normalization)
- k-gram generation and hash fingerprinting
- Similarity detection using Jaccard score
- Duplicate full-document detection via SHA-256 `content_hash`
- Upload history and document detail endpoint
- Optional admin flagged report endpoint
- Centralized error handling with consistent API responses
- PostgreSQL indexing for performance

## Project Structure

```text
palagarism-check/
  backend/
    src/
      controllers/
      services/
      routes/
      middlewares/
      utils/
      models/
      config/
    sql/
      schema.sql
    server.ts
  frontend/
    src/
```

## Backend Setup

1. Open terminal:
   ```powershell
   cd backend
   ```
2. Copy env file:
   ```powershell
   copy .env.example .env
   ```
3. Create PostgreSQL database named `plagiarism_checker` (or update `DATABASE_URL` in `.env`)
4. Run schema SQL:
   ```powershell
   psql "postgresql://postgres:postgres@localhost:5432/plagiarism_checker" -f .\sql\schema.sql
   ```
5. Start backend:
   ```powershell
   npm run dev
   ```

Backend runs on `http://localhost:5000` by default.

## Frontend Setup

1. Open second terminal:
   ```powershell
   cd frontend
   ```
2. Copy env file:
   ```powershell
   copy .env.example .env
   ```
3. Start frontend:
   ```powershell
   npm run dev
   ```

Frontend runs on `http://localhost:5173` by default.

## API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

### Documents (JWT required)

- `POST /api/documents/upload`
- `GET /api/documents/history`
- `GET /api/documents/:id`

### Admin (JWT required)

- `GET /api/admin/flagged`

## Sample Resume Bullet Points

- Implemented plagiarism detection using **k-gram fingerprinting** and **Jaccard similarity**, with optimized hash-based candidate search.
- Built a modular Express backend (controllers/services/models/middlewares) with JWT auth and centralized error handling.
- Designed indexed PostgreSQL schema for users, documents, and fingerprints to improve similarity lookup performance.
- Added upload validation, duplicate detection, and rate limiting for production-style API security.

## Notes

- Current upload parser supports `.txt` and `.md` files for reliability and speed.
- PDF support can be added later via a free parser (`pdf-parse`) as a next enhancement.
