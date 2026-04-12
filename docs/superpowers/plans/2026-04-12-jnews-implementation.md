# JNews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personalized AI news digest app with configurable topics, RSS/search sources, alerts, and Claude-powered summarization.

**Architecture:** Next.js 15 monorepo deployed on Vercel. Supabase for Postgres DB + Auth + RLS. API routes handle digest generation (cron + on-demand). Claude API for summarization/classification, Tavily for search, rss-parser for feeds.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Supabase, Anthropic SDK, Tavily, rss-parser

**Spec:** `docs/superpowers/specs/2026-04-12-jnews-design.md`

---

## File Map

```
jay-news/
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # Root layout: fonts, theme, Supabase provider
│   │   ├── page.tsx                        # Feed page (/)
│   │   ├── settings/page.tsx               # Settings page (/settings)
│   │   ├── login/page.tsx                  # Login page (/login)
│   │   └── api/
│   │       ├── digest/
│   │       │   ├── generate/route.ts       # POST: full digest pipeline
│   │       │   └── [id]/route.ts           # GET: single digest with articles
│   │       ├── digests/route.ts            # GET: digest history list
│   │       ├── topics/route.ts             # CRUD topics
│   │       ├── sources/route.ts            # CRUD RSS sources
│   │       ├── alerts/route.ts             # CRUD alerts
│   │       ├── exclusions/route.ts         # CRUD exclusions
│   │       └── auth/callback/route.ts      # Supabase Auth callback
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx                  # Arena-styled button
│   │   │   ├── Card.tsx                    # Arena-styled card
│   │   │   ├── Input.tsx                   # Arena-styled input
│   │   │   ├── Modal.tsx                   # Reusable modal
│   │   │   ├── ChipInput.tsx               # Tag/chip input for exclusions
│   │   │   ├── Badge.tsx                   # Priority/status badges
│   │   │   └── Select.tsx                  # Arena-styled select
│   │   ├── digest/
│   │   │   ├── HighlightCards.tsx           # Top 3 highlight cards
│   │   │   ├── CategorySection.tsx          # Collapsible topic section
│   │   │   ├── ArticleRow.tsx               # Single article row
│   │   │   ├── AlertsSection.tsx            # Alerts results section
│   │   │   ├── DaySummary.tsx               # AI day overview card
│   │   │   └── DigestDateSelector.tsx       # Date picker for history
│   │   └── settings/
│   │       ├── TopicsList.tsx               # Topics CRUD list
│   │       ├── TopicModal.tsx               # Create/edit topic modal
│   │       ├── SourcesList.tsx              # RSS sources CRUD list
│   │       ├── SourceModal.tsx              # Create/edit source modal
│   │       ├── AlertsList.tsx               # Alerts CRUD list
│   │       ├── AlertModal.tsx               # Create/edit alert modal
│   │       └── AdvancedOptions.tsx           # Collapsible advanced settings
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                   # Browser Supabase client
│   │   │   ├── server.ts                   # Server Supabase client
│   │   │   └── middleware.ts               # Auth middleware
│   │   ├── anthropic/
│   │   │   ├── client.ts                   # Anthropic SDK client
│   │   │   └── prompts.ts                  # Prompt templates
│   │   ├── sources/
│   │   │   ├── rss.ts                      # RSS feed fetcher/parser
│   │   │   ├── search.ts                   # Tavily search client
│   │   │   └── validate-url.ts             # SSRF-safe URL validation
│   │   └── digest/
│   │       ├── generator.ts                # Orchestrates full pipeline
│   │       ├── filter.ts                   # Dedup + exclusion filtering
│   │       └── processor.ts                # Claude batch processing
│   ├── types/
│   │   └── index.ts                        # All TypeScript types/interfaces
│   └── styles/
│       └── globals.css                     # Arena design tokens + Tailwind
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql          # All tables, RLS, indexes
├── public/
├── middleware.ts                            # Next.js middleware for auth
├── vercel.json                             # Cron config
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.local
```

---

## Task 1: Project Scaffolding + Design Tokens

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`
- Create: `src/styles/globals.css`
- Create: `src/app/layout.tsx`
- Create: `vercel.json`
- Create: `.env.local`
- Create: `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd C:/Users/Gabriel/Documents/GitHub/jay-news
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. This generates the base structure.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk rss-parser tailwind-merge clsx
```

- [ ] **Step 3: Create `.env.local` with all keys**

```bash
# Create .env.local (do NOT commit this file)
```

Write to `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<from keys.md — supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from keys.md — supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<from keys.md — service key supabase>
ANTHROPIC_API_KEY=<from keys.md — anthropic api key jay social>
TAVILY_API_KEY=<get from tavily.com>
CRON_SECRET=<generate a random secret>
```

- [ ] **Step 4: Ensure `.gitignore` includes `.env.local`**

Verify the generated `.gitignore` contains `.env.local`. If not, add it.

- [ ] **Step 5: Write Arena design tokens in `src/styles/globals.css`**

Replace the generated `globals.css` with:

```css
@import "tailwindcss";

@theme {
  --color-background: #151515;
  --color-card: rgba(28, 29, 30, 0.8);
  --color-card-solid: #1c1d1e;
  --color-primary: #fb830e;
  --color-primary-hover: #fba24b;
  --color-secondary: #08a6ff;
  --color-secondary-hover: #6ac9ff;
  --color-danger: #f54336;
  --color-success: #75f94c;
  --color-gold: #c0b662;
  --color-text: #ffffff;
  --color-text-secondary: #828282;
  --color-text-muted: #4f4f4f;
  --color-border: #333333;
  --color-surface: #1d1d1d;
  --color-surface-light: #282828;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --font-heading: 'Sora', sans-serif;
  --font-body: 'Inter', sans-serif;
}

body {
  background-color: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-body);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}
```

- [ ] **Step 6: Update `src/app/layout.tsx` with Arena fonts**

```tsx
import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JNews - AI News Digest",
  description: "Personalized AI-powered news digest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${inter.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create `vercel.json` with cron config**

