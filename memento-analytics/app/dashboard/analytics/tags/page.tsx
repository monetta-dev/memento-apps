'use client';

import React, { useState, useEffect } from 'react';
import { Card, Spin, Alert, Breadcrumb, Table, Tag as AntTag } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';
import { createClientComponentClient } from '@/lib/supabase';
import { HomeOutlined, TagsOutlined } from '@ant-design/icons';
import Link from 'next/link';

interface TagStats {
    tag_id: string;
    tag_name: string;
    tag_color: string;
    member_count: number;
    avg_sentiment: number;
    risk_count: number;
}

const TagsAnalyticsPage = () => {
    const [data, setData] = useState<TagStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClientComponentClient();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', user.id)
                    .single();

                if (!profile?.organization_id) {
                    setError('組織に所属していません');
                    return;
                }

                const { data: tagData, error: rpcError } = await supabase
                    .rpc('get_org_tag_analytics', { p_org_id: profile.organization_id });

                if (rpcError) throw rpcError;

                setData(tagData || []);

            } catch (err: any) {
                console.error('Error fetching tag analytics:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><Spin size="large" /></div>;
    if (error) return <Alert message="エラー" description={error} type="error" showIcon />;

    // Prepare data for chart (exclude tags with 0 members if desired, but keeping all is often better)
    const chartData = data.filter(d => d.member_count > 0);

    const columns = [
        {
            title: 'タグ名',
            dataIndex: 'tag_name',
            key: 'tag_name',
            render: (text: string, record: TagStats) => (
                <AntTag color={record.tag_color}>{text}</AntTag>
            )
        },
        {
            title: '所属人数',
            dataIndex: 'member_count',
            key: 'member_count',
            sorter: (a: TagStats, b: TagStats) => a.member_count - b.member_count,
        },
        {
            title: '平均感情スコア',
            dataIndex: 'avg_sentiment',
            key: 'avg_sentiment',
            render: (score: number) => (
                <span style={{
                    fontWeight: 600,
                    color: score && score < 6 ? '#cf1322' : '#3f8600'
                }}>
                    {score ? score.toFixed(1) : '-'}
                </span>
            ),
            sorter: (a: TagStats, b: TagStats) => a.avg_sentiment - b.avg_sentiment,
        },
        {
            title: '要注意メンバー数',
            dataIndex: 'risk_count',
            key: 'risk_count',
            render: (count: number) => (
                <span style={{
                    color: count > 0 ? '#cf1322' : '#8c8c8c',
                    fontWeight: count > 0 ? 'bold' : 'normal'
                }}>
                    {count} 名
                </span>
            ),
            sorter: (a: TagStats, b: TagStats) => a.risk_count - b.risk_count,
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            <Breadcrumb
                items={[
                    { title: <Link href="/dashboard"><HomeOutlined /></Link> },
                    { title: '分析' },
                    { title: 'タグ別比較' },
                ]}
                style={{ marginBottom: 24 }}
            />

            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 24 }}>
                <TagsOutlined style={{ marginRight: 8 }} />
                タグ別チーム比較分析
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Card title="チーム別エンゲージメント状況" bordered={false}>
                    <div style={{ width: '100%', height: 400 }}>
                        <ResponsiveContainer>
                            <ScatterChart
                                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                            >
                                <CartesianGrid />
                                <XAxis type="category" dataKey="tag_name" name="チーム" allowDuplicatedCategory={false} />
                                <YAxis type="number" dataKey="avg_sentiment" name="感情スコア" domain={[0, 10]} />
                                <ZAxis type="number" dataKey="member_count" range={[100, 1000]} name="人数" />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                <Legend />
                                <Scatter name="チーム状況 (円の大きさ=人数)" data={chartData} fill="#8884d8">
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.tag_color || '#8884d8'} />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card title="詳細データ" bordered={false}>
                    <Table
                        dataSource={data}
                        columns={columns}
                        rowKey="tag_id"
                        pagination={false}
                    />
                </Card>
            </div>
        </div>
    );
};

export default TagsAnalyticsPage;
