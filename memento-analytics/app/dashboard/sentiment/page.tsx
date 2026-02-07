'use client';

import React from 'react';
import { Row, Col, Statistic, Table, Tag, Select } from 'antd';
import { SmileOutlined } from '@ant-design/icons';

const SentimentPage = () => {
    // Mock Data (Users with tags instead of Department)
    const userData = [
        { key: '1', name: '佐藤 健太', score: 6.8, trend: 'down', tags: ['開発チーム', 'リーダー'] },
        { key: '2', name: '鈴木 花子', score: 7.5, trend: 'up', tags: ['営業部', '新卒2024'] },
        { key: '3', name: '田中 一郎', score: 7.1, trend: 'flat', tags: ['マーケティング'] },
        { key: '4', name: '高橋 優子', score: 5.5, trend: 'down', tags: ['開発チーム', '新卒2024'] },
    ];

    const columns = [
        { title: '氏名', dataIndex: 'name', key: 'name', render: (text: string) => <b>{text}</b> },
        {
            title: 'タグ', dataIndex: 'tags', key: 'tags', render: (tags: string[]) => (
                <>
                    {tags.map(tag => {
                        let color = tag === '新卒2024' ? 'green' : 'geekblue';
                        return <Tag color={color} key={tag}>{tag}</Tag>;
                    })}
                </>
            )
        },
        {
            title: '平均満足度', dataIndex: 'score', key: 'score', render: (score: number) => (
                <span style={{ color: score < 7 ? '#cf1322' : '#223a70', fontWeight: 'bold' }}>{score}</span>
            )
        },
        {
            title: '推移', dataIndex: 'trend', key: 'trend', render: (trend: string) => (
                trend === 'down' ? <Tag color="error">低下</Tag> : <Tag color="success">安定</Tag>
            )
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 className="brush-border-bottom" style={{ fontSize: '1.5rem', fontWeight: 600 }}>社員感情分析</h2>
                <Select defaultValue="all" style={{ width: 150 }} options={[
                    { label: '全てのタグ', value: 'all' },
                    { label: '新卒2024', value: 'new_grad' },
                    { label: '開発チーム', value: 'eng' }
                ]} />
            </div>

            <Row gutter={24} style={{ marginBottom: 24 }}>
                <Col span={12}>
                    <div className="wafu-card" style={{ padding: 24, borderRadius: 8 }}>
                        <Statistic title="全社平均" value={7.1} prefix={<SmileOutlined />} valueStyle={{ color: '#223a70' }} />
                        <p style={{ marginTop: 8, color: '#666' }}>昨月比 -0.2ポイント</p>
                    </div>
                </Col>
                <Col span={12}>
                    <div className="wafu-card" style={{ padding: 24, borderRadius: 8 }}>
                        <h4 style={{ marginBottom: 16, fontWeight: 600 }}>分布 (タグ別平均)</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>営業部</span> <span>7.5</span></div>
                            <div style={{ width: '100%', background: '#eee', height: 6 }}><div style={{ width: '75%', background: '#3f8600', height: '100%' }}></div></div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>開発チーム</span> <span>6.4</span></div>
                            <div style={{ width: '100%', background: '#eee', height: 6 }}><div style={{ width: '64%', background: '#faad14', height: '100%' }}></div></div>
                        </div>
                    </div>
                </Col>
            </Row>

            <div className="wafu-card" style={{ borderRadius: 8 }}>
                <Table dataSource={userData} columns={columns} pagination={false} />
            </div>
        </div>
    );
};

export default SentimentPage;
