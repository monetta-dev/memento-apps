'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@/lib/supabase';
import { getGoogleAccessToken, createGoogleCalendarEvent, listGoogleCalendarEvents } from '@/lib/google-calendar';
import { Card, Button, Typography, Alert, List, Descriptions, Steps, Space, Input, DatePicker, TimePicker } from 'antd';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function GoogleCalendarTestPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  
  const [eventForm, setEventForm] = useState({
    summary: '1on1セッション: テスト',
    description: 'Memento 1on1で作成されたテストセッション',
    startTime: dayjs().add(1, 'hour'),
    endTime: dayjs().add(2, 'hours'),
    attendees: ''
  });
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    checkGoogleAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkGoogleAccess = async () => {
    setLoading(true);
    try {
      // 1. セッション情報を確認
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔍 現在のセッション:', {
        hasSession: !!session,
        userEmail: session?.user?.email,
        providerToken: session?.provider_token ? 'あり' : 'なし'
      });
      
      setSessionInfo({
        hasSession: !!session,
        email: session?.user?.email,
        providerToken: !!session?.provider_token
      });

      if (!session) {
        setTestResults(prev => ({
          ...prev,
          sessionCheck: { success: false, error: 'セッションがありません' }
        }));
        setCurrentStep(0);
        return;
      }

      setTestResults(prev => ({
        ...prev,
        sessionCheck: { success: true, data: { email: session.user.email } }
      }));
      setCurrentStep(1);

      // 2. Googleアクセストークンを確認
      const token = await getGoogleAccessToken();
      setAccessToken(token);
      
      if (token) {
        console.log('✅ Googleアクセストークン取得成功（長さ）:', token.length);
        setTestResults(prev => ({
          ...prev,
          tokenCheck: { success: true, data: { tokenLength: token.length } }
        }));
        setCurrentStep(2);
        
        // 3. カレンダーAPIテスト（リスト取得）
        try {
          const events = await listGoogleCalendarEvents('primary', undefined, undefined, 5);
          console.log('📅 カレンダーイベント取得結果:', events);
          
          if ((events as any).items) {
            setCalendarEvents((events as any).items);
            setTestResults(prev => ({
              ...prev,
              calendarListCheck: { 
                success: true, 
                data: { eventCount: (events as any).items.length } 
              }
            }));
          } else {
            setTestResults(prev => ({
              ...prev,
              calendarListCheck: { 
                success: false, 
                error: 'イベントリストが取得できませんでした',
                data: events 
              }
            }));
          }
        } catch (error: unknown) {
          console.error('❌ カレンダーリスト取得エラー:', error);
          setTestResults(prev => ({
            ...prev,
            calendarListCheck: { 
              success: false, 
              error: error instanceof Error ? error.message : String(error)
            }
          }));
        }
      } else {
        setTestResults(prev => ({
          ...prev,
          tokenCheck: { success: false, error: 'Googleアクセストークンが取得できません' }
        }));
      }

    } catch (error: unknown) {
      console.error('❌ Googleアクセスチェックエラー:', error);
      setTestResults(prev => ({
        ...prev,
        generalError: { success: false, error: error instanceof Error ? error.message : String(error) }
      }));
    } finally {
      setLoading(false);
    }
  };

  const runAllTests = async () => {
    setTestResults({});
    setCalendarEvents([]);
    await checkGoogleAccess();
  };

  const createTestEvent = async () => {
    setLoading(true);
    try {
      const attendees = eventForm.attendees
        .split(',')
        .map(email => email.trim())
        .filter(email => email)
        .map(email => ({ email }));

      const eventData = {
        summary: eventForm.summary,
        description: eventForm.description,
        startTime: eventForm.startTime.toDate(),
        endTime: eventForm.endTime.toDate(),
        attendees: attendees.length > 0 ? attendees : undefined
      };

      console.log('📝 イベント作成データ:', eventData);
      
      const result = await createGoogleCalendarEvent(eventData, 'primary');
      
      console.log('✅ カレンダーイベント作成成功:', result);
      
      setTestResults(prev => ({
        ...prev,
        createEvent: { 
          success: true, 
            data: { 
              eventId: (result as any).id,
              htmlLink: (result as any).htmlLink,
              summary: (result as any).summary
            }
        }
      }));
      
      setCurrentStep(3);
      
      // イベントリストを更新
      const events = await listGoogleCalendarEvents('primary', undefined, undefined, 5);
      if ((events as any).items) {
        setCalendarEvents((events as any).items);
      }
      
      alert(`✅ カレンダーイベントを作成しました！\n${(result as any).htmlLink}`);
      
    } catch (error: unknown) {
      console.error('❌ イベント作成エラー:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTestResults(prev => ({
        ...prev,
        createEvent: { 
          success: false, 
          error: errorMessage
        }
      }));
      alert(`❌ イベント作成失敗: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStep) return 'finish';
    if (stepIndex === currentStep) return 'process';
    return 'wait';
  };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>📅 Google Calendar連携テスト</Title>
      
       <Card style={{ marginBottom: 20 }}>
        <Steps 
          current={currentStep}
          items={[
            { title: 'セッション確認', description: 'Googleログイン状態', status: getStepStatus(0) },
            { title: 'アクセストークン', description: 'Google APIトークン', status: getStepStatus(1) },
            { title: 'カレンダー確認', description: 'イベントリスト取得', status: getStepStatus(2) },
            { title: 'イベント作成', description: 'テストイベント作成', status: getStepStatus(3) },
          ]}
        />
      </Card>

      <div style={{ marginBottom: 20 }}>
        <Button 
          type="primary" 
          onClick={runAllTests}
          loading={loading}
          style={{ marginRight: 10 }}
        >
          すべてのテストを実行
        </Button>
        
        <Button 
          onClick={() => {
            setTestResults({});
            setCalendarEvents([]);
            setCurrentStep(0);
          }}
        >
          リセット
        </Button>
      </div>

      {sessionInfo && (
        <Card title="現在のセッション状態" style={{ marginBottom: 20 }}>
          <Descriptions bordered column={1}>
            <Descriptions.Item label="ログイン状態">
              {sessionInfo.hasSession ? (
                <Text type="success">✅ ログイン済み: {sessionInfo.email}</Text>
              ) : (
                <Text type="danger">❌ 未ログイン</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Google OAuthトークン">
              {sessionInfo.providerToken ? (
                <Text type="success">✅ トークンあり</Text>
              ) : (
                <Text type="warning">⚠️ トークンなし（Googleログインで取得）</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="アクセストークン">
              {accessToken ? (
                <Text type="success">✅ 取得済み（長さ: {accessToken.length}）</Text>
              ) : (
                <Text type="secondary">未取得</Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {Object.keys(testResults).length > 0 && (
        <Card title="テスト結果" style={{ marginBottom: 20 }}>
          <List
            dataSource={Object.entries(testResults)}
            renderItem={([testName, result]) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    result.success ? (
                      <span style={{ color: 'green', fontSize: '18px' }}>✅</span>
                    ) : (
                      <span style={{ color: 'red', fontSize: '18px' }}>❌</span>
                    )
                  }
                  title={testName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  description={
                    <div>
                      <Text type={result.success ? 'success' : 'danger'}>
                        {result.success ? '成功' : `失敗: ${result.error}`}
                      </Text>
                      {result.data && (
                        <pre style={{ 
                          background: '#f5f5f5', 
                          padding: 10, 
                          borderRadius: 4, 
                          marginTop: 8,
                          fontSize: '12px',
                          maxHeight: '200px',
                          overflow: 'auto'
                        }}>
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      <Card title="カレンダーイベント作成テスト" style={{ marginBottom: 20 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>イベントタイトル</Text>
            <Input
              value={eventForm.summary}
              onChange={(e) => setEventForm({ ...eventForm, summary: e.target.value })}
              placeholder="1on1セッション: 〇〇さん"
            />
          </div>
          
          <div>
            <Text strong>説明</Text>
            <TextArea
              value={eventForm.description}
              onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
              placeholder="1on1セッションの詳細な説明"
              rows={3}
            />
          </div>
          
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <Text strong>開始時間</Text>
              <DatePicker
                value={eventForm.startTime}
                onChange={(date) => date && setEventForm({ ...eventForm, startTime: date })}
                style={{ width: '100%' }}
              />
              <TimePicker
                value={eventForm.startTime}
                onChange={(time) => time && setEventForm({ ...eventForm, startTime: time })}
                style={{ width: '100%', marginTop: 8 }}
                format="HH:mm"
              />
            </div>
            
            <div style={{ flex: 1 }}>
              <Text strong>終了時間</Text>
              <DatePicker
                value={eventForm.endTime}
                onChange={(date) => date && setEventForm({ ...eventForm, endTime: date })}
                style={{ width: '100%' }}
              />
              <TimePicker
                value={eventForm.endTime}
                onChange={(time) => time && setEventForm({ ...eventForm, endTime: time })}
                style={{ width: '100%', marginTop: 8 }}
                format="HH:mm"
              />
            </div>
          </div>
          
          <div>
            <Text strong>参加者（メールアドレス、カンマ区切り）</Text>
            <Input
              value={eventForm.attendees}
              onChange={(e) => setEventForm({ ...eventForm, attendees: e.target.value })}
              placeholder="user1@example.com, user2@example.com"
            />
          </div>
          
          <Button 
            type="primary" 
            onClick={createTestEvent}
            loading={loading}
            disabled={!accessToken}
            block
          >
            カレンダーイベントを作成
          </Button>
          
          {!accessToken && (
            <Alert
              message="Googleアクセストークンが必要です"
              description="先に「すべてのテストを実行」ボタンをクリックしてGoogleアクセスを確認してください。"
              type="warning"
              showIcon
            />
          )}
        </Space>
      </Card>

      {calendarEvents.length > 0 && (
        <Card title="最近のカレンダーイベント" style={{ marginBottom: 20 }}>
          <List
            dataSource={calendarEvents}
            renderItem={(event) => (
              <List.Item>
                <List.Item.Meta
                  title={event.summary || '（タイトルなし）'}
                  description={
                    <div>
                      <Text type="secondary">
                        時間: {event.start?.dateTime ? dayjs(event.start.dateTime).format('YYYY-MM-DD HH:mm') : '終日'}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        ID: {event.id}
                      </Text>
                      {event.htmlLink && (
                        <div style={{ marginTop: 5 }}>
                          <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
                            Google Calendarで開く
                          </a>
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      <Card title="次のステップ">
        <List
          dataSource={[
            {
              title: '1. Googleログイン確認',
              description: 'Googleでログインしていることを確認',
              status: sessionInfo?.hasSession ? '✅' : '⏳'
            },
            {
              title: '2. アクセストークン取得',
              description: 'Google Calendar APIトークンを確認',
              status: accessToken ? '✅' : '⏳'
            },
            {
              title: '3. カレンダーイベント作成テスト',
              description: 'テストイベントを作成して動作確認',
              status: testResults.createEvent?.success ? '✅' : '🔧'
            },
            {
              title: '4. セッション作成に統合',
              description: '1on1セッション作成時に自動的にカレンダーイベントを作成',
              status: '🚀'
            },
          ]}
          renderItem={(item, _ignored) => ( // eslint-disable-line @typescript-eslint/no-unused-vars
            <List.Item>
              <List.Item.Meta
                avatar={<span style={{ fontSize: '20px' }}>{item.status}</span>}
                title={item.title}
                description={item.description}
              />
            </List.Item>
          )}
        />
      </Card>

      <Alert
        message="Google Calendar連携の仕組み"
        description={
          <div>
            <p>この機能は以下の流れで動作します：</p>
            <ol>
              <li>ユーザーがGoogle OAuthでログイン（calendarスコープ付き）</li>
              <li>SupabaseがGoogleアクセストークンをセッションに保存</li>
              <li>1on1セッション作成時にGoogle Calendar APIを呼び出し</li>
              <li>カレンダーにイベントを作成（参加者招待も可能）</li>
            </ol>
            <p><strong>必要な設定:</strong></p>
            <ul>
              <li>Google Cloud ConsoleでCalendar APIが有効</li>
              <li>OAuth同意画面にcalendarスコープが追加済み</li>
              <li>Supabase Google OAuthにcalendarスコープ設定済み</li>
            </ul>
          </div>
        }
        type="info"
        style={{ marginTop: 20 }}
      />
    </div>
  );
}