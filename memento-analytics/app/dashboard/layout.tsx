'use client';

import React, { useState, useEffect } from 'react';
import { Layout, Menu, theme, Avatar, Dropdown, Button } from 'antd';
import {
    DashboardOutlined,
    UserOutlined,
    BarChartOutlined,
    SettingOutlined,
    LogoutOutlined,
    MenuUnfoldOutlined,
    MenuFoldOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

const { Header, Content, Sider } = Layout;

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
    const { user, isLoading, signOut } = useAuth();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();
    const pathname = usePathname();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div className="ant-spin ant-spin-spinning">
                    <span className="ant-spin-dot-holder">
                        <i className="ant-spin-dot-item"></i>
                        <i className="ant-spin-dot-item"></i>
                        <i className="ant-spin-dot-item"></i>
                        <i className="ant-spin-dot-item"></i>
                    </span>
                </div>
            </div>
        );
    }

    if (!user) return null;

    const items = [
        {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: <Link href="/dashboard">ホーム</Link>,
        },
        {
            key: '/dashboard/analytics',
            icon: <BarChartOutlined />,
            label: '分析',
            children: [
                {
                    key: '/dashboard/analytics/trends',
                    label: <Link href="/dashboard/analytics/trends">トレンド</Link>,
                },
                {
                    key: '/dashboard/analytics/tags',
                    label: <Link href="/dashboard/analytics/tags">チーム比較</Link>,
                },
            ]
        },
        {
            key: '/dashboard/settings',
            icon: <SettingOutlined />,
            label: <Link href="/dashboard/settings">設定</Link>,
        },
    ];

    const handleLogout = async () => {
        try {
            await signOut();
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const userMenu = {
        items: [
            {
                key: 'profile',
                label: user?.email || 'ユーザー',
                icon: <UserOutlined />,
                disabled: true,
            },
            {
                key: 'logout',
                label: 'ログアウト',
                icon: <LogoutOutlined />,
                danger: true,
                onClick: handleLogout,
            },
        ],
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider trigger={null} collapsible collapsed={collapsed} style={{ background: '#fff' }}>
                <div style={{ height: 32, margin: 16, background: 'rgba(0, 0, 0, 0.05)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!collapsed && <span style={{ fontWeight: 'bold', color: '#333' }}>Memento Analytics</span>}
                    {collapsed && <span style={{ fontWeight: 'bold', color: '#333' }}>M</span>}
                </div>
                <Menu
                    mode="inline"
                    defaultSelectedKeys={['/dashboard']}
                    selectedKeys={[pathname]}
                    items={items}
                    style={{ borderRight: 0 }}
                />
            </Sider>
            <Layout>
                <Header style={{ padding: 0, background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Button
                            type="text"
                            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={() => setCollapsed(!collapsed)}
                            style={{
                                fontSize: '16px',
                                width: 64,
                                height: 64,
                            }}
                        />
                        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>管理ダッシュボード</h2>
                    </div>
                    <Dropdown menu={userMenu} placement="bottomRight" arrow>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'all 0.2s' }} className="hover:bg-gray-100">
                            <span style={{ fontWeight: 500 }}>
                                {isLoading ? '読み込み中...' : (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin User')}
                            </span>
                            <Avatar src={user?.user_metadata?.avatar_url} icon={<UserOutlined />} />
                        </div>
                    </Dropdown>
                </Header>
                <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: colorBgContainer, borderRadius: borderRadiusLG }}>
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
};

export default DashboardLayout;
