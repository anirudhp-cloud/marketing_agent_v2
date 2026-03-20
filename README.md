# Retail Marketing Agent v2

AI-powered marketing campaign generator for retail businesses. A wizard-based SPA that creates Instagram marketing campaigns using AI for copy, image, and video generation.

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- API keys for Azure OpenAI, FLUX, and Sora (configured in `.env`)

---

## How to Run the Application

You need **two separate Command Prompt (cmd) / PowerShell windows** — one for the backend, one for the frontend.

### Step 1: Set Up Environment Variables

Copy the example env file and fill in your API keys:

```cmd
copy .env.example .env
```

Edit `.env` and add your Azure OpenAI, FLUX, and Sora API keys.

### Step 2: Run the Backend

Open a terminal and run:

```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend API will be available at **http://localhost:8000**

### Step 3: Run the Frontend

Open a **second terminal** and run:

```cmd
cd frontend
npm install
npm run dev
```

The frontend will be available at **http://localhost:5173**

---

## Project Structure

```
├── backend/                # FastAPI backend (Python)
│   ├── app/
│   │   ├── api/            # Route handlers
│   │   ├── db/             # Database layer
│   │   ├── generators/     # Platform-specific generators
│   │   ├── models/         # Pydantic models
│   │   ├── parsers/        # Document parsers
│   │   ├── services/       # Business logic
│   │   └── utils/          # Helpers (LLM, image)
│   ├── data/
│   │   └── location_shards/  # Sharded location DB files
│   └── static/             # Generated images & uploads
├── frontend/               # React SPA (TypeScript)
│   ├── src/
│   │   ├── components/     # UI & wizard components
│   │   ├── context/        # React contexts & state
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # API client, schemas, utils
│   │   └── pages/          # Wizard step pages
│   └── public/             # Static assets
└── bussiness_requirements/ # BRD & brand assets
```

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** FastAPI, Python, aiosqlite
- **AI:** Azure OpenAI (GPT-4o), FLUX-1.1-pro (images), Sora (video)
- **Database:** SQLite (sharded for location search)

## Environment Variables

See `.env.example` for all required configuration variables.