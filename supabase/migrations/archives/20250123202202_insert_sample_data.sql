-- Insert sample data for testing
INSERT INTO public.subordinates (name, role, department, traits) VALUES
    ('山田 太郎', 'エンジニア', '開発部', '["詳細志向", "論理的", "協調性"]'),
    ('佐藤 花子', 'デザイナー', 'デザイン部', '["創造的", "几帳面", "コミュニケーション能力"]')
ON CONFLICT DO NOTHING;