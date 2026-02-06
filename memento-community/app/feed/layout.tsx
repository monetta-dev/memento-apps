'use client';

import React from 'react';
import { Layout, Menu, Avatar, Input, Button } from 'antd';
import { UserOutlined, SearchOutlined, BellOutlined, FormOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Header, Content, Sider } = Layout;

const FeedLayout = ({ children }: { children: React.ReactNode }) => {
    const items = [
        { key: 'feed', label: <Link href="/feed">ホーム</Link> },
        { key: 'explore', label: <Link href="/feed/explore">見つける</Link> },
        { key: 'notifications', label: <Link href="/feed/notifications">通知</Link> }
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#722ed1' }}>Memento Community</div>
                    <Menu mode="horizontal" defaultSelectedKeys={['feed']} items={items} style={{ borderBottom: 'none', width: 300 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Input prefix={<SearchOutlined />} placeholder="トピックを検索..." style={{ width: 200 }} />
                    <Button type="primary" shape="round" icon={<FormOutlined />}>投稿する</Button>
                    <BellOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
                    <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
                </div>
            </Header>
            <Layout>
                <Content style={{ padding: '24px 0', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
                    <div style={{ display: 'flex', gap: 24 }}>
                        <div style={{ flex: 1 }}>
                            {children}
                        </div>
                        <div style={{ width: 300 }}>
                            {/* Right Sidebar Placeholder */}
                            <div style={{ background: '#fff', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                                <h4 style={{ fontWeight: 600, marginBottom: 12 }}>注目のトピック</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {['#Leadership', '#RemoteWork', '#Feedback', '#CareerGrowth'].map(tag => (
                                        <span key={tag} style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, fontSize: '0.85rem', color: '#666', cursor: 'pointer' }}>{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default FeedLayout;
