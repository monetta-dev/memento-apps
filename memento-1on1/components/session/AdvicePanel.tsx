'use client';

import React from 'react';
import { Alert } from 'antd';
import { BulbOutlined } from '@ant-design/icons';

interface AdvicePanelProps {
  realTimeAdvice: string;
  adviceHistory: string[];
  isLarge?: boolean;
}

const AdvicePanel: React.FC<AdvicePanelProps> = ({ realTimeAdvice, adviceHistory, isLarge = false }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [adviceHistory, realTimeAdvice]);

  // Dynamic styles based on isLarge
  const avatarSize = isLarge ? '80px' : '40px';
  const fontSize = isLarge ? '28px' : '14px';
  const bubblePadding = isLarge ? '24px 32px' : '10px 14px';
  const gapSize = isLarge ? '24px' : '12px';
  const headerFontSize = isLarge ? '20px' : '14px';
  const iconSize = isLarge ? '24px' : '14px';

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
        padding: isLarge ? '20px 24px' : '12px 16px',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        fontWeight: 'bold',
        fontSize: headerFontSize,
        color: '#595959',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0
      }}>
        <BulbOutlined style={{ color: '#faad14', fontSize: iconSize }} />
        AIお地蔵さんのアドバイス履歴
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isLarge ? '32px' : '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: isLarge ? '32px' : '16px'
        }}
      >
        {adviceHistory.length === 0 && (
          <div style={{ textAlign: 'center', color: '#bfbfbf', marginTop: '20px', fontSize: isLarge ? '24px' : '14px' }}>
            <div style={{
              width: isLarge ? '120px' : '60px',
              height: isLarge ? '120px' : '60px',
              borderRadius: '50%',
              background: '#e6f7ff',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/jizo.png" alt="Silent Jizo" style={{ width: isLarge ? '80px' : '40px', height: isLarge ? '80px' : '40px', objectFit: 'cover', opacity: 0.5 }} />
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
            gap: gapSize
          }}>
            <div style={{
              flexShrink: 0,
              width: avatarSize,
              textAlign: 'center'
            }}>
              <div style={{
                width: avatarSize,
                height: avatarSize,
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
              padding: bubblePadding,
              borderRadius: '12px',
              borderTopLeftRadius: '2px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              flex: 1,
              maxWidth: '85%'
            }}>
              <div style={{ color: '#262626', lineHeight: '1.5', fontSize: fontSize }}>
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