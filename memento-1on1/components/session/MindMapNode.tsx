import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { PlusCircleOutlined, MinusCircleOutlined } from '@ant-design/icons';

export interface MindMapNodeData extends Record<string, unknown> {
    label: string;
    expanded?: boolean;
    hasChildren?: boolean;
    onToggle?: (id: string) => void;
}

export type CustomNode = Node<MindMapNodeData>;

const MindMapNode = ({ id, data, isConnectable, selected }: NodeProps<CustomNode>) => {
    const { label, expanded = true, hasChildren, onToggle } = data;

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onToggle) {
            onToggle(id);
        }
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
                transition: 'all 0.1s ease'
            }}
        >
            <Handle type="target" position={Position.Left} isConnectable={isConnectable} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{label}</span>

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
            </div>

            <Handle type="source" position={Position.Right} isConnectable={isConnectable} />
        </div>
    );
};

export default memo(MindMapNode);
