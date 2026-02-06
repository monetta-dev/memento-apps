'use client';

import React from 'react';
import { Row, Col, Statistic, Table, Tag } from 'antd';
import { SmileOutlined, DownOutlined } from '@ant-design/icons';

const SentimentPage = () => {
    // Mock Data
    const departmentData = [
        { key: '1', name: '開発部', score: 6.8, trend: 'down', employeeCount: 12 },
        { key: '2', name: '営業部', score: 7.5, trend: 'up', employeeCount: 8 },
        { key: '3', name: 'マーケティング', score: 7.1, trend: 'flat', employeeCount: 5 },
    ];

    const columns = [
        { title: '部門', dataIndex: 'name', key: 'name' },
        {
            title: '平均満足度', dataIndex: 'score', key: 'score', render: (score: number) => (
                <span style={{ color: score < 7 ? '#c9171e' : '#223a70', fontWeight: 'bold' }}>{score}</span>
            )
        },
        {
            title: '推移', dataIndex: 'trend', key: 'trend', render: (trend: string) => (
                trend === 'down' ? <Tag color="error">低下</Tag> : <Tag color="success">安定</Tag>
            )
        },
        { title: '人数', dataIndex: 'employeeCount', key: 'employeeCount' },
    ];

    return (
        <div>
            <h2 className="brush-border-bottom" style={{ fontSize: '1.5rem', fontWeight: 600 }}>社員感情分析</h2>

            <Row gutter={24} style={{ marginBottom: 24 }}>
                <Col span={12}>
                    <div className="wafu-card" style={{ padding: 24, borderRadius: 8 }}>
                        <Statistic title="全社平均" value={7.1} prefix={<SmileOutlined />} valueStyle={{ color: '#223a70' }} />
                        <p style={{ marginTop: 8, color: '#666' }}>先月 (7.3) よりわずかに低下しています。</p>
                    </div>
                </Col>
                <Col span={12}>
                    <div className="wafu-card" style={{ padding: 24, borderRadius: 8 }}>
                        <h4 style={{ marginBottom: 16, fontWeight: 600 }}>感情分布</h4>
                        {/* Mock Chart Visualization */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', height: 60, gap: 8 }}>
                            <div style={{ width: '20%', background: '#c9171e', height: '20%', borderRadius: '4px 4px 0 0' }}></div>
                            <div style={{ width: '20%', background: '#f5222d', height: '30%', borderRadius: '4px 4px 0 0' }}></div>
                            <div style={{ width: '20%', background: '#fa8c16', height: '50%', borderRadius: '4px 4px 0 0' }}></div>
                            <div style={{ width: '20%', background: '#a0d911', height: '80%', borderRadius: '4px 4px 0 0' }}></div>
                            <div style={{ width: '20%', background: '#223a70', height: '60%', borderRadius: '4px 4px 0 0' }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                            <span>低</span>
                            <span>高</span>
                        </div>
                    </div>
                </Col>
            </Row>

            <div className="wafu-card" style={{ borderRadius: 8 }}>
                <Table dataSource={departmentData} columns={columns} pagination={false} />
            </div>
        </div>
    );
};

export default SentimentPage;
