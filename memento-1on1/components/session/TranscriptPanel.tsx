'use client';

import React from 'react';
import { Typography, Flex, Card } from 'antd';
import { MessageOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface TranscriptMessage {
  speaker: 'manager' | 'subordinate' | string;
  text: string;
  time: string;
}

interface TranscriptPanelProps {
  messages: TranscriptMessage[];
  logEndRef: React.RefObject<HTMLDivElement | null>;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ messages, logEndRef }) => {
  return (
    <Card
      title={
        <span>
           <MessageOutlined /> ライブ文字起こし
        </span>
      }
      size="small"
      variant="outlined"
      style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column'
      }}
      styles={{
        body: { 
          flex: 1, 
          minHeight: 0, 
          padding: '8px',
          overflowY: 'auto'
        }
      }}
    >
      {messages.length > 0 ? (
        messages.map((msg, idx) => (
          <Flex
            key={idx}
            vertical
            align={msg.speaker === 'manager' ? 'flex-end' : 'flex-start'}
            style={{ marginBottom: 12 }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 12,
                background: msg.speaker === 'manager' ? '#1890ff' : '#f0f0f0',
                color: msg.speaker === 'manager' ? '#fff' : '#000',
                fontSize: 14,
              }}
            >
              {msg.text}
            </div>
            <Text type="secondary" style={{ fontSize: 10, marginTop: 4 }}>
              {msg.time}
            </Text>
          </Flex>
        ))
      ) : (
        <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
           会話を待機中...（マイクに向かって話してください）
        </div>
      )}
      <div ref={logEndRef} />
    </Card>
  );
};

export default TranscriptPanel;