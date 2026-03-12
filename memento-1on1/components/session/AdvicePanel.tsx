'use client';

import React from 'react';
import { BulbOutlined } from '@ant-design/icons';

interface AdvicePanelProps {
  realTimeAdvice: string;
  adviceHistory: string[];
  isLarge?: boolean;
}

const AdvicePanel: React.FC<AdvicePanelProps> = ({ realTimeAdvice, isLarge = false }) => {
  const headerFontSize = isLarge ? '28px' : '20px';
  const iconSize = isLarge ? '32px' : '24px';
  const adviceFontSize = isLarge ? '52px' : '32px';
  const avatarWidth = isLarge ? '300px' : '200px';
  const waitingFontSize = isLarge ? '36px' : '24px';

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
        padding: isLarge ? '20px 24px' : '14px 18px',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        fontWeight: 'bold',
        fontSize: headerFontSize,
        color: '#595959',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
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
        padding: isLarge ? '40px' : '28px',
      }}>
        {!hasAdvice ? (
          /* 待機中 */
          <div style={{ textAlign: 'center', color: '#bfbfbf', fontSize: waitingFontSize }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/jizo.png"
              alt="Silent Jizo"
              style={{
                width: avatarWidth,
                objectFit: 'contain',
                opacity: 0.5,
                display: 'block',
                margin: '0 auto 24px',
              }}
            />
            まだアドバイスはありません...<br />
            お地蔵さんが見守っています
          </div>
        ) : (
          /* 地蔵（左）＋吹き出し（右）の横並びレイアウト */
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: isLarge ? '24px' : '16px',
            width: '100%',
            height: '100%',
          }}>
            {/* 左：地蔵（縦長・自然表示） */}
            <div style={{
              width: avatarWidth,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/jizo.png"
                alt="AI Jizo"
                style={{
                  width: '100%',
                  objectFit: 'contain',
                  maxHeight: isLarge ? '680px' : '420px',
                }}
              />
            </div>

            {/* 右：吹き出し */}
            <div style={{ position: 'relative', flex: 1 }}>
              {/* 吹き出しの三角（左向き） */}
              <div style={{
                position: 'absolute',
                left: '-16px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: 0,
                height: 0,
                borderTop: '16px solid transparent',
                borderBottom: '16px solid transparent',
                borderRight: '16px solid #fff',
                filter: 'drop-shadow(-2px 0 2px rgba(0,0,0,0.06))',
              }} />
              <div style={{
                background: '#fff',
                padding: isLarge ? '36px 44px' : '24px 28px',
                borderRadius: '16px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                fontSize: adviceFontSize,
                color: '#262626',
                lineHeight: '1.7',
                textAlign: 'left',
              }}>
                {realTimeAdvice}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvicePanel;