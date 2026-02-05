import { promises as fs } from 'fs';
import path from 'path';
import { Tabs, Card } from 'antd';
import Title from 'antd/es/typography/Title';
import GuideMarkdown from '@/components/GuideMarkdown';



// Split guide content into sections
function splitGuideContent(content: string): { forManagers: string; forSubordinates: string } {
  const managerSectionStart = '## 地蔵型1on1 ガイド：上司（聞き手）向け';
  const subordinateSectionStart = '## 地蔵型1on1 ガイド：部下（話し手）向け';
  
  const managerStartIndex = content.indexOf(managerSectionStart);
  const subordinateStartIndex = content.indexOf(subordinateSectionStart);
  
  if (managerStartIndex === -1 || subordinateStartIndex === -1) {
    // If sections not found, return the whole content for both
    return { forManagers: content, forSubordinates: content };
  }
  
  const forManagers = content.substring(managerStartIndex, subordinateStartIndex).trim();
  const forSubordinates = content.substring(subordinateStartIndex).trim();
  
  return { forManagers, forSubordinates };
}

export default async function GuidePage() {
  let forManagers = '';
  let forSubordinates = '';
  let hasError = false;
  let errorMessage = '';

  try {
    // Read the markdown file
    const guidePath = path.join(process.cwd(), 'public', 'LEARNING_GUIDE.md');
    const content = await fs.readFile(guidePath, 'utf-8');
    
    // Split into sections
    const sections = splitGuideContent(content);
    forManagers = sections.forManagers;
    forSubordinates = sections.forSubordinates;
  } catch (error) {
    console.error('Failed to load guide:', error);
    hasError = true;
    errorMessage = error instanceof Error ? error.message : String(error);
    
    // Set fallback content
    const fallbackContent = `# 学習ガイド

現在ガイドを読み込めませんでした。しばらくしてから再度お試しください。

エラー詳細: ${errorMessage}`;
    
    forManagers = fallbackContent;
    forSubordinates = fallbackContent;
  }

  const tabItems = [
    {
      key: 'managers',
      label: '上司（聞き手）向け',
      children: <GuideMarkdown content={forManagers} />,
    },
    {
      key: 'subordinates',
      label: '部下（話し手）向け',
      children: <GuideMarkdown content={forSubordinates} />,
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>地蔵型1on1 学習ガイド</Title>
      
      <Card>
        <Tabs
          defaultActiveKey="managers"
          items={tabItems}
          size="large"
          tabPosition="top"
          style={{ marginTop: 16 }}
        />
      </Card>
      
      {hasError ? (
        <div style={{ marginTop: 24, padding: 16, background: '#fff2e8', border: '1px solid #ffbb96', borderRadius: 4 }}>
          <Title level={5} style={{ marginBottom: 8, color: '#fa541c' }}>読み込みエラー</Title>
          <p>
            ガイドファイルの読み込み中にエラーが発生しました。
            ファイルが存在するか、アクセス権限を確認してください。
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 24, padding: 16, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
          <Title level={5} style={{ marginBottom: 8 }}>ガイドの使い方</Title>
          <p>
            このガイドは「地蔵型1on1」の考え方と実践方法を説明しています。
            上司（聞き手）向けと部下（話し手）向けの2つの視点から書かれています。
          </p>
          <p style={{ marginTop: 8 }}>
            タブを切り替えて、それぞれの立場に合ったガイドを参照してください。
          </p>
        </div>
      )}
    </div>
  );
}