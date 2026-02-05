'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, DatePicker, TimePicker, Select, Typography, Alert, Space, Flex, message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { CalendarOutlined } from '@ant-design/icons';
import { createGoogleCalendarEvent } from '@/lib/google-calendar';
import { createClientComponentClient } from '@/lib/supabase';
import { useStore } from '@/store/useStore';

const { Text } = Typography;
const { Option } = Select;

interface ScheduleNextMeetingSectionProps {
  sessionId: string;
  subordinateName: string;
  onScheduled?: () => void;
}

const ScheduleNextMeetingSection: React.FC<ScheduleNextMeetingSectionProps> = ({
  sessionId,
  subordinateName,
  onScheduled,
}) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs().add(7, 'day')); // Default: 1 week from now
  const [selectedTime, setSelectedTime] = useState<Dayjs | null>(dayjs().hour(14).minute(0)); // Default: 2 PM
  const [duration, setDuration] = useState<number>(60); // minutes, default 60
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);
  const supabase = createClientComponentClient();
  const updateSession = useStore(state => state.updateSession);

  useEffect(() => {
    const checkAuthStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsGoogleAuth(!!session.provider_token);
      }
    };
    checkAuthStatus();
  }, [supabase]);

  const handleSchedule = async () => {
    if (!selectedDate || !selectedTime) {
      messageApi.error('日付と時間を選択してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Combine date and time
      const startDateTime = selectedDate
        .hour(selectedTime.hour())
        .minute(selectedTime.minute())
        .second(0);
      const endDateTime = startDateTime.add(duration, 'minute');

      // Get current user email for attendees
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      const userId = session?.user?.id;

      const eventData = {
        summary: `1on1セッション: ${subordinateName}`,
        description: `Memento 1on1セッション\n前回のセッションID: ${sessionId}`,
        startTime: startDateTime.toDate(),
        endTime: endDateTime.toDate(),
        attendees: userEmail ? [{ email: userEmail }] : undefined,
      };

      const result = await createGoogleCalendarEvent(eventData, 'primary');
      console.log('Google Calendar event created:', result);

      // Save next session data to database for LINE reminders
      try {
        if (!userId) {
          console.warn('User ID not found, LINE reminders may not work for this session');
          messageApi.warning('ユーザーIDが見つかりません。LINEリマインダーが機能しない可能性があります。');
        }
        await updateSession(sessionId, {
          nextSessionDate: startDateTime.toISOString(),
          nextSessionDurationMinutes: duration,
          lineReminderScheduled: false,
          lineReminderSentAt: undefined,
          ...(userId ? { userId } : {})
        });
        console.log('Session updated with next session data', { userId });
      } catch (dbError: unknown) {
        console.error('Failed to update session with next session data:', dbError);
        // Don't fail the whole operation, just warn the user
        messageApi.warning('Googleカレンダーに追加しましたが、LINEリマインダーの設定に失敗しました。後で設定ページから再度試してください。');
      }

      setSuccess(true);
      messageApi.success('次回の1on1セッションをGoogleカレンダーに追加しました');

      if (onScheduled) {
        onScheduled();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Failed to schedule next meeting:', err);
      setError(errorMessage);
      messageApi.error(`スケジュール作成に失敗しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const durationOptions = [
    { label: '30分', value: 30 },
    { label: '45分', value: 45 },
    { label: '60分', value: 60 },
    { label: '90分', value: 90 },
  ];

  if (success) {
    return (
      <Card
        title="次回の1on1セッションをスケジュール"
        style={{ marginBottom: 24 }}
        bordered={false}
      >
        {contextHolder}
        <Alert
          message="スケジュール作成完了"
          description="Googleカレンダーに次回の1on1セッションを追加しました。"
          type="success"
          showIcon
        />
        <div style={{ marginTop: 16 }}>
          <Button onClick={() => setSuccess(false)}>
            新しいスケジュールを作成
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="次回の1on1セッションをスケジュール"
      style={{ marginBottom: 24 }}
      bordered={false}
    >
      {contextHolder}
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Text strong>日付</Text>
          <DatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            style={{ width: '100%', marginTop: 8 }}
            disabledDate={(current) => current && current < dayjs().startOf('day')}
            placeholder="日付を選択"
          />
        </div>

        <div>
          <Text strong>時間</Text>
          <TimePicker
            value={selectedTime}
            onChange={setSelectedTime}
            style={{ width: '100%', marginTop: 8 }}
            format="HH:mm"
            minuteStep={5}
            placeholder="時間を選択"
          />
        </div>

        <div>
          <Text strong>所要時間</Text>
          <Select
            value={duration}
            onChange={setDuration}
            style={{ width: '100%', marginTop: 8 }}
          >
            {durationOptions.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </div>

        {error && (
          <Alert
            message="エラー"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
          />
        )}

        <Flex justify="space-between" align="center">
          <Text type="secondary">
            {isGoogleAuth
              ? 'Googleカレンダー連携が有効です。イベントが自動的に作成されます。'
              : 'Googleカレンダー連携が必要です。設定ページからGoogleでサインインしてください。'}
          </Text>
          {isGoogleAuth ? (
            <Button
              type="primary"
              icon={<CalendarOutlined />}
              onClick={handleSchedule}
              loading={loading}
              disabled={!selectedDate || !selectedTime}
            >
              カレンダーに追加
            </Button>
          ) : (
            <Alert
              message="Googleカレンダー連携が必要です"
              description="設定ページからGoogleでサインインしてください。"
              type="warning"
              showIcon
              style={{ flex: 1 }}
            />
          )}
        </Flex>
      </Space>
    </Card>
  );
};

export default ScheduleNextMeetingSection;