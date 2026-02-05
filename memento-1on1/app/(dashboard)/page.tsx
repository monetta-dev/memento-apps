'use client';

import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Tag, Modal, Form, Select, Input, Radio, DatePicker } from 'antd';
import { PlusOutlined, VideoCameraOutlined, UserOutlined } from '@ant-design/icons';
import { useStore, Session } from '@/store/useStore';
import { createClientComponentClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { THEME_OPTIONS, OTHER_THEME_VALUE } from '@/lib/constants';

const { Title } = Typography;
const { Option } = Select;

export default function Dashboard() {
  const router = useRouter();
  const { subordinates, sessions, addSession, fetchSubordinates, fetchSessions, setUserId } = useStore();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [form] = Form.useForm();

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const supabase = createClientComponentClient();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (userId) {
        setUserId(userId);
        console.log('User ID set:', userId);
      } else {
        console.warn('No authenticated user found');
      }

      // Fetch data after setting user ID
      await fetchSubordinates();
      await fetchSessions();
    };

    checkAuthAndFetch();
  }, [fetchSubordinates, fetchSessions, setUserId]);

  const handleStart = () => {
    setSelectedTheme('');
    setIsModalVisible(true);
  };

  const handleOk = () => {
    form.validateFields().then(async (values) => {
      const supabase = createClientComponentClient();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        console.warn('User ID not found, creating session without user association');
      }

      const startDate = values.sessionDateTime.toDate();

      // Determine theme label
      let themeLabel = values.theme;
      if (values.theme === OTHER_THEME_VALUE) {
        themeLabel = values.customTheme;
      } else {
        const selectedOption = THEME_OPTIONS.find(opt => opt.value === values.theme);
        themeLabel = selectedOption?.label || values.theme;
      }

      const sessionId = await addSession({
        subordinateId: values.subordinateId,
        date: startDate.toISOString(),
        mode: values.mode,
        theme: themeLabel,
      }, userId);

      if (sessionId) {
        setIsModalVisible(false);
        setSelectedTheme('');
        router.push(`/session/${sessionId}`);
      }
    });
  };

  const columns = [
    {
      title: '部下',
      dataIndex: 'subordinateId',
      key: 'subordinateId',
      filters: subordinates.map(s => ({ text: s.name, value: s.id })),
      onFilter: (value: any, record: Session) => record.subordinateId === value, // eslint-disable-line @typescript-eslint/no-explicit-any
      render: (id: string) => subordinates.find((s) => s.id === id)?.name || 'Unknown',
    },
    {
      title: '日付',
      dataIndex: 'date',
      key: 'date',
      sorter: (a: Session, b: Session) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      render: (text: string) => new Date(text).toLocaleDateString(),
    },
    {
      title: 'モード',
      dataIndex: 'mode',
      key: 'mode',
      filters: [
        { text: 'Web会議', value: 'web' },
        { text: '対面', value: 'face-to-face' },
      ],
      onFilter: (value: any, record: Session) => record.mode === value, // eslint-disable-line @typescript-eslint/no-explicit-any
      render: (mode: string) => (
        mode === 'web' ? <Tag icon={<VideoCameraOutlined />} color="blue">Web会議</Tag> : <Tag icon={<UserOutlined />} color="green">対面</Tag>
      ),
    },
    {
      title: 'テーマ',
      dataIndex: 'theme',
      key: 'theme',
      sorter: (a: Session, b: Session) => a.theme.localeCompare(b.theme),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm }: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
        <div style={{ padding: 8 }}>
          <Input
            placeholder="テーマを検索"
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Button
            type="primary"
            onClick={() => confirm()}
            size="small"
            style={{ width: 90 }}
          >
            検索
          </Button>
        </div>
      ),
      onFilter: (value: any, record: Session) => record.theme.toLowerCase().includes(value.toLowerCase()), // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      sorter: (a: Session, b: Session) => a.status.localeCompare(b.status),
      filters: [
        { text: 'Scheduled', value: 'scheduled' },
        { text: 'Live', value: 'live' },
        { text: 'Completed', value: 'completed' },
      ],
      onFilter: (value: any, record: Session) => record.status === value, // eslint-disable-line @typescript-eslint/no-explicit-any
      render: (status: string) => (
        <Tag color={status === 'completed' ? 'default' : 'processing'}>{status.toUpperCase()}</Tag>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>ダッシュボード</Title>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleStart}>
          1on1を開始
        </Button>
      </div>

      <Card title="最近のセッション" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={sessions}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          onRow={(record) => ({
            onClick: () => router.push(`/session/${record.id}/summary`),
            onKeyDown: (e) => e.key === 'Enter' && router.push(`/session/${record.id}/summary`),
            role: 'button',
            tabIndex: 0,
            'aria-label': `View details for session with theme: ${record.theme}`,
            style: { cursor: 'pointer' }
          })}
          rowClassName={() => 'session-table-row'}
        />
      </Card>

      <Modal
        title="新しい1on1セッションを開始"
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => { setIsModalVisible(false); setSelectedTheme(''); }}
        okText="セッション開始"
      >
        <Form form={form} layout="vertical" initialValues={{ mode: 'web', sessionDateTime: dayjs().add(1, 'hour'), duration: 1 }}>
          <Form.Item
            name="subordinateId"
            label="部下"
            rules={[{ required: true, message: '部下を選択してください' }]}
          >
            <Select placeholder="部下を選択" id="subordinateId">
              {subordinates.map((sub) => (
                <Option key={sub.id} value={sub.id}>{sub.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="mode"
            label="モード"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              <Radio.Button value="web"><VideoCameraOutlined /> Web会議</Radio.Button>
              <Radio.Button value="face-to-face"><UserOutlined /> 対面</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="theme"
            label="テーマ / トピック"
            rules={[{ required: true, message: 'テーマを選択してください' }]}
          >
            <Select
              placeholder="テーマを選択"
              onChange={(value) => setSelectedTheme(value)}
              options={THEME_OPTIONS}
            />
          </Form.Item>

          {selectedTheme === OTHER_THEME_VALUE && (
            <Form.Item
              name="customTheme"
              label="カスタムテーマ"
              rules={[{ required: true, message: 'カスタムテーマを入力してください' }]}
            >
              <Input placeholder="カスタムテーマを入力" />
            </Form.Item>
          )}

          <Form.Item
            name="sessionDateTime"
            label="セッション日時"
            rules={[{ required: true, message: '日時を選択してください' }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              placeholder="日時を選択"
            />
          </Form.Item>

          <Form.Item
            name="duration"
            label="所要時間 (時間)"
          >
            <Input type="number" min={0.5} max={8} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
