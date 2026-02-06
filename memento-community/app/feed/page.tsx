'use client';

import React from 'react';
import { Card, Avatar, Button, Space, Tag } from 'antd';
import { LikeOutlined, CommentOutlined, ShareAltOutlined, EllipsisOutlined } from '@ant-design/icons';

const FeedPage = () => {
    const posts = [
        {
            id: 1,
            author: '佐藤 美咲',
            role: 'エンジニアリングマネージャー',
            content: 'チームの1on1で、単なる「進捗確認」から「コーチング」のマインドセットに切り替えたところ、大きな変化がありました。最初に「今直面している最大の課題は何？」と聞くことを強くお勧めします。',
            tags: ['マネジメント', 'Tips'],
            likes: 24,
            comments: 5,
            time: '2時間前'
        },
        {
            id: 2,
            author: '陳 健一',
            role: 'プロダクトディレクター',
            content: '四半期ごとのキャリア成長に関する対話の良いテンプレートを持っている方はいませんか？現在のフォーマットは少し堅苦しすぎると感じています。',
            tags: ['質問', 'リソース'],
            likes: 12,
            comments: 8,
            time: '4時間前'
        }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {posts.map(post => (
                <Card key={post.id} bordered={false} hoverable>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <Avatar>{post.author[0]}</Avatar>
                            <div>
                                <div style={{ fontWeight: 600 }}>{post.author}</div>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>{post.role} • {post.time}</div>
                            </div>
                        </div>
                        <EllipsisOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
                    </div>
                    <div style={{ marginBottom: 16, fontSize: '1rem', lineHeight: 1.6 }}>
                        {post.content}
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        {post.tags.map(tag => (
                            <Tag key={tag}>#{tag}</Tag>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 24, color: '#666' }}>
                        <Space style={{ cursor: 'pointer' }}><LikeOutlined /> {post.likes}</Space>
                        <Space style={{ cursor: 'pointer' }}><CommentOutlined /> {post.comments}</Space>
                        <Space style={{ cursor: 'pointer' }}><ShareAltOutlined /> 共有</Space>
                    </div>
                </Card>
            ))}
        </div>
    );
};

export default FeedPage;
