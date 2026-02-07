'use client';

import React, { useState, useEffect } from 'react';
import { Card, Col, Row, Statistic, Select, Tag, Spin, Alert } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, SmileOutlined, TeamOutlined, RiseOutlined } from '@ant-design/icons';
import { createClientComponentClient } from '@/lib/supabase';
import Link from 'next/link';

interface DashboardStats {
    sentiment: number;
    riskCount: number;
    oneOnOneRate: number;
    totalSubordinates: number;
}

const DashboardPage = () => {
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [stats, setStats] = useState<DashboardStats>({
        sentiment: 0,
        riskCount: 0,
        oneOnOneRate: 0,
        totalSubordinates: 0
    });
    const [tags, setTags] = useState<{ label: string, value: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [userOrgId, setUserOrgId] = useState<string | null>(null);

    const supabase = createClientComponentClient();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // 1. Get User's Organization
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', user.id)
                    .single();

                if (!profile?.organization_id) {
                    setLoading(false);
                    return;
                }
                setUserOrgId(profile.organization_id);

                // 2. Fetch Tags for Filter
                const { data: tagData } = await supabase
                    .from('tags')
                    .select('id, name')
                    .eq('organization_id', profile.organization_id);

                if (tagData) {
                    setTags([
                        { label: 'すべて', value: 'all' },
                        ...tagData.map(t => ({ label: t.name, value: t.id }))
                    ]);
                }

                // 3. Fetch Stats via RPC (Server-side aggregation)
                const rpcParams: { p_org_id: string; p_tag_id?: string } = {
                    p_org_id: profile.organization_id
                };

                if (selectedTag && selectedTag !== 'all') {
                    rpcParams.p_tag_id = selectedTag;
                }

                const { data: statsData, error: statsError } = await supabase
                    .rpc('get_org_dashboard_stats', rpcParams);

                if (statsError) throw statsError;

                if (statsData) {
                    setStats({
                        sentiment: statsData.sentiment,
                        riskCount: statsData.riskCount,
                        oneOnOneRate: statsData.oneOnOneRate,
                        totalSubordinates: statsData.totalSubordinates
                    });
                }

            } catch (error) {
                console.error('Dashboard Fetch Error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [supabase, selectedTag]);

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    if (!userOrgId) {
        return <Alert message="組織に所属していません。設定から組織を作成または参加してください。" type="warning" showIcon />;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>概要</h1>
                <div>
                    <span style={{ marginRight: 8, fontWeight: 500 }}>タグで絞り込み:</span>
                    <Select
                        value={selectedTag || 'all'}
                        style={{ width: 200 }}
                        onChange={(val) => setSelectedTag(val)}
                        options={tags}
                    />
                </div>
            </div>

            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}>
                    <Card bordered={false}>
                        <Statistic
                            title="総部下数"
                            value={stats.totalSubordinates}
                            prefix={<TeamOutlined />}
                            suffix="名"
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card bordered={false} extra={<Link href="/dashboard/analytics/trends">詳細</Link>}>
                        <Statistic
                            title="平均社員満足度"
                            value={stats.sentiment}
                            precision={1}
                            valueStyle={{ color: stats.sentiment < 7 ? '#cf1322' : '#3f8600' }}
                            prefix={<SmileOutlined />}
                            suffix="/ 10"
                        />
                        <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                            <ArrowUpOutlined style={{ color: '#3f8600' }} /> 先月比 +0.3
                        </div>
                    </Card>
                </Col>
                <Col span={6}>
                    <Card bordered={false} extra={<Link href="/dashboard/analytics/tags">詳細</Link>}>
                        <Statistic
                            title="要注意社員数"
                            value={stats.riskCount}
                            valueStyle={{ color: stats.riskCount > 0 ? '#cf1322' : '#3f8600' }}
                            prefix={<ArrowUpOutlined />}
                            suffix="人"
                        />
                        <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                            {stats.riskCount > 0 ? '早急なフォローが必要です' : 'リスクなし'}
                        </div>
                    </Card>
                </Col>
                <Col span={6}>
                    <Card bordered={false} extra={<Link href="/dashboard/analytics/trends">推移</Link>}>
                        <Statistic
                            title="1on1実施率"
                            value={stats.oneOnOneRate}
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
                    <Card title="タグ別アラート状況" bordered={false} style={{ minHeight: 300 }}>
                        {tags.length > 1 ? (
                            <div style={{ color: '#999' }}>タグごとの詳細分析を表示します（実装中）</div>
                        ) : (
                            <div style={{ color: '#999' }}>タグが設定されていません</div>
                        )}
                    </Card>
                </Col>
                <Col span={12}>
                    <Card title="最新のインサイト (AI分析)" bordered={false} style={{ minHeight: 300 }}>
                        <p>• <b>全体</b>: 組織全体のエンゲージメントは安定しています。</p>
                        {stats.riskCount > 0 && (
                            <p style={{ color: '#cf1322' }}>• <b>リスク検知</b>: {stats.riskCount}名の部下から不安を示すシグナルが検出されました。</p>
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default DashboardPage;