```json
{
  "crons": [{
    "path": "/api/digest/generate",
    "schedule": "0 10 * * *"
  }]
}
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts at `http://localhost:3000`, no errors.

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js project with Arena design tokens"
```

---

## Task 2: Supabase Schema + RLS

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Docs:** Spec section 3 (Data Model)

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/001_initial_schema.sql

-- User settings
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_time TIME NOT NULL DEFAULT '07:00',
  language TEXT NOT NULL DEFAULT 'pt-BR',
  summary_style TEXT NOT NULL DEFAULT 'executive',
  max_articles INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Topics
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RSS sources
CREATE TABLE rss_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  query TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exclusions
CREATE TABLE exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Digests
CREATE TABLE digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'
);

-- Articles
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_id UUID NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  summary TEXT NOT NULL,
  relevance_score FLOAT NOT NULL,
  is_highlight BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_articles_digest_id ON articles(digest_id);
CREATE INDEX idx_articles_relevance ON articles(relevance_score DESC);
CREATE INDEX idx_digests_user_date ON digests(user_id, generated_at DESC);
CREATE INDEX idx_topics_user ON topics(user_id);

-- RLS: Enable on all tables
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: user_settings
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies: topics
CREATE POLICY "Users can view own topics" ON topics
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own topics" ON topics
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own topics" ON topics
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own topics" ON topics
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: rss_sources
CREATE POLICY "Users can view own sources" ON rss_sources
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own sources" ON rss_sources
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own sources" ON rss_sources
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own sources" ON rss_sources
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: alerts
CREATE POLICY "Users can view own alerts" ON alerts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own alerts" ON alerts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own alerts" ON alerts
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own alerts" ON alerts
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: exclusions
CREATE POLICY "Users can view own exclusions" ON exclusions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own exclusions" ON exclusions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own exclusions" ON exclusions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own exclusions" ON exclusions
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: digests
CREATE POLICY "Users can view own digests" ON digests
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own digests" ON digests
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own digests" ON digests
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies: articles (access via digest ownership)
CREATE POLICY "Users can view own articles" ON articles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM digests WHERE digests.id = articles.digest_id AND digests.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own articles" ON articles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM digests WHERE digests.id = articles.digest_id AND digests.user_id = auth.uid())
  );

-- Auto-create user_settings on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 2: Apply migration to Supabase**

Run this migration via the Supabase MCP tool `apply_migration` or via the Supabase dashboard SQL editor.

```
mcp__claude_ai_Supabase__apply_migration with the SQL above
```

- [ ] **Step 3: Verify tables exist**

```
mcp__claude_ai_Supabase__list_tables
```

Expected: All 7 tables visible (user_settings, topics, rss_sources, alerts, exclusions, digests, articles).

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema with RLS policies"
```

---

## Task 3: Supabase Client + Auth Middleware

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `middleware.ts` (root)
- Create: `src/app/api/auth/callback/route.ts`

**Docs:** https://supabase.com/docs/guides/auth/server-side/nextjs

- [ ] **Step 1: Create browser client `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client `src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create middleware helper `src/lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/api/auth") &&
    !request.nextUrl.pathname.startsWith("/api/digest/generate")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 4: Create root `middleware.ts`**

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 5: Create auth callback `src/app/api/auth/callback/route.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

- [ ] **Step 6: Verify middleware redirects to login**

```bash
npm run dev
# Open http://localhost:3000 — should redirect to /login
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/ middleware.ts src/app/api/auth/
git commit -m "feat: add Supabase auth client and middleware"
```

---

## Task 4: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write all types**

```typescript
// src/types/index.ts

export interface UserSettings {
  user_id: string;
  digest_time: string;
  language: string;
  summary_style: "executive" | "detailed";
  max_articles: number;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  user_id: string;
  name: string;
  keywords: string[];
  priority: "high" | "medium" | "low";
  is_active: boolean;
  created_at: string;
}

export interface RssSource {
  id: string;
  user_id: string;
  name: string;
  url: string;
  topic_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  title: string;
  query: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface Exclusion {
  id: string;
  user_id: string;
  keyword: string;
  is_active: boolean;
  created_at: string;
}

export interface Digest {
  id: string;
  user_id: string;
  generated_at: string;
  type: "scheduled" | "on_demand";
  status: "processing" | "completed" | "failed";
  summary: string | null;
  metadata: Record<string, unknown>;
}

export interface Article {
  id: string;
  digest_id: string;
  topic_id: string | null;
  alert_id: string | null;
  title: string;
  source_name: string;
  source_url: string;
  summary: string;
  relevance_score: number;
  is_highlight: boolean;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
}

// Used during digest generation before saving
export interface RawArticle {
  title: string;
  url: string;
  content: string;
  source_name: string;
  image_url?: string;
  published_at?: string;
}

// Claude API response for batch processing
export interface ProcessedArticle {
  title: string;
  source_name: string;
  source_url: string;
  summary: string;
  topic_id: string | null;
  alert_id: string | null;
  relevance_score: number;
  is_highlight: boolean;
  image_url: string | null;
  published_at: string | null;
}

// Digest with articles grouped by topic for the feed page
export interface DigestWithArticles extends Digest {
  articles: Article[];
  highlights: Article[];
  by_topic: Record<string, Article[]>;
  alert_articles: Article[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript types for all entities"
```

---

