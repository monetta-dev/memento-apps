'use client';

import React from 'react';
import { Alert } from 'antd';
import { BulbOutlined } from '@ant-design/icons';

interface AdvicePanelProps {
  realTimeAdvice: string;
}

const AdvicePanel: React.FC<AdvicePanelProps> = ({ realTimeAdvice }) => {
  return (
    <Alert
       message="リアルタイムアドバイス"
      description={realTimeAdvice}
      type="info"
      showIcon
      icon={<BulbOutlined style={{ color: '#1890ff' }} />}
      style={{ 
        border: '1px solid #91caff', 
        background: '#e6f7ff', 
        flexShrink: 0 
      }}
    />
  );
};

export default AdvicePanel;