
import dagre from 'dagre';
import { Node, Edge, Position } from '@xyflow/react';

const nodeWidth = 172;
const nodeHeight = 36;

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const newNode = {
            ...node,
            targetPosition: isHorizontal ? Position.Left : Position.Top,
            sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
            // We are shifting the dagre node position (anchor=center center) to the top left
            // so it matches the React Flow node anchor point (top left).
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };

        return newNode;
    });

    return { nodes: layoutedNodes, edges };
};

// Helper to calculate visibility based on 'expanded' state
// Assumes 'nodes' contains all nodes, including potentially hidden ones.
export const getVisibleNodes = (nodes: any[], edges: Edge[]) => {
    const hiddenNodeIds = new Set<string>();

    // Build parent map
    const childToParent = new Map<string, string>();
    edges.forEach(e => childToParent.set(e.target, e.source));

    // Create a map for quick node access
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Recursive function to check if a node should be hidden
    // A node is hidden if ANY ancestor is collapsed (expanded === false)
    const isNodeHidden = (nodeId: string): boolean => {
        if (hiddenNodeIds.has(nodeId)) return true;

        let currentId = nodeId;
        while (true) {
            const parentId = childToParent.get(currentId);
            if (!parentId) break; // Root reached

            const parent = nodeMap.get(parentId);
            if (parent && parent.data?.expanded === false) {
                hiddenNodeIds.add(nodeId); // Cache result
                return true;
            }
            currentId = parentId;
        }
        return false;
    };

    return nodes.map(node => ({
        ...node,
        hidden: isNodeHidden(node.id)
    }));
};
