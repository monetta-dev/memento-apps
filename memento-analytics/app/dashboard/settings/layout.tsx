'use client';

import React from 'react';
import { Menu } from 'antd';
import { TagOutlined, UserOutlined, SettingOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SettingsLayout = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname();

    const items = [
        { key: '/dashboard/settings', icon: <SettingOutlined />, label: <Link href="/dashboard/settings">一般設定</Link> },
        { key: '/dashboard/settings/tags', icon: <TagOutlined />, label: <Link href="/dashboard/settings/tags">タグ管理</Link> },
        { key: '/dashboard/settings/users', icon: <UserOutlined />, label: <Link href="/dashboard/settings/users">ユーザー管理</Link> },
    ];

    return (
        <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ width: 250, flexShrink: 0 }}>
                <div className="wafu-card" style={{ borderRadius: 8, overflow: 'hidden' }}>
                    <Menu
                        mode="inline"
                        selectedKeys={[pathname]}
                        items={items}
                        style={{ borderRight: 0 }}
                    />
                </div>
            </div>
            <div style={{ flex: 1 }}>
                {children}
            </div>
        </div>
    );
};

export default SettingsLayout;
