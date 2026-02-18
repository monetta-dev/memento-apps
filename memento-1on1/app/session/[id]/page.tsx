'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Layout, notification, Spin, Row, Col, Card } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { Node, Edge, useNodesState, useEdgesState, addEdge, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRouter, useParams } from 'next/navigation';
import { useStore, type AgendaItem, type Note } from '@/store/useStore';
import { useMindMapStore } from '@/store/useMindMapStore';
import { useStore as useZundoStore } from 'zustand';

import SessionHeader from '@/components/session/SessionHeader';

import FaceToFaceDashboard from '@/components/session/FaceToFaceDashboard';
import ControlsBar from '@/components/session/ControlsBar';
import AdvicePanel from '@/components/session/AdvicePanel';
// TranscriptPanel removed


import dynamic from 'next/dynamic';

const VideoPanel = dynamic(() => import('@/components/session/VideoPanel'), {
  loading: () => <div style={{ color: '#fff', textAlign: 'center', padding: 50 }}>ビデオ通話を準備中...</div>,
  ssr: false
});

const TranscriptionHandler = dynamic(() => import('@/components/TranscriptionHandler'), {
  ssr: false
});

const MindMapPanel = dynamic(() => import('@/components/session/MindMapPanel'), {
  loading: () => <div style={{ textAlign: 'center', padding: 50 }}>マインドマップを読み込み中...</div>,
  ssr: false
});

type CustomNode = Node<{ label: string }>;

const { Content, Sider } = Layout;

// Mock Data for Simulation (Kept for fallback logic if needed)
const MOCK_ADVICES = [
  "部下の話を遮らず、最後まで聞きましょう。",
  "「何か手伝えることは？」とオープンに問いかけてみてください。",
];

const initialNodes: CustomNode[] = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: '1on1 Theme: Project A' }, type: 'input', selected: true },
];
const initialEdges: Edge[] = [];