## Task 5: UI Base Components

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/Select.tsx`
- Create: `src/components/ui/ChipInput.tsx`

- [ ] **Step 1: Create `Button.tsx`**

```tsx
import { twMerge } from "tailwind-merge";
import clsx from "clsx";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={twMerge(
        clsx(
          "inline-flex items-center justify-center font-semibold rounded-md transition-all duration-300",
          {
            "bg-primary text-white hover:bg-primary-hover": variant === "primary",
            "bg-secondary text-white hover:bg-secondary-hover": variant === "secondary",
            "border border-border text-text hover:bg-surface-light": variant === "outline",
            "text-text-secondary hover:text-text hover:bg-surface-light": variant === "ghost",
            "px-3 py-1.5 text-sm": size === "sm",
            "px-5 py-3 text-base": size === "md",
            "px-6 py-4 text-lg": size === "lg",
            "opacity-50 cursor-not-allowed": disabled || loading,
          }
        ),
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Create `Card.tsx`**

```tsx
import { twMerge } from "tailwind-merge";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={twMerge(
        "bg-card rounded-md border border-border/20 p-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create `Input.tsx`**

```tsx
import { twMerge } from "tailwind-merge";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm text-text-secondary font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={twMerge(
            "bg-surface border border-border rounded-md px-4 py-3 text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors",
            error && "border-danger",
            className
          )}
          {...props}
        />
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
```

- [ ] **Step 4: Create `Modal.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { Card } from "./Card";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <Card className="w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Create `Badge.tsx`**

```tsx
import { twMerge } from "tailwind-merge";
import clsx from "clsx";

interface BadgeProps {
  variant?: "high" | "medium" | "low" | "default";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={twMerge(
        clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", {
          "bg-primary/20 text-primary": variant === "high",
          "bg-secondary/20 text-secondary": variant === "medium",
          "bg-border/30 text-text-secondary": variant === "low",
          "bg-surface-light text-text-secondary": variant === "default",
        }),
        className
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 6: Create `Select.tsx`**

```tsx
import { twMerge } from "tailwind-merge";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm text-text-secondary font-medium">
          {label}
        </label>
      )}
      <select
        className={twMerge(
          "bg-surface border border-border rounded-md px-4 py-3 text-text focus:outline-none focus:border-primary transition-colors appearance-none",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 7: Create `ChipInput.tsx`**

```tsx
"use client";

import { useState, type KeyboardEvent } from "react";
import { twMerge } from "tailwind-merge";

interface ChipInputProps {
  label?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function ChipInput({
  label,
  values,
  onChange,
  placeholder = "Digite e pressione Enter",
  className,
}: ChipInputProps) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!values.includes(input.trim())) {
        onChange([...values, input.trim()]);
      }
      setInput("");
    }
    if (e.key === "Backspace" && !input && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  const removeChip = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className={twMerge("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-sm text-text-secondary font-medium">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-2 bg-surface border border-border rounded-md px-3 py-2 focus-within:border-primary transition-colors">
        {values.map((val, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-surface-light text-text-secondary text-sm px-2 py-1 rounded"
          >
            {val}
            <button
              type="button"
              onClick={() => removeChip(i)}
              className="text-text-muted hover:text-danger transition-colors"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-text placeholder:text-text-muted outline-none py-1"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add Arena-styled UI base components"
```

---

## Task 6: Login Page

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Create login page**

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (isSignUp) {
      setError("Verifique seu email para confirmar o cadastro.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center mb-6">JNews</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
          {error && (
            <p className="text-sm text-danger text-center">{error}</p>
          )}
          <Button type="submit" loading={loading} className="w-full mt-2">
            {isSignUp ? "Criar conta" : "Entrar"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
          }}
          className="w-full text-center text-sm text-text-secondary hover:text-primary mt-4 transition-colors"
        >
          {isSignUp ? "Ja tem conta? Entrar" : "Criar conta"}
        </button>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Test login page in browser**

```bash
npm run dev
# Open http://localhost:3000/login
```

Expected: Dark-themed login form centered on page. "JNews" heading. Email/password fields. "Entrar" button in orange.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/
git commit -m "feat: add login page with Supabase auth"
```

---

## Task 7: CRUD API Routes (Topics, Sources, Alerts, Exclusions)

**Files:**
- Create: `src/app/api/topics/route.ts`
- Create: `src/app/api/sources/route.ts`
- Create: `src/app/api/alerts/route.ts`
- Create: `src/app/api/exclusions/route.ts`
- Create: `src/lib/sources/validate-url.ts`

- [ ] **Step 1: Create URL validator `src/lib/sources/validate-url.ts`**

```typescript
export function isValidRssUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (!["http:", "https:"].includes(url.protocol)) return false;

    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") return false;

    // Reject private IP ranges
    const parts = hostname.split(".");
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const first = parseInt(parts[0]);
      const second = parseInt(parts[1]);
      if (first === 10) return false;
      if (first === 172 && second >= 16 && second <= 31) return false;
      if (first === 192 && second === 168) return false;
      if (first === 127) return false;
      if (first === 0) return false;
    }

    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Create `src/app/api/topics/route.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("topics")
    .insert({ user_id: user.id, name: body.name, keywords: body.keywords, priority: body.priority || "medium" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("topics")
    .update({ name: body.name, keywords: body.keywords, priority: body.priority })
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("topics")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create `src/app/api/sources/route.ts`**

Same pattern as topics, but with RSS URL validation on POST:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isValidRssUrl } from "@/lib/sources/validate-url";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("rss_sources")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!isValidRssUrl(body.url)) {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("rss_sources")
    .insert({ user_id: user.id, name: body.name, url: body.url, topic_id: body.topic_id || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (body.url && !isValidRssUrl(body.url)) {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("rss_sources")
    .update({ name: body.name, url: body.url, topic_id: body.topic_id || null })
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("rss_sources")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Create `src/app/api/alerts/route.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("alerts")
    .insert({ user_id: user.id, title: body.title, query: body.query, expires_at: body.expires_at || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("alerts")
    .update({ title: body.title, query: body.query, expires_at: body.expires_at })
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("alerts")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Create `src/app/api/exclusions/route.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("exclusions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("exclusions")
    .insert({ user_id: user.id, keyword: body.keyword })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("exclusions")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Verify build passes**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/ src/lib/sources/validate-url.ts
git commit -m "feat: add CRUD API routes for topics, sources, alerts, exclusions"
```

---

## Task 8: Digest API Routes (List + Get)

**Files:**
- Create: `src/app/api/digests/route.ts`
- Create: `src/app/api/digest/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/digests/route.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10");
  const offset = parseInt(searchParams.get("offset") || "0");

  const { data, error } = await supabase
    .from("digests")
    .select("id, generated_at, type, status, summary")
    .order("generated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Create `src/app/api/digest/[id]/route.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { DigestWithArticles, Article } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: digest, error: digestError } = await supabase
    .from("digests")
    .select("*")
    .eq("id", id)
    .single();

  if (digestError || !digest) {
    return NextResponse.json({ error: "Digest not found" }, { status: 404 });
  }

  const { data: articles, error: articlesError } = await supabase
    .from("articles")
    .select("*")
    .eq("digest_id", id)
    .order("relevance_score", { ascending: false });

  if (articlesError) {
    return NextResponse.json({ error: articlesError.message }, { status: 500 });
  }

  const highlights = (articles || []).filter((a: Article) => a.is_highlight);
  const byTopic: Record<string, Article[]> = {};
  const alertArticles: Article[] = [];

  for (const article of articles || []) {
    if (article.alert_id) {
      alertArticles.push(article);
    }
    const key = article.topic_id || "uncategorized";
    if (!byTopic[key]) byTopic[key] = [];
    byTopic[key].push(article);
  }

  const result: DigestWithArticles = {
    ...digest,
    articles: articles || [],
    highlights,
    by_topic: byTopic,
    alert_articles: alertArticles,
  };

  return NextResponse.json(result);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/digests/ src/app/api/digest/
git commit -m "feat: add digest list and detail API routes"
```

---

## Task 9: News Source Fetchers (RSS + Tavily)

**Files:**
- Create: `src/lib/sources/rss.ts`
- Create: `src/lib/sources/search.ts`

- [ ] **Step 1: Create RSS fetcher `src/lib/sources/rss.ts`**

```typescript
import Parser from "rss-parser";
import type { RawArticle } from "@/types";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "JNews/1.0",
  },
});

export async function fetchRssFeed(
  url: string,
  sourceName: string
): Promise<RawArticle[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items || []).slice(0, 20).map((item) => ({
      title: item.title || "Sem título",
      url: item.link || url,
      content: item.contentSnippet || item.content || "",
      source_name: sourceName,
      image_url: item.enclosure?.url || undefined,
      published_at: item.isoDate || undefined,
    }));
  } catch (error) {
    console.error(`RSS fetch failed for ${sourceName} (${url}):`, error);
    return [];
  }
}

export async function fetchAllRssFeeds(
  sources: { url: string; name: string }[]
): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    sources.map((s) => fetchRssFeed(s.url, s.name))
  );

  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
```

- [ ] **Step 2: Create Tavily search client `src/lib/sources/search.ts`**

```typescript
import type { RawArticle } from "@/types";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
}

interface TavilyResponse {
  results: TavilyResult[];
}

