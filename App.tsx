
import React, { useState, useEffect, Suspense, lazy, useRef } from 'react';
import { ContentType, SummaryPoint, Quiz, QuizResult, QuizConfig, ToastNotification, AppSettings, LessonSession, TaskModels, Flashcard, QuestionType } from './types';
import Toast from './components/Toast';
import { BookOpen, LayoutDashboard, BrainCircuit, MessageSquare, Settings, History, Library as LibraryIcon, Loader2, Trophy, Flame, Star, ChevronLeft, ChevronRight, Maximize2, Minimize2, Menu, X, Home, Palette, Check, RotateCcw, User } from 'lucide-react';
import { soundManager } from './utils/soundEffects';

// Lazy load heavy components
const InputSection = lazy(() => import('./components/InputSection'));
const ContentEditor = lazy(() => import('./components/ContentEditor'));
const QuizSystem = lazy(() => import('./components/QuizSystem'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const ChatAssistant = lazy(() => import('./components/ChatAssistant'));
const Library = lazy(() => import('./components/Library'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const HistorySidebar = lazy(() => import('./components/HistorySidebar'));

// Loading Fallback
const LoadingFallback = () => (
  <div className="flex justify-center items-center h-[50vh]">
    <Loader2 className="w-12 h-12 animate-spin text-primary-500" />
  </div>
);

// Color Palettes Data (RGB values for Tailwind variables)
const COLOR_PALETTES: Record<string, any> = {
  teal: {
    name: 'التركواز (الافتراضي)',
    class: 'bg-teal-500',
    colors: {
      50: '240 253 250',
      100: '204 251 241',
      500: '20 184 166',
      600: '13 148 136',
      700: '15 118 110',
      800: '17 94 89',
      900: '19 78 74'
    }
  },
  blue: {
    name: 'الأزرق الملكي',
    class: 'bg-blue-600',
    colors: {
      50: '239 246 255',
      100: '219 234 254',
      500: '59 130 246',
      600: '37 99 235',
      700: '29 78 216',
      800: '30 64 175',
      900: '30 58 138'
    }
  },
  violet: {
    name: 'البنفسجي المبدع',
    class: 'bg-violet-600',
    colors: {
      50: '245 243 255',
      100: '237 233 254',
      500: '139 92 246',
      600: '124 58 237',
      700: '109 40 217',
      800: '91 33 182',
      900: '76 29 149'
    }
  },
  rose: {
    name: 'الوردي الحيوي',
    class: 'bg-rose-600',
    colors: {
      50: '255 241 242',
      100: '255 228 230',
      500: '244 63 94',
      600: '225 29 72',
      700: '190 18 60',
      800: '159 18 57',
      900: '136 19 55'
    }
  },
  amber: {
    name: 'الذهبي الدافئ',
    class: 'bg-amber-500',
    colors: {
      50: '255 251 235',
      100: '254 243 199',
      500: '245 158 11',
      600: '217 119 6',
      700: '180 83 9',
      800: '146 64 14',
      900: '120 53 15'
    }
  }
};

// Welcome Modal Component
const WelcomeModal = ({ onComplete }: { onComplete: (name: string) => void }) => {
    const [name, setName] = useState('');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl animate-in zoom-in-95 border border-gray-200 dark:border-gray-700">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6 text-primary-600">
                    <User className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">مرحباً بك في فصيح!</h2>
                <p className="text-gray-500 mb-6">للحصول على أفضل تجربة تعليمية، أخبرنا ما هو اسمك؟</p>
                
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اكتب اسمك هنا..."
                    className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-center text-lg font-bold outline-none focus:border-primary-500 mb-6"
                    autoFocus
                />
                
                <button 
                    onClick={() => {
                        if (name.trim()) onComplete(name.trim());
                    }}
                    disabled={!name.trim()}
                    className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-primary-700 disabled:opacity-50 transition-all"
                >
                    ابدأ الرحلة التعليمية
                </button>
            </div>
        </div>
    );
};

function App() {
  // --- State ---
  const [activeView, setActiveView] = useState<'STUDY' | 'EXAM' | 'PROFILE' | 'LIBRARY'>('STUDY');
  
  // Layout State
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatTriggerMessage, setChatTriggerMessage] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('faseeh_settings');
    if (saved) return JSON.parse(saved);
    return {
      theme: 'dark',
      colorTheme: 'teal', // Default color
      apiKeys: [],
      activeModel: 'gemini-2.0-flash',
      customModels: [],
      taskModels: {
        processing: 'gemini-2.0-flash',
        summary: 'gemini-2.0-flash',
        quiz: 'gemini-2.0-flash',
        chat: 'gemini-2.0-flash-lite-latest'
      },
      userStats: {
        xp: 0,
        level: 1,
        streak: 0,
        lastLoginDate: new Date().toDateString()
      }
    };
  });

  // Check for student name on mount
  useEffect(() => {
      if (!settings.studentName) {
          setShowWelcomeModal(true);
      }
  }, []);

  // Gamification Logic (Simple Check)
  useEffect(() => {
      const today = new Date().toDateString();
      if (settings.userStats.lastLoginDate !== today) {
          setSettings(prev => ({
              ...prev,
              userStats: {
                  ...prev.userStats,
                  streak: prev.userStats.streak + 1,
                  lastLoginDate: today
              }
          }));
          addToast('success', '🔥 مذهل! يوم جديد من التعلم المستمر.');
      }
  }, []);

  // Apply Theme and Colors
  useEffect(() => {
    localStorage.setItem('faseeh_settings', JSON.stringify(settings));
    
    // Apply Dark/Light Mode
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Apply Color Theme
    const palette = COLOR_PALETTES[settings.colorTheme] || COLOR_PALETTES['teal'];
    const root = document.documentElement;
    
    // Update CSS Variables for Tailwind
    Object.entries(palette.colors).forEach(([shade, value]) => {
      root.style.setProperty(`--color-primary-${shade}`, value as string);
    });

  }, [settings]);

  const handleNameSubmit = (name: string) => {
      setSettings(prev => ({ ...prev, studentName: name }));
      setShowWelcomeModal(false);
      addToast('success', `مرحباً ${name}! سعيد بوجودك.`);
      soundManager.play('SUCCESS');
  };

  const addXP = (amount: number) => {
      setSettings(prev => {
          const newXP = prev.userStats.xp + amount;
          const nextLevelXP = prev.userStats.level * 1000;
          let newLevel = prev.userStats.level;
          
          if (newXP >= nextLevelXP) {
              newLevel += 1;
              addToast('success', `🎉 مبروك! لقد وصلت للمستوى ${newLevel}`);
              soundManager.play('SUCCESS');
          }

          return {
              ...prev,
              userStats: {
                  ...prev.userStats,
                  xp: newXP,
                  level: newLevel
              }
          };
      });
  };

  // History Sidebar State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [lessonSessions, setLessonSessions] = useState<LessonSession[]>(() => {
    const saved = localStorage.getItem('faseeh_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Content State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedContent, setProcessedContent] = useState<string>('');
  const [summary, setSummary] = useState<SummaryPoint[]>([]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);

  // Quiz State
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizResult[]>(() => {
    const saved = localStorage.getItem('faseeh_quiz_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // FAB Draggable State
  const [fabPos, setFabPos] = useState({ right: 24, bottom: 24 });
  const isDraggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialFabPos = useRef({ right: 24, bottom: 24 });

  const handleDragStart = (clientX: number, clientY: number) => {
    dragStartPos.current = { x: clientX, y: clientY };
    initialFabPos.current = { ...fabPos };
    isDraggingRef.current = false;
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    const deltaX = dragStartPos.current.x - clientX;
    const deltaY = dragStartPos.current.y - clientY;

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        isDraggingRef.current = true;
        const newRight = initialFabPos.current.right + deltaX;
        const newBottom = initialFabPos.current.bottom + deltaY;
        
        setFabPos({
            right: Math.max(16, Math.min(window.innerWidth - 80, newRight)),
            bottom: Math.max(16, Math.min(window.innerHeight - 80, newBottom))
        });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY);

  const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      handleDragStart(e.clientX, e.clientY);
      const onMouseMove = (ev: MouseEvent) => { ev.preventDefault(); handleDragMove(ev.clientX, ev.clientY); };
      const onMouseUp = () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
  };

  const handleFabClick = () => {
      if (isDraggingRef.current) { isDraggingRef.current = false; return; }
      setIsMobileMenuOpen(!isMobileMenuOpen);
      soundManager.play('CLICK');
  };

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('faseeh_quiz_history', JSON.stringify(quizHistory));
  }, [quizHistory]);

  useEffect(() => {
    localStorage.setItem('faseeh_sessions', JSON.stringify(lessonSessions));
  }, [lessonSessions]);

  useEffect(() => {
    const handleClickOutside = () => setIsColorMenuOpen(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);


  // --- Helpers ---
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getApiKeyForTask = (task: keyof TaskModels) => {
      const keys = settings.apiKeys;
      if (!keys || keys.length === 0) return undefined;
      return keys[Math.floor(Math.random() * keys.length)];
  };
  
  const getConfigForTask = (task: keyof TaskModels) => {
    return {
      apiKey: getApiKeyForTask(task),
      model: settings.taskModels[task] || settings.activeModel
    };
  };

  // --- Handlers ---
  const handleExplainSelection = (text: string) => {
      if (!isChatOpen) setIsChatOpen(true);
      setChatTriggerMessage(`اشرح لي هذا النص: "${text}"`);
  };

  const handleProcessContent = async (type: ContentType, data: string, mimeType?: string) => {
    setIsProcessing(true);
    try {
      const Gemini = await import('./services/geminiService');
      
      const text = await Gemini.processContentToFusha(type, data, getConfigForTask('processing'), mimeType);
      setProcessedContent(text);
      setSummary([]);
      setFlashcards([]);
      addToast('success', 'تمت معالجة المحتوى بنجاح');
      addXP(50);
      soundManager.play('SUCCESS');

      const newSession: LessonSession = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        title: type === ContentType.TOPIC ? JSON.parse(data).lessonName : 'درس جديد',
        content: text,
        summary: [],
        messages: []
      };
      setLessonSessions(prev => [newSession, ...prev]);

    } catch (error) {
      console.error(error);
      addToast('error', 'حدث خطأ أثناء المعالجة');
      soundManager.play('ERROR');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!processedContent) return;
    setIsGeneratingSummary(true);
    try {
      const Gemini = await import('./services/geminiService');
      const points = await Gemini.generateSummary(processedContent, getConfigForTask('summary'));
      setSummary(points);
      addToast('success', 'تم إنشاء الملخص');
      addXP(30);
      soundManager.play('SUCCESS');
    } catch (error) {
      addToast('error', 'فشل في إنشاء الملخص');
      soundManager.play('ERROR');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!processedContent) return;
    setIsGeneratingFlashcards(true);
    try {
      const Gemini = await import('./services/geminiService');
      const cards = await Gemini.generateFlashcards(processedContent, getConfigForTask('summary'));
      setFlashcards(cards);
      addToast('success', 'تم إنشاء البطاقات');
      addXP(30);
      soundManager.play('SUCCESS');
    } catch (error) {
      addToast('error', 'فشل في إنشاء البطاقات');
      soundManager.play('ERROR');
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const handleGenerateQuiz = async (config: QuizConfig) => {
    if (!processedContent) {
        addToast('error', 'يجب توفر محتوى الدرس أولاً');
        return;
    }
    setIsGeneratingQuiz(true);
    try {
      const Gemini = await import('./services/geminiService');
      const quiz = await Gemini.generateQuiz(processedContent, config, getConfigForTask('quiz'));
      setCurrentQuiz(quiz);
      setActiveView('EXAM');
      addToast('success', 'تم إعداد الاختبار');
      soundManager.play('SUCCESS');
    } catch (error) {
      addToast('error', 'فشل في إعداد الاختبار');
      soundManager.play('ERROR');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleQuizComplete = (result: QuizResult) => {
    setQuizHistory(prev => [result, ...prev]);
    addXP(result.score * 10); // 10 XP per point
    addToast('info', `تم إنهاء الاختبار. النتيجة: ${result.score}/${result.total}`);
  };

  const handleRetakeQuiz = (result: QuizResult) => {
    if (result.quizSnapshot) {
        setCurrentQuiz(result.quizSnapshot);
        setActiveView('EXAM');
        addToast('info', 'جاري إعادة الاختبار...');
    } else {
        const reconstructedQuiz: Quiz = {
            title: 'إعادة اختبار سابق',
            questions: result.details.map((d, i) => ({
                id: i,
                text: d.questionText,
                type: QuestionType.SHORT_ANSWER,
                correctAnswer: d.correctAnswer,
                explanation: d.explanation
            }))
        };
        setCurrentQuiz(reconstructedQuiz);
        setActiveView('EXAM');
    }
  };

  const handleLibraryImageProcess = async (images: string[]) => {
      setActiveView('STUDY');
      handleProcessContent(ContentType.IMAGE, images as any);
  };

  const handleLibraryTextExtract = async (text: string) => {
      setActiveView('STUDY');
      setIsProcessing(true);
      setTimeout(() => {
         setProcessedContent(text);
         setSummary([]); 
         setFlashcards([]);
         setIsProcessing(false);
         addToast('success', 'تم استيراد النص بنجاح');
      }, 500);
  };

  const restoreSession = (session: LessonSession) => {
      setProcessedContent(session.content);
      setSummary(session.summary || []);
      setFlashcards(session.flashcards || []);
      setActiveView('STUDY');
      addToast('info', `تم استرجاع درس: ${session.title}`);
  };

  const deleteSession = (id: string) => {
      if(confirm('هل أنت متأكد من حذف هذا الدرس؟')) {
          setLessonSessions(prev => prev.filter(s => s.id !== id));
      }
  };

  const handleResetApp = () => {
      if(confirm('هل أنت متأكد من إعادة تشغيل التطبيق؟ سيتم فقدان العمل غير المحفوظ.')) {
          window.location.reload();
      }
  };

  // Navigation Handler
  const handleNavigate = (view: typeof activeView) => {
      soundManager.play('CLICK');
      setActiveView(view);
      setIsMobileMenuOpen(false);
  };
  
  const handleLogoClick = () => {
      soundManager.play('CLICK');
      setActiveView('STUDY');
  };

  const toggleColorTheme = (key: string) => {
      soundManager.play('CLICK');
      setSettings(prev => ({ ...prev, colorTheme: key }));
      setIsColorMenuOpen(false);
  };

  // XP Progress Calculation
  const nextLevelXP = settings.userStats.level * 1000;
  const progressPercent = Math.min(100, (settings.userStats.xp / nextLevelXP) * 100);

  // Dynamic sizing logic based on Chat state
  const chatSidebarWidthClass = "w-full md:w-[320px] lg:w-[380px] xl:w-[400px]";
  const contentMaxWidthClass = isChatOpen 
      ? "max-w-3xl lg:max-w-4xl xl:max-w-5xl" 
      : "max-w-4xl lg:max-w-5xl xl:max-w-6xl";

  return (
    <div className="h-screen bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300 flex flex-col overflow-hidden">
      
      {showWelcomeModal && <WelcomeModal onComplete={handleNameSubmit} />}

      {/* HEADER & GAMIFICATION BAR */}
      <header className="h-16 flex-shrink-0 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border shadow-sm z-30">
          <div className="h-full w-full px-4 flex items-center justify-between">
              
              {/* Left: Brand & Nav */}
              <div className="flex items-center gap-6">
                  {/* Logo Button - Redirects to Home */}
                  <div 
                    onClick={handleLogoClick}
                    className="flex items-center gap-3 cursor-pointer group select-none"
                    title="العودة للصفحة الرئيسية"
                  >
                      <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-primary-500/20 group-hover:scale-105 transition-transform">ف</div>
                      <span className="font-black text-xl tracking-tight text-gray-900 dark:text-white hidden md:block group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">فصيح</span>
                  </div>

                  <nav className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-xl">
                      {[
                          { id: 'STUDY', icon: BookOpen, label: 'الدرس' },
                          { id: 'LIBRARY', icon: LibraryIcon, label: 'المكتبة' },
                          { id: 'EXAM', icon: BrainCircuit, label: 'الاختبارات' },
                          { id: 'PROFILE', icon: LayoutDashboard, label: 'لوحتي' },
                      ].map(item => (
                          <button
                              key={item.id}
                              onClick={() => { setActiveView(item.id as any); soundManager.play('CLICK'); }}
                              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all duration-200 font-bold text-sm ${
                                  activeView === item.id 
                                  ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-white shadow-sm' 
                                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                              }`}
                          >
                              <item.icon className={`w-4 h-4 ${activeView === item.id ? 'fill-current' : ''}`} />
                              {item.label}
                          </button>
                      ))}
                  </nav>
              </div>

              {/* Right: Gamification & Controls */}
              <div className="flex items-center gap-4">
                  {/* XP Bar */}
                  <div className="hidden sm:flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-1 text-orange-500 font-black">
                          <Flame className="w-4 h-4 fill-current animate-pulse" />
                          <span>{settings.userStats.streak}</span>
                      </div>
                      <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                      <div className="flex flex-col w-32">
                          <div className="flex justify-between text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                              <span>مستوى {settings.userStats.level}</span>
                              <span>{settings.userStats.xp} XP</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-primary-500 to-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                          </div>
                      </div>
                  </div>

                  <div className="flex items-center gap-2">
                       
                       <button 
                          onClick={handleResetApp}
                          className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                          title="بدء من جديد"
                       >
                           <RotateCcw className="w-5 h-5" />
                       </button>

                       {/* Mobile Chat Toggle */}
                       {activeView === 'STUDY' && (
                           <button
                             onClick={() => setIsChatOpen(!isChatOpen)}
                             className={`md:hidden p-2 rounded-lg transition-colors ${
                               isChatOpen 
                                 ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' 
                                 : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                             }`}
                             title={isChatOpen ? "إخفاء المساعد" : "إظهار المساعد"}
                           >
                             <MessageSquare className="w-5 h-5" />
                           </button>
                       )}
                       
                       {/* Color Theme Picker */}
                       <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => setIsColorMenuOpen(!isColorMenuOpen)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="تغيير لون المنصة"
                          >
                              <Palette className="w-5 h-5" />
                          </button>
                          
                          {isColorMenuOpen && (
                              <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 z-50 overflow-hidden">
                                  <div className="p-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                      <p className="text-xs font-black text-gray-400">ألوان الواجهة</p>
                                  </div>
                                  <div className="p-2 space-y-1">
                                      {Object.entries(COLOR_PALETTES).map(([key, palette]) => (
                                          <button
                                            key={key}
                                            onClick={() => toggleColorTheme(key)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                                                settings.colorTheme === key 
                                                ? 'bg-gray-100 dark:bg-gray-700 font-bold text-gray-900 dark:text-white' 
                                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                          >
                                              <span className={`w-5 h-5 rounded-full ${palette.class} border border-gray-200 dark:border-gray-600`}></span>
                                              <span className="flex-1 text-right">{palette.name}</span>
                                              {settings.colorTheme === key && <Check className="w-4 h-4 text-primary-600" />}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          )}
                       </div>

                       <button 
                         onClick={() => setIsHistoryOpen(true)} 
                         className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
                         title="سجل الدروس"
                       >
                           <History className="w-5 h-5" />
                           {lessonSessions.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-gray-800"></span>}
                       </button>
                       <button 
                         onClick={() => setIsSettingsOpen(true)} 
                         className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                         title="الإعدادات"
                       >
                           <Settings className="w-5 h-5" />
                       </button>
                  </div>
              </div>
          </div>
      </header>

      {/* MAIN LAYOUT - SPLIT VIEW */}
      <main className="flex-1 flex overflow-hidden relative">
         
         {/* Content Area (Left/Center) */}
         <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8 transition-all duration-300`}>
            <Suspense fallback={<LoadingFallback />}>
              {activeView === 'STUDY' && (
                <div className={`mx-auto space-y-6 md:space-y-8 pb-20 transition-all duration-500 ease-in-out ${contentMaxWidthClass}`}>
                    <InputSection onProcess={handleProcessContent} isProcessing={isProcessing} />
                    
                    {processedContent ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                             <ContentEditor 
                                formattedText={processedContent}
                                summary={summary}
                                onSaveText={setProcessedContent}
                                onGenerateSummary={handleGenerateSummary}
                                isGeneratingSummary={isGeneratingSummary}
                                flashcards={flashcards}
                                onGenerateFlashcards={handleGenerateFlashcards}
                                isGeneratingFlashcards={isGeneratingFlashcards}
                                onExplainSelection={handleExplainSelection}
                            />
                        </div>
                    ) : (
                        <div className="mt-12 text-center space-y-4">
                             <div className="inline-block p-4 bg-primary-50 dark:bg-primary-900/10 rounded-full mb-2">
                                <BookOpen className="w-12 h-12 text-primary-400 opacity-50" />
                             </div>
                             <h3 className="text-xl font-bold text-gray-400 dark:text-gray-600">ابدأ بإدخال المحتوى أعلاه</h3>
                        </div>
                    )}
                </div>
              )}

              {activeView === 'LIBRARY' && (
                 <div className="max-w-7xl mx-auto h-full">
                    <Library 
                        onProcessPages={handleLibraryImageProcess}
                        onExtractText={handleLibraryTextExtract}
                    />
                 </div>
              )}

              {activeView === 'EXAM' && (
                <div className="max-w-5xl mx-auto py-2 md:py-6">
                    <QuizSystem 
                      onGenerateQuiz={handleGenerateQuiz}
                      isGenerating={isGeneratingQuiz}
                      quiz={currentQuiz}
                      onQuizComplete={handleQuizComplete}
                      studentName={settings.studentName}
                    />
                </div>
              )}

              {activeView === 'PROFILE' && (
                <div className="max-w-6xl mx-auto py-2 md:py-6">
                    <Dashboard 
                      history={quizHistory} 
                      onRetakeQuiz={handleRetakeQuiz}
                    />
                </div>
              )}
            </Suspense>
         </div>

         {/* Chat Sidebar (Right) */}
         {activeView === 'STUDY' && (
             <div className={`fixed md:relative inset-y-0 right-0 z-20 ${chatSidebarWidthClass} bg-white dark:bg-gray-800 shadow-2xl md:shadow-none border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out ${isChatOpen ? 'translate-x-0' : 'translate-x-full md:hidden'}`}>
                 {/* Toggle Button (Desktop) - For CLOSING */}
                 <button 
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className="hidden md:flex absolute top-1/2 -left-3 z-30 w-6 h-12 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-l-lg items-center justify-center text-gray-400 hover:text-primary-500 shadow-md"
                 >
                     {isChatOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                 </button>

                 {/* Toggle Button (Mobile Close) - Top Left inside sidebar */}
                 <button 
                    onClick={() => setIsChatOpen(false)}
                    className="md:hidden absolute top-4 left-4 p-2 bg-gray-100 dark:bg-gray-700 rounded-full z-50 shadow-sm text-gray-600 dark:text-gray-300 hover:bg-red-100 hover:text-red-500 transition-colors"
                    title="إخفاء"
                 >
                     <Minimize2 className="w-5 h-5" />
                 </button>

                 <div className="h-full w-full flex flex-col">
                     {processedContent ? (
                        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>}>
                            <ChatAssistant 
                                context={processedContent} 
                                settings={settings} 
                                triggerMessage={chatTriggerMessage}
                                onClearTrigger={() => setChatTriggerMessage(null)}
                            />
                        </Suspense>
                     ) : (
                         <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
                             <MessageSquare className="w-12 h-12 mb-4" />
                             <p>المساعد الذكي يعمل عند وجود محتوى للدرس</p>
                         </div>
                     )}
                 </div>
             </div>
         )}
         
         {/* Desktop persistent open button (Right Edge) */}
         {!isChatOpen && activeView === 'STUDY' && (
             <button 
                onClick={() => setIsChatOpen(true)}
                className="hidden md:flex fixed top-1/2 right-0 transform -translate-y-1/2 z-30 bg-white dark:bg-gray-800 p-3 rounded-l-2xl shadow-lg border border-gray-200 dark:border-gray-700 text-primary-600 hover:pr-5 hover:bg-primary-50 dark:hover:bg-gray-700 transition-all"
                title="إظهار المساعد الذكي"
             >
                 <ChevronLeft className="w-6 h-6" />
             </button>
         )}
      </main>

      {/* 
         ==============================================
         Draggable Floating Action Button (FAB)
         ==============================================
      */}
      <div 
        className="md:hidden fixed z-50 flex flex-col items-end gap-4 transition-none"
        style={{ right: `${fabPos.right}px`, bottom: `${fabPos.bottom}px` }}
      >
         
         {/* Backdrop Overlay */}
         {isMobileMenuOpen && (
            <div 
               onClick={() => setIsMobileMenuOpen(false)}
               className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
            />
         )}

         {/* Expanded Menu Items */}
         <div className={`flex flex-col gap-3 transition-all duration-300 origin-bottom-right z-50 ${isMobileMenuOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 translate-y-10 pointer-events-none'}`}>
            
            {[
                { id: 'STUDY', icon: BookOpen, label: 'الدرس الحالي' },
                { id: 'LIBRARY', icon: LibraryIcon, label: 'المكتبة الرقمية' },
                { id: 'EXAM', icon: BrainCircuit, label: 'الاختبارات' },
                { id: 'PROFILE', icon: LayoutDashboard, label: 'لوحتي الشخصية' },
            ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id as any)}
                  className={`flex items-center justify-end gap-3 p-2 rounded-full transition-all ${activeView === item.id ? 'translate-x-2' : ''}`}
                >
                    <span className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-3 py-1 rounded-lg font-bold text-sm shadow-md">
                        {item.label}
                    </span>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                        activeView === item.id 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200'
                    }`}>
                        <item.icon className="w-5 h-5" />
                    </div>
                </button>
            ))}
         </div>

         {/* Main Draggable Toggle Button */}
         <button 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onMouseDown={handleMouseDown}
            onClick={handleFabClick}
            className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-white transition-all duration-300 z-50 relative select-none touch-none ${
                isMobileMenuOpen 
                ? 'bg-red-500 rotate-90' 
                : 'bg-gradient-to-br from-primary-600 to-purple-700 active:scale-95'
            }`}
            style={{ 
                touchAction: 'none',
                cursor: isDraggingRef.current ? 'grabbing' : 'grab'
            }}
         >
             {isMobileMenuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
         </button>
      </div>

      {/* Overlays */}
      <Toast notifications={toasts} removeToast={removeToast} />
      
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            onUpdateSettings={setSettings}
          />
        </Suspense>
      )}

      {isHistoryOpen && (
        <Suspense fallback={null}>
          <HistorySidebar 
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            sessions={lessonSessions}
            onSelectSession={restoreSession}
            onDeleteSession={deleteSession}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
