'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Typography, Table as AntTable, List as AntList, Divider, Space } from 'antd';
import type { Components } from 'react-markdown';

const { Title, Paragraph, Text } = Typography;

interface GuideMarkdownProps {
  content: string;
}

const GuideMarkdown: React.FC<GuideMarkdownProps> = ({ content }) => {
  // Custom components for Ant Design integration
  const components: Components = {
    h1: ({ children }) => <Title level={1} style={{ marginTop: 24, marginBottom: 16 }}>{children}</Title>,
    h2: ({ children }) => <Title level={2} style={{ marginTop: 20, marginBottom: 12 }}>{children}</Title>,
    h3: ({ children }) => <Title level={3} style={{ marginTop: 16, marginBottom: 8 }}>{children}</Title>,
    h4: ({ children }) => <Title level={4} style={{ marginTop: 12, marginBottom: 6 }}>{children}</Title>,
    h5: ({ children }) => <Title level={5} style={{ marginTop: 8, marginBottom: 4 }}>{children}</Title>,
    h6: ({ children }) => <Text strong style={{ display: 'block', marginTop: 6, marginBottom: 4 }}>{children}</Text>,

    p: ({ children }) => <Paragraph style={{ marginBottom: 12 }}>{children}</Paragraph>,

    ul: ({ children }) => (
      <AntList
        size="small"
        dataSource={[]}
        renderItem={() => null}
        style={{ marginBottom: 12 }}
      >
        {children}
      </AntList>
    ),

    li: ({ children, ...props }) => {
      const ordered = (props as { ordered?: boolean }).ordered;
      const content = React.Children.toArray(children);
      const textContent = content.find((child): child is string => typeof child === 'string') || '';

      return (
        <AntList.Item style={{ padding: '4px 0', border: 'none' }}>
          <Space align="start">
            {ordered ? null : <Text style={{ marginRight: 8 }}>•</Text>}
            <Text>{textContent}</Text>
          </Space>
        </AntList.Item>
      );
    },

    table: ({ children }) => (
      <div style={{ overflowX: 'auto', marginBottom: 16, border: '1px solid #f0f0f0', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
          {children}
        </table>
      </div>
    ),

    thead: ({ children }) => <thead>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => <th style={{ fontWeight: 600, padding: '8px 12px', background: '#fafafa' }}>{children}</th>,
    td: ({ children }) => <td style={{ padding: '8px 12px', border: '1px solid #f0f0f0' }}>{children}</td>,

    hr: () => <Divider style={{ margin: '16px 0' }} />,

    strong: ({ children }) => <Text strong>{children}</Text>,
    em: ({ children }) => <Text italic>{children}</Text>,

    // Handle inline code
    code: ({ children, ...props }) => {
      const inline = (props as { inline?: boolean }).inline;
      if (inline) {
        return (
          <Text code style={{ fontSize: '0.9em', padding: '2px 4px', background: '#f5f5f5', borderRadius: 2 }}>
            {children}
          </Text>
        );
      }
      return (
        <pre style={{
          background: '#f6f8fa',
          padding: 12,
          borderRadius: 4,
          overflowX: 'auto',
          marginBottom: 12,
          fontSize: '0.9em',
          border: '1px solid #e1e4e8'
        }}>
          <code>{children}</code>
        </pre>
      );
    },

    // Handle blockquotes
    blockquote: ({ children }) => (
      <blockquote style={{
        borderLeft: '4px solid var(--primary)',
        margin: '12px 0',
        padding: '4px 0 4px 16px',
        background: 'rgba(0,0,0,0.03)',
        color: 'var(--foreground)'
      }}>
        {children}
      </blockquote>
    ),
  };

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '0 16px'
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default GuideMarkdown;