export async function searchTavily(
  query: string,
  maxResults: number = 5
): Promise<RawArticle[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.error("TAVILY_API_KEY not set");
    return [];
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: "basic",
        include_answer: false,
      }),
    });

    if (!response.ok) {
      console.error(`Tavily search failed: ${response.status}`);
      return [];
    }

    const data: TavilyResponse = await response.json();
    return data.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      source_name: new URL(r.url).hostname.replace("www.", ""),
      published_at: r.published_date || undefined,
    }));
  } catch (error) {
    console.error("Tavily search error:", error);
    return [];
  }
}

export async function searchAllTopics(
  queries: { query: string; maxResults?: number }[]
): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    queries.map((q) => searchTavily(q.query, q.maxResults || 5))
  );

  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/sources/
git commit -m "feat: add RSS and Tavily news source fetchers"
```

---

## Task 10: Claude AI Processing (Prompts + Processor)

**Files:**
- Create: `src/lib/anthropic/client.ts`
- Create: `src/lib/anthropic/prompts.ts`
- Create: `src/lib/digest/filter.ts`
- Create: `src/lib/digest/processor.ts`

- [ ] **Step 1: Create Anthropic client `src/lib/anthropic/client.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return client;
}
```

- [ ] **Step 2: Create prompts `src/lib/anthropic/prompts.ts`**

```typescript
import type { RawArticle, Topic } from "@/types";

export function buildBatchPrompt(
  articles: RawArticle[],
  topics: Topic[],
  language: string,
  style: string
): string {
  const topicList = topics
    .map((t) => `- "${t.name}" (id: ${t.id}, priority: ${t.priority}, keywords: ${t.keywords.join(", ")})`)
    .join("\n");

  const articleList = articles
    .map(
      (a, i) =>
        `[${i}] Title: ${a.title}\nSource: ${a.source_name}\nURL: ${a.url}\nContent: ${a.content.slice(0, 500)}`
    )
    .join("\n\n");

  const styleInstruction =
    style === "executive"
      ? "Write concise 2-3 sentence summaries focused on key facts and implications."
      : "Write detailed 4-5 sentence summaries covering context, details, and analysis.";

  return `You are a news analyst. Process these articles and return a JSON array.

Language: ${language}
Style: ${styleInstruction}

Available topics:
${topicList}

Articles to process:
${articleList}

For each article, return a JSON object with:
- "index": the article index number [N]
- "summary": summary in ${language}
- "topic_id": the best matching topic ID from the list above, or null if none match
- "relevance_score": float 0.0-1.0 based on how relevant and important this article is. Consider topic priority (high priority topics get a boost).

Return ONLY a valid JSON array, no markdown, no explanation.`;
}

export function buildDaySummaryPrompt(
  summaries: string[],
  language: string
): string {
  return `You are a news editor. Based on these article summaries from today, write a 2-3 sentence overview of the day's most important news themes. Write in ${language}. Be concise and insightful.

Today's articles:
${summaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Return ONLY the summary text, no quotes, no labels.`;
}
```

- [ ] **Step 3: Create filter `src/lib/digest/filter.ts`**

```typescript
import type { RawArticle, Exclusion } from "@/types";

export function filterArticles(
  articles: RawArticle[],
  exclusions: Exclusion[]
): RawArticle[] {
  const excludeKeywords = exclusions
    .filter((e) => e.is_active)
    .map((e) => e.keyword.toLowerCase());

  // Filter out excluded
  let filtered = articles.filter((article) => {
    const text = `${article.title} ${article.content}`.toLowerCase();
    return !excludeKeywords.some((kw) => text.includes(kw));
  });

  // Deduplicate by URL
  const seenUrls = new Set<string>();
  filtered = filtered.filter((a) => {
    const normalized = a.url.toLowerCase().replace(/\/+$/, "");
    if (seenUrls.has(normalized)) return false;
    seenUrls.add(normalized);
    return true;
  });

  // Deduplicate by similar titles (simple approach: exact lowercase match)
  const seenTitles = new Set<string>();
  filtered = filtered.filter((a) => {
    const normalized = a.title.toLowerCase().trim();
    if (seenTitles.has(normalized)) return false;
    seenTitles.add(normalized);
    return true;
  });

  return filtered;
}
```

- [ ] **Step 4: Create processor `src/lib/digest/processor.ts`**

```typescript
import { getAnthropicClient } from "@/lib/anthropic/client";
import { buildBatchPrompt, buildDaySummaryPrompt } from "@/lib/anthropic/prompts";
import type { RawArticle, Topic, ProcessedArticle } from "@/types";

const BATCH_SIZE = 10;

interface BatchResult {
  index: number;
  summary: string;
  topic_id: string | null;
  relevance_score: number;
}

async function processBatch(
  articles: RawArticle[],
  topics: Topic[],
  language: string,
  style: string
): Promise<BatchResult[]> {
  const client = getAnthropicClient();
  const prompt = buildBatchPrompt(articles, topics, language, style);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    return JSON.parse(text);
  } catch {
    console.error("Failed to parse Claude response:", text.slice(0, 200));
    return [];
  }
}

export async function processArticles(
  rawArticles: RawArticle[],
  topics: Topic[],
  language: string,
  style: string
): Promise<ProcessedArticle[]> {
  const processed: ProcessedArticle[] = [];

  // Process in batches
  for (let i = 0; i < rawArticles.length; i += BATCH_SIZE) {
    const batch = rawArticles.slice(i, i + BATCH_SIZE);

    let results: BatchResult[];
    try {
      results = await processBatch(batch, topics, language, style);
    } catch (error) {
      // Retry once
      console.error("Batch failed, retrying:", error);
      try {
        results = await processBatch(batch, topics, language, style);
      } catch {
        console.error("Batch retry failed, skipping batch");
        continue;
      }
    }

    for (const result of results) {
      const raw = batch[result.index];
      if (!raw) continue;

      processed.push({
        title: raw.title,
        source_name: raw.source_name,
        source_url: raw.url,
        summary: result.summary,
        topic_id: result.topic_id,
        alert_id: null,
        relevance_score: result.relevance_score,
        is_highlight: false,
        image_url: raw.image_url || null,
        published_at: raw.published_at || null,
      });
    }
  }

  // Mark top 3 as highlights
  processed.sort((a, b) => b.relevance_score - a.relevance_score);
  for (let i = 0; i < Math.min(3, processed.length); i++) {
    processed[i].is_highlight = true;
  }

  return processed;
}

