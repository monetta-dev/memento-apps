import { create } from 'zustand';
import { temporal, type TemporalState } from 'zundo';
import { Node, Edge, OnNodesChange, OnEdgesChange, applyNodeChanges, applyEdgeChanges, addEdge, Connection } from '@xyflow/react';

// Use same CustomNode type as defined in MindMapPanel
// (Ideally move CustomNode type to a shared types file, but for now re-declare or import if possible.
// Given strict TS, let's use a compatible generic type or precise check.
// We'll define a compatible interface here.)

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

interface MindMapState {
    nodes: CustomNode[];
    edges: Edge[];

    // Actions
    setNodes: (nodes: CustomNode[] | ((nodes: CustomNode[]) => CustomNode[])) => void;
    setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
    setGraph: (nodes: CustomNode[], edges: Edge[]) => void;
    onNodesChange: OnNodesChange<CustomNode>;
    onEdgesChange: OnEdgesChange<Edge>;
    onConnect: (connection: Connection) => void;
}

export const useMindMapStore = create<MindMapState>()(
    temporal(
        (set, get) => ({
            nodes: [],
            edges: [],

            setNodes: (nodes) => {
                if (typeof nodes === 'function') {
                    set({ nodes: nodes(get().nodes) });
                } else {
                    set({ nodes });
                }
            },

            setEdges: (edges) => {
                if (typeof edges === 'function') {
                    set({ edges: edges(get().edges) });
                } else {
                    set({ edges });
                }
            },

            setGraph: (nodes, edges) => {
                set({ nodes, edges });
            },

            onNodesChange: (changes) => {
                set({
                    nodes: applyNodeChanges(changes, get().nodes) as CustomNode[],
                });
            },

            onEdgesChange: (changes) => {
                set({
                    edges: applyEdgeChanges(changes, get().edges),
                });
            },

            onConnect: (connection) => {
                set({
                    edges: addEdge(connection, get().edges),
                });
            },
        }),
        {
            // Zundo options
            limit: 100, // Limit history depth
            equality: (pastState, currentState) => {
                // Return TRUE if states are effectively equal (ignoring noise), so NO snapshot is created.

                // 1. Check Edges
                // Edges change if ID, source, target change. Selection is noise.
                if (pastState.edges.length !== currentState.edges.length) return false;
                const edgesEqual = pastState.edges.every((e, i) => {
                    const c = currentState.edges[i];
                    return e.id === c.id && e.source === c.source && e.target === c.target;
                    // Ignore 'selected', 'animated', etc for now unless relevant
                });
                if (!edgesEqual) return false;

                // 2. Check Nodes
                // Ignore: selected, position, width, height, dragging, resizing
                // Track: id, data (label, expanded), type, parentId
                if (pastState.nodes.length !== currentState.nodes.length) return false;

                const nodesEqual = pastState.nodes.every((n, i) => {
                    const c = currentState.nodes[i];

                    // Structural Checks
                    if (n.id !== c.id) return false;
                    if (n.type !== c.type) return false;
                    if (n.parentId !== c.parentId) return false;

                    // Data Checks (Label, Expanded)
                    const nData = n.data || {};
                    const cData = c.data || {};
                    if (nData.label !== cData.label) return false;
                    if (nData.expanded !== cData.expanded) return false;

                    // If we want to track position (e.g. manual drag), we would check it here.
                    // But currently nodesDraggable={false}, so position changes are only AutoLayout.
                    // We DO NOT want to undo AutoLayout animation frames or adjustments usually.
                    // We want to undo the Structure change.
                    // So we IGNORE position. 

                    return true;
                });

                return nodesEqual;
            },
        }
    )
);
