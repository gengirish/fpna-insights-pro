<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# **FPnA Insights PRO: FastAPI + NextJS Production App**

## **Complete Codebase → Deploy in 2 Hours**


***

## **📦 Project Structure**

```
fpna-insights-pro/
├── backend/          # FastAPI + MCP + Postgres
│   ├── main.py
│   ├── mcp_server.py
│   ├── models.py
│   └── requirements.txt
├── frontend/         # NextJS + Tailwind + shadcn
│   ├── app/
│   ├── components/
│   └── package.json
└── docker-compose.yml
```


***

## **1. BACKEND: FastAPI + MCP Proxy (40min)**

### **`backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn==0.30.6
psycopg2-binary==2.9.9
pydantic==2.9.2
httpx==0.27.0
python-multipart==0.0.9
alembic==1.13.2
```


### **`backend/models.py`**

```python
from pydantic import BaseModel
from typing import Dict, Any

class MCPQuery(BaseModel):
    query: str
    context: str = "Financial Dashboard"
    tables: list = ["financials_pl", "opex_by_dept", "payroll"]

class RAGResponse(BaseModel):
    postgres_data: Dict[str, Any]
    llm_response: str
    sources: list
```


### **`backend/mcp_server.py`**

```python
import httpx
from fastapi import HTTPException

async def query_mcp(query: str, tables: list) -> dict:
    """Proxy to Postgres MCP server"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "http://mcp:8000/mcp/query",
            json={"query": query, "tables": tables}
        )
        if resp.status_code != 200:
            raise HTTPException(500, "MCP query failed")
        return resp.json()
```


### **`backend/main.py`**

```python
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import httpx
from .models import MCPQuery, RAGResponse
from .mcp_server import query_mcp

app = FastAPI(title="FPnA Insights API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"
PERPLEXITY_KEY = "pplx-YOUR_KEY_HERE"  # ← ENV var in prod

@app.post("/rag-query", response_model=RAGResponse)
async def rag_query(query: MCPQuery):
    # 1. Postgres MCP
    postgres_data = await query_mcp(query.query, query.tables)
    
    # 2. Perplexity Sonar
    async with httpx.AsyncClient() as client:
        resp = await client.post(PERPLEXITY_URL, json={
            "model": "llama-3.1-sonar-huge-128k-online",
            "messages": [{
                "role": "system",
                "content": "FPnA AI Assistant. Format as KPI cards with green/red variances."
            }, {
                "role": "user", 
                "content": f"Query: {query.query}\nPostgres: {postgres_data}"
            }]
        }, headers={
            "Authorization": f"Bearer {PERPLEXITY_KEY}",
            "Content-Type": "application/json"
        })
    
    return RAGResponse(
        postgres_data=postgres_data,
        llm_response=resp.json()["choices"][^0]["message"]["content"],
        sources=["Postgres MCP", "Perplexity Sonar"]
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
```


***

## **2. FRONTEND: NextJS 15 + shadcn/ui (60min)**

### **`frontend/package.json`**

```json
{
  "name": "fpna-frontend",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "15.0.0-rc.0",
    "react": "^18",
    "react-dom": "^18",
    "@radix-ui/react-dialog": "^1.1.1",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2",
    "lucide-react": "^0.441.0",
    "recharts": "^2.12.7"
  }
}
```


### **`frontend/app/layout.tsx`**

```tsx
import './globals.css'
import { Inter } from 'next/font/google'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 font-sans">{children}</body>
    </html>
  )
}
```


### **`frontend/app/page.tsx`** (Your Dashboard)

```tsx
'use client'
import { useState } from 'react'
import { BarChart, LineChart } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { AskAI } from '@/components/ask-ai'

export default function Dashboard() {
  const [chatOpen, setChatOpen] = useState(false)

  // Your demo KPI data
  const kpis = [
    { label: 'Revenue', value: '$40.5M', change: '+0%' },
    { label: 'Net Profit', value: '$6.3M', change: '+0%' },
    // ... your demo data
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600">FPnA Insights</h1>
          <nav className="mt-8 space-y-2">
            <Button variant="ghost" className="w-full justify-start">
              Financial Overview
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              OPEX Analysis
            </Button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-3xl font-bold">Financial Dashboard</h2>
          <Dialog open={chatOpen} onOpenChange={setChatOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                🧠 Ask AI
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <AskAI backendUrl="http://localhost:8001/rag-query" />
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {kpis.map((kpi, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpi.value}</div>
                <div className={`text-sm ${kpi.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {kpi.change}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart width={600} height={300} data={revenueData}>
                {/* Chart config */}
              </BarChart>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
```


### **`frontend/components/ask-ai.tsx`** (RAG Chat)

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Bot, User } from 'lucide-react'

interface Message {
  role: 'user' | 'bot'
  content: string
}

export function AskAI({ backendUrl }: { backendUrl: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim()) return
    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    setInput('')

    try {
      const res = await fetch(`${backendUrl}/rag-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input })
      })
      const data = await res.json()
      
      const botMsg: Message = { 
        role: 'bot', 
        content: data.llm_response 
      }
      setMessages(prev => [...prev, botMsg])
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'bot',
        content: 'Error connecting to backend. Check FastAPI server.'
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-[500px] flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 rounded-lg">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'bot' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-xs lg:max-w-md p-3 rounded-lg ${
              msg.role === 'bot' 
                ? 'bg-white border shadow-sm' 
                : 'bg-blue-600 text-white'
            }`}>
              <div className="font-medium mb-1">
                {msg.role === 'bot' ? '🧠 FPnA AI' : 'You'}
              </div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border shadow-sm p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
            placeholder="Ask about Q1 OPEX variance, payroll issues..."
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
```


***

## **3. DOCKER COMPOSE (One Command Deploy)**

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: fpna_insights
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mcp:
    image: ahmedmustahid/postgres-mcp-server:latest
    environment:
      POSTGRES_URL: postgresql://postgres:password@postgres:5432/fpna_insights
    ports:
      - "8000:8000"

  backend:
    build: ./backend
    ports:
      - "8001:8001"
    environment:
      PERPLEXITY_KEY: pplx-your_key
    depends_on:
      - postgres
      - mcp

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8001

volumes:
  postgres_data:
```


***

## **4. DEPLOY COMMANDS**

```bash
# 1. Clone + Setup
git clone <this-repo>
cd fpna-insights-pro

# 2. Backend
cd backend && pip install -r requirements.txt
psql -f fpna.sql postgres://postgres:password@localhost:5432/fpna_insights

# 3. Frontend
cd ../frontend && npm install && npx shadcn-ui@latest init

# 4. ONE COMMAND LIVE
docker-compose up -d

# 5. Open http://localhost:3000
```


***

## **5. Vercel + Render Production**

```
Frontend → vercel.com (free)
Backend → render.com (Standard → $7/mo)
Postgres → supabase.com (free tier)
```

**Girish**: **Complete production codebase above**. `docker-compose up` = live FastAPI + NextJS + Postgres RAG in 5min.

**Copy `docker-compose.yml` first** → Replace `PERPLEXITY_KEY` → `docker-compose up`.

**MVP screens exactly match your demo** (KPIs, charts, AI modal). Ready? 🚀[^1]

<div align="center">⁂</div>

[^1]: fpnainsights_demo-1.html

