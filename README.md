# Jhar Jeevan Blood Bank — Supabase Edition

A complete Blood Bank Management System using:

- HTML/CSS/JavaScript frontend
- Node.js + Express backend
- Supabase PostgreSQL database
- bcrypt password hashing
- JWT-based admin sessions
- Nodemailer email notifications
- AI donor recommendation
- AI blood-demand prediction
- Rule-based blood-bank chatbot

## Database

This project uses **Supabase PostgreSQL only**.

### Fresh database setup

1. Create a new Supabase project.
2. Open Supabase SQL Editor and execute `supabase/schema.sql`.
3. Review the migration files in `supabase/migrations/`.
4. Install or access Supabase CLI and authenticate:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

5. Check the migration history:

   ```powershell
   npx supabase migration list
   ```

6. After verifying that the pending migrations are compatible with the existing schema, apply them:

   ```powershell
   npx supabase db push
   ```

7. Verify the migration history again:

   ```powershell
   npx supabase migration list
   ```

### What the core schema and migrations create

`supabase/schema.sql` creates the core `admins`, `donors`, and `blood_requests` tables and the `blood_group_summary` view. It does not create every table required by the full application.

The additional client-dashboard tables, password-reset storage, request-ownership changes, indexes, and related security settings are defined in `supabase/migrations/`. For a fresh database, execute `supabase/schema.sql` first, then link the Supabase CLI to the project, inspect `npx supabase migration list`, and review and apply the pending migrations with `npx supabase db push`.

The two zero-byte `client_users_auth` migration files are historical migration entries. Do not delete them or add SQL to them. Preserve the existing migration history when setting up or updating a database.
### Existing database

Do not rerun `supabase/schema.sql` or apply migrations without first checking the live schema and migration history.

The migration `20261007145204_client_request_ownership.sql` uses the existing `blood_requests.client_user_id` column. It associates existing blood requests with client accounts when their email addresses match.

Review the ownership backfill before applying it to a database containing real requests.

### Security

Keep the Supabase server-side secret/service-role key in `.env`.

Never expose credentials in frontend JavaScript, HTML, screenshots, or GitHub.

## Local PowerShell setup

Open PowerShell in the project directory:

```powershell
cd "C:\path\to\bloodbank"

Copy-Item .env.example .env

notepad .env
```

Fill in:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SIDE_SECRET_KEY
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=your-admin-password
JWT_SECRET=your-long-random-secret
```

For the server, use the Supabase **secret key** if your project exposes the newer API key system. A legacy `service_role` key also works. Never put this key in HTML, `app.js`, `admin.js`, GitHub, or any browser code.

Install dependencies:

```powershell
npm install
```

Run development mode:

```powershell
npm run dev
```

Or normal mode:

```powershell
npm start
```

Open:

- http://localhost:5000/
- http://localhost:5000/admin-login.html
- http://localhost:5000/api/health

## First admin login

The server automatically creates the admin account from `ADMIN_EMAIL` and `ADMIN_PASSWORD` on first startup if the account does not already exist.

## Main API flow

1. Public user registers as a donor.
2. Donor is stored in Supabase `donors`.
3. Public user submits a blood request.
4. Request is stored in Supabase `blood_requests`.
5. Urgent requests can email matching donors.
6. Admin logs in through the Express API.
7. Admin sees donors and requests from Supabase.
8. Admin approves/completes/rejects requests.
9. Inventory/statistics are calculated from Supabase data.
10. AI donor matching reads the Supabase data.
11. AI demand prediction reads recent request history.
12. Password reset tokens are stored securely as hashes in the Supabase `admins` table.

## Important security rules

- Never commit `.env`.
- Never expose the Supabase server-side secret/service-role key in frontend JavaScript.
- RLS is enabled on the database tables.
- Direct `anon`/`authenticated` table access is revoked because this application uses the Express API as its controlled backend.
- If credentials from an older project were ever exposed publicly, rotate them.
