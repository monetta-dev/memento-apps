import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FaceToFaceDashboard from '@/components/session/FaceToFaceDashboard';
import type { Subordinate, Session, AgendaItem, Note } from '@/store/useStore';

// Mock data
const mockSubordinate: Subordinate = {
  id: 'sub-1',
  name: '山田 太郎',
  role: 'エンジニア',
  department: '開発部',
  traits: ['詳細志向', '論理的', '協調性'],
  lastOneOnOne: '2024-01-20',
};

const mockSession: Session = {
  id: 'session-1',
  subordinateId: 'sub-1',
  date: '2024-01-25',
  mode: 'face-to-face',
  theme: 'プロジェクト進捗確認',
  status: 'live',
};

const mockAgendaItems: AgendaItem[] = [
  { id: '1', text: '前回のアクションアイテム確認', completed: true },
  { id: '2', text: '現在のプロジェクト進捗', completed: false },
];

const mockNotes: Note[] = [
  { id: '1', content: '山田さんはプロジェクトAが順調とのこと', timestamp: '10:05', source: 'manual' },
  { id: '2', content: '次回までに仕様書を完成させる', timestamp: '10:15', source: 'ai' },
];

describe('FaceToFaceDashboard', () => {
  const mockOnAddNote = vi.fn();
  const mockOnUpdateAgenda = vi.fn();
  const mockOnToggleTimer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render subordinate profile correctly', () => {
    render(
      <FaceToFaceDashboard
        subordinate={mockSubordinate}
        sessionData={mockSession}
        agendaItems={[]}
        notes={[]}
        elapsedTime={300}
        sessionDuration={3600}
        onAddNote={mockOnAddNote}
        onUpdateAgenda={mockOnUpdateAgenda}
        onToggleTimer={mockOnToggleTimer}
      />
    );

    expect(screen.getByText('部下プロファイル')).toBeInTheDocument();
    expect(screen.getByText('山田 太郎')).toBeInTheDocument();
    expect(screen.getByText('エンジニア • 開発部')).toBeInTheDocument();
    expect(screen.getByText('詳細志向')).toBeInTheDocument();
    expect(screen.getByText('論理的')).toBeInTheDocument();
    expect(screen.getByText('協調性')).toBeInTheDocument();
  });

  test('should render agenda items', () => {
    render(
      <FaceToFaceDashboard
        subordinate={mockSubordinate}
        sessionData={mockSession}
        agendaItems={mockAgendaItems}
        notes={[]}
        elapsedTime={300}
        sessionDuration={3600}
        onAddNote={mockOnAddNote}
        onUpdateAgenda={mockOnUpdateAgenda}
        onToggleTimer={mockOnToggleTimer}
      />
    );

    expect(screen.getByText('本日の議題')).toBeInTheDocument();
    expect(screen.getByText('前回のアクションアイテム確認')).toBeInTheDocument();
    expect(screen.getByText('現在のプロジェクト進捗')).toBeInTheDocument();
    expect(screen.getByText('完了: 1 / 2')).toBeInTheDocument();
  });

  test('should render timer with correct time', () => {
    render(
      <FaceToFaceDashboard
        subordinate={mockSubordinate}
        sessionData={mockSession}
        agendaItems={[]}
        notes={[]}
        elapsedTime={125} // 2 minutes 5 seconds
        sessionDuration={3600}
        onAddNote={mockOnAddNote}
        onUpdateAgenda={mockOnUpdateAgenda}
        onToggleTimer={mockOnToggleTimer}
      />
    );

    expect(screen.getByText('セッションタイマー')).toBeInTheDocument();
    expect(screen.getByText('02:05')).toBeInTheDocument();
    expect(screen.getByText('残り: 57:55')).toBeInTheDocument();
  });

  test('should render notes', () => {
    render(
      <FaceToFaceDashboard
        subordinate={mockSubordinate}
        sessionData={mockSession}
        agendaItems={[]}
        notes={mockNotes}
        elapsedTime={300}
        sessionDuration={3600}
        onAddNote={mockOnAddNote}
        onUpdateAgenda={mockOnUpdateAgenda}
        onToggleTimer={mockOnToggleTimer}
      />
    );

    expect(screen.getByText('メモ')).toBeInTheDocument();
    expect(screen.getByText('山田さんはプロジェクトAが順調とのこと')).toBeInTheDocument();
    expect(screen.getByText('次回までに仕様書を完成させる')).toBeInTheDocument();
  });

  test('should add new agenda item', () => {
    render(
      <FaceToFaceDashboard
        subordinate={mockSubordinate}
        sessionData={mockSession}
        agendaItems={[]}
        notes={[]}
        elapsedTime={300}
        sessionDuration={3600}
        onAddNote={mockOnAddNote}
        onUpdateAgenda={mockOnUpdateAgenda}
        onToggleTimer={mockOnToggleTimer}
      />
    );

    const agendaInput = screen.getByPlaceholderText('議題を追加...');
    const addButton = screen.getByText('+');

    fireEvent.change(agendaInput, { target: { value: '新しい議題' } });
    fireEvent.click(addButton);

    expect(mockOnUpdateAgenda).toHaveBeenCalledWith([
      { id: expect.any(String), text: '新しい議題', completed: false },
    ]);
  });

  test('should add new note', () => {
    render(
      <FaceToFaceDashboard
        subordinate={mockSubordinate}
        sessionData={mockSession}
        agendaItems={[]}
        notes={[]}
        elapsedTime={300}
        sessionDuration={3600}
        onAddNote={mockOnAddNote}
        onUpdateAgenda={mockOnUpdateAgenda}
        onToggleTimer={mockOnToggleTimer}
      />
    );

    const noteInput = screen.getByPlaceholderText('メモを入力...');
    const addNoteButton = screen.getByText('追加');

    fireEvent.change(noteInput, { target: { value: '新しいメモ' } });
    fireEvent.click(addNoteButton);

    expect(mockOnAddNote).toHaveBeenCalledWith('新しいメモ');
  });

  test('should toggle agenda item completion', () => {
    render(
      <FaceToFaceDashboard
        subordinate={mockSubordinate}
        sessionData={mockSession}
        agendaItems={mockAgendaItems}
        notes={[]}
        elapsedTime={300}
        sessionDuration={3600}
        onAddNote={mockOnAddNote}
        onUpdateAgenda={mockOnUpdateAgenda}
        onToggleTimer={mockOnToggleTimer}
      />
    );

    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);

    expect(mockOnUpdateAgenda).toHaveBeenCalledWith([
      { id: '1', text: '前回のアクションアイテム確認', completed: false }, // Toggled from true to false
      { id: '2', text: '現在のプロジェクト進捗', completed: false },
    ]);
  });

  test('should toggle timer pause state', () => {
    render(
      <FaceToFaceDashboard
        subordinate={mockSubordinate}
        sessionData={mockSession}
        agendaItems={[]}
        notes={[]}
        elapsedTime={300}
        sessionDuration={3600}
        timerPaused={false}
        onAddNote={mockOnAddNote}
        onUpdateAgenda={mockOnUpdateAgenda}
        onToggleTimer={mockOnToggleTimer}
      />
    );

    const toggleButton = screen.getByText('一時停止');
    fireEvent.click(toggleButton);

    expect(mockOnToggleTimer).toHaveBeenCalledWith(true);
  });

  test('should show session stage based on progress', () => {
    render(
      <FaceToFaceDashboard
        subordinate={mockSubordinate}
        sessionData={mockSession}
        agendaItems={[]}
        notes={[]}
        elapsedTime={100} // Less than 5 minutes
        sessionDuration={3600}
        onAddNote={mockOnAddNote}
        onUpdateAgenda={mockOnUpdateAgenda}
        onToggleTimer={mockOnToggleTimer}
      />
    );

    expect(screen.getByText('セッション開始直後')).toBeInTheDocument();
  });

  test('should render without subordinate data', () => {
    render(
      <FaceToFaceDashboard
        sessionData={mockSession}
        agendaItems={[]}
        notes={[]}
        elapsedTime={300}
        sessionDuration={3600}
        onAddNote={mockOnAddNote}
        onUpdateAgenda={mockOnUpdateAgenda}
        onToggleTimer={mockOnToggleTimer}
      />
    );

    expect(screen.getByText('部下情報を読み込み中...')).toBeInTheDocument();
  });
});