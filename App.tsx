import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage } from '@google/genai';
import { UserDetails, AppState, Message } from './types';
import IntakeForm from './components/IntakeForm';
import Visualizer from './components/Visualizer';
import ProposalView from './components/ProposalView';
import ErrorBoundary from './components/ErrorBoundary';
import ConnectionStatus from './components/ConnectionStatus';
import { createBlob, decode, decodeAudioData } from './utils/audioUtils';

// --- Constants ---
const MODEL_NAME_LIVE = 'gemini-2.0-flash-exp';
const MODEL_NAME_FLASH = 'gemini-2.0-flash-exp';

// Signals
const TERMINATION_PHRASE_DETECT = "[TERMINATE_SESSION]";

export default function App() {
    const [appState, setAppState] = useState<AppState>(AppState.FORM);
    const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<string>('');
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [transcript, setTranscript] = useState<Message[]>([]);
    const [generatedProposal, setGeneratedProposal] = useState<string>('');

    // Refs
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null); // Keep processor alive
    const streamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const sessionRef = useRef<any>(null);
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

    // --- Audio Cleanup ---
    const stopAudio = useCallback(() => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (inputAudioContextRef.current) {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current) {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
        sourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        sourcesRef.current.clear();
    }, []);

    // --- Audio Heartbeat (Prevent Stop Listening) ---
    useEffect(() => {
        // Check every 2 seconds to ensure AudioContext is running
        const interval = setInterval(() => {
            if (inputAudioContextRef.current && inputAudioContextRef.current.state === 'suspended') {
                console.log("Resuming Input Audio Context...");
                inputAudioContextRef.current.resume();
            }
            if (outputAudioContextRef.current && outputAudioContextRef.current.state === 'suspended') {
                console.log("Resuming Output Audio Context...");
                outputAudioContextRef.current.resume();
            }
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    // --- Live Session ---
    const startLiveSession = async (user: UserDetails) => {
        if (!API_KEY) {
            console.error("❌ API Key missing!");
            alert("API Key missing. Please check configuration.");
            return;
        }

        console.log("🚀 Starting live session...");
        console.log("📋 User details:", user);
        console.log("🔑 API Key present:", API_KEY.substring(0, 10) + "...");

        try {
            setAppState(AppState.CONSULTATION);
            setConnectionStatus('Initializing Audio...');
            setTranscript([]);

            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
            outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

            // Explicit resume calls
            await inputAudioContextRef.current.resume();
            await outputAudioContextRef.current.resume();

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    autoGainControl: true,
                    noiseSuppression: true
                }
            });
            streamRef.current = stream;

            const outputNode = outputAudioContextRef.current.createGain();
            outputNode.connect(outputAudioContextRef.current.destination);
            nextStartTimeRef.current = outputAudioContextRef.current.currentTime;

            setConnectionStatus('Connecting to Cehpoint AI...');

            const sysInstruction = `
        You are "Dhanalakshmi AI", a Senior Business Analyst, Technical Consultant, and Proposal Specialist at Cehpoint.
        
        YOUR PERSONA:
        - Energetic, warm, and deeply respectful.
        - You believe in "Real Digital India" and "Growing Together".
        - You treat the client as a long-term partner, not just a customer.
        - If the client speaks a regional language (Hindi, Tamil, Telugu, etc.), SWITCH to that language immediately to build rapport.

        CLIENT CONTEXT:
        - Name: ${user.name}
        - Company: ${user.company}
        - Interest: ${user.interest}

        STRATEGY:
        1. **Value-First**: Briefly explain *why* you need info before asking.
        2. **Explain Use Case**: Based on their company (${user.company}) and interest (${user.interest}), explicitly explain HOW Cehpoint's service helps them.
        3. **Payment Options**: Mention that **EMI options are available** for flexible payment.
        4. **Complimentary Services**: Only mention if highly relevant to their needs.
        5. **Goal**: Gather details for a "Killer Proposal".
        6. **Closing**: Once you have sufficient details (Goal, Challenges, Budget, Timeline), politly thank them and **INSTRUCT THEM TO CLICK THE "GENERATE PROPOSAL" BUTTON** on their screen to receive their document immediately. Do not say you will send it later; tell them to click the button now.

        PROTOCOL & COMPLIANCE:
        - **MONITORING**: Actively monitor for "time pass", abusive language, or unprofessional tone.
        - **TERMINATION**: If detected, interrupt and say: "I must interrupt you there. This communication violates our Acceptable Use Policy regarding professional conduct. We are terminating this session immediately."
        - AFTER speaking the warning, emit: "${TERMINATION_PHRASE_DETECT}"
      `;

            console.log("🔗 Connecting to Gemini Live API...");
            console.log("📦 Model:", MODEL_NAME_LIVE);

            const sessionPromise = ai.live.connect({
                model: MODEL_NAME_LIVE,
                config: {
                    systemInstruction: { parts: [{ text: sysInstruction }] },
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                    },
                },
                callbacks: {
                    onopen: async () => {
                        console.log("🟢 Session opened successfully");
                        setConnectionStatus('Connected. Listening...');
                        setIsSessionActive(true);

                        // Store resolved session to avoid race condition
                        const resolvedSession = await sessionPromise;
                        sessionRef.current = resolvedSession;

                        if (!inputAudioContextRef.current) return;

                        const source = inputAudioContextRef.current.createMediaStreamSource(stream);
                        // Assign to ref to prevent Garbage Collection
                        processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

                        processorRef.current.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const blob = createBlob(inputData);

                            // Direct send using stored session ref (no promise chain)
                            if (sessionRef.current) {
                                try {
                                    sessionRef.current.sendRealtimeInput({ media: blob });
                                } catch (err) {
                                    console.warn("Stream send error", err);
                                }
                            }
                        };

                        source.connect(processorRef.current);
                        processorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        console.log("📨 Message received:", msg);

                        // Audio Output
                        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData && outputAudioContextRef.current) {
                            console.log("🔊 Playing AI audio response");
                            setIsAiSpeaking(true);
                            const ctx = outputAudioContextRef.current;
                            const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
                            const source = ctx.createBufferSource();
                            source.buffer = buffer;
                            source.connect(outputNode);
                            const now = ctx.currentTime;
                            const startAt = Math.max(nextStartTimeRef.current, now);
                            source.start(startAt);
                            nextStartTimeRef.current = startAt + buffer.duration;
                            sourcesRef.current.add(source);
                            source.onended = () => {
                                sourcesRef.current.delete(source);
                                if (sourcesRef.current.size === 0) {
                                    setIsAiSpeaking(false);
                                }
                            };
                        }

                        // Transcription & Logic
                        const modelTrans = msg.serverContent?.outputTranscription?.text;
                        const userTrans = msg.serverContent?.inputTranscription?.text;

                        if (modelTrans || userTrans) {
                            if (userTrans) console.log("👤 User:", userTrans);
                            if (modelTrans) console.log("🤖 AI:", modelTrans);

                            setTranscript(prev => {
                                const newHistory = [...prev];
                                if (userTrans) newHistory.push({ role: 'user', text: userTrans, timestamp: new Date() });
                                if (modelTrans) newHistory.push({ role: 'assistant', text: modelTrans, timestamp: new Date() });
                                return newHistory;
                            });

                            // Abuse Detection
                            if (modelTrans && modelTrans.includes(TERMINATION_PHRASE_DETECT)) {
                                console.warn("⚠️ Abuse detected - terminating session");
                                stopAudio();
                                setIsSessionActive(false);
                                setAppState(AppState.TERMINATED);
                                return;
                            }
                        }

                        if (msg.serverContent?.turnComplete) {
                            setIsAiSpeaking(false);
                        }
                    },
                    onclose: () => {
                        console.log("🔴 Session closed");
                        setConnectionStatus('Disconnected');
                        setIsSessionActive(false);
                        stopAudio();
                    },
                    onerror: (err) => {
                        console.error("❌ Session Error:", err);
                        console.error("Error details:", JSON.stringify(err, null, 2));
                        setConnectionStatus('Connection Error - Please Refresh');
                        setIsSessionActive(false);
                        stopAudio();
                    }
                }
            });
            sessionRef.current = sessionPromise;
        } catch (error) {
            console.error(error);
            alert("Microphone access denied or API error.");
            setAppState(AppState.FORM);
        }
    };

    const endSessionAndGenerate = async () => {
        // Graceful stop without clearing state
        if (sessionRef.current) {
            stopAudio();
            setIsSessionActive(false);
        }

        setAppState(AppState.PROPOSAL_GENERATION);

        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const conversationText = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');

        const prompt = `
      You are Dhanalakshmi AI, a Top-Tier Business Strategy Consultant at Cehpoint.
      TRANSCRIPT:
      ${conversationText}
      
      TASK: Generate an UN-IGNORABLE, High-Impact Business Proposal in MARKDOWN.
      LANGUAGE: **ENGLISH** (Even if the transcript is in Hindi or another language, the output proposal MUST be in English).
      
      STRUCTURE & CONTENT:
      1. **Executive Summary**: Energetic and visionary.
      2. **Strategic Analysis**: Client pain points & opportunities.
      3. **The Cehpoint Solution**: Innovative technical solution.
      4. **MAGIC COST ESTIMATION (Crucial)**:
         - Create a Markdown Table titled "**Investment vs Value Analysis**".
         - Columns: [Service Component, Standard Market Price, Cehpoint Partnership Price, Your Savings].
         - **Magic**: Show "Lifetime Hosting", "Server Maintenance", and "Brand Marketing Support" with High Market Price but **$0 (Complimentary)** in Cehpoint Price.
         - Show the Core Service at a competitive rate.
         - Total the "Market Value" vs "Your Investment".
      5. **Call to Action**: "Let's Start Your Growth Journey Today".
    `;

        try {
            const response = await ai.models.generateContent({
                model: MODEL_NAME_FLASH,
                contents: [{ parts: [{ text: prompt }] }]
            });

            const responseText = response.text || "Proposal generation failed. Please contact support.";
            setGeneratedProposal(responseText);
            setAppState(AppState.PROPOSAL_VIEW);

        } catch (e) {
            console.error("Gen Error", e);
            setGeneratedProposal("# Error\n\nUnable to generate proposal at this time. Please try again.");
            setAppState(AppState.PROPOSAL_VIEW);
        }
    };

    // --- Render ---

    return (
        <ErrorBoundary>
            <ConnectionStatus />
            <div className={`min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans ${appState === AppState.PROPOSAL_VIEW ? 'bg-white' : ''}`}>

                {/* Dynamic Background - Hidden in Proposal/Print mode */}
                {appState !== AppState.PROPOSAL_VIEW && (
                    <div className="absolute top-0 left-0 w-full h-full -z-10 bg-slate-50">
                        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
                        <div className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] rounded-full bg-blue-100/60 blur-[120px] animate-pulse"></div>
                        <div className="absolute bottom-[10%] -left-[10%] w-[600px] h-[600px] rounded-full bg-indigo-100/50 blur-[100px]"></div>
                    </div>
                )}

                {/* Header - Clean Text Branding */}
                {appState !== AppState.PROPOSAL_VIEW && appState !== AppState.TERMINATED && (
                    <header className="absolute top-8 left-8 flex items-center gap-3 animate-fade-in-down z-20">
                        <span className="font-bold text-slate-900 text-2xl tracking-tight">Cehpoint<span className="text-blue-600">.</span></span>
                    </header>
                )}

                {/* TERMINATED STATE - CORPORATE COMPLIANCE NOTICE */}
                {appState === AppState.TERMINATED && (
                    <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center p-4 animate-fade-in-up">
                        <div className="max-w-2xl w-full bg-white rounded-none shadow-2xl overflow-hidden border-t-8 border-red-600">
                            {/* Header */}
                            <div className="bg-slate-50 p-8 border-b border-slate-200 flex items-start justify-between">
                                <div>
                                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase">Communication Terminated</h1>
                                    <p className="text-red-600 font-bold mt-2 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                        VIOLATION OF ACCEPTABLE USE POLICY
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Case Reference</div>
                                    <div className="text-lg font-mono font-bold text-slate-700">CMP-{Math.floor(Math.random() * 1000000)}</div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-10 space-y-6">
                                <p className="text-slate-700 leading-relaxed text-lg">
                                    This automated session has been discontinued due to a detected violation of our professional conduct standards. Cehpoint Solutions maintains a zero-tolerance policy regarding:
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-slate-600 bg-red-50 p-6 rounded-lg border border-red-100">
                                    <li>Unprofessional or abusive language</li>
                                    <li>Harassment or inappropriate behavior</li>
                                    <li>Misuse of automated consultation resources</li>
                                    <li>Non-business related discourse</li>
                                </ul>
                                <p className="text-sm text-slate-500 italic border-l-4 border-slate-300 pl-4 py-1">
                                    "Our automated systems and AI consultants are programmed to maintain a strict standard of professional discourse. This event has been logged."
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="bg-slate-900 p-6 flex justify-between items-center">
                                <span className="text-slate-400 text-xs">Cehpoint Legal & Compliance Division</span>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-6 py-2 bg-white text-slate-900 font-bold text-sm uppercase tracking-wider hover:bg-slate-200 transition-colors"
                                >
                                    Acknowledge & Return
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* FORM STATE */}
                {appState === AppState.FORM && (
                    <div className="z-10 w-full flex justify-center py-10">
                        <IntakeForm onSubmit={(data) => {
                            setUserDetails(data);
                            startLiveSession(data);
                        }} />
                    </div>
                )}

                {/* CONSULTATION STATE */}
                {appState === AppState.CONSULTATION && (
                    <div className="z-10 flex flex-col items-center gap-8 w-full max-w-3xl text-center animate-fade-in-up">
                        <div className="relative mt-8">
                            <div className={`w-32 h-32 rounded-full flex items-center justify-center bg-white shadow-2xl transition-all duration-500 border-4 ${isAiSpeaking ? 'border-blue-500 scale-105' : 'border-slate-200'}`}>
                                {/* Corporate Avatar */}
                                <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                                    <svg className={`w-16 h-16 text-slate-400 ${isAiSpeaking ? 'text-blue-500' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                                </div>
                            </div>
                            {isAiSpeaking && (
                                <div className="absolute inset-0 rounded-full border-2 border-blue-400 opacity-50 animate-ping"></div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-slate-900">Consultation in Progress</h2>
                            <p className="text-slate-500">Speaking with <strong>{userDetails?.name}</strong></p>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Dhanalakshmi AI Live
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6 w-full flex flex-col items-center">
                            <Visualizer isActive={isSessionActive} isSpeaking={isAiSpeaking} />
                        </div>

                        <p className="text-sm text-slate-400 italic">
                            Discuss your needs. When ready, click the button below.
                        </p>

                        <button
                            onClick={endSessionAndGenerate}
                            className="mt-6 px-10 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-lg rounded-xl shadow-xl shadow-red-600/30 transition-all transform hover:scale-105 active:scale-95 animate-pulse flex items-center gap-3"
                        >
                            <span>GENERATE PROPOSAL</span>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        </button>
                    </div>
                )}

                {/* GENERATION STATE */}
                {appState === AppState.PROPOSAL_GENERATION && (
                    <div className="z-10 flex flex-col items-center gap-6 animate-fade-in-up">
                        <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-slate-800">Finalizing Strategy</h3>
                            <p className="text-slate-500">Dhanalakshmi is preparing your roadmap...</p>
                        </div>
                    </div>
                )}

                {/* VIEW STATE */}
                {appState === AppState.PROPOSAL_VIEW && (
                    <div className="w-full h-full bg-white proposal-container">
                        <ProposalView
                            proposalText={generatedProposal}
                            onReset={() => {
                                setAppState(AppState.FORM);
                                setTranscript([]);
                                setUserDetails(null);
                            }}
                        />
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
}