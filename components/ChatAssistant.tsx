
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AppSettings } from '../types';
import { Send, Bot, User, Loader2, Mic, MicOff, Volume2, StopCircle, Sparkles, Zap, Radio, Image as ImageIcon, X } from 'lucide-react';
import * as Gemini from '../services/geminiService';
import { GoogleGenAI, Modality } from '@google/genai';

interface ChatAssistantProps {
  context: string;
  settings: AppSettings;
  triggerMessage?: string | null; // To receive external triggers
  onClearTrigger?: () => void;
}

// Audio Utils for Live API
function floatTo16BitPCM(input: Float32Array) {
    let output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ context, settings, triggerMessage, onClearTrigger }) => {
  // Text Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `مرحباً ${settings.studentName || 'يا بطل'}! أنا "فصيح"، مساعدك الذكي. يمكنك سؤالي أو تحديد أي نص في الدرس لشرحه، كما يمكنك إرسال صور لسؤالك عنها.`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // base64
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Voice State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveStatus, setLiveStatus] = useState('جاهز');
  
  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<any>(null); 
  const nextStartTimeRef = useRef(0);

  const getActiveConfig = () => {
    const apiKey = settings.apiKeys.length > 0 
      ? settings.apiKeys[Math.floor(Math.random() * settings.apiKeys.length)] 
      : undefined;
    return { apiKey, model: settings.activeModel };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle External Trigger
  useEffect(() => {
      if (triggerMessage && !isLoading) {
          // If triggered externally, we want to auto-speak the response
          handleSendText(triggerMessage, true);
          if (onClearTrigger) onClearTrigger();
      }
  }, [triggerMessage]);

  // --- TTS Logic ---
  const speakText = (text: string) => {
      window.speechSynthesis.cancel(); // Stop previous
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA'; // Default Arabic
      
      const voices = window.speechSynthesis.getVoices();
      // Prioritize "Google" voice for Arabic
      const arabicVoice = voices.find(v => v.lang.includes('ar') && v.name.includes('Google')) || 
                          voices.find(v => v.lang.includes('ar'));
                          
      if (arabicVoice) utterance.voice = arabicVoice;
      
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
  };

  // --- IMAGE HANDLING ---
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64 = reader.result as string;
              setSelectedImage(base64);
          };
          reader.readAsDataURL(file);
      }
  };

  const clearImage = () => {
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- TEXT CHAT LOGIC ---
  const handleSendText = async (overrideText?: string, autoSpeak: boolean = false) => {
    const textToSend = overrideText || input;
    if ((!textToSend.trim() && !selectedImage) || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      image: selectedImage || undefined,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    
    // Keep image for API call but clear from UI input immediately
    const imageToSend = selectedImage;
    clearImage();
    
    setIsLoading(true);

    try {
      // Prepare history for AI (map internal messages to Gemini history format)
      const historyForAi = messages.map(m => {
         const parts: any[] = [{ text: m.text }];
         if (m.image) {
             // Add image to history parts if exists
             parts.push({ inlineData: { mimeType: 'image/jpeg', data: m.image.split(',')[1] } });
         }
         return {
             role: m.role,
             parts: parts
         };
      });

      const imageData = imageToSend ? {
          data: imageToSend.split(',')[1],
          mimeType: 'image/jpeg' // Assuming JPEG from simple file reader, ideally extract from base64 prefix
      } : undefined;

      const responseText = await Gemini.chatWithLesson(
        context, 
        userMsg.text || (imageToSend ? "اشرح هذه الصورة" : ""), 
        settings.studentName || '',
        getActiveConfig(),
        historyForAi,
        imageData
      );
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);

      if (autoSpeak) {
          speakText(responseText);
      }
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: 'عذراً، حدث خطأ في الاتصال.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- LIVE VOICE LOGIC ---
  const startLiveSession = async () => {
    try {
        setLiveStatus('اتصال...');
        const config = getActiveConfig();
        if (!config.apiKey) throw new Error("API Key required");

        const client = new GoogleGenAI({ apiKey: config.apiKey });
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: {
            sampleRate: 16000,
            channelCount: 1
        }});
        mediaStreamRef.current = stream;

        const inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = outputContext; 

        const inputSource = inputContext.createMediaStreamSource(stream);
        const inputProcessor = inputContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = inputProcessor;
        
        const sessionPromise = client.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                systemInstruction: `You are Faseeh, a helpful Arabic tutor. Speak in Arabic. The Student Name is ${settings.studentName || 'Friend'}. Context: ${context.substring(0, 2000)}`
            },
            callbacks: {
                onopen: () => {
                    setLiveStatus("تحدث الآن");
                    setIsLiveConnected(true);
                },
                onmessage: async (msg) => {
                    const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (base64Audio) {
                       playAudioChunk(base64Audio, outputContext);
                    }
                },
                onclose: () => {
                    setLiveStatus("منفصل");
                    setIsLiveConnected(false);
                },
                onerror: (err) => {
                    setLiveStatus("خطأ");
                }
            }
        });

        inputProcessor.onaudioprocess = (e) => {
            const data = e.inputBuffer.getChannelData(0);
            const pcm16 = floatTo16BitPCM(data);
            let binary = '';
            const bytes = new Uint8Array(pcm16.buffer);
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            const base64 = btoa(binary);

            sessionPromise.then(session => {
                session.sendRealtimeInput({
                    media: { mimeType: 'audio/pcm;rate=16000', data: base64 }
                });
            });
        };

        inputSource.connect(inputProcessor);
        inputProcessor.connect(inputContext.destination);
        
        wsRef.current = await sessionPromise;

    } catch (error) {
        setLiveStatus("فشل");
        setIsLiveConnected(false);
    }
  };

  const stopLiveSession = () => {
      if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
      }
      if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(t => t.stop());
          mediaStreamRef.current = null;
      }
      if (processorRef.current) {
          processorRef.current.disconnect();
          processorRef.current = null;
      }
      if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
      }
      setIsLiveConnected(false);
      setLiveStatus("متوقف");
      nextStartTimeRef.current = 0;
  };

  const playAudioChunk = async (base64: string, ctx: AudioContext) => {
      try {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        
        const dataInt16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(dataInt16.length);
        for (let i = 0; i < dataInt16.length; i++) float32[i] = dataInt16[i] / 32768.0;

        const buffer = ctx.createBuffer(1, float32.length, 24000);
        buffer.copyToChannel(float32, 0);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        const now = ctx.currentTime;
        const startTime = Math.max(now, nextStartTimeRef.current);
        source.start(startTime);
        
        nextStartTimeRef.current = startTime + buffer.duration;
      } catch (e) {
          console.error("Audio Decode Error", e);
      }
  };

  const toggleLiveMode = () => {
      if (isLiveMode) {
          stopLiveSession();
          setIsLiveMode(false);
      } else {
          setIsLiveMode(true);
          startLiveSession();
      }
  };

  return (
    <div className="flex flex-col h-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border-l border-gray-100 dark:border-gray-700 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-900/80 p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md transition-all ${isLiveMode ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-br from-primary-500 to-purple-600'}`}>
                {isLiveMode ? <Radio className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">المساعد الذكي</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{isLiveMode ? liveStatus : "جاهز للمساعدة"}</p>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
             {isSpeaking && (
                 <button 
                    onClick={stopSpeaking}
                    className="p-2 rounded-full bg-yellow-100 text-yellow-600 hover:bg-yellow-200 animate-pulse"
                    title="إيقاف القراءة"
                 >
                     <Volume2 className="w-5 h-5" />
                 </button>
             )}
        </div>
      </div>

      {/* Content Area */}
      {isLiveMode ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-transparent to-gray-50/50 dark:to-gray-900/50 relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <div className={`w-40 h-40 bg-primary-500 rounded-full blur-3xl transition-all duration-1000 ${isLiveConnected ? 'scale-150 opacity-50 animate-pulse' : 'scale-50'}`}></div>
              </div>
              
              <div className="z-10 text-center space-y-4">
                  <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center mx-auto transition-all duration-500 bg-white dark:bg-gray-800 ${isLiveConnected ? 'border-green-400 shadow-[0_0_30px_rgba(74,222,128,0.4)]' : 'border-gray-200 dark:border-gray-700'}`}>
                      <Mic className={`w-10 h-10 ${isLiveConnected ? 'text-green-500' : 'text-gray-400'}`} />
                  </div>
                  <h3 className="text-lg font-black text-gray-700 dark:text-white">
                      {isLiveConnected ? "استمع..." : "اتصال..."}
                  </h3>
              </div>
              
              <button 
                onClick={toggleLiveMode} 
                className="mt-12 px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold shadow-lg flex items-center gap-2 transition-transform active:scale-95 z-20"
              >
                  <StopCircle className="w-5 h-5" /> إنهاء المحادثة
              </button>
          </div>
      ) : (
          <>
            {/* Text Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm text-xs ${
                    msg.role === 'user' 
                    ? 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600' 
                    : 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400'
                    }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    
                    <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-sm leading-relaxed group relative ${
                    msg.role === 'user' 
                        ? 'bg-gray-900 text-white rounded-tr-none' 
                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tl-none'
                    }`}>
                    {msg.image && (
                        <img src={msg.image} alt="Uploaded content" className="w-full h-auto rounded-lg mb-2 border border-gray-200 dark:border-gray-600" />
                    )}
                    {msg.text}
                    {/* Read Aloud Button */}
                    {msg.role === 'model' && (
                        <button 
                           onClick={() => speakText(msg.text)}
                           className="absolute -bottom-6 left-0 text-gray-400 hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity"
                           title="قراءة بصوت عالٍ"
                        >
                            <Volume2 className="w-4 h-4" />
                        </button>
                    )}
                    </div>
                </div>
                ))}
                {isLoading && (
                <div className="flex items-center gap-2 p-2 justify-center">
                   <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                   <span className="text-xs text-gray-400">فصيح يكتب...</span>
                </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Image Preview Area */}
            {selectedImage && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3 animate-in slide-in-from-bottom-2">
                    <div className="relative group">
                        <img src={selectedImage} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-600" />
                        <button 
                           onClick={clearImage}
                           className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm hover:bg-red-600"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">صورة محددة</span>
                </div>
            )}

            {/* Input Area */}
            <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                
                <button 
                    onClick={toggleLiveMode}
                    className={`p-3 rounded-xl transition-all shadow-sm active:scale-95 ${
                        isLiveMode ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                    title="المتحدث الذكي (Live)"
                >
                     <Zap className="w-4 h-4 fill-current" />
                </button>

                <div className="flex-1 relative flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-transparent focus-within:border-primary-500 rounded-xl transition-all px-2">
                     <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                     />
                     <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-primary-500 transition-colors"
                        title="إرفاق صورة"
                     >
                         <ImageIcon className="w-5 h-5" />
                     </button>
                     <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
                        placeholder={selectedImage ? "أضف سؤالاً حول الصورة..." : "اسأل هنا..."}
                        disabled={isLoading}
                        className="flex-1 py-3 bg-transparent outline-none text-sm dark:text-white"
                    />
                </div>
                
                <button
                    onClick={() => handleSendText()}
                    disabled={(!input.trim() && !selectedImage) || isLoading}
                    className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 rtl:rotate-180" />}
                </button>
                </div>
            </div>
          </>
      )}
    </div>
  );
};

export default ChatAssistant;
