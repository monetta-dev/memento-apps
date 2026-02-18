'use client';

import React from 'react';
import { Alert } from 'antd';
import { BulbOutlined } from '@ant-design/icons';

interface AdvicePanelProps {
  realTimeAdvice: string;
  adviceHistory: string[];
}

const AdvicePanel: React.FC<AdvicePanelProps> = ({ realTimeAdvice, adviceHistory }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [adviceHistory, realTimeAdvice]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#f0f2f5',
      borderRadius: '8px',
      border: '1px solid #d9d9d9',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        fontWeight: 'bold',
        color: '#595959',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0
      }}>
        <BulbOutlined style={{ color: '#faad14' }} />
        AIお地蔵さんのアドバイス履歴
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {adviceHistory.length === 0 && (
          <div style={{ textAlign: 'center', color: '#bfbfbf', marginTop: '20px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: '#e6f7ff',
              margin: '0 auto 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/jizo.png" alt="Silent Jizo" style={{ width: '40px', height: '40px', objectFit: 'cover', opacity: 0.5 }} />
            </div>
            まだアドバイスはありません...<br />
            お地蔵さんが見守っています
          </div>
        )}

        {adviceHistory.map((advice, index) => (
          <div key={index} style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <div style={{
              flexShrink: 0,
              width: '40px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#fff',
                border: '1px solid #1890ff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/jizo.png"
                  alt="AI Jizo"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>

            <div style={{
              position: 'relative',
              background: '#fff',
              padding: '10px 14px',
              borderRadius: '12px',
              borderTopLeftRadius: '2px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              flex: 1,
              maxWidth: '85%'
            }}>
              <div style={{ color: '#262626', lineHeight: '1.5', fontSize: '14px' }}>
                {advice}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdvicePanel;