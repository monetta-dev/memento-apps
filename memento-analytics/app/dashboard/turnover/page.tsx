'use client';

import React from 'react';
import { Table, Tag, Button, Tooltip } from 'antd';
import { WarningOutlined, EyeOutlined } from '@ant-design/icons';

const TurnoverPage = () => {
    const riskData = [
        { key: '1', name: '佐藤 健太', dept: '開発部', risk: '高', reason: 'エンゲージメント低下, 1on1未実施' },
        { key: '2', name: '鈴木 花子', dept: '営業部', risk: '中', reason: '満足度の低下傾向' },
        { key: '3', name: '田中 一郎', dept: 'マーケティング', risk: '高', reason: '残業過多, フィードバックが否定的' },
    ];

    const columns = [
        { title: '氏名', dataIndex: 'name', key: 'name', render: (text: string) => <b>{text}</b> },
        { title: '部門', dataIndex: 'dept', key: 'dept' },
        {
            title: 'リスク度', dataIndex: 'risk', key: 'risk', render: (risk: string) => {
                let color = risk === '高' ? 'red' : 'orange';
                return <Tag color={color}>{risk}</Tag>;
            }
        },
        { title: '主な要因', dataIndex: 'reason', key: 'reason' },
        {
            title: '詳細', key: 'action', render: () => (
                <Tooltip title="詳細レポートを見る">
                    <Button type="text" icon={<EyeOutlined />} />
                </Tooltip>
            )
        },
    ];

    return (
        <div>
            <h2 className="brush-border-bottom" style={{ fontSize: '1.5rem', fontWeight: 600, color: '#c9171e' }}>
                <WarningOutlined style={{ marginRight: 8 }} />
                離職リスク診断
            </h2>

            <div className="wafu-card" style={{ padding: 24, borderRadius: 8, marginBottom: 24 }}>
                <p style={{ marginBottom: 16 }}>
                    AIモデルが1on1の頻度、感情の推移、エンゲージメント指標に基づいて、離職リスクのある社員を特定します。
                </p>
                <Table dataSource={riskData} columns={columns} />
            </div>
        </div>
    );
};

export default TurnoverPage;
