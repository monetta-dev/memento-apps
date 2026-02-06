'use client';

import React, { useState } from 'react';
import { Layout, Menu, theme, Avatar, Dropdown } from 'antd';
import {
    DashboardOutlined,
    UserOutlined,
    TeamOutlined,
    BarChartOutlined,
    SettingOutlined,
    LogoutOutlined,
    BuildOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const { Header, Content, Sider } = Layout;

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
    const [collapsed, setCollapsed] = useState(false);
    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();
    const pathname = usePathname();

    const items = [
        {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: <Link href="/dashboard">ホーム</Link>,
        },
        {
            key: '/dashboard/sentiment',
            icon: <BarChartOutlined />,
            label: <Link href="/dashboard/sentiment">感情分析</Link>,
        },
        {
            key: '/dashboard/turnover',
            icon: <TeamOutlined />,
            label: <Link href="/dashboard/turnover">離職リスク</Link>,
        },
        {
            key: '/dashboard/settings',
            icon: <SettingOutlined />,
            label: <Link href="/dashboard/settings">設定</Link>,
        },
    ];

    const userMenu = {
        items: [
            {
                key: 'profile',
                label: 'プロフィール',
                icon: <UserOutlined />,
            },
            {
                key: 'logout',
                label: 'ログアウト',
                icon: <LogoutOutlined />,
                danger: true,
            },
        ],
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
                <div style={{ height: 32, margin: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                    {collapsed ? <BuildOutlined /> : 'Memento Analytics'}
                </div>
                <Menu theme="dark" defaultSelectedKeys={['/dashboard']} selectedKeys={[pathname]} mode="inline" items={items} />
            </Sider>
            <Layout>
                <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>管理ダッシュボード</h2>
                    <Dropdown menu={userMenu}>
                        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar icon={<UserOutlined />} />
                            <span>Admin User</span>
                        </div>
                    </Dropdown>
                </Header>
                <Content style={{ margin: '16px' }}>
                    <div
                        style={{
                            padding: 24,
                            minHeight: 360,
                            background: colorBgContainer,
                            borderRadius: borderRadiusLG,
                        }}
                    >
                        {children}
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default DashboardLayout;
