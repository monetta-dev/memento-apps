'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Tag, Input, Button, List, Space } from 'antd';
import { FileTextOutlined, BulbOutlined } from '@ant-design/icons';
import type { Note } from '@/store/useStore';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface FaceToFaceDashboardProps {
  notes: Note[];
  onAddNote: (content: string) => void;
  isAiQuestionMode: boolean;
  onToggleMode: () => void;
  onAskAI: (question: string) => Promise<void>;
}

const FaceToFaceDashboard: React.FC<FaceToFaceDashboardProps> = ({
  notes,
  onAddNote,
  isAiQuestionMode,
  onToggleMode,
  onAskAI,
}) => {
  const [newNoteText, setNewNoteText] = useState('');

  const handleSubmit = useCallback(() => {
    if (!newNoteText.trim()) return;
    
    if (isAiQuestionMode) {
      onAskAI(newNoteText.trim()).then(() => {
        setNewNoteText('');
      }).catch(() => {
        // Error handling is done in parent
      });
    } else {
      onAddNote(newNoteText.trim());
      setNewNoteText('');
    }
  }, [newNoteText, isAiQuestionMode, onAskAI, onAddNote]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key toggles mode
    if (e.key === 'Tab') {
      e.preventDefault();
      onToggleMode();
    }
    // Ctrl+Enter submits
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }, [onToggleMode, handleSubmit]);

  useEffect(() => {
    // Focus the textarea when mode changes
    const textarea = document.querySelector('textarea[placeholder*="メモ"], textarea[placeholder*="AI"]');
    if (textarea) {
      (textarea as HTMLTextAreaElement).focus();
    }
  }, [isAiQuestionMode]);

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      background: '#f5f5f5',
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
    }}>
       <Card 
         title={
           <Space>
             <FileTextOutlined />
             <span>メモ</span>
             <Button 
               size="small" 
               type={isAiQuestionMode ? "primary" : "default"}
               onClick={onToggleMode}
               icon={<BulbOutlined />}
             >
               {isAiQuestionMode ? 'AI質問モード' : 'メモモード'}
             </Button>
             <Text type="secondary" style={{ fontSize: 11 }}>
               Tabキーで切り替え
             </Text>
           </Space>
         }
        size="small"
        style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        bodyStyle={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: 12,
          overflow: 'hidden'
        }}
      >
        {/* メモ入力エリア */}
        <div style={{ marginBottom: 12 }}>
          <TextArea 
            placeholder={isAiQuestionMode ? "AIに質問を入力...（Ctrl+Enterで送信、Tabでモード切替）" : "メモを入力...（Ctrl+Enterで追加、Tabでモード切替）"}
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            autoSize={{ minRows: 3, maxRows: 5 }}
            onKeyDown={handleKeyDown}
            style={isAiQuestionMode ? { borderColor: '#722ed1' } : {}}
          />
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Button 
                type="primary" 
                onClick={handleSubmit}
                disabled={!newNoteText.trim()}
                icon={isAiQuestionMode ? <BulbOutlined /> : <FileTextOutlined />}
              >
                {isAiQuestionMode ? 'AIに質問' : 'メモを追加'}
              </Button>
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                {isAiQuestionMode ? 'Ctrl+Enterで送信' : 'Ctrl+Enterで追加'}
              </Text>
            </div>
            <div>
              <Tag color={isAiQuestionMode ? 'purple' : 'blue'}>
                {isAiQuestionMode ? 'AI質問モード' : 'メモモード'}
              </Tag>
            </div>
          </div>
        </div>

        {/* メモリスト */}
        <div style={{ 
          flex: 1,
          overflowY: 'auto',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
          padding: 8,
          backgroundColor: '#fff'
        }}>
          {notes.length > 0 ? (
            <List
              size="small"
              dataSource={[...notes].reverse()} // 新しいメモを上に表示
              renderItem={(note) => (
                <List.Item style={{ 
                  padding: '6px 0', 
                  borderBottom: '1px solid #f0f0f0',
                  backgroundColor: '#fff'
                }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4
                    }}>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {note.timestamp}
                      </Text>
                      {note.source === 'ai' && (
                        <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>AI</Tag>
                      )}
                      {note.source === 'transcript' && (
                        <Tag color="cyan" style={{ fontSize: 10, margin: 0 }}>文字起こし</Tag>
                      )}
                      {note.source === 'manual' && (
                        <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>手動</Tag>
                      )}
                    </div>
                    <Paragraph style={{ 
                      margin: 0, 
                      fontSize: 12,
                      lineHeight: 1.4,
                      color: '#333'
                    }}>
                      {note.content}
                    </Paragraph>
                  </div>
                </List.Item>
              )}
              locale={{ emptyText: 'メモがありません。メモを追加してください。' }}
            />
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: 150,
              color: '#999'
            }}>
              <Text type="secondary">メモがありません</Text>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default FaceToFaceDashboard;