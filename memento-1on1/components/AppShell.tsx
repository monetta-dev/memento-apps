'use client';

import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  UserOutlined,
  VideoCameraOutlined,
  TeamOutlined,
  SettingOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  BookOutlined,
  LogoutOutlined,
  GoogleOutlined,
} from '@ant-design/icons';
import { createClientComponentClient } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';

const { Header, Sider, Content } = Layout;

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          setIsGoogleAuth(!!session.provider_token);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Determine selected key based on path
  const getSelectedKey = () => {
    if (pathname.startsWith('/session')) return 'session'; // Though usually hidden or different layout
    if (pathname.startsWith('/crm')) return 'crm';
    if (pathname.startsWith('/guide')) return 'guide';
    if (pathname.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  const items = [
    {
      key: 'dashboard',
      icon: <VideoCameraOutlined />,
      label: 'ダッシュボード',
      onClick: () => router.push('/'),
    },
    {
      key: 'crm',
      icon: <TeamOutlined />,
      label: '部下管理',
      onClick: () => router.push('/crm'),
    },
    {
      key: 'guide',
      icon: <BookOutlined />,
      label: 'ガイド',
      onClick: () => router.push('/guide'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '設定',
      onClick: () => router.push('/settings'),
    },
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'email',
      label: user?.email || '',
      icon: <UserOutlined />,
      disabled: true,
      style: { color: 'rgba(0, 0, 0, 0.88)', cursor: 'default' }
    },
    {
      key: 'logout',
      label: 'ログアウト',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout
    }
  ];

  // If in session, maybe we don't want the sidebar? 
  // The requirement implies a web app, usually session is full screen or focused.
  // But for now, I'll keep it consistent or simple.
  const isSession = pathname.startsWith('/session');

  if (isSession) {
    return <>{children}</>;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} style={{ background: '#fff' }}>
        <div style={{ height: 32, margin: 16, background: 'rgba(0, 0, 0, 0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!collapsed && <span style={{ fontWeight: 'bold', color: '#333' }}>Memento 1on1</span>}
          {collapsed && <span style={{ fontWeight: 'bold', color: '#333' }}>M</span>}
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={['dashboard']}
          selectedKeys={[getSelectedKey()]}
          items={items}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'all 0.2s' }} className="hover:bg-gray-100">
                <span style={{ fontWeight: 500 }}>
                  {loading ? '読み込み中...' : (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'ユーザー')}
                </span>
                <Avatar src={user?.user_metadata?.avatar_url} icon={!user?.user_metadata?.avatar_url && <UserOutlined />} />
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: '#fff',
            borderRadius: 8,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppShell;
