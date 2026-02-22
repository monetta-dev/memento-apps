'use client';

import React from 'react';
import { BulbOutlined } from '@ant-design/icons';

interface AdvicePanelProps {
  realTimeAdvice: string;
  adviceHistory: string[];
  isLarge?: boolean;
}

const AdvicePanel: React.FC<AdvicePanelProps> = ({ realTimeAdvice, isLarge = false }) => {
  const headerFontSize = isLarge ? '20px' : '14px';
  const iconSize = isLarge ? '24px' : '14px';
  const adviceFontSize = isLarge ? '28px' : '16px';
  const avatarSize = isLarge ? '120px' : '60px';

  const hasAdvice = realTimeAdvice && realTimeAdvice.trim().length > 0;

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
        AIお地蔵さんのアドバイス
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isLarge ? '40px' : '24px',
      }}>
        {!hasAdvice ? (
          /* 待機中 */
          <div style={{ textAlign: 'center', color: '#bfbfbf', fontSize: isLarge ? '24px' : '14px' }}>
            <div style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: '50%',
              background: '#e6f7ff',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/jizo.png"
                alt="Silent Jizo"
                style={{ width: '70%', height: '70%', objectFit: 'cover', opacity: 0.5 }}
              />
            </div>
            まだアドバイスはありません...<br />
            お地蔵さんが見守っています
          </div>
        ) : (
          /* 現在のアドバイスを大きく表示 */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: isLarge ? '32px' : '20px',
            width: '100%',
          }}>
            <div style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: '50%',
              overflow: 'hidden',
              background: '#fff',
              border: '2px solid #1890ff',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexShrink: 0,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/jizo.png"
                alt="AI Jizo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{
              background: '#fff',
              padding: isLarge ? '32px 40px' : '16px 20px',
              borderRadius: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              fontSize: adviceFontSize,
              color: '#262626',
              lineHeight: '1.7',
              textAlign: 'center',
              width: '100%',
            }}>
              {realTimeAdvice}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvicePanel;