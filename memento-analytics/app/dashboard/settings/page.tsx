'use client';

import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Alert, Typography } from 'antd';
import { createClientComponentClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

const { Title, Text, Paragraph } = Typography;

const SettingsPage = () => {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [org, setOrg] = useState<{ id: string, name: string, code: string } | null>(null);
    const [form] = Form.useForm();
    const supabase = createClientComponentClient();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
        }
    }, [user, isLoading, router]);

    const fetchOrg = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', session.user.id).single();

        if (profile?.organization_id) {
            const { data: orgData } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single();
            setOrg(orgData);
            form.setFieldsValue({ name: orgData?.name, code: orgData?.code });
        }
    };

    useEffect(() => {
        fetchOrg();
    }, []);

    if (isLoading) return <div>Loading...</div>; // Or a proper spinner

    const handleCreateOrg = async (values: { name: string, code: string }) => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // 1. Create Organization & Link Profile via RPC
            const { data: newOrg, error: createError } = await supabase
                .rpc('create_organization_and_link', {
                    org_name: values.name,
                    org_code: values.code
                });

            if (createError) throw createError;

            message.success('組織を作成しました');
            // RPC returns the new org object
            setOrg(newOrg);
        } catch (error: any) {
            console.error(error);
            message.error(error.message || '作成に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    if (org) {
        return (
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                <Title level={2} style={{ marginBottom: 24 }}>組織設定</Title>
                <Card className="wafu-card" bordered={false}>
                    <Form layout="vertical" initialValues={{ name: org.name, code: org.code }}>
                        <Form.Item label="組織名">
                            <Input value={org.name} readOnly bordered={false} style={{ fontWeight: 'bold', fontSize: '1.2rem', paddingLeft: 0 }} />
                        </Form.Item>
                        <Alert
                            message="招待コード"
                            description={
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text copyable={{ text: org.code }} style={{ fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '2px' }}>
                                        {org.code}
                                    </Text>
                                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                        このコードをメンバーに共有してください
                                    </div>
                                </div>
                            }
                            type="info"
                            showIcon
                        />
                    </Form>
                </Card>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: 40 }}>
            <Card title="組織の作成" className="wafu-card" bordered={false}>
                <Paragraph>
                    まだ組織に所属していません。新しい組織を作成して、メンバーを招待しましょう。
                </Paragraph>
                <Form layout="vertical" onFinish={handleCreateOrg} form={form}>
                    <Form.Item
                        label="組織名"
                        name="name"
                        rules={[{ required: true, message: '組織名を入力してください' }]}
                    >
                        <Input placeholder="例: 株式会社Memento" />
                    </Form.Item>
                    <Form.Item
                        label="招待コード (一意のID)"
                        name="code"
                        rules={[{ required: true, message: '招待コードを入力してください' }]}
                        help="メンバーが組織に参加する際に使用します（半角英数字）"
                    >
                        <Input placeholder="例: MEM-2024" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading} size="large">
                        組織を作成して開始
                    </Button>
                </Form>
            </Card>
        </div>
    );
};

export default SettingsPage;
