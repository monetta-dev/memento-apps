import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { PlusCircleOutlined, MinusCircleOutlined } from '@ant-design/icons';

export interface MindMapNodeData extends Record<string, unknown> {
    label: string;
    expanded?: boolean;
    hasChildren?: boolean;
    onToggle?: (id: string) => void;
    isEditing?: boolean;
    onLabelChange?: (id: string, newLabel: string, intent?: 'TAB' | 'ENTER') => void;
    onEditBlur?: (id: string) => void;
}

export type CustomNode = Node<MindMapNodeData>;

const MindMapNode = ({ id, data, isConnectable, selected }: NodeProps<CustomNode>) => {
    const { label, expanded = true, hasChildren, onToggle, isEditing, onLabelChange, onEditBlur } = data;
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isEditing && inputRef.current) {
            // Prevent scroll on focus to fix viewport jump issue
            inputRef.current.focus({ preventScroll: true });
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onToggle) {
            onToggle(id);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.stopPropagation(); // Prevent react flow from catching enter
            if (onLabelChange && inputRef.current) {
                onLabelChange(id, inputRef.current.value, 'ENTER');
            }
        } else if (e.key === 'Tab') {
            e.preventDefault(); // Prevent focus loss
            e.stopPropagation();
            if (onLabelChange && inputRef.current) {
                onLabelChange(id, inputRef.current.value, 'TAB');
            }
        }
    };

    const handleBlur = () => {
        if (onEditBlur) {
            onEditBlur(id);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Optional: Update local state if needed, but for now we trust onBlur/Enter to save
    };

    return (
        <div
            className="react-flow__node-default"
            style={{
                position: 'relative',
                minWidth: '150px',
                padding: '10px',
                background: '#fff',
                border: selected ? '2px solid #1890ff' : '1px solid #777',
                borderRadius: '4px',
                boxShadow: selected ? '0 0 0 2px rgba(24, 144, 255, 0.2)' : 'none',
                transition: 'all 0.1s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}
        >
            <Handle type="target" position={Position.Left} isConnectable={isConnectable} />

            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                {isEditing ? (
                    <input
                        ref={inputRef}
                        defaultValue={label}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            fontSize: 'inherit',
                            background: 'transparent'
                        }}
                    />
                ) : (
                    <span>{label}</span>
                )}
            </div>

            {hasChildren && (
                <div
                    role="button"
                    onClick={handleToggle}
                    style={{
                        cursor: 'pointer',
                        marginLeft: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        color: '#555'
                    }}
                >
                    {expanded ? <MinusCircleOutlined /> : <PlusCircleOutlined />}
                </div>
            )}

            <Handle type="source" position={Position.Right} isConnectable={isConnectable} />
        </div>
    );
};

export default memo(MindMapNode);
