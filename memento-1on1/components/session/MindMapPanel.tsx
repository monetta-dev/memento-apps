import React, { useCallback, KeyboardEvent, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  Connection,
  OnNodesChange,
  OnEdgesChange,
  Panel,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import { Button, Space, Tooltip, type InputRef } from 'antd';
import type { NodeChange } from '@xyflow/react';
import {
  PlusCircleOutlined,
  NodeIndexOutlined,
  DeleteOutlined,
  EnterOutlined,
  UndoOutlined,
  RedoOutlined
} from '@ant-design/icons';
import '@xyflow/react/dist/style.css';
import MindMapNode, { MindMapNodeData } from './MindMapNode';
import { getLayoutedElements, getVisibleNodes } from './layoutUtils';
import { useMindMapStore, type CustomNode } from '@/store/useMindMapStore';
import { useStore as useZundoStore } from 'zustand';
import type { NodeTypes } from '@xyflow/react';

// Register custom node types - Cast to NodeTypes to avoid strict prop checks
const nodeTypes: NodeTypes = {
  mindMap: MindMapNode as unknown as NodeTypes['mindMap'],
};

interface MindMapPanelProps {
  isReadOnly?: boolean;
}

const MindMapContent: React.FC<MindMapPanelProps> = ({ isReadOnly = false }) => {
  const { getNodes, getEdges, setCenter, getViewport, fitView } = useReactFlow<CustomNode, Edge>();

  // Initial fit view
  useEffect(() => {
    // Small timeout to allow nodes to render
    const timer = setTimeout(() => {
      fitView();
    }, 100);
    return () => clearTimeout(timer);
  }, [fitView]);

  // Use Zundo Store
  const nodes = useMindMapStore((state) => state.nodes);
  const edges = useMindMapStore((state) => state.edges);
  const onNodesChange = useMindMapStore((state) => state.onNodesChange);
  const onEdgesChange = useMindMapStore((state) => state.onEdgesChange);
  const setNodes = useMindMapStore((state) => state.setNodes);
  const setEdges = useMindMapStore((state) => state.setEdges);
  const setGraph = useMindMapStore((state) => state.setGraph);
  const onConnectStore = useMindMapStore((state) => state.onConnect);

  // Undo/Redo via Zundo temporal middleware
  // Undo/Redo via Zundo temporal middleware
  const undo = useZundoStore(useMindMapStore.temporal, (state) => state.undo);
  const redo = useZundoStore(useMindMapStore.temporal, (state) => state.redo);
  const pastStates = useZundoStore(useMindMapStore.temporal, (state) => state.pastStates);
  const futureStates = useZundoStore(useMindMapStore.temporal, (state) => state.futureStates);
  const pause = useZundoStore(useMindMapStore.temporal, (state) => state.pause);
  const resume = useZundoStore(useMindMapStore.temporal, (state) => state.resume);

  // DEBUG: Monitor History
  useEffect(() => {
    console.log('[MindMapPanel] Zundo History:', {
      past: pastStates.length,
      future: futureStates.length,
      tracking: !useMindMapStore.temporal.getState().isTracking ? 'PAUSED' : 'ACTIVE'
    });
  }, [pastStates, futureStates]);


  const inputRef = useRef<InputRef>(null);
  const mindMapContainerRef = useRef<HTMLDivElement>(null); // Ref for container focus

  // Handler Refs
  const handleLabelChangeRef = useRef<(id: string, newLabel: string, intent?: 'TAB' | 'ENTER') => void>(() => { });
  const handleEditBlurRef = useRef<(id: string) => void>(() => { });


  // Declare refs to break circular dependencies
  const addChildNodeRef = useRef<() => void>(() => { });

  // Inline Editing Handlers
  const handleLabelChange = useCallback((id: string, newLabel: string, intent?: 'TAB' | 'ENTER') => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, label: newLabel, isEditing: false },
          };
        }
        return node;
      })
    );

    // Refocus container
    setTimeout(() => {
      mindMapContainerRef.current?.focus();

      // Handle intention
      if (intent === 'TAB') {
        addChildNodeRef.current();
      }
    }, 0);
  }, [setNodes]);

  const handleEditBlur = useCallback((id: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, isEditing: false },
          };
        }
        return node;
      })
    );
    // Refocus container on blur so shortcuts work immediately
    mindMapContainerRef.current?.focus();
  }, [setNodes]);

  // Update refs
  useEffect(() => {
    handleLabelChangeRef.current = handleLabelChange;
    handleEditBlurRef.current = handleEditBlur;
  }, [handleLabelChange, handleEditBlur]);

  // Declare applyAutoLayout and toggleNodeExpansion using refs to break circular dependency
  const applyAutoLayoutRef = useRef<(currentNodes: CustomNode[], currentEdges: Edge[], focusNodeId?: string) => void>(() => { });
  const toggleNodeExpansionRef = useRef<(nodeId: string, expand?: boolean) => void>(() => { });


  // Expand/Collapse logic
  const toggleNodeExpansion = useCallback((nodeId: string, expand?: boolean) => {
    const currentNodes = getNodes() as CustomNode[];
    const currentEdges = getEdges();

    const newNodes = currentNodes.map(n => {
      if (n.id === nodeId) {
        const currentExpanded = n.data.expanded ?? true; // Default to true
        const newExpanded = expand !== undefined ? expand : !currentExpanded;
        return { ...n, data: { ...n.data, expanded: newExpanded } };
      }
      return n;
    });

    // Re-apply layout including visibility calculation
    applyAutoLayoutRef.current(newNodes, currentEdges);
  }, [getNodes, getEdges]);

  // Update ref whenever toggleNodeExpansion changes
  useEffect(() => {
    toggleNodeExpansionRef.current = toggleNodeExpansion;
  }, [toggleNodeExpansion]);

  // Auto-layout with visibility handling
  const applyAutoLayout = useCallback((currentNodes: CustomNode[], currentEdges: Edge[], focusNodeId?: string) => {
    // Inject live data helpers (hasChildren, onToggle)
    const nodesWithData = currentNodes.map(node => {
      const hasChildren = currentEdges.some(e => e.source === node.id);
      return {
        ...node,
        type: 'mindMap', // Ensure type is always mindMap
        data: {
          ...node.data,
          hasChildren,
          onToggle: (id: string) => toggleNodeExpansionRef.current(id),
          onLabelChange: (id: string, label: string, intent?: 'TAB' | 'ENTER') => handleLabelChangeRef.current(id, label, intent),
          onEditBlur: (id: string) => handleEditBlurRef.current(id)
        }
      };
    });

    // 1. Calculate visibility based on 'expanded' state
    const nodesWithVisibility = getVisibleNodes(nodesWithData, currentEdges) as CustomNode[];

    // 2. Filter visible nodes for layout calculation
    const visibleNodes = nodesWithVisibility.filter(n => !n.hidden);
    const visibleEdges = currentEdges.filter(e =>
      !nodesWithVisibility.find(n => n.id === e.source)?.hidden &&
      !nodesWithVisibility.find(n => n.id === e.target)?.hidden
    );

    // 3. Layout visible elements
    const { nodes: layoutedVisibleNodes } = getLayoutedElements(
      visibleNodes,
      visibleEdges
    );

    // 4. Merge results: Update positions for visible nodes, keep hidden nodes hidden
    const finalNodes = nodesWithVisibility.map(node => {
      const layoutedNode = layoutedVisibleNodes.find(ln => ln.id === node.id);
      if (layoutedNode) {
        return layoutedNode;
      }
      return node;
    }) as CustomNode[];

    // Set Nodes/Edges via Store (Atomic update for History)
    setGraph(finalNodes, currentEdges);


    if (focusNodeId) {
      const focusNode = finalNodes.find(n => n.id === focusNodeId);
      if (focusNode && focusNode.position) {
        const { zoom } = getViewport();
        // Use fitView to robustly focus on the node using ReactFlow's internal logic
        // We set minZoom and maxZoom to current zoom to prevent zooming in/out, just pan.
        // Timeout reduced to 50ms to start panning almost immediately (but after render)
        setTimeout(() => {
          fitView({
            nodes: [{ id: focusNodeId }],
            duration: 800,
            minZoom: zoom,
            maxZoom: zoom,
          });
        }, 50);
      }
    }
  }, [setNodes, setEdges, setCenter, getViewport, fitView]); // Store actions are stable

  // Update ref whenever applyAutoLayout changes
  useEffect(() => {
    applyAutoLayoutRef.current = applyAutoLayout;
  }, [applyAutoLayout]);


  const getSelectedNode = useCallback(() => {
    return getNodes().find((n) => n.selected);
  }, [getNodes]);

  const addChildNode = useCallback(() => {
    const currentNodes = getNodes();
    const selectedNode = currentNodes.find(n => n.selected);

    if (!selectedNode) return;

    const newNodeId = `${Date.now()}`;
    const newNode: CustomNode = {
      id: newNodeId,
      position: { x: selectedNode.position.x + 200, y: selectedNode.position.y },
      data: { label: 'New Topic', expanded: true, isEditing: true },
      type: 'mindMap',
      selected: true, // Auto-select new node
      width: 172,
      height: 50,
    };

    const newEdge: Edge = {
      id: `e${selectedNode.id}-${newNodeId}`,
      source: selectedNode.id,
      target: newNodeId,
    };

    // Deselect other nodes
    const deselectNodes = currentNodes.map(n => ({ ...n, selected: false }));
    const updatedNodes = [...deselectNodes, newNode] as CustomNode[];
    const updatedEdges = [...getEdges(), newEdge];

    applyAutoLayout(updatedNodes, updatedEdges, newNodeId);

    // Initial edit mode for new node
  }, [getNodes, getEdges, applyAutoLayout]);

  // Update ref
  useEffect(() => {
    addChildNodeRef.current = addChildNode;
  }, [addChildNode]);


  const addSiblingNode = useCallback(() => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const selectedNode = currentNodes.find(n => n.selected);

    if (!selectedNode) return;

    // Find parent
    const parentEdge = currentEdges.find(e => e.target === selectedNode.id);

    if (!parentEdge) return;

    const parentNodeId = parentEdge.source;
    const newNodeId = `${Date.now()}`;
    const newNode: CustomNode = {
      id: newNodeId,
      position: { x: selectedNode.position.x, y: selectedNode.position.y + 100 },
      data: { label: 'New Topic', expanded: true, isEditing: true },
      type: 'mindMap',
      selected: true, // Auto-select
      width: 172,
      height: 50,
    };

    const newEdge: Edge = {
      id: `e${parentNodeId}-${newNodeId}`,
      source: parentNodeId,
      target: newNodeId,
    };

    const deselectNodes = currentNodes.map(n => ({ ...n, selected: false }));
    const updatedNodes = [...deselectNodes, newNode] as CustomNode[];
    const updatedEdges = [...currentEdges, newEdge];

    applyAutoLayout(updatedNodes, updatedEdges, newNodeId);


  }, [getNodes, getEdges, applyAutoLayout]);

  const deleteSelectedNodes = useCallback(() => {
    const selectedNodes = getNodes().filter(n => n.selected);
    if (selectedNodes.length === 0) return;

    const currentEdges = getEdges();
    const incomingEdgeTargets = new Set(currentEdges.map(e => e.target));
    // Prevent deleting root node (assuming ID '1' is always root)
    const directNodesToDelete = selectedNodes
      .filter(n => incomingEdgeTargets.has(n.id) || n.id !== '1') // Allow if it has incoming edge (not root usually) OR is not root
      .filter(n => n.id !== '1'); // Strict check: never delete ID '1'

    if (directNodesToDelete.length === 0) return;

    // Recursive helper to find all descendants
    const getDescendants = (nodeIds: string[], accumulated: Set<string> = new Set()): Set<string> => {
      const children = currentEdges
        .filter(e => nodeIds.includes(e.source))
        .map(e => e.target);

      if (children.length === 0) return accumulated;

      const newChildren = children.filter(id => !accumulated.has(id));
      newChildren.forEach(id => accumulated.add(id));

      return getDescendants(newChildren, accumulated);
    };

    const descendants = getDescendants(directNodesToDelete.map(n => n.id));
    const allIdsToDelete = new Set([...directNodesToDelete.map(n => n.id), ...descendants]);

    let parentIdToFocus: string | undefined;
    const firstDeletedNode = directNodesToDelete[0];
    const parentEdge = currentEdges.find(e => e.target === firstDeletedNode.id);
    if (parentEdge) {
      parentIdToFocus = parentEdge.source;
    }

    const remainingNodes = getNodes()
      .filter((n) => !allIdsToDelete.has(n.id))
      .map(n => {
        if (parentIdToFocus && n.id === parentIdToFocus) {
          return { ...n, selected: true };
        }
        return { ...n, selected: false };
      }) as CustomNode[];

    const remainingEdges = getEdges().filter((e) => !allIdsToDelete.has(e.source) && !allIdsToDelete.has(e.target));

    applyAutoLayout(remainingNodes, remainingEdges, parentIdToFocus);
  }, [getNodes, getEdges, applyAutoLayout]);

  const onNodeDoubleClickInternal = useCallback((event: React.MouseEvent, node: CustomNode) => {
    if (isReadOnly) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === node.id) {
          return {
            ...n,
            data: { ...n.data, isEditing: true },
          };
        }
        return n;
      })
    );
  }, [isReadOnly, setNodes]);



  const moveSelection = useCallback((key: string) => {
    const selectedNode = getSelectedNode() as CustomNode | undefined;
    if (!selectedNode) return;

    const currentNodes = getNodes() as CustomNode[];
    const currentEdges = getEdges();

    // Sort logic helper
    const getSortedChildren = (parentNodeId: string) => {
      const childEdges = currentEdges.filter(e => e.source === parentNodeId);
      const childNodes = currentNodes.filter(n => childEdges.some(e => e.target === n.id) && !n.hidden);
      return childNodes.sort((a, b) => a.position.y - b.position.y);
    };

    let nextNodeId: string | undefined;

    if (key === 'ArrowLeft') {
      const parentEdge = currentEdges.find(e => e.target === selectedNode.id);
      if (parentEdge) nextNodeId = parentEdge.source;
    } else if (key === 'ArrowRight') {
      if (selectedNode.data.expanded !== false) {
        const childNodes = getSortedChildren(selectedNode.id);
        if (childNodes.length > 0) {
          const middleIndex = Math.floor(childNodes.length / 2);
          nextNodeId = childNodes[middleIndex].id;
        }
      }
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      const parentEdge = currentEdges.find(e => e.target === selectedNode.id);

      let siblings: CustomNode[] = [];
      if (parentEdge) {
        siblings = getSortedChildren(parentEdge.source);
      } else {
        const nonRootIds = new Set(currentEdges.map(e => e.target));
        siblings = currentNodes.filter(n => !nonRootIds.has(n.id) && !n.hidden);
        siblings.sort((a, b) => a.position.y - b.position.y);
      }

      const currentIndex = siblings.findIndex(n => n.id === selectedNode.id);
      if (currentIndex !== -1) {
        if (key === 'ArrowUp' && currentIndex > 0) {
          nextNodeId = siblings[currentIndex - 1].id;
        } else if (key === 'ArrowDown' && currentIndex < siblings.length - 1) {
          nextNodeId = siblings[currentIndex + 1].id;
        }
      }
    }

    if (nextNodeId) {
      // Pause history for selection change? Usually yes.
      pause();
      setNodes((nds) => nds.map(n => ({
        ...n,
        selected: n.id === nextNodeId
      })));
      resume();

      const nextNode = currentNodes.find(n => n.id === nextNodeId);
      if (nextNode && nextNode.position) {
        const { zoom } = getViewport();
        fitView({
          nodes: [{ id: nextNodeId }],
          duration: 300,
          minZoom: zoom,
          maxZoom: zoom,
        });
      }
    }
  }, [getNodes, getEdges, getSelectedNode, setNodes, setCenter, getViewport, pause, resume, fitView]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (isReadOnly) return;

    const activeElement = document.activeElement;
    const isInput = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
    if (isInput) return;

    const isCtrl = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (isCtrl && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }

    const isRedoKey = key === 'y' || (key === 'z' && event.shiftKey);
    if (isCtrl && isRedoKey) {
      event.preventDefault();
      redo();
      return;
    }

    switch (event.key) {
      case 'Tab':
        event.preventDefault();
        addChildNode();
        break;
      case 'Enter':
        event.preventDefault();
        addSiblingNode();
        break;
      case 'Delete':
      case 'Backspace':
        deleteSelectedNodes();
        break;
      case ' ':
        event.preventDefault();
        const selectedNode = getSelectedNode();
        if (selectedNode) {
          setNodes((nds) => nds.map((n) => {
            if (n.id === selectedNode.id) {
              return { ...n, data: { ...n.data, isEditing: true } };
            }
            return n;
          }));
        }
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        event.preventDefault();
        moveSelection(event.key);
        break;
    }
  }, [isReadOnly, addChildNode, addSiblingNode, deleteSelectedNodes, moveSelection, getSelectedNode, undo, redo, setNodes]);

  return (
    <div
      ref={mindMapContainerRef} // 2. Provide ref to container div
      style={{ width: '100%', height: '100%', background: '#fff', position: 'relative', outline: 'none' }}
      onKeyDown={onKeyDown}
      tabIndex={0}
      className='mindmap-container' // Identifier for tests
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          onNodesChange(changes as NodeChange<CustomNode>[]);
          // If a node is deselected, ensure the container gets focus back
          if (changes.some(c => c.type === 'select' && !c.selected)) {
            if (mindMapContainerRef.current) {
              mindMapContainerRef.current.focus();
            }
          }
        }}
        onEdgesChange={onEdgesChange}
        onConnect={onConnectStore}
        onNodeDoubleClick={onNodeDoubleClickInternal}
        onKeyDown={onKeyDown}
        selectNodesOnDrag={false}
        nodesDraggable={false}
        nodeTypes={nodeTypes}
        nodesConnectable={!isReadOnly}
        elementsSelectable={!isReadOnly}
      >
        <Background />
        <Controls />

        {!isReadOnly && (
          <Panel position="top-center">
            <Space>
              <Tooltip title="元に戻す (Ctrl+Z)">
                <Button
                  icon={<UndoOutlined />}
                  onClick={() => undo()}
                  disabled={pastStates.length === 0}
                  aria-label="元に戻す"
                />
              </Tooltip>
              <Tooltip title="やり直す (Ctrl+Y)">
                <Button
                  icon={<RedoOutlined />}
                  onClick={() => redo()}
                  disabled={futureStates.length === 0}
                  aria-label="やり直す"
                />
              </Tooltip>
              <div style={{ width: 1, height: 24, background: '#eee', margin: '0 8px' }} />
              <Tooltip title="子トピックを追加 (Tab)">
                <Button
                  icon={<NodeIndexOutlined />}
                  onClick={addChildNode}
                  aria-label="子追加"
                >
                  子追加
                </Button>
              </Tooltip>
              <Tooltip title="兄弟トピックを追加 (Enter)">
                <Button
                  icon={<EnterOutlined style={{ transform: 'scaleX(-1)' }} />}
                  onClick={addSiblingNode}
                  aria-label="兄弟追加"
                >
                  兄弟追加
                </Button>
              </Tooltip>
              <Tooltip title="削除 (Del)">
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  onClick={deleteSelectedNodes}
                  aria-label="削除"
                />
              </Tooltip>
            </Space>
          </Panel>
        )}
      </ReactFlow>

    </div>
  );
};

const MindMapPanel: React.FC<MindMapPanelProps> = (props) => {
  return (
    <ReactFlowProvider>
      <MindMapContent {...props} />
    </ReactFlowProvider>
  );
};

export default MindMapPanel;