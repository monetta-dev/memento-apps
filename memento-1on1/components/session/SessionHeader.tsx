'use client';

import React from 'react';
import { Layout, Typography, Tag, Flex, Space, Button } from 'antd';
import { LinkOutlined } from '@ant-design/icons';

const { Header } = Layout;
const { Title, Text } = Typography;

interface Subordinate {
  id: string;
  name: string;
}

interface SessionData {
  id: string;
  theme: string;
  mode: 'web' | 'face-to-face';
  subordinateId: string;
}

interface SessionHeaderProps {
  subordinate?: Subordinate;
  sessionData?: SessionData;
  isSubordinateView?: boolean;
  onCopyInviteLink?: () => void;
}

const SessionHeader: React.FC<SessionHeaderProps> = ({ 
  subordinate, 
  sessionData, 
  isSubordinateView = false,
  onCopyInviteLink 
}) => {
  return (
    <Header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 24px' }}>
      <Flex justify="space-between" align="center">
        <Space size={16} align="center">
          <Title level={4} style={{ margin: 0 }}>
             {isSubordinateView ? '1on1セッション (参加者)' : `${subordinate?.name || '部下'}との1on1`}
          </Title>
          <Tag color="blue">{sessionData?.theme}</Tag>
          <Tag color={sessionData?.mode === 'web' ? 'cyan' : 'green'}>
             {sessionData?.mode === 'web' ? 'Web会議モード' : '対面モード'}
          </Tag>
           {isSubordinateView && <Tag color="orange">部下ビュー</Tag>}
        </Space>
        <Space size={16} align="center">
           {!isSubordinateView && onCopyInviteLink && sessionData?.mode !== 'face-to-face' && (
             <Button 
               type="default" 
               size="small" 
               icon={<LinkOutlined />}
               onClick={onCopyInviteLink}
             >
                招待リンクをコピー
             </Button>
           )}
          <Text type="secondary">{new Date().toDateString()}</Text>
        </Space>
      </Flex>
    </Header>
  );
};

export default SessionHeader;