'use client';

import React, { useState, useCallback } from 'react';

interface DevTranscriptPanelProps {
    onTranscript: (text: string, speaker: 'manager' | 'subordinate') => void;
}

const SAMPLE_SCRIPTS: { speaker: 'manager' | 'subordinate'; text: string }[] = [
    { speaker: 'manager', text: '最近、仕事の調子はどうですか？' },
    { speaker: 'subordinate', text: 'プロジェクトAの遅延が少し気になっています。' },
    { speaker: 'manager', text: 'それは具体的にどういった状況ですか？' },
    { speaker: 'subordinate', text: '要件定義が固まらず、チームが動けない状態です。' },
    { speaker: 'manager', text: 'なるほど。何か手伝えることはありますか？' },
    { speaker: 'subordinate', text: 'ステークホルダーとの調整を一緒にしてもらえると助かります。' },
];

export default function DevTranscriptPanel({ onTranscript }: DevTranscriptPanelProps) {
    const [speaker, setSpeaker] = useState<'manager' | 'subordinate'>('manager');
    const [text, setText] = useState('');
    const [scriptIndex, setScriptIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(true);

    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed) return;
        onTranscript(trimmed, speaker);
        setText('');
    }, [text, speaker, onTranscript]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const handleNextScript = useCallback(() => {
        const entry = SAMPLE_SCRIPTS[scriptIndex % SAMPLE_SCRIPTS.length];
        onTranscript(entry.text, entry.speaker);
        setScriptIndex(i => i + 1);
    }, [scriptIndex, onTranscript]);

    return (
        <div style={{
            position: 'fixed',
            bottom: '80px',
            left: '16px',
            zIndex: 9999,
            width: '320px',
            background: '#1a1a2e',
            border: '1px solid #4f46e5',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(79,70,229,0.4)',
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#e2e8f0',
        }}>
            {/* Header */}
            <div
                onClick={() => setIsOpen(o => !o)}
                style={{
                    padding: '8px 14px',
                    background: '#4f46e5',
                    borderRadius: isOpen ? '12px 12px 0 0' : '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                }}
            >
                <span>🧪 Dev: Mock Transcript</span>
                <span style={{ opacity: 0.7 }}>{isOpen ? '▼' : '▲'}</span>
            </div>

            {isOpen && (
                <div style={{ padding: '12px' }}>
                    {/* Speaker toggle */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        {(['manager', 'subordinate'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setSpeaker(s)}
                                style={{
                                    flex: 1,
                                    padding: '5px 0',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: speaker === s ? 'bold' : 'normal',
                                    background: speaker === s
                                        ? (s === 'manager' ? '#7c3aed' : '#0891b2')
                                        : '#2d2d4e',
                                    color: '#fff',
                                    fontSize: '12px',
                                }}
                            >
                                {s === 'manager' ? '👔 Manager' : '👤 部下'}
                            </button>
                        ))}
                    </div>

                    {/* Text input */}
                    <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="発言を入力... (Enter で送信)"
                        rows={2}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #4f46e5',
                            background: '#0f0f23',
                            color: '#e2e8f0',
                            resize: 'none',
                            fontSize: '13px',
                            boxSizing: 'border-box',
                            outline: 'none',
                        }}
                    />

                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <button
                            onClick={handleSend}
                            disabled={!text.trim()}
                            style={{
                                flex: 1,
                                padding: '6px 0',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: text.trim() ? 'pointer' : 'not-allowed',
                                background: text.trim() ? '#4f46e5' : '#2d2d4e',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 'bold',
                            }}
                        >
                            送信
                        </button>
                        <button
                            onClick={handleNextScript}
                            title="サンプル会話を順番に流す"
                            style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                background: '#065f46',
                                color: '#6ee7b7',
                                fontSize: '12px',
                            }}
                        >
                            ▶ Auto ({scriptIndex % SAMPLE_SCRIPTS.length + 1}/{SAMPLE_SCRIPTS.length})
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