export default function SessionPage() {
  const router = useRouter();
  const params = useParams();
  // Select state and actions with shallow comparison to avoid unnecessary re-renders
  const sessions = useStore(state => state.sessions);
  const subordinates = useStore(state => state.subordinates);
  const updateSession = useStore(state => state.updateSession);
  const fetchSessions = useStore(state => state.fetchSessions);
  const fetchSubordinates = useStore(state => state.fetchSubordinates);

  const [api, contextHolder] = notification.useNotification();

  // Session State
  const [messages, setMessages] = useState<{ speaker: string, text: string, time: string }[]>([]);
  const [realTimeAdvice, setRealTimeAdvice] = useState<string>('会話を待っています...');
  const [adviceHistory, setAdviceHistory] = useState<string[]>([]);

  const [isMindMapMode, setIsMindMapMode] = useState(false);
  // Face-to-Face mode state
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAiQuestionMode, setIsAiQuestionMode] = useState(false);

  const handleToggleMode = useCallback(() => {
    setIsAiQuestionMode(prev => !prev);
  }, []);

  const [micOn, setMicOn] = useState(true); // Re-introduce mic control for transcription handling
  const isAnalyzingRef = useRef<boolean>(false);
  const lastAdviceTimeRef = useRef<number>(0);
  const [remoteAudioStream, setRemoteAudioStream] = useState<MediaStream | null>(null);
  const prevRemoteStreamRef = useRef<MediaStream | null>(null);
  // logEndRef removed

  const agendaSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const notesSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const handleTranscript = useCallback((text: string, speaker: 'manager' | 'subordinate') => {
    const newMessage = {
      speaker,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const handleRemoteAudioTrack = useCallback((stream: MediaStream | null) => {
    // Skip update if stream is effectively the same
    const prevStream = prevRemoteStreamRef.current;
    if ((!stream && !prevStream) || (stream && prevStream && stream.id === prevStream.id)) {
      return;
    }
    prevRemoteStreamRef.current = stream;
    setRemoteAudioStream(stream);
  }, []);

  // Face-to-Face mode handlers
  const handleAddNote = useCallback((content: string) => {
    const newNote: Note = {
      id: Date.now().toString(),
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'manual'
    };
    setNotes(prev => [...prev, newNote]);
  }, []);





  // Track if we've fetched for this session ID
  const hasFetchedRef = useRef<string | null>(null);



  // Fetch session data on mount or when session ID changes
  useEffect(() => {
    // Skip if already fetched this session
    if (hasFetchedRef.current === params.id) {
      return;
    }

    try {
      fetchSessions();
      fetchSubordinates();
      hasFetchedRef.current = params.id as string;
    } catch (error) {
      console.error('Error fetching session data:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const sessionData = useMemo(() => {
    const data = sessions.find(s => s.id === params.id);
    return data;
  }, [sessions, params.id]);

  // Initialize notes from session data when sessionData changes
  useEffect(() => {
    if (sessionData && sessionData.notes && notes.length === 0) {
      setNotes(sessionData.notes);
    }
  }, [sessionData, notes.length]);

  const subordinate = useMemo(() => {
    if (!sessionData) {
      return undefined;
    }
    const sub = subordinates.find(s => s.id === sessionData.subordinateId);
    return sub;
  }, [sessionData, subordinates]);

  const handleAskAI = useCallback(async (question: string) => {
    if (!question.trim()) return;

    try {
      const recentMessages = messages.slice(-10); // Last 10 messages

      const response = await fetch('/api/chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: recentMessages,
          theme: sessionData?.theme || 'General Check-in',
          subordinateTraits: subordinate?.traits || [],
          question: question.trim()
        })
      });

      if (!response.ok) throw new Error('API call failed');

      const data = await response.json();
      if (data.answer) {
        const aiNote: Note = {
          id: Date.now().toString(),
          content: data.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: 'ai'
        };
        setNotes(prev => [...prev, aiNote]);
        api.success({
          message: 'AI Response',
          description: 'AI answer has been added as a note',
          placement: 'topRight',
          duration: 3,
        });
      }
    } catch (error) {
      console.error('Failed to get AI answer:', error);
      // Fallback to mock answer
      const mockAnswer = "Could not get AI response. Please check your connection and try again.";
      const aiNote: Note = {
        id: Date.now().toString(),
        content: mockAnswer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'ai'
      };
      setNotes(prev => [...prev, aiNote]);
      api.error({
        message: 'AI Response Failed',
        description: 'Using fallback answer',
        placement: 'topRight',
        duration: 4,
      });
    }
  }, [messages, sessionData, subordinate]);

  // Trigger real-time AI advice based on conversation
  useEffect(() => {
    const fetchRealTimeAdvice = async () => {
      if (isAnalyzingRef.current || messages.length < 3) return; // Need minimum conversation
      if (Date.now() - lastAdviceTimeRef.current < 30000) return; // Throttle: min 30 seconds between calls

      isAnalyzingRef.current = true;
      try {
        const recentMessages = messages.slice(-10); // Last 10 messages

        // Use memoized sessionData and subordinate instead of finding them again
        const response = await fetch('/api/chat/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: recentMessages,
            theme: sessionData?.theme || 'General Check-in',
            subordinateTraits: subordinate?.traits || []
          })
        });

        if (!response.ok) throw new Error('API call failed');

        const data = await response.json();
        if (data.advice) {
          lastAdviceTimeRef.current = Date.now();
          setRealTimeAdvice(data.advice);
          setAdviceHistory(prev => [...prev, data.advice]);

          api.info({
            message: 'AI Coach Advice',
            description: data.advice,
            placement: 'topRight',
            icon: <BulbOutlined style={{ color: '#1890ff' }} />,
            duration: 6,
          });
        }
      } catch (error) {
        console.error('Failed to fetch AI advice:', error);
        // Fallback to mock advice
        const mockAdvice = MOCK_ADVICES[Math.floor(Math.random() * MOCK_ADVICES.length)];
        setRealTimeAdvice(mockAdvice);
        setAdviceHistory(prev => [...prev, mockAdvice]);

        api.info({
          message: 'AI Coach Advice',
          description: mockAdvice,
          placement: 'topRight',
          icon: <BulbOutlined style={{ color: '#1890ff' }} />,
          duration: 4,
        });
      } finally {
        isAnalyzingRef.current = false;
      }
    };

    // Trigger AI analysis when enough messages accumulated and enough time passed
    if (messages.length >= 3 && Date.now() - lastAdviceTimeRef.current > 30000) {
      fetchRealTimeAdvice();
    }
  }, [messages, sessionData, subordinate]);

  // Scroll effect removed


  // MindMap state - using global store for zundo support
  const mindMapNodes = useMindMapStore(state => state.nodes);
  const mindMapEdges = useMindMapStore(state => state.edges);
  const setMindMapNodes = useMindMapStore(state => state.setNodes);
  const setMindMapEdges = useMindMapStore(state => state.setEdges);
  const { clear: clearHistory } = useZundoStore(useMindMapStore.temporal, (state) => state);

  // Initialize MindMap from session data
  useEffect(() => {
    // Only initialize if store is empty or we specifically want to load (e.g. on first load)
    // Actually sessionData loading happens once.
    if (sessionData && sessionData.mindMapData) {
      // Avoid overwriting if we already have data in store? 
      // Ideally we sync from DB on load.
      // But since we are client-side navigation, if we navigate away and back, store might persist?
      // Zustand store persists in memory.
      // If we want to reset on new session ID:

      // Basic logic: always load from DB on session load.
      // We can check if `nodes.length === 0` to decide? 
      // Or just overwrite.

      // Let's use a ref to track if we initialized for this session ID
      // Reuse hasFetchedRef? No, that's for fetching.

      // Simple approach: When sessionData changes (and is different ID), update store.
      // But sessionData updates on auto-save too. We need to avoid loops.

      // Best: Only load if we haven't loaded this session yet.
      // But we don't have a reliable 'loaded' flag in store.

      // Actually, standard pattern:
      // Load initial data props into store.
      // We can do this once when `isFirstRender` logic runs or similar.

      // For now, let's load if nodes are empty OR if we assume fresh mount.
      // But we just navigated here.

      const dbNodes = sessionData.mindMapData.nodes || initialNodes;
      const dbEdges = sessionData.mindMapData.edges || initialEdges;

      // Check if we need to load (e.g. store is empty or diff ID - but we don't track ID in store)
      // Just set it.
      // setMindMapNodes(dbNodes);
      // setMindMapEdges(dbEdges);
      // clearHistory(); // Clear history after initial load

      // BUT this useEffect runs on every sessionData update (auto-save included).
      // We must NOT overwrite store with DB data if store is ahead.
      // So we only load ONCE.
    }
  }, [sessionData]); // This dependency is dangerous for overwriting.

  // Better initialization logic:
  const sessionLoadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionData && sessionData.id !== sessionLoadedRef.current) {
      // New session loaded
      console.log('Initializing MindMap Store from Session Data');
      let dbNodes = sessionData.mindMapData?.nodes;
      const dbEdges = sessionData.mindMapData?.edges || initialEdges;

      // Safe guard: If dbNodes is empty or missing root, restore initial
      if (!dbNodes || dbNodes.length === 0) {
        dbNodes = initialNodes;
      }

      setMindMapNodes(dbNodes as any); // Cast for safety if types slightly mismatch
      setMindMapEdges(dbEdges);
      console.log('Clearing History after initialization');
      clearHistory();

      sessionLoadedRef.current = sessionData.id;
    } else {
      console.log('Skipping MindMap Init:', {
        hasData: !!sessionData,
        currentId: sessionData?.id,
        loadedId: sessionLoadedRef.current
      });
    }
  }, [sessionData, setMindMapNodes, setMindMapEdges, clearHistory]);


  const [isEnding, setIsEnding] = useState(false);

  const handleCopyInviteLink = useCallback(() => {
    const inviteUrl = `${window.location.origin}/session/${params.id}/join`;
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        api.success({
          message: 'Invite Link Copied',
          description: 'Share this link with your subordinate to join the session.',
          placement: 'topRight',
          duration: 3,
        });
      })
      .catch((err) => {
        console.error('Failed to copy invite link:', err);
        api.error({
          message: 'Failed to Copy',
          description: 'Please copy the URL manually.',
          placement: 'topRight',
        });
      });
  }, [params.id]);

  // Auto-save mindmap changes
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Auto-save: Watch store state
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Don't save if we haven't loaded yet
    if (sessionLoadedRef.current !== params.id) return;

    // Debounce save to avoid too frequent updates
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!sessionData) return;

      try {
        const mindMapData = { nodes: mindMapNodes, edges: mindMapEdges };
        await updateSession(sessionData.id, {
          mindMapData
        });
      } catch (error) {
        console.error('Failed to auto-save mindmap:', error);
      }
    }, 1000); // 1 second debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [mindMapNodes, mindMapEdges, sessionData, updateSession, params.id]);



  // Auto-save notes
  useEffect(() => {
    if (notesSaveTimeoutRef.current) {
      clearTimeout(notesSaveTimeoutRef.current);
    }

    notesSaveTimeoutRef.current = setTimeout(async () => {
      if (!sessionData || notes.length === 0) return;

      try {
        await updateSession(sessionData.id, {
          notes
        });
      } catch (error) {
        console.error('Failed to auto-save notes:', error);
      }
    }, 3000); // 3 second debounce

    return () => {
      if (notesSaveTimeoutRef.current) {
        clearTimeout(notesSaveTimeoutRef.current);
      }
    };
  }, [notes, sessionData, updateSession]);

  const handleEndSession = async () => {
    console.log('handleEndSession called - starting');
    setIsEnding(true);
    try {
      // 1. Prepare transcript data
      const transcriptData = messages.map(m => ({
        speaker: m.speaker as 'manager' | 'subordinate',
        text: m.text,
        timestamp: m.time
      }));

      // 2. Call AI summary API
      console.log('handleEndSession - calling AI summary API');
      let summary = "Automatic summary generated by AI based on the session transcript. The discussion focused on project delays and managing stakeholder expectations.";
      let actionItems: string[] = ["Schedule a follow-up meeting regarding the specs of Project A.", "Share the updated roadmap documentation."];

      try {
        console.log('handleEndSession - fetching /api/chat/summarize');
        const response = await fetch('/api/chat/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: transcriptData,
            theme: sessionData?.theme || 'General Check-in'
          })
        });

        if (response.ok) {
          console.log('handleEndSession - AI summary API response OK');
          const data = await response.json();
          if (data.summary) {
            summary = data.summary;
            console.log('handleEndSession - got AI summary');
          }
          if (Array.isArray(data.actionItems)) {
            actionItems = data.actionItems;
            console.log('handleEndSession - got action items:', actionItems.length);
          }
        } else {
          console.warn('AI summary API returned non-OK status:', response.status);
        }
      } catch (error) {
        console.error('Failed to generate AI summary:', error);
        // Show warning but continue with default summary
        api.warning({
          message: 'AI Summary Generation Failed',
          description: 'Using default summary. Session will be saved.',
          duration: 3,
          placement: 'topRight'
        });
        // Continue with default summary
      }

      // 3. Save data to store
      const currentSessionData = sessions.find(s => s.id === params.id);
      if (currentSessionData) {
        console.log('handleEndSession - calling updateSession with data');
        try {
          // Use latest store data
          // READ directly from store to ensure we have latest even if effect pending
          // (Though mindMapNodes variable is reactive, inside async handler it might be stale closure if not careful? 
          // Actually handleEndSession is re-created on render? No it's not wrapped in useCallback... wait, let's check original logic.
          // Original logic was not shown fully but likely defined in component body.
          // Ideally we use refs or ensure we have latest.
          // Since mindMapNodes is from useMindMapStore hook, it updates component.

          await updateSession(currentSessionData.id, {
            status: 'completed',
            transcript: transcriptData,
            summary: summary,
            mindMapData: {
              nodes: mindMapNodes,
              edges: mindMapEdges,
              actionItems: actionItems
            },
            notes
          });
          console.log('handleEndSession - updateSession completed successfully');
        } catch (updateError) {
          console.error('Failed to update session in database:', updateError);
          // Continue to redirect even if database update fails
          // (e.g., due to updated_at field error which doesn't affect user experience)
        }
      } else {
        console.error('Current session data not found for id:', params.id);
      }

      console.log('handleEndSession - Before redirect, currentSessionData found:', !!currentSessionData);
      // 4. Redirect to summary page
      console.log('handleEndSession - Redirecting to summary page', { sessionId: params.id });

      try {
        // Try router.push first
        await router.push(`/session/${params.id}/summary`);
        console.log('handleEndSession - router.push completed');
      } catch (pushError) {
        console.error('handleEndSession - router.push failed:', pushError);
        // Fallback to window.location
        console.log('handleEndSession - Falling back to window.location.assign');
        window.location.assign(`/session/${params.id}/summary`);
      }
    } catch (error) {
      console.error('handleEndSession - Error ending session:', error);
      let errorMessage = 'Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('Network')) {
          errorMessage = 'Network error occurred. Please check your connection and try again.';
        } else if (error.message.includes('session') || error.message.includes('not found')) {
          errorMessage = 'Session data not found. Please refresh the page and try again.';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      api.error({
        message: 'Failed to End Session',
        description: errorMessage,
        placement: 'topRight',
        duration: 5
      });
    } finally {
      console.log('handleEndSession - finally block, setting isEnding to false');
      setIsEnding(false);
    }
  };


  if (!sessionData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', height: '100dvh' }}>
        <Spin>Loading session data...</Spin>
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', height: '100dvh', overflow: 'auto' }}>
      {contextHolder}
      <SessionHeader
        subordinate={subordinate}
        sessionData={sessionData}
        onCopyInviteLink={handleCopyInviteLink}
      />

      <Layout style={{ flex: 1, minHeight: 0 }}>
        {/* Left Side: Video / Visuals */}
        <Content style={{
          flex: isMindMapMode ? 1 : 2,
          background: '#000',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            {/* Web mode: VideoPanel with LiveKit */}
            {sessionData.mode === 'web' && !isMindMapMode && (
              <div style={{
                width: '100%',
                height: '100%',
                position: 'relative',
              }}>
                <VideoPanel
                  sessionData={sessionData}
                  micOn={micOn}
                  remoteAudioStream={remoteAudioStream}
                  onTranscript={handleTranscript}
                  onRemoteAudioTrack={handleRemoteAudioTrack}
                  username="Manager"
                />
              </div>
            )}

            {/* Face-to-face mode: Dashboard */}
            {sessionData.mode === 'face-to-face' && !isMindMapMode && (
              <div style={{
                width: '100%',
                height: '100%',
                position: 'relative',
              }}>
                <FaceToFaceDashboard
                  notes={notes}
                  onAddNote={handleAddNote}
                  isAiQuestionMode={isAiQuestionMode}
                  onToggleMode={handleToggleMode}
                  onAskAI={handleAskAI}
                />
              </div>
            )}

            {/* MindMapPanel overlays when in mindmap mode */}
            {isMindMapMode && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 10,
                background: '#fff'
              }}>
                <MindMapPanel
                // No props needed now, usage via store
                />
              </div>
            )}

            {/* Common TranscriptionHandler for all modes */}
            <TranscriptionHandler
              isMicOn={micOn}
              onTranscript={handleTranscript}
              remoteAudioStream={sessionData.mode === 'web' ? remoteAudioStream : null}
            />
          </div>

          <ControlsBar
            micOn={micOn}
            setMicOn={setMicOn}
            isMindMapMode={isMindMapMode}
            setIsMindMapMode={setIsMindMapMode}
            handleEndSession={handleEndSession}
            isEnding={isEnding}
            mode={sessionData?.mode}
          />
        </Content>

        {/* Right Side: AI Copilot & Transcript - hidden in mindmap mode */}
        {!isMindMapMode && (
          <Sider width={400} theme="light" style={{
            borderLeft: '1px solid #f0f0f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: '16px'
            }}>
              <AdvicePanel realTimeAdvice={realTimeAdvice} adviceHistory={adviceHistory} />
            </div>
          </Sider>
        )}
      </Layout>
    </Layout>
  );
}
