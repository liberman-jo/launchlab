# LaunchLab

> AI-powered platform that takes you from "I have no idea what business to start" to a fully operational business with a real website, business plan, and marketing content.

---

## What this does

1. **Discovery** — AI analyzes your skills, location, budget, and goals and returns 5 tailored business ideas with scoring
2. **Creation** — AI generates setup tasks specific to your business. Auto tasks produce real outputs: a deployable website, business plan, social calendar, and email templates
3. **Dashboard** — Download your generated content, connect Stripe and Google, manage automation modes

---

## Tech Stack

| Layer      | Technology                         |
|------------|-------------------------------------|
| Frontend   | React + Vite                       |
| Backend    | Node.js + Express                  |
| Database   | SQLite via Prisma ORM              |
| AI         | Anthropic Claude (claude-sonnet-4) |
| Payments   | Stripe Connect                     |
| Auth       | JWT                                |

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- An Anthropic API key (console.anthropic.com)

### Setup

```bash
# 1. Clone or unzip the project
cd launchlab

# 2. Copy environment file and fill in your keys
cp .env.example server/.env
# Edit server/.env and add your ANTHROPIC_API_KEY

# 3. Install all dependencies
npm install

# 4. Set up the database
npm run db:push

# 5. Start both servers
npm run dev
```

The app will be at **http://localhost:5173**
The API runs at **http://localhost:3001**

---

## Environment Variables

Copy `.env.example` to `server/.env` and configure:

### Required
```
ANTHROPIC_API_KEY=sk-ant-...      # Get from console.anthropic.com
JWT_SECRET=<random 64 char hex>   # Run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
DATABASE_URL=file:./dev.db        # SQLite database path
PORT=3001
CLIENT_URL=http://localhost:5173
```

### Optional (enables integrations)
```
STRIPE_SECRET_KEY=sk_test_...     # stripe.com — enables Stripe Connect
GOOGLE_CLIENT_ID=                 # console.cloud.google.com — enables Google OAuth
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/integrations/google/callback
```

---

## What the AI Actually Generates

When you run an auto task, the server calls Claude to generate real content:

| Task type        | What's produced                                                      |
|------------------|----------------------------------------------------------------------|
| Website          | Complete standalone HTML file with CSS, ready to deploy to Netlify  |
| Business plan    | Full HTML document: exec summary, market analysis, 12-month projections |
| Social content   | 30-day Instagram/Facebook calendar with captions and hashtags       |
| Email templates  | 8 professional templates: welcome, booking, reminder, follow-up, etc |
| Other tasks      | Direct links to official setup pages (Stripe, Calendly, Google, etc) |

### Deploying your generated website
1. Go to the Dashboard → Generated Content tab
2. Click "Generate" next to Business Website
3. Click "Download" when it's ready
4. Go to [netlify.com/drop](https://netlify.com/drop) and drag the HTML file into the browser
5. Your site is live instantly with a free URL

---

## Project Structure

```
launchlab/
├── client/                   # React frontend (Vite)
│   └── src/
│       ├── pages/            # Welcome, Discovery, Results, Creation, Hub, Dashboard
│       ├── components/       # Shared UI (TagInput, ScoreBar, WorkflowRail, etc.)
│       └── lib/
│           ├── api.js        # All API calls to the backend
│           └── store.js      # Zustand global state
│
└── server/                   # Node.js + Express backend
    ├── routes/               # auth, business, tasks, generate, integrations
    ├── services/
    │   ├── ai.js             # All Anthropic API calls
    │   └── generators.js     # Task output logic (what each auto task produces)
    └── prisma/
        └── schema.prisma     # Database schema (User, Business, Task, Output, Integration)
```

---

## Deploying to Production

### Option 1: Railway (recommended — one-click)
1. Push to GitHub
2. Go to railway.app and create a new project from your repo
3. Add environment variables in Railway dashboard
4. Railway detects Node.js and deploys automatically

### Option 2: Render
1. Create a Web Service from your GitHub repo
2. Build command: `npm install && npm run db:push`
3. Start command: `node server/index.js`
4. Add environment variables

### Option 3: VPS (DigitalOcean, Linode, etc.)
```bash
# On the server:
git clone your-repo
cd launchlab
npm install
npm run db:push
# Use PM2 to keep server running:
npm install -g pm2
pm2 start server/index.js --name launchlab
# Serve client/dist with Nginx
npm run build   # in client/ directory
```

---

## Adding Integrations (Claude Code Prompts)

The integration framework is ready. Use Claude Code to fill in:

**Add Calendly OAuth:**
> "In server/routes/integrations.js, add Calendly OAuth2 flow using their developer API. The client ID and secret come from CALENDLY_CLIENT_ID and CALENDLY_CLIENT_SECRET environment variables."

**Add domain registration:**
> "In server/services/generators.js, add a function that uses the Namecheap API to check domain availability for a given business name and register it if available. Use NAMECHEAP_API_KEY and NAMECHEAP_USERNAME from env."

**Add email sending:**
> "Add a Resend (resend.com) integration to server/services/ that sends the generated email templates to real customers. Trigger it from the Hub settings tab."

---

## Database

The app uses SQLite by default (no setup required). To switch to PostgreSQL for production:

1. Change `provider = "sqlite"` to `provider = "postgresql"` in `server/prisma/schema.prisma`
2. Update `DATABASE_URL` to your PostgreSQL connection string
3. Run `npm run db:push`

---

## License

MIT
