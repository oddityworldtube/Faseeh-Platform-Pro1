
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SummaryPoint, Flashcard } from '../types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { 
  Edit2, Save, List, BookOpen, Loader2, Volume2, Copy, Check, 
  Bold, Italic, Heading, Quote, AlignRight, AlignCenter, AlignLeft, 
  Undo, Redo, StopCircle, Sparkles, Type, Layers, RotateCw, GitGraph,
  ZoomIn, ZoomOut, Move, Maximize, RefreshCw, HelpCircle
} from 'lucide-react';
import { soundManager } from '../utils/soundEffects';
import ExportMenu from './ExportMenu';
import * as Gemini from '../services/geminiService';

// Declare mermaid global
declare const mermaid: any;

// Initialize Turndown service outside component to avoid recreation
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

interface ContentEditorProps {
  formattedText: string;
  summary: SummaryPoint[];
  onSaveText: (newText: string) => void;
  onGenerateSummary: () => void;
  isGeneratingSummary: boolean;
  flashcards?: Flashcard[];
  onGenerateFlashcards?: () => void;
  isGeneratingFlashcards?: boolean;
  onExplainSelection?: (text: string) => void; // New callback
}

const ContentEditor: React.FC<ContentEditorProps> = ({
  formattedText,
  summary,
  onSaveText,
  onGenerateSummary,
  isGeneratingSummary,
  flashcards = [],
  onGenerateFlashcards,
  isGeneratingFlashcards,
  onExplainSelection
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'summary' | 'flashcards' | 'mindmap'>('content');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Mind Map State
  const [mindMapCode, setMindMapCode] = useState('');
  const [isGeneratingMindMap, setIsGeneratingMindMap] = useState(false);
  const mindMapRef = useRef<HTMLDivElement>(null);
  const mindMapContainerRef = useRef<HTMLDivElement>(null);
  
  // Pan & Zoom State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // State for Flashcard Flips (track flipped index)
  const [flippedCards, setFlippedCards] = useState<number[]>([]);

  // Initialize TipTap Editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
        defaultAlignment: 'right',
      }),
    ],
    content: '', // Initial content set via useEffect
    editorProps: {
      attributes: {
        class: 'prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-4 md:px-8 md:py-6',
        dir: 'auto' // Auto detect direction, but we default to RTL in parent
      },
    },
  });

  // Sync content when formattedText changes (initial load or external update)
  useEffect(() => {
    if (editor && formattedText && !editor.isFocused) {
      const htmlContent = marked.parse(formattedText) as string;
      editor.commands.setContent(htmlContent);
    }
  }, [formattedText, editor]);

  // Load TTS voices
  useEffect(() => {
    const loadVoices = () => {
      const vs = window.speechSynthesis.getVoices();
      setVoices(vs);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Initialize Mermaid when tab is active and code exists
  useEffect(() => {
    if (activeTab === 'mindmap' && mindMapCode && typeof mermaid !== 'undefined') {
        mermaid.initialize({ startOnLoad: false, theme: 'default', direction: 'rtl', securityLevel: 'loose' });
        if (mindMapRef.current) {
            // Clear previous content
            mindMapRef.current.innerHTML = `<div class="mermaid">${mindMapCode}</div>`;
            
            // Safe run for Mermaid v10+
            setTimeout(() => {
                if(mermaid.run) {
                    mermaid.run({ nodes: mindMapRef.current?.querySelectorAll('.mermaid') });
                } else if (mermaid.init) {
                    // Fallback for older versions
                    mermaid.init(undefined, mindMapRef.current?.querySelectorAll('.mermaid'));
                }
            }, 100);

            // Reset View
            setScale(1);
            setPosition({ x: 0, y: 0 });
        }
    }
  }, [activeTab, mindMapCode]);

  // Add non-passive wheel listener manually to prevent browser console errors
  useEffect(() => {
      const container = mindMapContainerRef.current;
      if (container) {
          const onWheel = (e: WheelEvent) => {
              e.preventDefault();
              const delta = e.deltaY > 0 ? 0.9 : 1.1;
              setScale(prev => Math.min(Math.max(prev * delta, 0.5), 3));
          };
          // { passive: false } is key here
          container.addEventListener('wheel', onWheel, { passive: false });
          return () => container.removeEventListener('wheel', onWheel);
      }
  }, [activeTab, mindMapCode]);

  const handleTabChange = (tab: 'content' | 'summary' | 'flashcards' | 'mindmap') => {
    soundManager.play('CLICK');
    setActiveTab(tab);
  };

  const handleSave = () => {
    if (!editor) return;
    setIsSaving(true);
    soundManager.play('SUCCESS');
    
    const html = editor.getHTML();
    const markdown = turndownService.turndown(html);
    
    onSaveText(markdown);
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handleExplain = () => {
    if (!editor || !onExplainSelection) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    if (text) {
        soundManager.play('CLICK');
        onExplainSelection(text);
    }
  };

  const handleGenerateMindMap = async () => {
      setIsGeneratingMindMap(true);
      try {
          const text = editor ? editor.getText() : formattedText;
          const settings = JSON.parse(localStorage.getItem('faseeh_settings') || '{}');
          const config = { 
              apiKey: settings.apiKeys?.[0], 
              model: settings.activeModel || 'gemini-2.5-flash' 
          };
          
          const code = await Gemini.generateMindMap(text, config);
          setMindMapCode(code);
          soundManager.play('SUCCESS');
      } catch (error) {
          console.error(error);
          soundManager.play('ERROR');
      } finally {
          setIsGeneratingMindMap(false);
      }
  };

  // --- Pan Handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTab !== 'mindmap') return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || activeTab !== 'mindmap') return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleSpeak = () => {
    soundManager.play('CLICK');
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    let textToSpeak = "";
    if (activeTab === 'content' && editor) {
      textToSpeak = editor.getText();
    } else if (activeTab === 'summary') {
      textToSpeak = summary.map(s => `${s.point}. ${s.explanation}`).join('. ');
    } else {
      // Flashcards speak
      textToSpeak = flashcards.map(f => `السؤال: ${f.front}. الإجابة: ${f.back}`).join('. ');
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    // Prioritize Google Voice
    const arabicVoice = voices.find(v => v.lang.startsWith('ar') && v.name.includes('Google')) || 
                        voices.find(v => v.lang.startsWith('ar'));

    if (arabicVoice) {
      utterance.voice = arabicVoice;
      utterance.lang = arabicVoice.lang;
    } else {
      utterance.lang = 'ar-SA'; 
    }
    utterance.rate = 0.9; 
    
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handleCopy = () => {
    soundManager.play('CLICK');
    let text = "";
    if (activeTab === 'content' && editor) {
       const html = editor.getHTML();
       text = turndownService.turndown(html);
    } else if (activeTab === 'summary') {
       text = JSON.stringify(summary, null, 2);
    } else if (activeTab === 'flashcards') {
       text = JSON.stringify(flashcards, null, 2);
    } else {
       text = mindMapCode;
    }
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCardFlip = (index: number) => {
    soundManager.play('HOVER'); // Soft sound for flip
    setFlippedCards(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Toolbar Button Component
  const ToolbarBtn = ({ onClick, isActive = false, children, title }: any) => (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-all ${
        isActive 
        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400' 
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      title={title}
    >
      {children}
    </button>
  );

  if (!editor) {
    return <div className="p-12 text-center"><Loader2 className="animate-spin w-8 h-8 mx-auto text-primary-500"/></div>;
  }

  return (
    <div className="bg-white dark:bg-dark-card/50 backdrop-blur-sm rounded-[1.5rem] md:rounded-[2rem] shadow-lg border border-gray-100 dark:border-dark-border overflow-hidden h-full flex flex-col relative transition-colors duration-300 glass">
      
      {/* Top Header / Navigation */}
      <div className="border-b border-gray-100 dark:border-dark-border px-4 sm:px-6 py-4 flex flex-col lg:flex-row justify-between items-center gap-4 sticky top-0 z-20 bg-white/90 dark:bg-dark-card/90 backdrop-blur">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full lg:w-auto overflow-x-auto">
          <button
            onClick={() => handleTabChange('content')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'content' 
              ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-white shadow-sm' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            الدرس
          </button>
          <button
            onClick={() => handleTabChange('summary')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'summary' 
              ? 'bg-white dark:bg-gray-700 text-secondary-600 dark:text-white shadow-sm' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
            }`}
          >
            <List className="w-4 h-4" />
            ملخص
          </button>
          <button
            onClick={() => handleTabChange('flashcards')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'flashcards' 
              ? 'bg-white dark:bg-gray-700 text-pink-600 dark:text-white shadow-sm' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            بطاقات
          </button>
          <button
            onClick={() => handleTabChange('mindmap')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'mindmap' 
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
            }`}
          >
            <GitGraph className="w-4 h-4" />
            مخطط
          </button>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
          <div className="flex items-center gap-2">
            <button onClick={handleSpeak} className={`p-2.5 rounded-full transition-all border ${isSpeaking ? 'bg-red-50 border-red-200 text-red-500 animate-pulse' : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100'}`}>
               {isSpeaking ? <StopCircle className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button onClick={handleCopy} className="p-2.5 rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200">
               {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          <ExportMenu 
            filename={activeTab === 'content' ? 'Lesson' : (activeTab === 'summary' ? 'Summary' : 'Flashcards')} 
            content={activeTab === 'content' ? turndownService.turndown(editor.getHTML()) : (activeTab === 'summary' ? JSON.stringify(summary) : JSON.stringify(flashcards))}
            isSummary={activeTab === 'summary'}
            summaryData={summary}
          />

          {activeTab === 'content' && (
             <button 
               onClick={handleSave} 
               disabled={isSaving}
               className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold shadow-lg shadow-green-600/20 text-sm transition-all active:scale-95"
             >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                {isSaving ? 'حفظ' : 'حفظ'}
             </button>
          )}
        </div>
      </div>

      {/* Editor Toolbar (Only visible in Content tab) */}
      {activeTab === 'content' && (
        <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-1 sticky top-[60px] md:top-[72px] z-10 backdrop-blur-sm">
            {onExplainSelection && (
                 <ToolbarBtn onClick={handleExplain} title="اشرح النص المحدد">
                   <Sparkles className="w-4 h-4 text-purple-500" />
                 </ToolbarBtn>
            )}
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2"></div>

            <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="عريض">
              <Bold className="w-4 h-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="مائل">
              <Italic className="w-4 h-4" />
            </ToolbarBtn>
            
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2"></div>

            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="عنوان رئيسي">
              <Heading className="w-4 h-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="عنوان فرعي">
              <Type className="w-4 h-4" />
            </ToolbarBtn>
            
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2"></div>

            <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="محاذاة لليمين (عربي)">
              <AlignRight className="w-4 h-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="توسيط">
              <AlignCenter className="w-4 h-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="محاذاة لليسار (إنجليزي)">
              <AlignLeft className="w-4 h-4" />
            </ToolbarBtn>

            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2"></div>
            
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="اقتباس">
              <Quote className="w-4 h-4" />
            </ToolbarBtn>

            <div className="flex-1"></div>

            <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="تراجع">
              <Undo className="w-4 h-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="إعادة">
              <Redo className="w-4 h-4" />
            </ToolbarBtn>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 bg-transparent flex flex-col overflow-hidden relative">
        {activeTab === 'content' ? (
            <div className="w-full h-full text-gray-900 dark:text-gray-100 overflow-auto custom-scrollbar" dir="rtl">
               <style>{`
                 .ProseMirror {
                    min-height: 100%;
                    padding: 1rem;
                    direction: rtl;
                    font-family: 'Tajawal', sans-serif;
                 }
                 @media (min-width: 768px) {
                   .ProseMirror {
                      padding: 2rem;
                   }
                 }
                 .ProseMirror:focus {
                    outline: none;
                 }
                 .ProseMirror strong {
                    color: inherit;
                    font-weight: 900;
                    background-color: transparent !important;
                 }
                 .ProseMirror h1 {
                    font-size: 2em;
                    font-weight: 900;
                    color: #0d9488;
                    margin-top: 1.5em;
                    margin-bottom: 0.5em;
                    line-height: 1.2;
                 }
                 .dark .ProseMirror h1 { color: #2dd4bf; }
                 .ProseMirror h2 {
                    font-size: 1.5em;
                    font-weight: 800;
                    margin-top: 1.5em;
                    margin-bottom: 0.5em;
                    border-right: 4px solid #6366f1;
                    padding-right: 1rem;
                 }
                 .ProseMirror blockquote {
                    border-right: 4px solid #f59e0b;
                    background: rgba(245, 158, 11, 0.1);
                    padding: 1rem 1.5rem;
                    border-radius: 0.5rem;
                    margin: 1.5rem 0;
                    font-style: italic;
                 }
                 .ProseMirror ul {
                    list-style-type: disc;
                    padding-right: 1.5rem;
                    margin: 1rem 0;
                 }
                 .ProseMirror ol {
                    list-style-type: decimal;
                    padding-right: 1.5rem;
                    margin: 1rem 0;
                 }
                 .ProseMirror li {
                    margin-bottom: 0.5rem;
                 }
                 .ProseMirror p[style*="text-align: left"] { direction: ltr; }
               `}</style>
               <EditorContent editor={editor} />
            </div>
        ) : activeTab === 'summary' ? (
          <div className="w-full h-full overflow-auto custom-scrollbar">
            <div className="w-full max-w-[98%] mx-auto p-4 md:p-8 space-y-8">
              {summary.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-24 h-24 bg-secondary-50 dark:bg-secondary-900/20 text-secondary-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-float">
                    <List className="w-12 h-12" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">أنشئ ملخصاً ذكياً</h3>
                  <button
                    onClick={() => { soundManager.play('CLICK'); onGenerateSummary(); }}
                    disabled={isGeneratingSummary}
                    className="btn-secondary px-10 py-4 text-lg shadow-xl shadow-secondary-500/20"
                  >
                    {isGeneratingSummary ? <span className="flex gap-2"><Loader2 className="animate-spin" /> جاري التحليل...</span> : 'توليد الملخص'}
                  </button>
                </div>
              ) : (
                <div className="grid gap-6">
                  {summary.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                          soundManager.play('CLICK');
                          if (onExplainSelection) onExplainSelection(`اشرح لي هذه النقطة من الملخص: ${item.point} - ${item.explanation}`);
                      }}
                      className="group relative bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 hover:border-primary-200 dark:hover:border-primary-700 cursor-pointer transition-all duration-300 overflow-hidden"
                      title="اضغط ليشرح المساعد الذكي هذه النقطة"
                    >
                      <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="flex items-center gap-1 text-xs text-primary-600 font-bold bg-primary-50 dark:bg-primary-900/50 px-2 py-1 rounded-lg">
                            <Sparkles className="w-3 h-3" /> اشرح لي
                         </div>
                      </div>
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-secondary-400 to-secondary-600"></div>
                      <div className="flex items-start gap-5">
                        <span className="flex-shrink-0 w-12 h-12 bg-secondary-50 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400 rounded-2xl flex items-center justify-center font-black text-xl group-hover:scale-110 transition-transform">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white text-xl mb-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{item.point}</h4>
                          <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">{item.explanation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'flashcards' ? (
            <div className="w-full h-full overflow-auto custom-scrollbar">
                <div className="w-full max-w-[98%] mx-auto p-4 md:p-8">
                     {flashcards.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-24 h-24 bg-pink-50 dark:bg-pink-900/20 text-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-float">
                            <Layers className="w-12 h-12" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">بطاقات المراجعة السريعة</h3>
                            <p className="text-gray-500 mb-8">حول الدرس إلى بطاقات سؤال وجواب للحفظ والمراجعة</p>
                            <button
                            onClick={() => { soundManager.play('CLICK'); onGenerateFlashcards && onGenerateFlashcards(); }}
                            disabled={isGeneratingFlashcards}
                            className="px-10 py-4 bg-pink-600 text-white rounded-xl font-bold shadow-xl shadow-pink-500/20 hover:bg-pink-700 transition-all flex items-center gap-2 mx-auto"
                            >
                            {isGeneratingFlashcards ? <span className="flex gap-2"><Loader2 className="animate-spin" /> جاري الإنشاء...</span> : 'توليد البطاقات'}
                            </button>
                        </div>
                     ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                             {flashcards.map((card, idx) => (
                                 <div 
                                    key={idx} 
                                    className="group h-64 w-full perspective"
                                    onClick={() => toggleCardFlip(idx)}
                                 >
                                     <div className={`relative w-full h-full duration-500 preserve-3d cursor-pointer transition-transform ${flippedCards.includes(idx) ? 'rotate-y-180' : ''}`}>
                                         <div className="absolute inset-0 backface-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center">
                                             <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    soundManager.play('CLICK');
                                                    if (onExplainSelection) onExplainSelection(`اشرح لي هذا المفهوم: ${card.front}`);
                                                }}
                                                className="absolute top-4 left-4 z-20 p-2 bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 rounded-full shadow-sm hover:bg-primary-50 dark:hover:bg-gray-600 transition-all opacity-60 hover:opacity-100"
                                                title="شرح بالذكاء الاصطناعي"
                                             >
                                                <Sparkles className="w-4 h-4" />
                                             </button>
                                             <span className="absolute top-4 right-4 text-xs font-bold text-pink-500 bg-pink-50 dark:bg-pink-900/20 px-2 py-1 rounded">سؤال {idx + 1}</span>
                                             <h3 className="text-xl font-bold text-gray-800 dark:text-white leading-relaxed">{card.front}</h3>
                                             <div className="absolute bottom-4 text-gray-400 text-sm flex items-center gap-1">
                                                 <RotateCw className="w-4 h-4" /> اضغط للقلب
                                             </div>
                                         </div>
                                         <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-pink-500 to-purple-600 text-white rounded-2xl shadow-xl p-6 flex flex-col items-center justify-center text-center">
                                             <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    soundManager.play('CLICK');
                                                    if (onExplainSelection) onExplainSelection(`اشرح لي بالتفصيل: ${card.back}`);
                                                }}
                                                className="absolute top-4 left-4 z-20 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-sm transition-all"
                                                title="شرح مفصل"
                                             >
                                                <Sparkles className="w-4 h-4" />
                                             </button>
                                             <p className="text-lg font-medium leading-relaxed">{card.back}</p>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     )}
                      <style>{` .perspective { perspective: 1000px; } .preserve-3d { transform-style: preserve-3d; } .backface-hidden { backface-visibility: hidden; } .rotate-y-180 { transform: rotateY(180deg); } `}</style>
                </div>
            </div>
        ) : (
          <div className="h-full flex flex-col relative bg-gray-50 dark:bg-gray-900 overflow-hidden">
             {/* Mind Map Controls */}
             {mindMapCode && (
                 <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 animate-in slide-in-from-right">
                     <button onClick={zoomIn} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300" title="تكبير">
                         <ZoomIn className="w-5 h-5" />
                     </button>
                     <button onClick={zoomOut} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300" title="تصغير">
                         <ZoomOut className="w-5 h-5" />
                     </button>
                     <button onClick={resetView} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300" title="إعادة ضبط">
                         <Maximize className="w-5 h-5" />
                     </button>
                     <div className="h-px bg-gray-200 dark:bg-gray-600 my-1"></div>
                     <button onClick={() => setMindMapCode('')} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="إعادة إنشاء">
                         <RefreshCw className="w-5 h-5" />
                     </button>
                 </div>
             )}
             
             {/* Empty State */}
             {!mindMapCode ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mb-6 animate-float">
                        <GitGraph className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">المخطط الذهني الذكي</h3>
                    <p className="text-gray-500 mb-8 max-w-lg mx-auto">أنشئ مخططاً بصرياً يربط مفاهيم الدرس ببعضها البعض لتسهيل الحفظ والفهم</p>
                    <button
                        onClick={handleGenerateMindMap}
                        disabled={isGeneratingMindMap}
                        className="px-10 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center gap-2"
                    >
                        {isGeneratingMindMap ? <span className="flex gap-2"><Loader2 className="animate-spin" /> جاري الرسم...</span> : 'رسم المخطط الذهني'}
                    </button>
                </div>
             ) : (
                <div 
                  ref={mindMapContainerRef}
                  className="flex-1 w-full h-full overflow-hidden cursor-move relative"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{ 
                      backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', 
                      backgroundSize: '20px 20px',
                      backgroundColor: 'transparent'
                  }}
                >
                    <div 
                        className="w-full h-full flex items-center justify-center origin-center transition-transform duration-75 ease-out"
                        style={{ 
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
                        }}
                    >
                        <div ref={mindMapRef} className="pointer-events-none select-none" />
                    </div>

                    <div className="absolute bottom-4 left-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-4 py-2 rounded-lg text-xs font-mono text-gray-500 border border-gray-200 dark:border-gray-700 pointer-events-none">
                        Zoom: {Math.round(scale * 100)}% | Pan: {Math.round(position.x)}, {Math.round(position.y)}
                    </div>
                </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentEditor;
