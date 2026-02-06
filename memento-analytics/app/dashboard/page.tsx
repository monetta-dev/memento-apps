'use client';

import React from 'react';
import { Card, Col, Row, Statistic } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, SmileOutlined, MehOutlined } from '@ant-design/icons';

const DashboardPage = () => {
    return (
        <div>
            <h1 style={{ marginBottom: 24, fontSize: '1.5rem', fontWeight: 600 }}>概要</h1>

            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={8}>
                    <Card bordered={false}>
                        <Statistic
                            title="平均社員満足度"
                            value={7.2}
                            precision={1}
                            valueStyle={{ color: '#3f8600' }}
                            prefix={<SmileOutlined />}
                            suffix="/ 10"
                        />
                        <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                            <ArrowUpOutlined style={{ color: '#3f8600' }} /> 先月比 +0.3
                        </div>
                    </Card>
                </Col>
                <Col span={8}>
                    <Card bordered={false}>
                        <Statistic
                            title="要注意社員数"
                            value={5}
                            valueStyle={{ color: '#cf1322' }}
                            prefix={<ArrowUpOutlined />}
                            suffix="人"
                        />
                        <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                            早急なフォローが必要です
                        </div>
                    </Card>
                </Col>
                <Col span={8}>
                    <Card bordered={false}>
                        <Statistic
                            title="1on1実施率"
                            value={88}
                            precision={1}
                            valueStyle={{ color: '#1890ff' }}
                            suffix="%"
                        />
                        <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                            高い水準を維持しています
                        </div>
                    </Card>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col span={12}>
                    <Card title="部門別内訳" bordered={false} style={{ minHeight: 300 }}>
                        <p style={{ color: '#ccc', textAlign: 'center', marginTop: 100 }}>グラフ表示エリア（プレースホルダー）</p>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card title="最新のアラート" bordered={false} style={{ minHeight: 300 }}>
                        <p>• <b>営業部</b>: 満足度が低下傾向にあります。</p>
                        <p>• <b>開発部</b>: 2名の社員に燃え尽き症候群の兆候が見られます。</p>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default DashboardPage;
