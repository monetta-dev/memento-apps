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
import { Button, Space, Tooltip, Modal, Input, type InputRef } from 'antd';
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


  // Renaming state
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [isCreatingNode, setIsCreatingNode] = useState(false);
  const inputRef = useRef<InputRef>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isRenameModalOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isRenameModalOpen]);

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
          onToggle: (id: string) => toggleNodeExpansionRef.current(id)
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
        setTimeout(() => {
          fitView({
            nodes: [{ id: focusNodeId }],
            duration: 800,
            minZoom: zoom,
            maxZoom: zoom,
          });
        }, 0);
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
      data: { label: 'New Topic', expanded: true },
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

    // Auto-open rename modal
    setEditingNodeId(newNodeId);
    setEditingLabel(newNode.data.label);
    setIsRenameModalOpen(true);
    setIsCreatingNode(true);
    // Pause recording logic handling?
    // Actually Zundo tracks every setNodes.
    // Ideally we want 1 history item for Add + Rename.
    // We can pause() here? No, 'Add' needs to be recorded.
    // Retain 'isCreatingNode' logic to handle consolidation or rely on zundo's grouping if implemented.
    // For now, let zundo snapshot 'Add'. If we want to group rename, we might need a transaction.
    // Or we pause() before rename?

  }, [getNodes, getEdges, applyAutoLayout]);

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
      data: { label: 'New Topic', expanded: true },
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

    setEditingNodeId(newNodeId);
    setEditingLabel(newNode.data.label);
    setIsRenameModalOpen(true);
    setIsCreatingNode(true);
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
    setEditingNodeId(node.id);
    setEditingLabel(node.data.label);
    setIsRenameModalOpen(true);
  }, [isReadOnly]);

  const handleRenameSave = useCallback((e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (!editingNodeId) return;

    // Implementation Note:
    // With Zundo, every state change is recorded.
    // If 'isCreatingNode' is true, we just Added a node (1 history).
    // Now we Rename it. This adds another history step.
    // Users prefer "Add+Rename" as 1 step.
    // Zundo doesn't support 'retroactive merge' easily without transactions.
    // WORKAROUND: We can just let it be 2 steps to start with (Safe), 
    // OR we can try to pause() tracking during 'Add' and resume() after 'Rename'?
    // No, we want 'Add' to be undoable if we Cancel rename.
    // The previous manual logic skipped snapshot on Rename if isCreatingNode.

    // Zundo Logic:
    // We can pause tracking *before* the rename state update if isCreatingNode is true?
    // But then the Rename isn't tracked? So Undo would revert the Name change?
    // If we pause, the Rename mutation applies but history doesn't see it.
    // So Undo goes back to 'Before Add'? No, Zundo doesn't know about the Pause mutation?
    // Actually if we Pause, the state changes but history pointer stays.
    // So Undo would jump back to state BEFORE the Pause changes (i.e. before Rename).
    // Which is the 'Add' state.

    // Desired: Undo from (Add+Rename) -> (Pre-Add).
    // Means we want to overwite the 'Add' history entry with the 'Add+Rename' state?
    // Zundo doesn't support overwrite.

    // Alternative: We accept 2 steps for now, or use `isCreatingNode` to simply NOT Pause, 
    // but maybe we can merge?

    // Let's stick to standard behavior first: Every change is a snapshot.
    // If users complain about 2 steps, we refine.
    // Actually, manual implementation had this refinement.
    // We can achieve this by:
    // 1. pause() before Add? No.
    // 2. pause() before Rename? Then Undo -> Add State (with old name).
    // So User un-renames, then un-adds. That is 2 steps.

    // To get 1 step: We need the 'Add' action NOT to create a history entry yet?
    // But we need to see it.

    // For now, I will create a standard save. 
    // We can optimize 'isCreatingNode' later if needed.
    // OR: We use `interaction` grouping if we had it, but Zundo is simple.
    // Actually, if we use `pause()` during `Add`... no.

    // Let's implement standard SetNodes.

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === editingNodeId) {
          return {
            ...node,
            selected: true,
            data: {
              ...node.data,
              label: editingLabel,
            },
          };
        }
        return { ...node, selected: false };
      })
    );
    setIsRenameModalOpen(false);
    setEditingNodeId(null);
    setEditingLabel('');
    setIsCreatingNode(false);
  }, [editingNodeId, editingLabel, setNodes, isCreatingNode]);

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
    if (isReadOnly || isRenameModalOpen) return;

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
          setEditingNodeId(selectedNode.id);
          setEditingLabel(selectedNode.data.label as string);
          setIsRenameModalOpen(true);
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
  }, [isReadOnly, isRenameModalOpen, addChildNode, addSiblingNode, deleteSelectedNodes, moveSelection, getSelectedNode, undo, redo]);

  return (
    <div
      style={{ width: '100%', height: '100%', background: '#fff', position: 'relative' }}
      onKeyDown={onKeyDown}
      tabIndex={0}
      className='mindmap-container' // Identifier for tests
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
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

      <Modal
        title="トピック名の編集"
        open={isRenameModalOpen}
        onOk={handleRenameSave}
        onCancel={() => {
          setIsRenameModalOpen(false);
          setIsCreatingNode(false);
        }}
        okText="保存"
        cancelText="キャンセル"
      >
        <Input
          ref={inputRef}
          value={editingLabel}
          onChange={(e) => setEditingLabel(e.target.value)}
          onPressEnter={handleRenameSave}
          autoFocus
        />
      </Modal>
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