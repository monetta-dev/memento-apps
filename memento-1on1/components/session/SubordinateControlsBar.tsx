'use client';

import React from 'react';
import { Button, Flex } from 'antd';
import {
  AudioOutlined,
  AudioMutedOutlined,
  VideoCameraOutlined,
  PartitionOutlined,
} from '@ant-design/icons';

interface SubordinateControlsBarProps {
  micOn: boolean;
  setMicOn: (micOn: boolean) => void;
  isMindMapMode: boolean;
  setIsMindMapMode: (isMindMapMode: boolean) => void;
  onLeaveSession?: () => void;
}

const SubordinateControlsBar: React.FC<SubordinateControlsBarProps> = ({
  micOn,
  setMicOn,
  isMindMapMode,
  setIsMindMapMode,
  onLeaveSession,
}) => {
  return (
    <Flex 
      justify="center" 
      align="center" 
      gap={24}
      style={{ 
        height: 60, 
        background: '#1f1f1f',
        padding: '0 24px'
      }}
      data-testid="subordinate-controls-bar"
    >
      <Button
        shape="circle"
        icon={micOn ? <AudioOutlined /> : <AudioMutedOutlined />}
        type={micOn ? 'default' : 'primary'}
        danger={!micOn}
        onClick={() => setMicOn(!micOn)}
        data-testid="mic-toggle-button"
      />

      <Button
        type="default"
        shape="round"
        icon={isMindMapMode ? <VideoCameraOutlined /> : <PartitionOutlined />}
        onClick={() => setIsMindMapMode(!isMindMapMode)}
        data-testid="mindmap-toggle-button"
      >
         {isMindMapMode ? 'ビデオに切り替え' : 'マインドマップに切り替え'}
      </Button>

      {onLeaveSession && (
        <Button
          type="primary"
          shape="round"
          danger
          onClick={onLeaveSession}
          data-testid="leave-session-button"
        >
           セッション退出
        </Button>
      )}
    </Flex>
  );
};

export default SubordinateControlsBar;