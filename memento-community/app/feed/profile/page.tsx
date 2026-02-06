'use client';

import React from 'react';
import { Avatar, Button, Tabs, Card, Tag, Row, Col, Statistic } from 'antd';
import { UserOutlined, SettingOutlined, TrophyOutlined, FireOutlined, TeamOutlined } from '@ant-design/icons';

const ProfilePage = () => {
    const items = [
        {
            key: '1',
            label: '投稿',
            children: (
                <div style={{ padding: '16px 0' }}>
                    <Card bordered={false} hoverable style={{ marginBottom: 16 }} className="wafu-card">
                        <p style={{ fontSize: '1.1rem', marginBottom: 12 }}>リモート1on1を効果的に実施するためのガイドを公開しました。</p>
                        <Tag>#RemoteWork</Tag> <Tag>#Management</Tag>
                        <div style={{ marginTop: 12, color: '#888', fontSize: '0.9rem' }}>2日前 • 15 いいね</div>
                    </Card>
                    <Card bordered={false} hoverable className="wafu-card">
                        <p style={{ fontSize: '1.1rem', marginBottom: 12 }}>質問: 1on1での昇給交渉リクエストにはどう対応していますか？</p>
                        <Tag>#Compensation</Tag> <Tag>#Advice</Tag>
                        <div style={{ marginTop: 12, color: '#888', fontSize: '0.9rem' }}>5日前 • 32 コメント</div>
                    </Card>
                </div>
            ),
        },
        {
            key: '2',
            label: 'メンション',
            children: <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>メンションはまだありません。</div>,
        },
        {
            key: '3',
            label: '保存済み',
            children: <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>保存された投稿はありません。</div>,
        },
    ];

    return (
        <div>
            <div className="wafu-card" style={{ padding: 24, borderRadius: 8, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 24 }}>
                        <Avatar size={100} icon={<UserOutlined />} style={{ backgroundColor: '#223a70' }} />
                        <div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: 4 }}>管理者ユーザー</h2>
                            <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: 16 }}>エンジニアリングマネージャー @ Memento</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Tag icon={<TrophyOutlined />} color="gold">トップ貢献者</Tag>
                                <Tag icon={<FireOutlined />} color="volcano">5日連続</Tag>
                            </div>
                        </div>
                    </div>
                    <Button icon={<SettingOutlined />}>プロフィール編集</Button>
                </div>

                <Row gutter={24} style={{ marginTop: 32, textAlign: 'center' }}>
                    <Col span={8}>
                        <Statistic title="投稿数" value={12} />
                    </Col>
                    <Col span={8}>
                        <Statistic title="フォロー中" value={45} />
                    </Col>
                    <Col span={8}>
                        <Statistic title="フォロワー" value={128} />
                    </Col>
                </Row>
            </div>

            <Tabs defaultActiveKey="1" items={items} />
        </div>
    );
};

export default ProfilePage;
