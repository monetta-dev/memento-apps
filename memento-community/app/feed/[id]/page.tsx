'use client';

import React from 'react';
import { Avatar, Input, Button, List, Divider } from 'antd';
import { UserOutlined, LikeOutlined, MessageOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';

const PostDetailPage = () => {
    // Mock Data
    const mainPost = {
        id: 1,
        author: '佐藤 美咲',
        role: 'エンジニアリングマネージャー',
        content: 'チームの1on1で、単なる「進捗確認」から「コーチング」のマインドセットに切り替えたところ、大きな変化がありました。最初に「今直面している最大の課題は何？」と聞くことを強くお勧めします。会話の雰囲気が完全に変わりました。',
        time: '2時間前',
        likes: 24
    };

    const comments = [
        { author: '山田 太郎', role: '営業本部長', content: '素晴らしいヒントですね、美咲さん！私は普段個人的なチェックインから始めますが、すぐに課題に切り替えるのは集中したセッションに効果的だと思います。', time: '1時間前' },
        { author: '鈴木 一郎', role: 'プロダクトリード', content: '明日試してみます。', time: '30分前' },
    ];

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Link href="/feed" style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ArrowLeftOutlined /> フィードに戻る
                </Link>
            </div>

            <div className="wafu-card" style={{ padding: 24, borderRadius: 8 }}>
                {/* Post Header */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <Avatar size={48} icon={<UserOutlined />} style={{ backgroundColor: '#223a70' }} />
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{mainPost.author}</div>
                        <div style={{ color: '#888' }}>{mainPost.role} • {mainPost.time}</div>
                    </div>
                </div>

                {/* Post Content */}
                <div style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: 24 }}>
                    {mainPost.content}
                </div>

                <div style={{ display: 'flex', gap: 24, borderTop: '1px solid #eee', paddingTop: 16 }}>
                    <span style={{ cursor: 'pointer', color: '#223a70', fontWeight: 600 }}><LikeOutlined /> {mainPost.likes} いいね</span>
                    <span style={{ cursor: 'pointer', color: '#666' }}><MessageOutlined /> {comments.length} コメント</span>
                </div>
            </div>

            {/* Comments Section */}
            <div style={{ marginTop: 24, paddingLeft: 16, borderLeft: '4px solid #e0e0e0' }}>
                <h3 style={{ marginBottom: 16, fontWeight: 600 }}>コメント一覧</h3>

                <List
                    itemLayout="horizontal"
                    dataSource={comments}
                    renderItem={(item) => (
                        <List.Item>
                            <List.Item.Meta
                                avatar={<Avatar style={{ backgroundColor: '#c9171e' }}>{item.author[0]}</Avatar>}
                                title={<span style={{ fontWeight: 600 }}>{item.author} <span style={{ fontWeight: 400, color: '#999', fontSize: '0.8rem' }}>({item.role})</span></span>}
                                description={
                                    <div>
                                        <div style={{ color: '#2b2b2b' }}>{item.content}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#ccc', marginTop: 4 }}>{item.time}</div>
                                    </div>
                                }
                            />
                        </List.Item>
                    )}
                />

                <div style={{ marginTop: 24, display: 'flex', gap: 16 }}>
                    <Avatar icon={<UserOutlined />} />
                    <div style={{ flex: 1 }}>
                        <Input.TextArea rows={3} placeholder="コメントを追加..." style={{ marginBottom: 8 }} />
                        <Button type="primary">コメントする</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostDetailPage;