export async function generateDaySummary(
  summaries: string[],
  language: string
): Promise<string> {
  const client = getAnthropicClient();
  const prompt = buildDaySummaryPrompt(summaries, language);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/anthropic/ src/lib/digest/
git commit -m "feat: add Claude AI processing pipeline with batch prompts"
```

---

## Task 11: Digest Generator (Orchestrator) + Generate API Route

**Files:**
- Create: `src/lib/digest/generator.ts`
- Create: `src/app/api/digest/generate/route.ts`

- [ ] **Step 1: Create generator `src/lib/digest/generator.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";
import { fetchAllRssFeeds } from "@/lib/sources/rss";
import { searchAllTopics } from "@/lib/sources/search";
import { filterArticles } from "@/lib/digest/filter";
import { processArticles, generateDaySummary } from "@/lib/digest/processor";
import type { Topic, RssSource, Alert, Exclusion, UserSettings } from "@/types";

// Use service role client for server-side operations
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function generateDigest(
  userId: string,
  type: "scheduled" | "on_demand"
): Promise<string> {
  const supabase = getServiceClient();

  // 1. Load user config
  const [settingsRes, topicsRes, sourcesRes, alertsRes, exclusionsRes] =
    await Promise.all([
      supabase.from("user_settings").select("*").eq("user_id", userId).single(),
      supabase.from("topics").select("*").eq("user_id", userId).eq("is_active", true),
      supabase.from("rss_sources").select("*").eq("user_id", userId).eq("is_active", true),
      supabase.from("alerts").select("*").eq("user_id", userId).eq("is_active", true),
      supabase.from("exclusions").select("*").eq("user_id", userId).eq("is_active", true),
    ]);

  const settings: UserSettings = settingsRes.data || {
    user_id: userId,
    digest_time: "07:00",
    language: "pt-BR",
    summary_style: "executive",
    max_articles: 20,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const topics: Topic[] = topicsRes.data || [];
  const sources: RssSource[] = sourcesRes.data || [];
  const alerts: Alert[] = alertsRes.data || [];
  const exclusions: Exclusion[] = exclusionsRes.data || [];

  // Create digest record
  const { data: digest, error: digestError } = await supabase
    .from("digests")
    .insert({ user_id: userId, type, status: "processing" })
    .select()
    .single();

  if (digestError || !digest) {
    throw new Error(`Failed to create digest: ${digestError?.message}`);
  }

  try {
    // 2. Fetch articles in parallel
    const rssFeeds = sources.map((s) => ({ url: s.url, name: s.name }));

    const searchQueries = [
      ...topics.map((t) => ({
        query: t.keywords.join(" OR "),
        maxResults: t.priority === "high" ? 8 : t.priority === "medium" ? 5 : 3,
      })),
      ...alerts
        .filter((a) => !a.expires_at || new Date(a.expires_at) > new Date())
        .map((a) => ({ query: a.query, maxResults: 5 })),
    ];

    const [rssArticles, searchArticles] = await Promise.all([
      fetchAllRssFeeds(rssFeeds),
      searchAllTopics(searchQueries),
    ]);

    const allRaw = [...rssArticles, ...searchArticles];

    // 3. Filter
    const filtered = filterArticles(allRaw, exclusions).slice(
      0,
      settings.max_articles
    );

    if (filtered.length === 0) {
      await supabase
        .from("digests")
        .update({ status: "completed", summary: "Nenhuma notícia encontrada para hoje." })
        .eq("id", digest.id);
      return digest.id;
    }

    // 4. Process with Claude
    const processed = await processArticles(
      filtered,
      topics,
      settings.language,
      settings.summary_style
    );

    // 5. Save articles
    const articleRows = processed.map((a) => ({
      digest_id: digest.id,
      topic_id: a.topic_id,
      alert_id: a.alert_id,
      title: a.title,
      source_name: a.source_name,
      source_url: a.source_url,
      summary: a.summary,
      relevance_score: a.relevance_score,
      is_highlight: a.is_highlight,
      image_url: a.image_url,
      published_at: a.published_at,
    }));

    await supabase.from("articles").insert(articleRows);

    // Generate day summary
    const daySummary = await generateDaySummary(
      processed.map((a) => a.summary),
      settings.language
    );

    await supabase
      .from("digests")
      .update({
        status: "completed",
        summary: daySummary,
        metadata: {
          total_articles: processed.length,
          sources_count: new Set(processed.map((a) => a.source_name)).size,
          topics_count: new Set(processed.filter((a) => a.topic_id).map((a) => a.topic_id)).size,
        },
      })
      .eq("id", digest.id);

    return digest.id;
  } catch (error) {
    await supabase
      .from("digests")
      .update({ status: "failed", metadata: { error: String(error) } })
      .eq("id", digest.id);
    throw error;
  }
}
```

- [ ] **Step 2: Create generate route `src/app/api/digest/generate/route.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { generateDigest } from "@/lib/digest/generator";
import { NextResponse } from "next/server";

export const maxDuration = 60; // Vercel Pro timeout

export async function POST(request: Request) {
  // Check if cron request
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    // Cron: generate for first user (v1 single-user)
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: users } = await supabase
      .from("user_settings")
      .select("user_id")
      .limit(1);

    if (!users || users.length === 0) {
      return NextResponse.json({ error: "No users found" }, { status: 404 });
    }

    const digestId = await generateDigest(users[0].user_id, "scheduled");
    return NextResponse.json({ digestId, status: "processing" });
  }

  // On-demand: use authenticated user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const digestId = await generateDigest(user.id, "on_demand");
    return NextResponse.json({ digestId, status: "processing" });
  } catch (error) {
    return NextResponse.json(
      { error: `Generation failed: ${error}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/digest/generator.ts src/app/api/digest/generate/
git commit -m "feat: add digest generation pipeline with cron and on-demand support"
```

---

## Task 12: Settings Page (Frontend)

**Files:**
- Create: `src/app/settings/page.tsx`
- Create: `src/components/settings/TopicsList.tsx`
- Create: `src/components/settings/TopicModal.tsx`
- Create: `src/components/settings/SourcesList.tsx`
- Create: `src/components/settings/SourceModal.tsx`
- Create: `src/components/settings/AlertsList.tsx`
- Create: `src/components/settings/AlertModal.tsx`
- Create: `src/components/settings/AdvancedOptions.tsx`

- [ ] **Step 1: Create `TopicModal.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ChipInput } from "@/components/ui/ChipInput";
import { Button } from "@/components/ui/Button";
import type { Topic } from "@/types";

interface TopicModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; keywords: string[]; priority: string }) => void;
  topic?: Topic | null;
  loading?: boolean;
}

export function TopicModal({ open, onClose, onSave, topic, loading }: TopicModalProps) {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [priority, setPriority] = useState("medium");

  useEffect(() => {
    if (topic) {
      setName(topic.name);
      setKeywords(topic.keywords);
      setPriority(topic.priority);
    } else {
      setName("");
      setKeywords([]);
      setPriority("medium");
    }
  }, [topic, open]);

  return (
    <Modal open={open} onClose={onClose} title={topic ? "Editar Tema" : "Novo Tema"}>
      <div className="flex flex-col gap-4">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Inteligência Artificial" />
        <ChipInput label="Keywords" values={keywords} onChange={setKeywords} placeholder="Digite e pressione Enter" />
        <Select
          label="Prioridade"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          options={[
            { value: "high", label: "Alta" },
            { value: "medium", label: "Média" },
            { value: "low", label: "Baixa" },
          ]}
        />
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button
            onClick={() => onSave({ name, keywords, priority })}
            loading={loading}
            disabled={!name || keywords.length === 0}
            className="flex-1"
          >
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Create `TopicsList.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TopicModal } from "./TopicModal";
import type { Topic } from "@/types";

interface TopicsListProps {
  topics: Topic[];
  onRefresh: () => void;
}

export function TopicsList({ topics, onRefresh }: TopicsListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave(data: { name: string; keywords: string[]; priority: string }) {
    setLoading(true);
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...data, id: editing.id } : data;

    await fetch("/api/topics", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    setModalOpen(false);
    setEditing(null);
    onRefresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/topics?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Temas</h2>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>+ Novo</Button>
      </div>
      <Card className="divide-y divide-border/20">
        {topics.length === 0 && <p className="text-text-secondary text-sm py-3">Nenhum tema configurado.</p>}
        {topics.map((t) => (
          <div key={t.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.name}</span>
                <Badge variant={t.priority as "high" | "medium" | "low"}>
                  {t.priority === "high" ? "Alta" : t.priority === "medium" ? "Média" : "Baixa"}
                </Badge>
              </div>
              <p className="text-sm text-text-secondary mt-0.5">{t.keywords.join(", ")}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(t); setModalOpen(true); }}>Editar</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="text-danger hover:text-danger">Remover</Button>
            </div>
          </div>
        ))}
      </Card>
      <TopicModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} topic={editing} loading={loading} />
    </div>
  );
}
```

- [ ] **Step 3: Create `SourceModal.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { RssSource, Topic } from "@/types";

