'use client';

import React, { useState, useEffect } from 'react';
import { Card, Spin, Alert, Breadcrumb, DatePicker } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ComposedChart } from 'recharts';
import { createClientComponentClient } from '@/lib/supabase';
import { HomeOutlined, LineChartOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { RangePicker } = DatePicker;

interface TrendData {
    month: string;
    avg_sentiment: number;
    session_count: number;
}

const TrendsPage = () => {
    const [data, setData] = useState<TrendData[]>([]);
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

                const { data: trendData, error: rpcError } = await supabase
                    .rpc('get_org_sentiment_trend', { p_org_id: profile.organization_id });

                if (rpcError) throw rpcError;

                // Format data for Recharts if needed, but RPC returns correct structure
                setData(trendData || []);

            } catch (err: any) {
                console.error('Error fetching trends:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><Spin size="large" /></div>;
    if (error) return <Alert message="エラー" description={error} type="error" showIcon />;

    return (
        <div style={{ padding: 24 }}>
            <Breadcrumb
                items={[
                    { title: <Link href="/dashboard"><HomeOutlined /></Link> },
                    { title: '分析' },
                    { title: 'トレンド分析 (時系列)' },
                ]}
                style={{ marginBottom: 24 }}
            />

            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 24 }}>
                <LineChartOutlined style={{ marginRight: 8 }} />
                組織トレンド分析
            </h1>

            <Card title="エンゲージメントと1on1実施数の推移 (過去12ヶ月)" bordered={false} style={{ marginBottom: 24 }}>
                <div style={{ width: '100%', height: 400 }}>
                    <ResponsiveContainer>
                        <ComposedChart
                            data={data}
                            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                        >
                            <CartesianGrid stroke="#f5f5f5" />
                            <XAxis dataKey="month" scale="point" padding={{ left: 20, right: 20 }} />
                            <YAxis yAxisId="left" domain={[0, 10]} label={{ value: '感情スコア (0-10)', angle: -90, position: 'insideLeft' }} />
                            <YAxis yAxisId="right" orientation="right" label={{ value: '実施回数', angle: 90, position: 'insideRight' }} />
                            <Tooltip />
                            <Legend />
                            <Bar yAxisId="right" dataKey="session_count" name="1on1実施数" barSize={20} fill="#413ea0" opacity={0.3} />
                            <Line yAxisId="left" type="monotone" dataKey="avg_sentiment" name="平均感情スコア" stroke="#82ca9d" strokeWidth={3} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                <div style={{ marginTop: 16, textAlign: 'center', color: '#666' }}>
                    <p>※ 平均感情スコアは、各月の1on1セッションでAIが判定した感情値の平均です。</p>
                </div>
            </Card>

            <div style={{ display: 'flex', gap: 16 }}>
                <Card title="インサイト" bordered={false} style={{ flex: 1 }}>
                    <ul style={{ paddingLeft: 20 }}>
                        <li>直近3ヶ月の1on1実施回数は {data.slice(-3).reduce((acc, curr) => acc + (curr.session_count || 0), 0)} 回です。</li>
                        <li>平均感情スコアは {data.length > 1 && data[data.length - 1].avg_sentiment > data[data.length - 2].avg_sentiment ? '上昇傾向' : '横ばいまたは下降傾向'} にあります。</li>
                    </ul>
                </Card>
            </div>
        </div>
    );
};

export default TrendsPage;
