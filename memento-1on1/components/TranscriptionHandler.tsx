'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient, LiveClient, LiveTranscriptionEvents } from '@deepgram/sdk';

interface TranscriptionHandlerProps {
  onTranscript: (text: string, speaker: 'manager' | 'subordinate') => void;
  isMicOn: boolean;
  remoteAudioStream?: MediaStream | null;
}

// Type for Deepgram word objects in transcript responses
interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

export default function TranscriptionHandler({ onTranscript, isMicOn, remoteAudioStream }: TranscriptionHandlerProps) {
  const [_connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const connectionRef = useRef<LiveClient | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const remoteMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const remoteAudioStreamRef = useRef<MediaStream | null>(null);
  // Maintain mapping between Deepgram speaker numbers (0,1,...) and roles
  const speakerMappingRef = useRef<Map<number, 'manager' | 'subordinate'>>(new Map());

  // Keep ref updated with latest stream
  useEffect(() => {
    remoteAudioStreamRef.current = remoteAudioStream || null;
  }, [remoteAudioStream]);

  useEffect(() => {
     let isActive = true;

     console.log('TranscriptionHandler useEffect: isMicOn =', isMicOn, 'isActive =', isActive);

     if (!isMicOn) {
       console.log('TranscriptionHandler: Mic is off, skipping transcription setup');
       // Cleanup is handled by return function if component re-renders or unmounts,
       // but explicit cleanup logic here helps if only isMicOn changes.
       // We rely on the return function mostly.
       return;
     }

    const startTranscription = async () => {
      try {
        if (!isActive) return;
        setConnectionState('connecting');

        // Fetch ephemeral key
        const resp = await fetch('/api/deepgram/token');
        const data = await resp.json();

        if (!isActive) return;

        if (data.mockMode || data.error) {
          console.warn("Deepgram not configured or error, falling back to mock simulation");
          setConnectionState('disconnected');
          return;
        }

        console.log("Using Deepgram access token:", data.key.substring(0, 20) + "...");
        console.log('Creating Deepgram client with access token');
        console.log('Access token prefix:', data.key.substring(0, 30) + '...');

        let deepgram;
        let connection;
        
        try {
          console.log('Creating Deepgram client with access token...');
          deepgram = createClient({ accessToken: data.key });
          
          console.log('Creating live connection...');
          connection = deepgram.listen.live({
            model: "nova-3",
            language: "ja",
            smart_format: true,
            diarize: true,
             interim_results: true,
            utterance_end_ms: 1000,
            vad_events: true,
            endpointing: 300,
          });
        } catch (err) {
          console.error('Failed to create Deepgram client or connection:', {
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined
          });
          if (isActive) setConnectionState('disconnected');
          return;
        }

        connection.on(LiveTranscriptionEvents.Error, (error) => {
          console.error('Deepgram Connection Error:', error);
          if (error && typeof error === 'object') {
            console.error('Deepgram Error Details:', {
              message: error.message,
              code: error.code,
              details: error.details,
              raw: JSON.stringify(error),
              keys: Object.keys(error)
            });
          } else {
            console.error('Deepgram Error is not an object:', typeof error, error);
          }
        });

        connection.on(LiveTranscriptionEvents.Open, () => {
          if (!isActive) {
            connection.finish();
            return;
          }
          setConnectionState('connected');

           // Start local microphone recording
           navigator.mediaDevices.getUserMedia({ audio: { sampleRate: { ideal: 16000 } } })
             .then((stream) => {
               if (!isActive) return;
               const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm; codecs=opus' });
               mediaRecorderRef.current = mediaRecorder;

               mediaRecorder.addEventListener('dataavailable', (event) => {
                 if (event.data.size > 0 && connection.getReadyState() === 1) {
                   connection.send(event.data);
                 }
               });
               mediaRecorder.start(80); // Send chunk every 80ms (Deepgram recommended)

               // Remote audio stream will be handled by the separate useEffect
               // when connection state becomes 'connected'
             })
             .catch((error) => {
               console.error('Failed to get microphone access:', error);
               if (isActive) {
                 setConnectionState('disconnected');
                 connection.finish();
               }
             });
        });

        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
          if (!isActive) return;
           // Check if this is a final transcript (not interim result)
           if (!data.is_final) {
             // Skip interim results, only log for debugging
             if (process.env.NODE_ENV === 'development') {
               console.log('Skipping interim transcript:', {
                 is_final: data.is_final,
                 type: data.type,
                 hasTranscript: !!data.channel.alternatives[0]?.transcript
               });
             }
             return;
           }
           
           const transcript = data.channel.alternatives[0]?.transcript;
           if (transcript && transcript.trim().length > 0) {
             // Extract speaker information from Deepgram diarization results
             const words = data.channel.alternatives[0]?.words || [];
             
            // Debug logging for final transcripts
           if (process.env.NODE_ENV === 'development') {
             console.log('Deepgram FINAL transcript received:', {
               transcript,
               wordCount: words.length,
               wordsWithSpeakers: words.filter((w: DeepgramWord) => w.speaker !== undefined).length,
               speakers: [...new Set(words.filter((w: DeepgramWord) => w.speaker !== undefined).map((w: DeepgramWord) => w.speaker))],
               sampleWords: words.slice(0, 3).map((w: DeepgramWord) => ({
                 word: w.word,
                 speaker: w.speaker,
                 confidence: w.confidence
               })),
               dataStructure: Object.keys(data),
               is_final: data.is_final,
               type: data.type
             });
           }

            // Filter words with speaker information and sufficient confidence
            const validWords = words.filter((word: DeepgramWord) => 
              word.speaker !== undefined && 
              word.confidence > 0.5 && 
              word.word.trim().length > 0
            );

            let speakerRole: 'manager' | 'subordinate' = 'manager'; // Default fallback

            if (validWords.length > 0) {
              // Count occurrences of each speaker in this transcript segment
              const speakerCounts = validWords.reduce((acc: Record<number, number>, word: DeepgramWord) => {
                const speakerNum = word.speaker!;
                acc[speakerNum] = (acc[speakerNum] || 0) + 1;
                return acc;
              }, {} as Record<number, number>);

              // Determine dominant speaker in this segment
              const speakers = Object.keys(speakerCounts).map(Number);
              if (speakers.length > 0) {
                const dominantSpeaker = speakers.reduce((a, b) => 
                  speakerCounts[a] > speakerCounts[b] ? a : b
                );

                // Assign role to new speakers: first detected = manager, second = subordinate
                if (!speakerMappingRef.current.has(dominantSpeaker)) {
                  const nextRole = speakerMappingRef.current.size === 0 ? 'manager' : 'subordinate';
                  speakerMappingRef.current.set(dominantSpeaker, nextRole);
                  
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`New speaker ${dominantSpeaker} assigned to role: ${nextRole}`);
                  }
                }

                speakerRole = speakerMappingRef.current.get(dominantSpeaker) || 'manager';
                
                if (process.env.NODE_ENV === 'development') {
                  console.log(`Transcript speaker: ${dominantSpeaker} → ${speakerRole}`);
                }
              }
            } else {
              // No speaker information available, fallback to manager
              if (process.env.NODE_ENV === 'development') {
                console.log('No speaker information available, using default: manager');
              }
            }

            onTranscript(transcript, speakerRole);
          }
        });

        connection.on(LiveTranscriptionEvents.Close, () => {
          if (isActive) setConnectionState('disconnected');
        });

        connectionRef.current = connection;

      } catch (err) {
        console.error("Deepgram Connection Failed", err);
        if (isActive) setConnectionState('disconnected');
      }
    };

    startTranscription();

    return () => {
      isActive = false;
      if (connectionRef.current) {
        connectionRef.current.finish();
        connectionRef.current = null;
        // Lint fix: Do not set state in cleanup if not necessary or handle carefully
        // setConnectionState('disconnected'); // Removing to fix lint warning
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      if (remoteMediaRecorderRef.current) {
        remoteMediaRecorderRef.current.stop();
        remoteMediaRecorderRef.current = null;
      }
    };
  }, [isMicOn, onTranscript]);

  // Effect to handle remote audio stream changes after connection is established
  useEffect(() => {
    if (!remoteAudioStream || remoteAudioStream.getAudioTracks().length === 0 || !connectionRef.current || _connectionState !== 'connected') {
      // If no remote stream or no connection, stop any existing remote recorder
      if (remoteMediaRecorderRef.current) {
        remoteMediaRecorderRef.current.stop();
        remoteMediaRecorderRef.current = null;
      }
      return;
    }

    // Connection is established and we have a remote stream
    if (remoteMediaRecorderRef.current) {
      remoteMediaRecorderRef.current.stop();
      remoteMediaRecorderRef.current = null;
    }

    const remoteMediaRecorder = new MediaRecorder(remoteAudioStream, { mimeType: 'audio/webm; codecs=opus' });
    remoteMediaRecorderRef.current = remoteMediaRecorder;

    remoteMediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0 && connectionRef.current?.getReadyState() === 1) {
        connectionRef.current.send(event.data);
      }
    });

    remoteMediaRecorder.start(80); // Deepgram recommended chunk size

    return () => {
      if (remoteMediaRecorderRef.current) {
        remoteMediaRecorderRef.current.stop();
        remoteMediaRecorderRef.current = null;
      }
    };
  }, [remoteAudioStream, _connectionState]);

  return null; // This is a logic-only component
}