interface SourceModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; url: string; topic_id: string | null }) => void;
  source?: RssSource | null;
  topics: Topic[];
  loading?: boolean;
}

export function SourceModal({ open, onClose, onSave, source, topics, loading }: SourceModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [topicId, setTopicId] = useState("");

  useEffect(() => {
    if (source) {
      setName(source.name);
      setUrl(source.url);
      setTopicId(source.topic_id || "");
    } else {
      setName("");
      setUrl("");
      setTopicId("");
    }
  }, [source, open]);

  const topicOptions = [{ value: "", label: "Nenhum" }, ...topics.map((t) => ({ value: t.id, label: t.name }))];

  return (
    <Modal open={open} onClose={onClose} title={source ? "Editar Fonte" : "Nova Fonte RSS"}>
      <div className="flex flex-col gap-4">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: TechCrunch" />
        <Input label="URL do Feed RSS" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://techcrunch.com/feed/" />
        <Select label="Tema associado" value={topicId} onChange={(e) => setTopicId(e.target.value)} options={topicOptions} />
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={() => onSave({ name, url, topic_id: topicId || null })} loading={loading} disabled={!name || !url} className="flex-1">Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Create `SourcesList.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SourceModal } from "./SourceModal";
import type { RssSource, Topic } from "@/types";

interface SourcesListProps {
  sources: RssSource[];
  topics: Topic[];
  onRefresh: () => void;
}

export function SourcesList({ sources, topics, onRefresh }: SourcesListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RssSource | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave(data: { name: string; url: string; topic_id: string | null }) {
    setLoading(true);
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...data, id: editing.id } : data;
    await fetch("/api/sources", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    setModalOpen(false);
    setEditing(null);
    onRefresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/sources?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  const getTopicName = (topicId: string | null) => topics.find((t) => t.id === topicId)?.name || "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Fontes RSS</h2>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>+ Novo</Button>
      </div>
      <Card className="divide-y divide-border/20">
        {sources.length === 0 && <p className="text-text-secondary text-sm py-3">Nenhuma fonte configurada.</p>}
        {sources.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div>
              <span className="font-medium">{s.name}</span>
              <span className="text-text-secondary text-sm ml-2">→ {getTopicName(s.topic_id)}</span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setModalOpen(true); }}>Editar</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-danger hover:text-danger">Remover</Button>
            </div>
          </div>
        ))}
      </Card>
      <SourceModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} source={editing} topics={topics} loading={loading} />
    </div>
  );
}
```

- [ ] **Step 5: Create `AlertModal.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Alert } from "@/types";

interface AlertModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { title: string; query: string; expires_at: string | null }) => void;
  alert?: Alert | null;
  loading?: boolean;
}

export function AlertModal({ open, onClose, onSave, alert: alertData, loading }: AlertModalProps) {
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (alertData) {
      setTitle(alertData.title);
      setQuery(alertData.query);
      setExpiresAt(alertData.expires_at ? alertData.expires_at.split("T")[0] : "");
    } else {
      setTitle("");
      setQuery("");
      setExpiresAt("");
    }
  }, [alertData, open]);

  return (
    <Modal open={open} onClose={onClose} title={alertData ? "Editar Alerta" : "Novo Alerta"}>
      <div className="flex flex-col gap-4">
        <Input label="Titulo" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Regulacao IA Brasil" />
        <Input label="Busca" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: regulacao inteligencia artificial brasil" />
        <Input label="Expira em (opcional)" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={() => onSave({ title, query, expires_at: expiresAt || null })} loading={loading} disabled={!title || !query} className="flex-1">Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 6: Create `AlertsList.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AlertModal } from "./AlertModal";
import type { Alert } from "@/types";

interface AlertsListProps {
  alerts: Alert[];
  onRefresh: () => void;
}

export function AlertsList({ alerts, onRefresh }: AlertsListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave(data: { title: string; query: string; expires_at: string | null }) {
    setLoading(true);
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...data, id: editing.id } : data;
    await fetch("/api/alerts", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    setModalOpen(false);
    setEditing(null);
    onRefresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Alertas</h2>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>+ Novo</Button>
      </div>
      <Card className="divide-y divide-border/20">
        {alerts.length === 0 && <p className="text-text-secondary text-sm py-3">Nenhum alerta configurado.</p>}
        {alerts.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div>
              <span className="font-medium">{a.title}</span>
              {a.expires_at && <span className="text-text-secondary text-sm ml-2">ate {new Date(a.expires_at).toLocaleDateString("pt-BR")}</span>}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(a); setModalOpen(true); }}>Editar</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="text-danger hover:text-danger">Remover</Button>
            </div>
          </div>
        ))}
      </Card>
      <AlertModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} alert={editing} loading={loading} />
    </div>
  );
}
```

- [ ] **Step 7: Create `AdvancedOptions.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ChipInput } from "@/components/ui/ChipInput";
import type { UserSettings, Exclusion } from "@/types";

interface AdvancedOptionsProps {
  settings: UserSettings;
  exclusions: Exclusion[];
  onSettingsChange: (settings: Partial<UserSettings>) => void;
  onAddExclusion: (keyword: string) => void;
  onRemoveExclusion: (id: string) => void;
}

