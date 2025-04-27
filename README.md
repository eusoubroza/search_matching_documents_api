# README.txt

## Project: tax-rag-kag-api

**Description:**
OpenAI-powered API for intelligent document search, flexible by natural language queries.
It classifies queries, reads documents with GPT-4o, and retrieves best matching documents.

---

## Features:
- Semantic search using OpenAI Embeddings
- Knowledge Extraction from documents
- Flexible queries (income > X, employees > Y, specific company names, etc.)
- Batch Processing with Worker Threads
- API Key Authentication
- Rate Limiting

---

## How to Install:
1. Clone repository:
```bash
git clone https://github.com/your-username/tax-rag-kag-api.git
cd tax-rag-kag-api
```
2. Install dependencies:
```bash
npm install
```
3. Create `.env` file:
```env
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
OPENAI_API_KEY=your-openai-api-key
API_KEY=your-api-key
```
4. Start server:
```bash
npm run start
```

---

## API Endpoints

### POST /batch-search
- Header: `x-api-key: your-api-key`
- Body:
```json
{
  "texts": ["Find reports from 2024", "Companies with income > 1M"]
}
```
- Returns classified queries + best matching documents.

### GET /download/:id
- Header: `x-api-key: your-api-key`
- Download specific document by id.

---

## Deployment on Railway
- Connect GitHub repo to Railway
- Set Environment Variables (SUPABASE, OPENAI, API_KEY)
- Deploy.

---

## License
MIT 2025 — Your Company Name

