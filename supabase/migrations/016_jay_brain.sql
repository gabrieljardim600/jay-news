-- Jay Brain: watchlist, interactions, chat sessions/messages

-- ─── watchlist_items ─────────────────────────────────────────────────────────
CREATE TABLE watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('asset', 'theme', 'person', 'company')),
  label TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_watchlist_user ON watchlist_items(user_id) WHERE is_active = true;

ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own watchlist" ON watchlist_items
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own watchlist" ON watchlist_items
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own watchlist" ON watchlist_items
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own watchlist" ON watchlist_items
  FOR DELETE USING (user_id = auth.uid());

-- ─── user_interactions ───────────────────────────────────────────────────────
CREATE TABLE user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interactions_user_time ON user_interactions(user_id, created_at DESC);

ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own interactions" ON user_interactions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own interactions" ON user_interactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── chat_sessions ───────────────────────────────────────────────────────────
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  context_type TEXT,
  context_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user_time ON chat_sessions(user_id, updated_at DESC);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own chat sessions" ON chat_sessions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own chat sessions" ON chat_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own chat sessions" ON chat_sessions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own chat sessions" ON chat_sessions
  FOR DELETE USING (user_id = auth.uid());

-- ─── chat_messages ───────────────────────────────────────────────────────────
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own chat messages" ON chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_sessions WHERE chat_sessions.id = chat_messages.session_id AND chat_sessions.user_id = auth.uid())
  );
CREATE POLICY "Users insert own chat messages" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat_sessions WHERE chat_sessions.id = chat_messages.session_id AND chat_sessions.user_id = auth.uid())
  );