export function AdvancedOptions({
  settings,
  exclusions,
  onSettingsChange,
  onAddExclusion,
  onRemoveExclusion,
}: AdvancedOptionsProps) {
  const [open, setOpen] = useState(false);

  const exclusionValues = exclusions.map((e) => e.keyword);

  function handleExclusionsChange(values: string[]) {
    const current = new Set(exclusions.map((e) => e.keyword));
    const next = new Set(values);

    // Added
    for (const v of values) {
      if (!current.has(v)) onAddExclusion(v);
    }
    // Removed
    for (const e of exclusions) {
      if (!next.has(e.keyword)) onRemoveExclusion(e.id);
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-text-secondary hover:text-text transition-colors mb-3"
      >
        <span className="text-sm">{open ? "▾" : "▸"}</span>
        <span className="text-lg font-semibold">Opcoes avancadas</span>
      </button>
      {open && (
        <Card className="flex flex-col gap-4">
          <Input
            label="Horario do digest"
            type="time"
            value={settings.digest_time}
            onChange={(e) => onSettingsChange({ digest_time: e.target.value })}
          />
          <Select
            label="Idioma dos resumos"
            value={settings.language}
            onChange={(e) => onSettingsChange({ language: e.target.value })}
            options={[
              { value: "pt-BR", label: "Portugues" },
              { value: "en", label: "English" },
              { value: "es", label: "Espanol" },
            ]}
          />
          <Select
            label="Estilo do resumo"
            value={settings.summary_style}
            onChange={(e) => onSettingsChange({ summary_style: e.target.value as "executive" | "detailed" })}
            options={[
              { value: "executive", label: "Executivo (2-3 frases)" },
              { value: "detailed", label: "Detalhado (4-5 frases)" },
            ]}
          />
          <Input
            label="Max artigos por digest"
            type="number"
            value={settings.max_articles}
            onChange={(e) => onSettingsChange({ max_articles: parseInt(e.target.value) || 20 })}
            min={5}
            max={50}
          />
          <ChipInput
            label="Exclusoes"
            values={exclusionValues}
            onChange={handleExclusionsChange}
            placeholder="Ex: esportes, fofoca"
          />
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Create settings page `src/app/settings/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TopicsList } from "@/components/settings/TopicsList";
import { SourcesList } from "@/components/settings/SourcesList";
import { AlertsList } from "@/components/settings/AlertsList";
import { AdvancedOptions } from "@/components/settings/AdvancedOptions";
import type { Topic, RssSource, Alert, Exclusion, UserSettings } from "@/types";

const DEFAULT_SETTINGS: UserSettings = {
  user_id: "",
  digest_time: "07:00",
  language: "pt-BR",
  summary_style: "executive",
  max_articles: 20,
  created_at: "",
  updated_at: "",
};

export default function SettingsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<RssSource[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const router = useRouter();
  const supabase = createClient();

  const loadAll = useCallback(async () => {
    const [topicsRes, sourcesRes, alertsRes, exclusionsRes, settingsRes] = await Promise.all([
      fetch("/api/topics").then((r) => r.json()),
      fetch("/api/sources").then((r) => r.json()),
      fetch("/api/alerts").then((r) => r.json()),
      fetch("/api/exclusions").then((r) => r.json()),
      supabase.from("user_settings").select("*").single(),
    ]);
    setTopics(topicsRes);
    setSources(sourcesRes);
    setAlerts(alertsRes);
    setExclusions(exclusionsRes);
    if (settingsRes.data) setSettings(settingsRes.data);
  }, [supabase]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleSettingsChange(partial: Partial<UserSettings>) {
    const updated = { ...settings, ...partial, updated_at: new Date().toISOString() };
    setSettings(updated);
    await supabase.from("user_settings").upsert(updated);
  }

  async function handleAddExclusion(keyword: string) {
    await fetch("/api/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    loadAll();
  }

  async function handleRemoveExclusion(id: string) {
    await fetch(`/api/exclusions?id=${id}`, { method: "DELETE" });
    loadAll();
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Configuracoes</h1>
        <Button variant="outline" size="sm" onClick={() => router.push("/")}>
          ← Voltar
        </Button>
      </div>
      <div className="flex flex-col gap-8">
        <TopicsList topics={topics} onRefresh={loadAll} />
        <SourcesList sources={sources} topics={topics} onRefresh={loadAll} />
        <AlertsList alerts={alerts} onRefresh={loadAll} />
        <AdvancedOptions
          settings={settings}
          exclusions={exclusions}
          onSettingsChange={handleSettingsChange}
          onAddExclusion={handleAddExclusion}
          onRemoveExclusion={handleRemoveExclusion}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Test in browser**

```bash
npm run dev
# Create a user account, then go to http://localhost:3000/settings
```

Expected: All four sections render. CRUD modals open/close. Data persists after refresh.

- [ ] **Step 10: Commit**

```bash
git add src/app/settings/ src/components/settings/
git commit -m "feat: add settings page with topics, sources, alerts, and advanced options"
```

---

## Task 13: Feed Page (Frontend)

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/components/digest/DaySummary.tsx`
- Create: `src/components/digest/HighlightCards.tsx`
- Create: `src/components/digest/ArticleRow.tsx`
- Create: `src/components/digest/CategorySection.tsx`
- Create: `src/components/digest/AlertsSection.tsx`
- Create: `src/components/digest/DigestDateSelector.tsx`

- [ ] **Step 1: Create `DaySummary.tsx`**

```tsx
import { Card } from "@/components/ui/Card";

interface DaySummaryProps {
  summary: string | null;
}

export function DaySummary({ summary }: DaySummaryProps) {
  if (!summary) return null;

  return (
    <Card className="bg-gradient-to-r from-[#ee322f]/10 to-[#fee53a]/10 border-primary/20">
      <p className="text-text-secondary text-sm mb-1">Resumo do dia</p>
      <p className="text-text leading-relaxed">{summary}</p>
    </Card>
  );
}
```

- [ ] **Step 2: Create `ArticleRow.tsx`**

```tsx
import { Badge } from "@/components/ui/Badge";
import type { Article } from "@/types";

interface ArticleRowProps {
  article: Article;
}

export function ArticleRow({ article }: ArticleRowProps) {
  return (
    <a
      href={article.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block py-3 hover:bg-surface-light/50 transition-colors -mx-4 px-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-text truncate">{article.title}</h4>
          <p className="text-sm text-text-secondary mt-1 line-clamp-2">{article.summary}</p>
        </div>
        <div className="text-right shrink-0">
          <Badge>{article.source_name}</Badge>
          {article.published_at && (
            <p className="text-xs text-text-muted mt-1">
              {new Date(article.published_at).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}
```

- [ ] **Step 3: Create `HighlightCards.tsx`**

```tsx
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Article } from "@/types";

interface HighlightCardsProps {
  articles: Article[];
}

export function HighlightCards({ articles }: HighlightCardsProps) {
  if (articles.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {articles.slice(0, 3).map((article, i) => (
        <a
          key={article.id}
          href={article.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className={i === 0 ? "md:col-span-2" : ""}
        >
          <Card className="h-full hover:border-primary/40 transition-colors group">
            {article.image_url && (
              <div className="aspect-video rounded overflow-hidden mb-3 bg-surface">
                <img
                  src={article.image_url}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            )}
            <Badge className="mb-2">{article.source_name}</Badge>
            <h3 className={`font-semibold leading-snug ${i === 0 ? "text-lg" : "text-base"}`}>
              {article.title}
            </h3>
            <p className="text-sm text-text-secondary mt-2 line-clamp-3">{article.summary}</p>
          </Card>
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `CategorySection.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { ArticleRow } from "./ArticleRow";
import type { Article } from "@/types";

interface CategorySectionProps {
  name: string;
  articles: Article[];
}

export function CategorySection({ name, articles }: CategorySectionProps) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mb-2 hover:text-primary transition-colors"
      >
        <span className="text-sm">{open ? "▾" : "▸"}</span>
        <h3 className="text-lg font-semibold">{name}</h3>
        <span className="text-text-secondary text-sm">({articles.length})</span>
      </button>
      {open && (
        <Card className="divide-y divide-border/10">
          {articles.map((a) => (
            <ArticleRow key={a.id} article={a} />
          ))}
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `AlertsSection.tsx`**

```tsx
import { Card } from "@/components/ui/Card";
import { ArticleRow } from "./ArticleRow";
import type { Article } from "@/types";

interface AlertsSectionProps {
  articles: Article[];
}

export function AlertsSection({ articles }: AlertsSectionProps) {
  if (articles.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Alertas</h3>
      <Card className="border-primary/30 divide-y divide-border/10">
        {articles.map((a) => (
          <ArticleRow key={a.id} article={a} />
        ))}
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Create `DigestDateSelector.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import type { Digest } from "@/types";

interface DigestDateSelectorProps {
  digests: Digest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DigestDateSelector({ digests, selectedId, onSelect }: DigestDateSelectorProps) {
  if (digests.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {digests.map((d) => (
        <Button
          key={d.id}
          variant={d.id === selectedId ? "primary" : "outline"}
          size="sm"
          onClick={() => onSelect(d.id)}
        >
          {new Date(d.generated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Create feed page `src/app/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DaySummary } from "@/components/digest/DaySummary";
import { HighlightCards } from "@/components/digest/HighlightCards";
import { CategorySection } from "@/components/digest/CategorySection";
import { AlertsSection } from "@/components/digest/AlertsSection";
import { DigestDateSelector } from "@/components/digest/DigestDateSelector";
import type { Digest, DigestWithArticles, Topic } from "@/types";

export default function FeedPage() {
  const [digests, setDigests] = useState<Digest[]>([]);
  const [current, setCurrent] = useState<DigestWithArticles | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadDigest = useCallback(async (id: string) => {
    const res = await fetch(`/api/digest/${id}`);
    const data = await res.json();
    setCurrent(data);
  }, []);

  const loadDigests = useCallback(async () => {
    const [digestsRes, topicsRes] = await Promise.all([
      fetch("/api/digests?limit=10").then((r) => r.json()),
      fetch("/api/topics").then((r) => r.json()),
    ]);
    setDigests(digestsRes);
    setTopics(topicsRes);
    if (digestsRes.length > 0) {
      await loadDigest(digestsRes[0].id);
    }
    setLoading(false);
  }, [loadDigest]);

  useEffect(() => {
    loadDigests();
  }, [loadDigests]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/digest/generate", { method: "POST" });
      const { digestId } = await res.json();

      // Poll for completion
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 2000));
        const check = await fetch(`/api/digest/${digestId}`);
        const data = await check.json();
        if (data.status === "completed" || data.status === "failed") {
          await loadDigests();
          break;
        }
        attempts++;
      }
    } finally {
      setGenerating(false);
    }
  }

  const getTopicName = (topicId: string) =>
    topics.find((t) => t.id === topicId)?.name || "Outros";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">JNews</h1>
          {current && (
            <p className="text-text-secondary text-sm">
              Digest de {new Date(current.generated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerate} loading={generating}>
            {generating ? "Gerando..." : "Gerar Digest"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/settings")}>
            ⚙
          </Button>
        </div>
      </header>

      <DigestDateSelector
        digests={digests}
        selectedId={current?.id || null}
        onSelect={loadDigest}
      />

      {!current && digests.length === 0 && (
        <div className="text-center py-20">
          <p className="text-text-secondary text-lg mb-4">Nenhum digest gerado ainda.</p>
          <p className="text-text-muted text-sm mb-6">Configure seus temas em Configuracoes e gere seu primeiro digest.</p>
          <Button onClick={() => router.push("/settings")}>Ir para Configuracoes</Button>
        </div>
      )}

      {current && (
        <div className="flex flex-col gap-6 mt-6">
          <DaySummary summary={current.summary} />
          <HighlightCards articles={current.highlights} />

          {Object.entries(current.by_topic)
            .filter(([key]) => key !== "uncategorized")
            .map(([topicId, articles]) => (
              <CategorySection
                key={topicId}
                name={getTopicName(topicId)}
                articles={articles}
              />
            ))}

          {current.by_topic["uncategorized"] && (
            <CategorySection name="Outros" articles={current.by_topic["uncategorized"]} />
          )}

          <AlertsSection articles={current.alert_articles} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Test in browser**

```bash
npm run dev
# Go to http://localhost:3000
```

Expected: Shows empty state if no digests. After configuring topics/sources in settings and clicking "Gerar Digest", shows the generated digest with highlights, categories, and summary.

- [ ] **Step 9: Commit**

```bash
git add src/app/page.tsx src/components/digest/
git commit -m "feat: add feed page with highlights, categories, alerts, and date selector"
```

---

## Task 14: End-to-End Test + Final Polish

- [ ] **Step 1: Create a test user via Supabase dashboard or login page**

Go to `http://localhost:3000/login`, create account with email/password.

- [ ] **Step 2: Configure test data in Settings**

- Add topic: "Inteligência Artificial" with keywords ["AI", "LLM", "machine learning"], priority high
- Add topic: "Crypto" with keywords ["bitcoin", "ethereum", "crypto"], priority medium
- Add RSS source: "TechCrunch" → `https://techcrunch.com/feed/`
- Add alert: "Regulação IA" with query "regulacao inteligencia artificial brasil"
- Add exclusion: "esportes"

- [ ] **Step 3: Generate a digest**

Click "Gerar Digest" on the feed page. Wait for completion (~20-30s).

- [ ] **Step 4: Verify the full flow**

Expected:
- Day summary card shows 2-3 sentence overview
- Top 3 highlight cards with images (if available), titles, summaries
- Category sections for each topic with articles grouped
- Alert section with relevant articles
- All links open original sources
- Date selector shows the digest

- [ ] **Step 5: Verify build for production**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: JNews v1 complete — AI news digest with configurable topics, sources, and alerts"
```

- [ ] **Step 7: Push to GitHub**

```bash
git remote add origin <github-repo-url>
git push -u origin main
```

- [ ] **Step 8: Deploy to Vercel**

Connect the repo on Vercel, add env vars, deploy.
