# CalClone

An advanced scheduling and booking application inspired by Cal.com. This full-stack application allows users to create customizable event types, define complex availability schedules (including multiple time blocks per day and date-specific overrides), and share a public booking link for seamless appointment scheduling.

## 🌟 Features

- **Public Booking Interface**: A slick, embedded multi-step booking panel (Slide-over or Full-page) to minimize friction for guests.
- **Complex Availability Rules**: Instead of simplistic daily hours, define multiple time blocks per day (e.g., "Morning Shift", "Evening Shift").
- **Date Overrides & Blockouts**: Need a vacation or extended hours for a specific day? Use date overrides that take strict priority over your regular weekly schedule.
- **Rescheduling Engine**: Fully auditable rescheduling flows that maintain connections between old and new bookings.
- **Smart Slot Generation**: Automatically generates available appointment slots by merging active availability blocks, removing overlaps, and applying timezone offsets.
- **Responsive Dashboard**: Mobile-optimized layouts, dynamic card views, and instant toggle between dark and light modes.

## 🛠 Tech Stack

**Frontend:**
- [Next.js (App Router)](https://nextjs.org/)
- React / TypeScript
- Tailwind CSS (with custom CSS variables for easy theming)
- TanStack Query (React Query)
- Lucide React (Icons)
- date-fns & date-fns-tz (Date/time manipulation)

**Backend:**
- [Node.js](https://nodejs.org/) with [Express](https://expressjs.com/)
- TypeScript
- `express-validator` (Robust input validation)
- Supabase (used as a managed PostgreSQL database)

## 📂 Project Structure

This is a monorepo setup containing both ends of the application:
```text
/
├── client/       # Next.js frontend application
│   ├── src/app/  # Dashboard, Booking pages, and generic routing
│   ├── src/comp..# Reusable UI components (BookingPanel, Navbar, etc)
│   └── src/lib/  # API wrappers and data fetching logic
│
└── server/       # Express API
    ├── src/routes/       # API endpoints (availability, bookings, events)
    ├── src/middleware/   # Error handling & logging
    └── src/lib/          # Core business logic (Slot Generator)
```

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v18+)
- A [Supabase](https://supabase.com/) project (for the PostgreSQL database)

### 1. Database Setup
Execute the SQL dump found in `supabase/schema.sql` against your Supabase instance to create the required tables (`event_types`, `availability`, `date_overrides`, `bookings`).

### 2. Backend Setup
Navigate into the server directory and install dependencies:
```bash
cd server
npm install
```
Create a `.env` file in the `server` directory:
```env
PORT=4000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
CLIENT_ORIGIN=http://localhost:3000
```
Start the backend development server:
```bash
npm run dev
```

### 3. Frontend Setup
Open a new terminal, navigate into the client directory, and install dependencies:
```bash
cd client
npm install
```
Create a `.env.local` file in the `client` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```
Start the frontend development server:
```bash
npm run dev
```

Navigate to `http://localhost:3000` to interact with the dashboard!

## 🌍 Deployment

### Frontend (Vercel)
1. Import the repository into Vercel.
2. In the project settings, set the **Root Directory** to `client`.
3. Add the `NEXT_PUBLIC_API_URL` environment variable pointing to your deployed backend URL.
4. Deploy.

### Backend (Render / Railway)
1. Create a new Web Service.
2. Set the **Root Directory** to `server`.
3. Use the build command: `npm install && npm run build`
4. Use the start command: `npm start`
5. Map your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables.
6. Set `CLIENT_ORIGIN` to your deployed frontend domain.
7. Deploy.
