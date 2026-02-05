import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MindMapPanel from '@/components/session/MindMapPanel';
import { useMindMapStore } from '@/store/useMindMapStore';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ResizeObserver mock
global.ResizeObserver = class ResizeObserver {
  observe() { }
  unobserve() { }
  disconnect() { }
};

// Mock layoutUtils
vi.mock('@/components/session/layoutUtils', () => ({
  getLayoutedElements: vi.fn((nodes, edges) => ({ nodes, edges })),
  getVisibleNodes: vi.fn((nodes, edges) => nodes),
}));

// Mock zundo
// Since we use the real store, we don't strictly *need* to mock zundo, 
// as long as the store creation works. But we might want to ensure temporal is attached.
// The store export includes temporal.

// Helper to reset store
const resetStore = () => {
  useMindMapStore.setState({
    nodes: [],
    edges: [],
  });
  useMindMapStore.temporal.getState().clear();
};

describe('MindMapPanel (Zundo Store)', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  const initialNodes = [
    { id: '1', position: { x: 0, y: 0 }, data: { label: 'Root' }, type: 'mindMap', width: 100, height: 40 },
  ];

  const renderComponent = () => {
    return render(
      <ReactFlowProvider>
        <MindMapPanel />
      </ReactFlowProvider>
    );
  };

  it('should render initial nodes from store', () => {
    useMindMapStore.setState({ nodes: initialNodes, edges: [] });
    renderComponent();
    expect(screen.getByText('Root')).toBeInTheDocument();
  });

  it('should add child node and update store', async () => {
    useMindMapStore.setState({ nodes: [{ ...initialNodes[0], selected: true }], edges: [] });
    const user = userEvent.setup();
    renderComponent();

    const addButton = screen.getByLabelText('子追加');
    await user.click(addButton);

    const nodes = useMindMapStore.getState().nodes;
    expect(nodes).toHaveLength(2);
    expect(nodes[1].data.label).toBe('New Topic');
    expect(useMindMapStore.getState().edges).toHaveLength(1);
  });

  it('should undo last action (Zundo)', async () => {
    useMindMapStore.setState({ nodes: [{ ...initialNodes[0], selected: true }], edges: [] });
    const user = userEvent.setup();
    renderComponent();

    // 1. Add Child
    const addButton = screen.getByLabelText('子追加');
    await user.click(addButton);
    expect(useMindMapStore.getState().nodes).toHaveLength(2);

    // 2. Undo
    const undoButton = screen.getByLabelText('元に戻す');
    await user.click(undoButton);

    expect(useMindMapStore.getState().nodes).toHaveLength(1);
    expect(screen.queryByText('New Topic')).not.toBeInTheDocument();
  });

  it('should redo action (Zundo)', async () => {
    useMindMapStore.setState({ nodes: [{ ...initialNodes[0], selected: true }], edges: [] });
    const user = userEvent.setup();
    renderComponent();

    // 1. Add Child
    await user.click(screen.getByLabelText('子追加'));
    expect(useMindMapStore.getState().nodes).toHaveLength(2);

    // 2. Undo
    await user.click(screen.getByLabelText('元に戻す'));
    expect(useMindMapStore.getState().nodes).toHaveLength(1);

    // 3. Redo
    await user.click(screen.getByLabelText('やり直す'));
    expect(useMindMapStore.getState().nodes).toHaveLength(2);
  });

  it.skip('should handle rename and save', async () => {
    useMindMapStore.setState({ nodes: [{ ...initialNodes[0], selected: true }], edges: [] });
    const user = userEvent.setup();
    renderComponent();

    // Add child to open modal
    const addButton = screen.getByLabelText('子追加');
    fireEvent.click(addButton);

    // Find input by value (default 'New Topic')
    // We need to wait for modal to be visible.
    const input = await screen.findByDisplayValue('New Topic');
    fireEvent.change(input, { target: { value: 'Renamed Topic' } });

    // Click Save button in Modal (text "保存")
    const saveButton = await screen.findByText('保存');
    fireEvent.click(saveButton);

    const nodes = useMindMapStore.getState().nodes;
    expect(nodes.find(n => n.data.label === 'Renamed Topic')).toBeDefined();
  });

  it('should handle SessionPage initialization flow (set then clear history)', async () => {
    // 1. Simulate Page Mount & Init
    useMindMapStore.setState({ nodes: [{ ...initialNodes[0], selected: true }], edges: [] });
    // Simulate calling clear() which happens in SessionPage
    useMindMapStore.temporal.getState().clear();

    // Check initial state
    expect(useMindMapStore.getState().nodes).toHaveLength(1);
    expect(useMindMapStore.temporal.getState().pastStates).toHaveLength(0);

    const user = userEvent.setup();
    renderComponent();

    // 2. Add Child (User Action 1)
    const addButton = screen.getByLabelText('子追加');
    fireEvent.click(addButton);

    // Check state update
    expect(useMindMapStore.getState().nodes).toHaveLength(2);
    // History should keep the Add action
    expect(useMindMapStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    // 3. User Undo
    const undoButton = screen.getByLabelText('元に戻す');
    await user.click(undoButton);

    // Should revert to 1 node
    expect(useMindMapStore.getState().nodes).toHaveLength(1);
  });

});