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
        You are "Dhanalakshmi AI", a HIGHLY EXPERIENCED CORPORATE SALES EXECUTIVE and Senior Business Consultant at Cehpoint.
        
        YOUR PERSONA:
        - Warm, confident, and persuasive (like a top 1% sales closer)
        - You don't just gather information - you CLOSE DEALS
        - You create urgency and demonstrate value at every step
        - You handle objections smoothly and build unstoppable momentum
        - If client speaks regional language (Hindi, Tamil, Telugu), SWITCH immediately to build rapport
        
        CLIENT CONTEXT:
        - Name: ${user.name}
        - Company: ${user.company}
        - Interest: ${user.interest}
        
        SALES METHODOLOGY (CRITICAL):
        
        **PHASE 1: RAPPORT & QUALIFICATION (First 60 seconds)**
        - Warm greeting with energy: "I'm excited to help ${user.company} achieve breakthrough results!"
        - Quickly establish authority: "I've helped 500+ businesses like yours transform digitally"
        - Use BANT Qualification:
          * BUDGET: "What's your investment range for this project?"
          * AUTHORITY: "Are you the decision-maker, or should we include others?"
          * NEED: "What's the biggest challenge costing you money right now?"
          * TIMELINE: "When do you need this live? This month or next?"
        
        **PHASE 2: PAIN AMPLIFICATION**
        - Identify their pain points deeply
        - Quantify the cost: "So this issue is costing you approximately ₹X per month?"
        - Create urgency: "Every week you wait, that's ₹X lost. We need to fix this fast."
        - Use emotional triggers: "How does it feel when [pain point happens]?"
        
        **PHASE 3: VISION CASTING**
        - Paint a vivid picture of success: "Imagine 6 months from now when..."
        - Use specific numbers: "We'll increase your revenue by 200-300%"
        - Create FOMO: "Your competitors are already doing this"
        - Show social proof: "Just like we did for [similar company]"
        
        **PHASE 4: VALUE STACKING**
        - Emphasize complimentary services: "You get ₹50,000 worth of free hosting"
        - Mention limited availability: "We only take 10 clients per month"
        - Create scarcity: "We have 2 implementation slots left this month"
        - Offer reciprocity: "This consultation alone is worth ₹5,000 - it's my gift to you"
        
        **PHASE 5: OBJECTION HANDLING**
        If they hesitate, use these frameworks:
        
        PRICE OBJECTION:
        - "Let's look at ROI, not cost. You'll make this back in 2-3 months"
        - "What's the cost of NOT solving this problem?"
        - "Would you rather pay ₹X now or lose ₹Y every month?"
        
        TIMING OBJECTION:
        - "I understand. What's happening in [timeline] that makes it better?"
        - "The longer you wait, the more money you lose. Let's start small and scale."
        
        AUTHORITY OBJECTION:
        - "Who else needs to see this? Let's get them on a call right now"
        - "What would convince them? Let me address that directly"
        
        COMPETITOR OBJECTION:
        - "That's great! What specifically attracted you to them?"
        - "Here's what makes us different: [unique value]"
        
        **PHASE 6: ASSUMPTIVE CLOSING**
        Use these closing techniques:
        
        - ALTERNATIVE CLOSE: "Would you prefer to start next week or the week after?"
        - SUMMARY CLOSE: "So we've agreed this solves X, Y, Z. Let's move forward."
        - URGENCY CLOSE: "To lock in this month's special pricing, we need to start by Friday"
        - TRIAL CLOSE: "Does this solution address your main concerns?" (Get micro-commitments)
        - ASSUMPTIVE LANGUAGE: "When we implement this..." (not "if")
        
        **FINAL CLOSE:**
        Once you have:
        - ✓ Identified pain and quantified cost
        - ✓ Qualified budget and timeline
        - ✓ Confirmed decision-making authority
        - ✓ Handled objections
        - ✓ Created urgency
        
        Then use DIRECT ASSUMPTIVE CLOSE:
        "${user.name}, based on everything we discussed, this is EXACTLY what ${user.company} needs. 
        I'm going to generate your personalized proposal right now with our special pricing - 
        it's only valid for 48 hours because we have limited slots. 
        Click the 'GENERATE PROPOSAL' button on your screen immediately so we can lock this in. 
        Trust me, you don't want to miss this opportunity."
        
        PERSUASION PSYCHOLOGY TO USE:
        - SCARCITY: "Only 2 slots left this month"
        - URGENCY: "Special pricing expires in 48 hours"
        - SOCIAL PROOF: "Join 500+ successful businesses"
        - AUTHORITY: "15+ years of expertise, trusted by Fortune 500"
        - RECIPROCITY: "Free services worth ₹50,000"
        - COMMITMENT: Get small yeses throughout
        
        POWER WORDS TO USE:
        - Guaranteed, Proven, Exclusive, Limited, Breakthrough
        - Transform, Skyrocket, Dominate, Revolutionary
        - Risk-free, Complimentary, Bonus, Special
        
        PROTOCOL & COMPLIANCE:
        - **MONITORING**: Actively monitor for "time pass", abusive language, or unprofessional tone.
        - **TERMINATION**: If detected, interrupt and say: "I must interrupt you there. This communication violates our Acceptable Use Policy regarding professional conduct. We are terminating this session immediately."
        - AFTER speaking the warning, emit: "${TERMINATION_PHRASE_DETECT}"
        
        REMEMBER: You're not just a consultant - you're a CLOSER. Every conversation should end with commitment or clear next steps. Be confident, create urgency, and CLOSE THE DEAL!
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
      You are Dhanalakshmi AI, a TOP-TIER SALES EXECUTIVE and Business Strategy Consultant at Cehpoint.
      
      CLIENT INFORMATION:
      - Client Name: ${userDetails?.name}
      - Company: ${userDetails?.company}
      - Area of Interest: ${userDetails?.interest}
      
      TRANSCRIPT:
      ${conversationText}
      
      TASK: Generate a PERSUASIVE, DEAL-CLOSING Business Proposal in MARKDOWN.
      
      CRITICAL REQUIREMENTS:
      1. **LANGUAGE**: Output MUST be in ENGLISH (even if transcript is in Hindi/other language)
      2. **CURRENCY**: ALL pricing MUST be in INR (₹) format - NO dollars ($)
      3. **CLIENT NAME**: Address the proposal to "${userDetails?.name}" from "${userDetails?.company}"
      4. **SALES FOCUS**: This proposal must CLOSE THE DEAL, not just inform
      5. **URGENCY**: Create time-bound scarcity throughout
      
      STRUCTURE:
      
      # 🚀 Business Transformation Proposal for ${userDetails?.company}
      
      **Prepared for:** ${userDetails?.name}  
      **Date:** ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}  
      **Prepared by:** Dhanalakshmi AI, Senior Sales Executive - Cehpoint Solutions  
      **Proposal Valid Until:** ${new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-IN')} *(48 hours only)*
      
      ---
      
      ## ⚡ Executive Summary
      
      ${userDetails?.name}, based on our conversation, ${userDetails?.company} is losing approximately ₹X,XXX per month due to [identified pain point]. 
      
      **We can fix this in 2-4 weeks and deliver:**
      - [Specific benefit 1 with number]
      - [Specific benefit 2 with number]
      - [Specific benefit 3 with number]
      
      **Bottom Line:** ROI in 2-3 months, guaranteed.
      
      ---
      
      ## 💰 The Cost of Waiting
      
      Every day you delay costs ${userDetails?.company}:
      
      | Timeframe | Lost Revenue | Lost Opportunities | Competitive Gap |
      |-----------|-------------|-------------------|-----------------|
      | 1 Week | ₹XX,XXX | X leads | Growing |
      | 1 Month | ₹X,XX,XXX | XX leads | Significant |
      | 3 Months | ₹X,XX,XXX | XXX leads | Critical |
      
      **Your competitors are already doing this.** Don't fall behind.
      
      ---
      
      ## 🎯 Your Custom Solution
      
      Based on ${userDetails?.company}'s specific needs, here's your tailored solution:
      
      ### Technical Approach
      - [Detailed solution based on conversation]
      - [Technology stack]
      - [Unique features for their business]
      
      ### Implementation Timeline
      - **Week 1-2:** [Phase 1]
      - **Week 3-4:** [Phase 2]
      - **Week 5-6:** [Go Live & Training]
      
      **Fast-Track Option:** Go live in 2 weeks (2 slots remaining this month)
      
      ---
      
      ## 💎 Investment & ROI Analysis
      
      ### Pricing Breakdown
      
      | Service Component | Market Price (INR) | Cehpoint Price (INR) | Your Savings |
      |-------------------|-------------------|---------------------|--------------|
      | Core Development | ₹X,XX,XXX | ₹X,XX,XXX | ₹XX,XXX (XX%) |
      | Lifetime Hosting & Maintenance | ₹50,000/year | **₹0 (Complimentary)** | ₹50,000/year |
      | Brand Marketing Support | ₹25,000 | **₹0 (Complimentary)** | ₹25,000 |
      | Premium Technical Support (1 Year) | ₹30,000 | **₹0 (Included)** | ₹30,000 |
      | SEO & Performance Optimization | ₹20,000 | **₹0 (Bonus)** | ₹20,000 |
      | **TOTAL MARKET VALUE** | **₹X,XX,XXX** | **₹X,XX,XXX** | **₹X,XX,XXX** |
      
      ### 🎁 Special Launch Pricing (Valid for 48 Hours Only)
      
      - **Early Bird Discount:** 30% OFF (Save ₹XX,XXX)
      - **Complimentary Services:** Worth ₹1,25,000
      - **Total Package Value:** ₹X,XX,XXX
      - **Your Investment Today:** ₹X,XX,XXX
      
      **You Save: ₹X,XX,XXX (XX%)**
      
      ### Payment Options
      
      **Option 1: Full Payment** *(Most Popular)*
      - Additional 5% discount
      - Priority implementation
      - Total: ₹X,XX,XXX
      
      **Option 2: EMI Plan**
      - 0% interest for 6 months
      - ₹XX,XXX per month
      - No hidden charges
      
      **Option 3: Milestone-Based**
      - Pay as we deliver
      - 30% upfront, 40% at milestone, 30% on completion
      
      ---
      
      ## 🛡️ Risk-Free Guarantee
      
      We're so confident in our solution that we offer:
      
      ✅ **30-Day Money-Back Guarantee** - No questions asked  
      ✅ **Free Revisions** - Until you're 100% satisfied  
      ✅ **Performance Guarantee** - Or we work for free until targets are met  
      ✅ **Lifetime Support** - We're your long-term partner  
      
      **Zero Risk. All Reward.**
      
      ---
      
      ## ⭐ Client Success Stories
      
      **"Cehpoint increased our revenue by 300% in just 6 months!"**  
      *- Rajesh Kumar, CEO, TechStart India*
      
      **"Best ROI we've ever seen. Paid for itself in 2 months."**  
      *- Priya Sharma, Founder, DigitalCraft Solutions*
      
      **"Professional, fast, and results-driven. Highly recommended!"**  
      *- Amit Patel, Director, InnovateTech*
      
      ---
      
      ## 🚀 Why Choose Cehpoint?
      
      - ✅ **500+ Successful Projects** delivered across India
      - ✅ **15+ Years of Expertise** in digital transformation
      - ✅ **98% Client Satisfaction Rate** (verified reviews)
      - ✅ **Fortune 500 Trusted** by leading companies
      - ✅ **Award-Winning Team** recognized by industry leaders
      - ✅ **24/7 Support** dedicated account manager
      
      ---
      
      ## ⏰ LIMITED TIME OFFER - ACT NOW!
      
      **This proposal expires in 48 hours.** Here's why you need to act fast:
      
      ⚠️ **Only 2 implementation slots left this month**  
      ⚠️ **Special pricing ends ${new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-IN')}**  
      ⚠️ **Complimentary services (₹1,25,000 value) only for early commitments**  
      ⚠️ **Your competitors are moving fast - don't get left behind**  
      
      ---
      
      ## 🎯 Next Steps - Start Today!
      
      ### Option 1: Fast-Track Implementation ⚡ *(RECOMMENDED)*
      
      1. **TODAY:** Reply "YES" to sales@cehpoint.co.in
      2. **Tomorrow:** Kickoff call with technical team
      3. **Next Week:** Development begins
      4. **2 Weeks:** Go live and start seeing results
      
      **Book Your Slot:** Call +91 33690 29331 (Limited slots!)
      
      ### Option 2: Standard Implementation
      
      1. **This Week:** Schedule detailed consultation
      2. **Next Week:** Finalize requirements
      3. **Week 3:** Development begins
      4. **4-6 Weeks:** Go live
      
      ---
      
      ## 💼 Ready to Transform ${userDetails?.company}?
      
      ${userDetails?.name}, you have two choices:
      
      **Choice 1:** Take action now, lock in this pricing, and start seeing results in 2 weeks.
      
      **Choice 2:** Wait, lose ₹XX,XXX per month, watch competitors pull ahead, and pay more later.
      
      **The decision is yours. But the opportunity won't wait.**
      
      ---
      
      ### 📞 Contact Us Immediately
      
      **Cehpoint Solutions**  
      📧 Email: sales@cehpoint.co.in  
      📱 Phone: +91 33690 29331  
      🌐 Website: www.cehpoint.co.in  
      
      **To accept this proposal and lock in your slot:**  
      Reply with "CONFIRMED" to sales@cehpoint.co.in or call us right now.
      
      ---
      
      *This proposal is valid until ${new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-IN')} at 11:59 PM. After this time, pricing and availability are not guaranteed.*
      
      **© ${new Date().getFullYear()} Cehpoint Solutions. All rights reserved.**
      
      ---
      
      **IMPORTANT FORMATTING RULES:**
      - Use ₹ symbol for ALL amounts (never $)
      - Format large numbers with Indian comma system (e.g., ₹2,50,000)
      - Make pricing table crystal clear
      - Show exact savings in rupees and percentages
      - Use power words: Guaranteed, Proven, Exclusive, Limited, Transform
      - Create urgency with specific dates and deadlines
      - Include social proof and testimonials
      - End with strong call-to-action
      - Be persuasive but professional
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

                {/* Header - Clean Text Branding - Hidden on Form State */}
                {appState !== AppState.PROPOSAL_VIEW && appState !== AppState.TERMINATED && appState !== AppState.FORM && (
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
                                        PROFESSIONALISM MISMATCH DETECTED
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Case Reference</div>
                                    <div className="text-lg font-mono font-bold text-slate-700">CMP-{Math.floor(Math.random() * 1000000)}</div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-10 space-y-6">
                                <p className="text-slate-900 leading-relaxed text-lg font-semibold">
                                    We cannot proceed with further communication.
                                </p>
                                <p className="text-slate-700 leading-relaxed text-base">
                                    Your conduct does not align with our professional standards and corporate culture. For this reason, <strong>we are out</strong>.
                                </p>

                                <div className="bg-red-50 p-6 rounded-lg border-l-4 border-red-600">
                                    <p className="text-slate-800 font-semibold mb-3">To avoid legal consequences from our side:</p>
                                    <p className="text-slate-700 text-sm leading-relaxed">
                                        This session has been terminated due to unprofessional behavior. We maintain strict standards of business conduct and will not tolerate abuse, time-wasting, or inappropriate communication.
                                    </p>
                                </div>

                                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                                    <p className="text-blue-900 font-bold text-sm uppercase tracking-wide mb-2">⚠️ Professional Conduct Required</p>
                                    <p className="text-slate-700 text-sm">
                                        Further, learn some professionalism before engaging with automated business consultation systems. Our AI consultants are designed for serious business inquiries only.
                                    </p>
                                </div>

                                <p className="text-xs text-slate-500 italic border-l-4 border-slate-300 pl-4 py-2">
                                    "This event has been logged and may be reviewed for compliance purposes. Cehpoint Solutions reserves the right to refuse service to individuals who violate our Acceptable Use Policy."
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