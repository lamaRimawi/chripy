# Chirpy 🐦

Chirpy is a full-featured RESTful API for a social media platform, similar to Twitter. This project was built to demonstrate proficiency in modern back-end development using Node.js, TypeScript, and PostgreSQL.

## 🚀 Features

- **User Authentication**: Secure signup and login using **Argon2** for password hashing and **JWT** (JSON Web Tokens) for session management.
- **Refresh Tokens**: Long-lived refresh tokens stored in the database for extended user sessions.
- **Chirp Management**: Full CRUD operations (Create, Read, Update, Delete) for "Chirps" (posts).
- **Authorization**: Granular permissions ensuring users can only edit or delete their own content.
- **Advanced Filtering**: Support for filtering chirps by author and sorting by date (ASC/DESC) via query parameters.
- **Webhooks**: Integration with third-party payment providers (Polka) via secure, API-key protected webhooks for "Chirpy Red" memberships.
- **Automated Migrations**: Database schema stays in sync automatically using **Drizzle ORM**.

## 🛠️ Tech Stack

- **Runtime**: Node.js (v22+)
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Security**: Argon2, JsonWebToken
- **Testing**: Vitest

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd bootdev-server
2. Install dependencies :
   
   ```
   npm install
   ```
3. Environment Variables :
   Create a .env file in the root directory and add the following:
   
   ```
   DB_URL="postgres://
   username:password@localhost:5432/chirpy"
   PLATFORM="dev"
   JWT_SECRET="your_jwt_secret_key"
   POLKA_KEY="f271c81ff7084ee5b99a5091b42d486e"
   ```
4. Database Setup :
   Generate and run migrations to set up your PostgreSQL schema:
   
   ```
   npx drizzle-kit generate
   ```
## 🏃 Running the Project
- Development Mode (with auto-reload):
  
  ```
  npm run dev
  ```
- Production Build :
  
  ```
  npm run build
  npm run start
  ```
- Run Unit Tests :
  
  ```
  npm run test
  ```
## 📑 API Endpoints
### Authentication
- POST /api/users - Register a new user
- POST /api/login - Login and receive Access/Refresh tokens
- POST /api/refresh - Get a new access token using a refresh token
- POST /api/revoke - Revoke a refresh token (Logout)
### Chirps
- POST /api/chirps - Create a new chirp (Authenticated)
- GET /api/chirps - List all chirps (Supports authorId and sort query params)
- GET /api/chirps/:chirpId - Get a single chirp by ID
- DELETE /api/chirps/:chirpId - Delete a chirp (Owner only)
### Webhooks
- POST /api/polka/webhooks - Secure endpoint for Polka payment notifications
