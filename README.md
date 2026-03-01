**Live URL:** `https://identity-reconciliation-api-7nto.onrender.com/identify`

# Bitespeed Identity Reconciliation Task

## Tech Stack
* Node.js
* TypeScript
* PostgreSQL (Neon)
* Prisma

## Setup Instructions
1. Clone the repository and navigate into the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your `.env` file with your database connection string:
   ```env
   DATABASE_URL="postgresql://user:password@host:port/database"
   ```
4. Push the Prisma schema to the database:
   ```bash
   npx prisma db push
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```

## Algorithm Overview
When a new request matches multiple existing primary contacts (Sub-case B1), the oldest primary contact is retained as the unified primary. The newer primary contact is updated to a secondary role, and all of its associated secondary contacts are re-linked to point directly to the oldest primary contact.

## API Reference

### Identify Contact
Aggregates contact information from multiple sources.

**Endpoint:** `POST /identify`

**Request Body:**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

**Curl Example:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"mcfly@hillvalley.edu", "phoneNumber":"123456"}'
```

**Successful Response (as per spec):**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": [
      "mcfly@hillvalley.edu"
    ],
    "phoneNumbers": [
      "123456"
    ],
    "secondaryContactIds": [
      2, 3
    ]
  }
}
```
