-- messaging_integrations テーブル
-- 複数の業務メッセージサービス（Slack/Chatwork/LINE Works）の連携情報を一元管理する

CREATE TABLE IF NOT EXISTS messaging_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('slack', 'chatwork', 'lineworks', 'line')),
  webhook_url TEXT,           -- Slack Incoming Webhook URL
  api_token TEXT,             -- Chatwork APIトークン / LINE Works アクセストークン
  room_id TEXT,               -- Chatworkルームid / LINE Works ユーザーID等
  display_name TEXT,          -- サービス上の表示名
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',   -- プロバイダー固有の追加情報
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1ユーザーにつき各プロバイダー1件まで
CREATE UNIQUE INDEX IF NOT EXISTS messaging_integrations_user_provider_idx
  ON messaging_integrations(user_id, provider);

-- RLS（既存のprofilesテーブルのポリシーに合わせて設定）
ALTER TABLE messaging_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own messaging integrations"
  ON messaging_integrations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at を自動更新するトリガー（既存パターンに合わせる）
CREATE OR REPLACE FUNCTION update_messaging_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messaging_integrations_updated_at
  BEFORE UPDATE ON messaging_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_messaging_integrations_updated_at();
