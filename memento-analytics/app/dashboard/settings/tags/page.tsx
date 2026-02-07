'use client';

import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Input, Modal, Space, Popconfirm, Select, message, Spin, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { createClientComponentClient } from '@/lib/supabase';

interface OrgTag {
    id: string;
    name: string;
    color: string;
    count?: number; // Optional: count of subordinates with this tag
}

const TagSettingsPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tags, setTags] = useState<OrgTag[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [userOrgId, setUserOrgId] = useState<string | null>(null);

    // Form state
    const [tagName, setTagName] = useState('');
    const [tagColor, setTagColor] = useState('geekblue');

    const supabase = createClientComponentClient();

    const fetchTags = async () => {
        setLoading(true);
        try {
            // 1. Get User's Organization if not set
            let orgId = userOrgId;
            if (!orgId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', user.id)
                    .single();

                if (profile?.organization_id) {
                    orgId = profile.organization_id;
                    setUserOrgId(orgId);
                } else {
                    setLoading(false);
                    return;
                }
            }

            // 2. Fetch Tags
            const { data, error } = await supabase
                .from('tags')
                .select('*')
                .eq('organization_id', orgId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            setTags(data || []);

        } catch (error) {
            console.error('Error fetching tags:', error);
            message.error('タグの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTags();
    }, []);

    const handleAdd = async () => {
        if (!tagName) {
            message.error('タグ名を入力してください');
            return;
        }
        if (!userOrgId) {
            message.error('組織情報が見つかりません');
            return;
        }

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('tags')
                .insert({
                    name: tagName,
                    color: tagColor,
                    organization_id: userOrgId
                });

            if (error) throw error;

            message.success('タグを作成しました');
            setIsModalOpen(false);
            setTagName('');
            setTagColor('geekblue');
            fetchTags();
        } catch (error: any) {
            console.error('Error adding tag:', error);
            message.error('タグの作成に失敗しました: ' + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from('tags')
                .delete()
                .eq('id', id);

            if (error) throw error;

            message.success('タグを削除しました');
            fetchTags();
        } catch (error: any) {
            console.error('Error deleting tag:', error);
            message.error('タグの削除に失敗しました: ' + error.message);
        }
    };

    const columns = [
        {
            title: 'タグ名', dataIndex: 'name', key: 'name', render: (text: string, record: OrgTag) => (
                <Tag color={record.color} style={{ fontSize: '1rem', padding: '4px 8px' }}>{text}</Tag>
            )
        },
        // Count implementation requires aggregation query which is complex for now. Omitting or keeping placeholder.
        // { title: '所属人数', dataIndex: 'count', key: 'count', render: (count: number) => `${count || 0} 名` },
        {
            title: '操作', key: 'action', render: (_: any, record: OrgTag) => (
                <Space>
                    {/* Edit to be implemented if needed */}
                    <Popconfirm title="本当に削除しますか？" onConfirm={() => handleDelete(record.id)}>
                        <Button icon={<DeleteOutlined />} size="small" danger>削除</Button>
                    </Popconfirm>
                </Space>
            )
        },
    ];

    const colors = ['geekblue', 'green', 'gold', 'purple', 'magenta', 'cyan', 'blue', 'red', 'orange', 'lime'];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>タグ管理</h2>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={fetchTags} loading={loading}>更新</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                        新しいタグを作成
                    </Button>
                </Space>
            </div>

            {!userOrgId && !loading && (
                <Alert message="組織に所属していません。設定から組織を作成・参加してください。" type="warning" showIcon style={{ marginBottom: 16 }} />
            )}

            <div className="wafu-card" style={{ borderRadius: 8 }}>
                <Table
                    dataSource={tags}
                    columns={columns}
                    pagination={false}
                    rowKey="id"
                    loading={loading}
                    locale={{ emptyText: 'タグがありません' }}
                />
            </div>

            <Modal
                title="新しいタグを作成"
                open={isModalOpen}
                onOk={handleAdd}
                onCancel={() => setIsModalOpen(false)}
                confirmLoading={actionLoading}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ fontWeight: 500, display: 'block', marginBottom: 8 }}>タグ名</label>
                        <Input
                            placeholder="例: 大阪オフィス, プロジェクトX"
                            value={tagName}
                            onChange={(e) => setTagName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={{ fontWeight: 500, display: 'block', marginBottom: 8 }}>カラー</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {colors.map(color => (
                                <div
                                    key={color}
                                    onClick={() => setTagColor(color)}
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: color,
                                        cursor: 'pointer',
                                        border: tagColor === color ? '3px solid #1890ff' : '2px solid transparent',
                                        boxShadow: '0 0 0 1px #ddd',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontWeight: 'bold'
                                    }}
                                >
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 8 }}>
                            プレビュー: <Tag color={tagColor}>{tagName || 'タグ名'}</Tag>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default TagSettingsPage;
