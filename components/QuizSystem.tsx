import React, { useState, useEffect } from 'react';
import { QuestionType, Quiz, Question, QuizResult, QuizConfig, DifficultyLevel } from '../types';
import { Loader2, Play, Plus, ArrowLeft, Timer, X, RotateCcw, Sparkles, Save, Trash2, Edit2, FileText, Printer, Home, ArrowRight } from 'lucide-react';
import { soundManager } from '../utils/soundEffects';
import ExportMenu from './ExportMenu';
import * as Gemini from '../services/geminiService';

interface QuizSystemProps {
  onGenerateQuiz: (config: QuizConfig) => Promise<void>;
  isGenerating: boolean;
  quiz: Quiz | null;
  onQuizComplete: (result: QuizResult) => void;
  studentName?: string;
}

const QuizSystem: React.FC<QuizSystemProps> = ({ onGenerateQuiz, isGenerating, quiz, onQuizComplete, studentName }) => {
  // --- STATE ---
  const [mode, setMode] = useState<'SETUP' | 'PREVIEW' | 'TAKING' | 'REVIEW'>('SETUP');
  const [setupTab, setSetupTab] = useState<'CUSTOM' | 'COMPREHENSIVE' | 'MANUAL'>('COMPREHENSIVE');
  
  // Setup Config
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(DifficultyLevel.MEDIUM);
  const [enableTimer, setEnableTimer] = useState(false);
  const [timerDuration, setTimerDuration] = useState<number>(10); // Minutes
  const [instantFeedback, setInstantFeedback] = useState(false);
  const [typeCounts, setTypeCounts] = useState<Record<QuestionType, number>>({
      [QuestionType.TRUE_FALSE]: 5,
      [QuestionType.MULTIPLE_CHOICE]: 5,
      [QuestionType.SHORT_ANSWER]: 0,
      [QuestionType.FILL_BLANKS]: 0,
      [QuestionType.ORDERING]: 0,
      [QuestionType.MATCHING]: 0
  });

  // Preview/Edit State (Local Quiz)
  const [localQuiz, setLocalQuiz] = useState<Quiz | null>(null);

  // Taking Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [allAnswers, setAllAnswers] = useState<Record<number, any>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showAnswerForCurrent, setShowAnswerForCurrent] = useState(false);

  // Review State
  const [currentResult, setCurrentResult] = useState<QuizResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Manual Builder Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualQ, setManualQ] = useState<Partial<Question>>({ type: QuestionType.MULTIPLE_CHOICE, options: ['', '', '', ''] });

  // Sync generated quiz to localQuiz when it arrives
  useEffect(() => {
      if (quiz) {
          setLocalQuiz(quiz);
          setMode('PREVIEW'); // Move to Preview instead of Taking directly
      }
  }, [quiz]);

  // Timer Effect
  useEffect(() => {
      let interval: any;
      if (isTimerRunning && timeLeft > 0) {
          interval = setInterval(() => {
              setTimeLeft(prev => {
                  if (prev <= 1) {
                      clearInterval(interval);
                      submitQuiz(); // Auto submit
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const formatTime = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // --- HANDLERS ---

  const handleGenerate = async () => {
    soundManager.play('CLICK');
    await onGenerateQuiz({
        typeCounts: setupTab === 'CUSTOM' ? typeCounts : {},
        mode: setupTab === 'MANUAL' ? 'MANUAL_ONLY' : setupTab as any,
        difficulty,
        enableTimer,
        timerDuration,
        instantFeedback
    });
    // Note: setMode('PREVIEW') happens in useEffect when quiz prop updates
  };

  const handleStartManual = () => {
      // Initialize empty quiz for manual building
      setLocalQuiz({
          title: 'اختبار يدوي',
          questions: []
      });
      setMode('PREVIEW');
  };

  const startQuiz = () => {
      if (!localQuiz || localQuiz.questions.length === 0) {
          alert("لا يوجد أسئلة لبدء الاختبار");
          return;
      }
      soundManager.play('CLICK');
      setMode('TAKING');
      setCurrentQuestionIndex(0);
      setAllAnswers({});
      setShowAnswerForCurrent(false);
      setAiAnalysis('');
      
      if (enableTimer) {
          setTimeLeft(timerDuration * 60);
          setIsTimerRunning(true);
      }
  };

  const handleAnswerChange = (qId: number, val: any) => {
      setAllAnswers(prev => ({ ...prev, [qId]: val }));
      if (instantFeedback) setShowAnswerForCurrent(true);
      soundManager.play('CLICK');
  };

  const submitQuiz = async () => {
    setIsTimerRunning(false);
    if (!localQuiz) return;
    
    let correctCount = 0;
    const resultDetails = localQuiz.questions.map(q => {
      const studentAns = allAnswers[q.id];
      let isCorrect = false;

      // Grading Logic
      if (q.type === QuestionType.ORDERING) {
          if (Array.isArray(studentAns) && Array.isArray(q.correctAnswer)) {
             isCorrect = JSON.stringify(studentAns) === JSON.stringify(q.correctAnswer);
          }
      } else if (q.type === QuestionType.MATCHING) {
          if (q.matches && typeof studentAns === 'object') {
              const allMatch = q.matches.every(m => studentAns[m.left] === m.right);
              isCorrect = allMatch;
          }
      } else {
           const cleanStudent = String(studentAns || '').trim().toLowerCase().replace(/[.,]/g,"");
           const cleanCorrect = String(q.correctAnswer).trim().toLowerCase().replace(/[.,]/g,"");
           if (q.type === QuestionType.TRUE_FALSE) {
               isCorrect = cleanStudent === cleanCorrect || (cleanStudent === 'صواب' && cleanCorrect === 'true');
           } else {
               isCorrect = cleanStudent === cleanCorrect;
           }
      }

      if (isCorrect) correctCount++;
      return {
        questionText: q.text,
        userAnswer: JSON.stringify(studentAns),
        correctAnswer: typeof q.correctAnswer === 'object' ? JSON.stringify(q.correctAnswer) : String(q.correctAnswer),
        isCorrect,
        explanation: q.explanation
      };
    });

    const result: QuizResult = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      score: correctCount,
      total: localQuiz.questions.length,
      details: resultDetails,
      quizSnapshot: localQuiz
    };

    setCurrentResult(result);
    onQuizComplete(result);
    setMode('REVIEW');
    
    // Auto Analyze
    setIsAnalyzing(true);
    try {
        const analysis = await Gemini.analyzeQuizPerformance(result, studentName || '', { model: 'gemini-2.5-flash' });
        setAiAnalysis(analysis);
    } catch(e) { setAiAnalysis("تعذر إجراء التحليل الذكي حالياً."); }
    setIsAnalyzing(false);
  };

  // --- MANUAL BUILDER (Inside Preview Mode) ---
  const addManualQuestion = () => {
      if (!manualQ.text || !manualQ.correctAnswer) return;
      const newId = (localQuiz?.questions.length || 0) + Date.now();
      const newQuestion = { ...manualQ, id: newId } as Question;
      
      if (localQuiz) {
          setLocalQuiz({ ...localQuiz, questions: [...localQuiz.questions, newQuestion] });
      } else {
          setLocalQuiz({ title: 'اختبار مخصص', questions: [newQuestion] });
      }
      setIsManualModalOpen(false);
      setManualQ({ type: QuestionType.MULTIPLE_CHOICE, options: ['', '', '', ''] });
      soundManager.play('SUCCESS');
  };

  const deleteQuestion = (id: number) => {
      if (!localQuiz) return;
      setLocalQuiz({
          ...localQuiz,
          questions: localQuiz.questions.filter(q => q.id !== id)
      });
  };

  // --- RENDERERS ---

  const OrderingQuestion = ({ q, readOnly }: { q: Question, readOnly?: boolean }) => {
      const [items, setItems] = useState<string[]>(() => {
          if (readOnly && allAnswers[q.id]) return allAnswers[q.id]; 
          return q.options || []; 
      });

      const moveItem = (idx: number, dir: -1 | 1) => {
          if (readOnly) return;
          const newItems = [...items];
          const swapIdx = idx + dir;
          if (swapIdx >= 0 && swapIdx < newItems.length) {
              [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];
              setItems(newItems);
              handleAnswerChange(q.id, newItems);
          }
      };

      return (
          <div className="space-y-3">
              {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex flex-col gap-1 flex-shrink-0">
                          <button onClick={() => moveItem(idx, -1)} disabled={idx === 0 || readOnly} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30 transition-colors" title="تحريك لأعلى"><ArrowLeft className="w-4 h-4 rotate-90 text-gray-700 dark:text-gray-300" /></button>
                          <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1 || readOnly} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30 transition-colors" title="تحريك لأسفل"><ArrowLeft className="w-4 h-4 -rotate-90 text-gray-700 dark:text-gray-300" /></button>
                      </div>
                      <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 flex items-center justify-center text-sm font-bold flex-shrink-0">{idx + 1}</span>
                      <span className="flex-1 font-bold text-lg text-gray-800 dark:text-gray-100">{item}</span>
                  </div>
              ))}
          </div>
      );
  };

  const MatchingQuestion = ({ q, readOnly }: { q: Question, readOnly?: boolean }) => {
      const leftItems = q.matches?.map(m => m.left) || [];
      const rightOptions = q.options || [];

      return (
          <div className="space-y-4">
              {leftItems.map((left, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-center gap-4 justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm">
                      <div className="font-bold text-gray-800 dark:text-gray-100 w-full sm:w-1/2 text-lg text-right">{left}</div>
                      <ArrowLeft className="w-5 h-5 text-gray-400 hidden sm:block" />
                      <select 
                        disabled={readOnly}
                        value={allAnswers[q.id]?.[left] || ''}
                        onChange={(e) => {
                            const newAns = { ...(allAnswers[q.id] || {}), [left]: e.target.value };
                            handleAnswerChange(q.id, newAns);
                        }}
                        className="w-full sm:w-1/2 p-3 rounded-xl border-2 border-gray-300 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 outline-none font-medium transition-colors cursor-pointer"
                      >
                          <option value="">اختر الإجابة...</option>
                          {rightOptions.map((opt, i) => (
                              <option key={i} value={opt} className='dark:bg-gray-800'>{opt}</option>
                          ))}
                      </select>
                  </div>
              ))}
          </div>
      );
  };


  // --- MAIN VIEWS ---

  if (mode === 'SETUP') {
      return (
          <div className="space-y-8 animate-in fade-in max-w-4xl mx-auto">
               <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-gray-700">
                   <h2 className="text-3xl font-black mb-6 text-gray-900 dark:text-white flex items-center gap-3 border-b pb-4 border-gray-100 dark:border-gray-700/50">
                       <Sparkles className="text-primary-500 w-7 h-7" /> إعداد الاختبار الذكي
                   </h2>
                   
                   {/* Difficulty */}
                   <div className="mb-8">
                       <label className="block font-bold mb-3 text-lg text-gray-700 dark:text-gray-300">مستوى الصعوبة</label>
                       <div className="flex gap-4">
                           {[DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD].map(lvl => (
                               <button 
                                key={lvl} 
                                onClick={() => setDifficulty(lvl)}
                                className={`flex-1 py-4 rounded-2xl font-extrabold border-2 transition-all duration-300 text-lg shadow-sm ${
                                    difficulty === lvl 
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 ring-4 ring-primary-100 dark:ring-primary-900 scale-[1.01] shadow-primary-500/10' 
                                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 hover:bg-primary-50/50 dark:hover:bg-gray-700/70 hover:border-primary-300'
                                }`}
                               >
                                   {lvl === DifficultyLevel.EASY ? 'سهل' : lvl === DifficultyLevel.MEDIUM ? 'متوسط' : 'صعب'}
                               </button>
                           ))}
                       </div>
                   </div>

                   {/* Options */}
                   <div className="flex flex-col md:flex-row gap-6 mb-8">
                       <div className={`flex-1 p-5 border-2 rounded-2xl transition-all duration-300 ${enableTimer ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                           <label className="flex items-center gap-4 cursor-pointer mb-2">
                               <input type="checkbox" checked={enableTimer} onChange={(e) => setEnableTimer(e.target.checked)} className="w-6 h-6 accent-primary-600 dark:accent-primary-400" />
                               <div className="flex items-center gap-2">
                                    <Timer className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                    <span className="font-bold text-lg text-gray-800 dark:text-gray-200">تحدي الوقت</span>
                               </div>
                           </label>
                           {enableTimer && (
                               <div className="flex items-center gap-3 mt-3 mr-10 animate-in fade-in">
                                   <input 
                                     type="number" 
                                     min="1" 
                                     max="180"
                                     value={timerDuration}
                                     onChange={(e) => setTimerDuration(parseInt(e.target.value))}
                                     className="w-24 p-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-center font-bold text-lg focus:border-primary-500 dark:focus:border-primary-400 outline-none dark:bg-gray-800 dark:text-white transition-colors"
                                   />
                                   <span className="text-gray-500 dark:text-gray-400 font-bold">دقيقة</span>
                               </div>
                           )}
                       </div>
                       
                       <label className={`flex-1 p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 flex items-center gap-4 ${instantFeedback ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                           <input type="checkbox" checked={instantFeedback} onChange={(e) => setInstantFeedback(e.target.checked)} className="w-6 h-6 accent-primary-600 dark:accent-primary-400" />
                           <div>
                               <span className="block font-bold text-lg text-gray-800 dark:text-gray-200">تصحيح فوري</span>
                               <span className="text-sm text-gray-500 dark:text-gray-400">إظهار الإجابة الصحيحة بعد كل سؤال مباشرة</span>
                           </div>
                       </label>
                   </div>

                   {/* Type Selection */}
                   <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl mb-8 border border-gray-200 dark:border-gray-700 shadow-inner">
                       <div className="flex gap-2 mb-6 overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-700/50">
                           <button onClick={() => setSetupTab('COMPREHENSIVE')} className={`px-6 py-2 rounded-full font-bold whitespace-nowrap transition-all duration-200 text-sm ${setupTab === 'COMPREHENSIVE' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>شامل (تلقائي)</button>
                           <button onClick={() => setSetupTab('CUSTOM')} className={`px-6 py-2 rounded-full font-bold whitespace-nowrap transition-all duration-200 text-sm ${setupTab === 'CUSTOM' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>مخصص (تحديد العدد)</button>
                           <button onClick={() => setSetupTab('MANUAL')} className={`px-6 py-2 rounded-full font-bold whitespace-nowrap transition-all duration-200 text-sm ${setupTab === 'MANUAL' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>يدوي بالكامل</button>
                       </div>

                       {setupTab === 'CUSTOM' && (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                               {Object.values(QuestionType).map(type => (
                                   <div key={type} className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md">
                                       <span className="font-bold text-gray-700 dark:text-gray-300">{type === QuestionType.TRUE_FALSE ? 'صح وخطأ' : type === QuestionType.MULTIPLE_CHOICE ? 'اختيارات' : type === QuestionType.ORDERING ? 'ترتيب' : type === QuestionType.MATCHING ? 'توصيل' : 'أخرى'}</span>
                                       <div className="flex items-center gap-3">
                                           <button onClick={() => setTypeCounts(p => ({...p, [type]: Math.max(0, p[type]-1)}))} className="w-8 h-8 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full font-bold text-lg flex items-center justify-center text-gray-600 dark:text-gray-300 transition-colors">-</button>
                                           <span className="font-mono w-8 text-center text-lg font-bold text-gray-800 dark:text-white">{typeCounts[type]}</span>
                                           <button onClick={() => setTypeCounts(p => ({...p, [type]: p[type]+1}))} className="w-8 h-8 bg-primary-100 dark:bg-primary-900/50 hover:bg-primary-200 dark:hover:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full font-bold text-lg flex items-center justify-center transition-colors">+</button>
                                       </div>
                                   </div>
                               ))}
                           </div>
                       )}

                        {setupTab === 'MANUAL' && (
                           <div className="text-center py-10">
                               <Edit2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                               <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium">صمم اختبارك بنفسك! أضف الأسئلة وحدد الإجابات يدوياً.</p>
                               <button onClick={handleStartManual} className="px-8 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:border-primary-500 hover:text-primary-600 dark:hover:border-primary-400 dark:hover:text-primary-400 font-bold transition-all shadow-md">ابدأ نموذج فارغ</button>
                           </div>
                       )}
                   </div>

                   {setupTab !== 'MANUAL' && (
                        <button 
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full py-5 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white rounded-2xl font-black text-xl shadow-2xl shadow-primary-500/40 dark:shadow-primary-700/30 flex items-center justify-center gap-3 transform active:scale-[0.98] transition-all duration-200"
                        >
                            {isGenerating ? <Loader2 className="animate-spin w-6 h-6" /> : <Sparkles className="w-6 h-6" />} 
                            {setupTab === 'CUSTOM' ? 'توليد الأسئلة والانتقال للمعاينة' : 'توليد اختبار ذكي شامل'}
                        </button>
                   )}
               </div>
          </div>
      );
  }

  if (mode === 'PREVIEW' && localQuiz) {
      return (
          <div className="space-y-6 max-w-4xl mx-auto pb-20">
               {/* Header Card */}
               <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-6 sticky top-4 z-20 transition-all duration-300">
                   <div className="flex items-center gap-4 w-full md:w-auto">
                       <button onClick={() => setMode('SETUP')} className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors transform active:scale-95" title="عودة للإعداد">
                           <ArrowRight className="w-5 h-5" />
                       </button>
                       <div>
                           <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-1">معاينة الاختبار</h2>
                           <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 font-medium">
                               <span className="flex items-center gap-1"><FileText className="w-4 h-4 text-primary-500" /> {localQuiz.questions.length} سؤال</span>
                               <span>•</span>
                               <span className="flex items-center gap-1"><Timer className="w-4 h-4 text-primary-500" /> {enableTimer ? `${timerDuration} دقيقة` : 'مفتوح'}</span>
                           </div>
                       </div>
                   </div>
                   <div className="flex gap-3 w-full md:w-auto">
                       <ExportMenu filename={`Quiz_${localQuiz.title}`} type="QUIZ" quizData={localQuiz} />
                       <button 
                         onClick={startQuiz}
                         className="flex-1 md:flex-none px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-98"
                       >
                           <Play className="w-5 h-5 fill-current" /> بدء الحل الآن
                       </button>
                   </div>
               </div>

               <div className="space-y-4">
                   {localQuiz.questions.map((q, i) => (
                       <div key={q.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 relative group shadow-md hover:shadow-xl transition-all duration-300">
                           <button 
                             onClick={() => deleteQuestion(q.id)}
                             className="absolute top-4 left-4 p-2 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 dark:hover:bg-red-900/50 transform hover:scale-105"
                             title="حذف السؤال"
                           >
                               <Trash2 className="w-4 h-4" />
                           </button>
                           <div className="flex gap-4">
                               <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 w-10 h-10 flex items-center justify-center rounded-xl font-black text-lg shadow-inner flex-shrink-0">{i+1}</span>
                               <div className="flex-1">
                                   <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                                       <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-relaxed">{q.text}</h3>
                                       <span className="text-xs font-bold bg-primary-50 dark:bg-primary-900 text-primary-600 dark:text-primary-300 px-3 py-1 rounded-full border border-primary-100 dark:border-primary-800/50">{q.type}</span>
                                   </div>
                                   
                                   <div className="text-sm text-gray-500 dark:text-gray-400 pl-8">
                                       {q.type === QuestionType.MULTIPLE_CHOICE && (
                                           <div className="flex gap-2 flex-wrap mt-2">
                                               {q.options?.map((opt, idx) => (
                                                   <span key={idx} className={`px-3 py-1.5 rounded-lg border-2 font-medium transition-colors ${opt === q.correctAnswer ? 'bg-green-100 dark:bg-green-900/50 border-green-400 text-green-700 dark:text-green-300' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700'}`}>
                                                       {opt}
                                                   </span>
                                               ))}
                                           </div>
                                       )}
                                       {q.type === QuestionType.TRUE_FALSE && (
                                            <div className="flex gap-2 mt-2">
                                                <span className={`px-4 py-1 rounded-lg border ${String(q.correctAnswer) === 'true' ? 'bg-green-100 dark:bg-green-900/50 border-green-400 text-green-800 dark:text-green-300' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-700'}`}>صواب</span>
                                                <span className={`px-4 py-1 rounded-lg border ${String(q.correctAnswer) === 'false' ? 'bg-green-100 dark:bg-green-900/50 border-green-400 text-green-800 dark:text-green-300' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-700'}`}>خطأ</span>
                                            </div>
                                       )}
                                   </div>
                               </div>
                           </div>
                       </div>
                   ))}
                   
                   <button 
                      onClick={() => setIsManualModalOpen(true)}
                      className="w-full py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl text-gray-500 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:border-primary-400 dark:hover:text-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-all duration-300 flex items-center justify-center gap-2 font-bold text-lg transform hover:scale-[1.005]"
                   >
                       <Plus className="w-6 h-6" /> إضافة سؤال يدوياً
                   </button>
               </div>

               {/* Manual Modal */}
                {isManualModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 w-full max-w-xl shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95">
                            <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white">إضافة سؤال جديد</h3>
                                <button onClick={() => setIsManualModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300"><X className="w-6 h-6" /></button>
                            </div>
                            
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">نص السؤال</label>
                                    <textarea 
                                        className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-primary-500 dark:focus:border-primary-400 outline-none dark:bg-gray-700 dark:text-gray-100 font-medium min-h-[100px] transition-colors" 
                                        value={manualQ.text || ''}
                                        onChange={e => setManualQ({...manualQ, text: e.target.value})}
                                        placeholder="اكتب السؤال هنا..."
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">نوع السؤال</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-primary-500 dark:focus:border-primary-400 outline-none dark:bg-gray-700 dark:text-gray-100 appearance-none cursor-pointer font-bold transition-colors"
                                            value={manualQ.type}
                                            onChange={e => setManualQ({...manualQ, type: e.target.value as QuestionType})}
                                        >
                                            <option value={QuestionType.MULTIPLE_CHOICE} className='dark:bg-gray-800'>اختيار من متعدد</option>
                                            <option value={QuestionType.TRUE_FALSE} className='dark:bg-gray-800'>صح وخطأ</option>
                                            <option value={QuestionType.SHORT_ANSWER} className='dark:bg-gray-800'>مقالي قصير</option>
                                        </select>
                                    </div>
                                </div>

                                {manualQ.type === QuestionType.MULTIPLE_CHOICE && (
                                    <div className="space-y-3 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <label className="block text-sm font-bold text-gray-600 dark:text-gray-300">الخيارات</label>
                                        {manualQ.options?.map((opt, i) => (
                                            <input key={i} value={opt} onChange={e => {
                                                const newOpt = [...(manualQ.options || [])];
                                                newOpt[i] = e.target.value;
                                                setManualQ({...manualQ, options: newOpt});
                                            }} placeholder={`الخيار ${i+1}`} className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:border-primary-400 outline-none transition-colors" />
                                        ))}
                                        <label className="block text-sm font-bold mt-4 text-green-600 dark:text-green-400">الإجابة الصحيحة (انسخها بالضبط)</label>
                                        <input 
                                            placeholder="الإجابة الصحيحة..."
                                            value={manualQ.correctAnswer as string || ''}
                                            onChange={e => setManualQ({...manualQ, correctAnswer: e.target.value})}
                                            className="w-full p-3 border-2 border-green-200 dark:border-green-600 rounded-lg focus:border-green-500 dark:focus:border-green-400 outline-none dark:bg-gray-800 dark:text-gray-100 transition-colors"
                                        />
                                    </div>
                                )}
                                {manualQ.type === QuestionType.TRUE_FALSE && (
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">الإجابة الصحيحة</label>
                                        <div className="flex gap-4">
                                            <button 
                                                onClick={() => setManualQ({...manualQ, correctAnswer: 'true'})}
                                                className={`flex-1 py-3 rounded-lg border-2 font-bold transition-all ${String(manualQ.correctAnswer) === 'true' ? 'border-green-500 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 shadow-md' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                            >صواب</button>
                                            <button 
                                                onClick={() => setManualQ({...manualQ, correctAnswer: 'false'})}
                                                className={`flex-1 py-3 rounded-lg border-2 font-bold transition-all ${String(manualQ.correctAnswer) === 'false' ? 'border-red-500 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 shadow-md' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                            >خطأ</button>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">شرح الإجابة (اختياري)</label>
                                    <textarea 
                                        className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl h-24 dark:bg-gray-700 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors"
                                        value={manualQ.explanation || ''}
                                        onChange={e => setManualQ({...manualQ, explanation: e.target.value})}
                                        placeholder="اشرح لماذا هذه الإجابة صحيحة..."
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button onClick={() => setIsManualModalOpen(false)} className="px-6 py-3 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">إلغاء</button>
                                <button onClick={addManualQuestion} className="px-8 py-3 bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-500/30 hover:bg-primary-700 transform active:scale-98 transition-all">حفظ السؤال</button>
                            </div>
                        </div>
                    </div>
                )}
          </div>
      );
  }

  if (mode === 'TAKING' && localQuiz) {
      const q = localQuiz.questions[currentQuestionIndex];
      const progress = ((currentQuestionIndex + 1) / localQuiz.questions.length) * 100;

      return (
          <div className="max-w-3xl mx-auto pb-20">
              {/* Top Bar */}
              <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                      <button 
                        onClick={() => {if(confirm('هل أنت متأكد من الخروج؟ سيتم فقدان التقدم الحالي.')) setMode('SETUP')}} 
                        className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/50 dark:text-gray-300 transition-colors transform active:scale-95"
                        title="إلغاء وخروج"
                      >
                          <X className="w-5 h-5" />
                      </button>
                      {enableTimer && (
                          <div className={`flex items-center gap-2 font-mono text-xl font-bold px-4 py-2 rounded-xl shadow-md border transition-all duration-500 ${timeLeft < 60 ? 'bg-red-50 dark:bg-red-950/50 border-red-200 text-red-600 dark:text-red-400 animate-pulse' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'}`}>
                              <Timer className="w-5 h-5" /> {formatTime(timeLeft)}
                          </div>
                      )}
                  </div>
                  <div className="text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-lg">سؤال {currentQuestionIndex + 1} من {localQuiz.questions.length}</div>
              </div>

              {/* Progress Bar */}
              <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full mb-8 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(13,148,136,0.5)]" style={{ width: `${progress}%` }}></div>
              </div>

              {/* Question Card */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-2xl border-t-4 border-primary-500/50 dark:border-primary-400/50 dark:shadow-primary-900/20 min-h-[400px] flex flex-col relative overflow-hidden transition-all duration-300">
                  <span className="absolute top-6 left-6 text-xs font-bold bg-primary-50 dark:bg-primary-900 text-primary-600 dark:text-primary-300 px-3 py-1.5 rounded-full border border-primary-100 dark:border-primary-800/50 tracking-wide">
                      {q.type === QuestionType.MULTIPLE_CHOICE ? 'اختيار من متعدد' : q.type}
                  </span>

                  <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-10 leading-relaxed mt-8">{q.text}</h2>

                  <div className="flex-1 space-y-4">
                      {q.type === QuestionType.TRUE_FALSE && (
                          <div className="flex gap-6">
                              <button 
                                onClick={() => handleAnswerChange(q.id, 'true')} 
                                className={`flex-1 py-8 rounded-2xl border-2 font-black text-2xl transition-all duration-200 transform hover:scale-[1.01] ${allAnswers[q.id] === 'true' ? 'border-green-500 bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-300 shadow-xl ring-4 ring-green-100 dark:ring-green-900/50' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 hover:border-primary-400 dark:hover:border-primary-300 text-gray-700 dark:text-gray-300 hover:shadow-lg'}`}
                              >
                                  صواب
                              </button>
                              <button 
                                onClick={() => handleAnswerChange(q.id, 'false')} 
                                className={`flex-1 py-8 rounded-2xl border-2 font-black text-2xl transition-all duration-200 transform hover:scale-[1.01] ${allAnswers[q.id] === 'false' ? 'border-red-500 bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300 shadow-xl ring-4 ring-red-100 dark:ring-red-900/50' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 hover:border-primary-400 dark:hover:border-primary-300 text-gray-700 dark:text-gray-300 hover:shadow-lg'}`}
                              >
                                  خطأ
                              </button>
                          </div>
                      )}
                      {q.type === QuestionType.MULTIPLE_CHOICE && (
                          <div className="grid gap-4">
                              {q.options?.map((opt, i) => (
                                  <button 
                                    key={i} 
                                    onClick={() => handleAnswerChange(q.id, opt)} 
                                    className={`w-full p-5 rounded-2xl border-2 text-right font-bold text-lg transition-all duration-200 shadow-sm ${allAnswers[q.id] === opt ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/50 text-primary-900 dark:text-primary-200 shadow-md ring-4 ring-primary-100 dark:ring-primary-900/50 scale-[1.005]' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 hover:border-primary-300 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700/80 text-gray-700 dark:text-gray-300'}`}
                                  >
                                      <span className={`inline-block w-6 h-6 rounded-full border-2 ml-3 align-middle transition-colors ${allAnswers[q.id] === opt ? 'border-primary-600 bg-primary-600 dark:border-primary-400 dark:bg-primary-400' : 'border-gray-300 dark:border-gray-500 bg-transparent'}`}></span>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      )}
                      {q.type === QuestionType.ORDERING && <OrderingQuestion q={q} />}
                      {q.type === QuestionType.MATCHING && <MatchingQuestion q={q} />}
                      {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.FILL_BLANKS) && (
                          <input type="text" value={allAnswers[q.id] || ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)} className="w-full p-5 border-2 border-gray-300 dark:border-gray-600 rounded-2xl text-xl outline-none focus:border-primary-500 dark:focus:border-primary-400 focus:ring-4 focus:ring-primary-100 dark:focus:ring-primary-900/50 dark:bg-gray-700 dark:text-white transition-all" placeholder="اكتب إجابتك هنا..." />
                      )}
                  </div>

                  {/* Instant Feedback */}
                  {instantFeedback && showAnswerForCurrent && (
                      <div className="mt-8 p-5 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/50 animate-in fade-in slide-in-from-bottom-2">
                          <p className="font-bold text-blue-800 dark:text-blue-300 mb-2 text-lg flex items-center gap-2">💡 الإجابة الصحيحة:</p>
                          <p className="text-blue-700 dark:text-blue-200 font-medium text-lg">{typeof q.correctAnswer === 'object' ? 'انظر الترتيب/التوصيل الصحيح' : String(q.correctAnswer)}</p>
                          <p className="text-sm text-gray-700 dark:text-gray-400 mt-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50">{q.explanation}</p>
                      </div>
                  )}
              </div>

              {/* Navigation */}
              <div className="flex justify-between mt-8 items-center">
                  <button onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))} disabled={currentQuestionIndex === 0} className="px-6 py-3 rounded-xl text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors transform active:scale-95">السابق</button>
                  
                  {currentQuestionIndex < localQuiz.questions.length - 1 ? (
                      <button 
                        onClick={() => {setCurrentQuestionIndex(currentQuestionIndex + 1); setShowAnswerForCurrent(false); soundManager.play('CLICK');}} 
                        className="px-10 py-4 rounded-2xl bg-primary-600 text-white font-bold text-lg hover:bg-primary-700 shadow-xl shadow-primary-500/30 flex items-center gap-3 transform active:scale-95 transition-all duration-200"
                      >
                          السؤال التالي <ArrowLeft className="w-5 h-5" />
                      </button>
                  ) : (
                      <button 
                        onClick={submitQuiz} 
                        className="px-10 py-4 rounded-2xl bg-green-600 text-white font-bold text-lg hover:bg-green-700 shadow-xl shadow-green-500/30 flex items-center gap-2 transform active:scale-95 transition-all duration-200"
                      >
                          <Check className="w-5 h-5" /> تسليم الاختبار
                      </button>
                  )}
              </div>
          </div>
      );
  }

  if (mode === 'REVIEW' && currentResult) {
      return (
          <div className="max-w-4xl mx-auto pb-20 animate-in slide-in-from-bottom-4">
              
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-black text-gray-900 dark:text-white">نتيجة الاختبار</h2>
                  <button onClick={() => setMode('SETUP')} className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors transform active:scale-98">
                      <Home className="w-4 h-4" /> القائمة الرئيسية
                  </button>
              </div>

              {/* Result Header */}
              <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 shadow-2xl mb-8 text-center relative overflow-hidden border border-gray-100 dark:border-gray-700">
                   <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"></div>
                   <div className="relative z-10">
                       <div className="w-40 h-40 mx-auto bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 shadow-inner border-4 border-white dark:border-gray-800">
                            <div className="text-7xl font-black bg-gradient-to-br from-primary-600 to-purple-600 text-transparent bg-clip-text">
                                {Math.round((currentResult.score / currentResult.total) * 100)}%
                            </div>
                       </div>
                       
                       <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{studentName ? `أداء رائع يا ${studentName}!` : 'نتيجة الاختبار'}</h3>
                       <p className="text-gray-500 dark:text-gray-400 text-lg font-medium mb-6">أجبت بشكل صحيح على {currentResult.score} من أصل {currentResult.total} سؤال</p>
                       
                       {/* AI Analysis (Changed indigo to a theme-consistent blue) */}
                       <div className="bg-blue-50 dark:bg-blue-950/40 p-6 rounded-2xl border border-blue-200 dark:border-blue-900/50 text-right shadow-lg">
                           <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2 text-lg"><Sparkles className="w-5 h-5 text-blue-500" /> تحليل المساعد الذكي</h3>
                           {isAnalyzing ? (
                               <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 py-2"><Loader2 className="animate-spin w-5 h-5 text-blue-500" /> جاري كتابة تقرير مخصص لك...</div>
                           ) : (
                               <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 leading-relaxed text-right">
                                   {aiAnalysis || "لا يتوفر تحليل حالياً."}
                               </div>
                           )}
                       </div>
                   </div>
              </div>
              
              <div className="flex justify-end gap-3 mb-8">
                   <ExportMenu filename={`Report_${localQuiz?.title}`} type="REPORT" content={aiAnalysis} quizData={localQuiz || undefined} />
              </div>

              {/* Detailed Review */}
              <div className="space-y-6">
                  {currentResult.details.map((detail, idx) => (
                      <div key={idx} className={`p-6 rounded-2xl border-2 shadow-md transition-all duration-300 ${detail.isCorrect ? 'border-green-300 bg-green-50 dark:bg-green-950/40' : 'border-red-300 bg-red-50 dark:bg-red-950/40'}`}>
                          <div className="flex items-start gap-4">
                              <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-lg ${detail.isCorrect ? 'bg-green-600' : 'bg-red-600'}`}>
                                  {detail.isCorrect ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
                              </span>
                              <div className="flex-1">
                                  <h3 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">{detail.questionText}</h3>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                      <div className={`p-3 rounded-xl border-2 ${detail.isCorrect ? 'bg-green-100 dark:bg-green-900/50 border-green-400 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 border-red-400 text-red-800 dark:text-red-300'}`}>
                                          <span className="block text-xs font-bold opacity-70 mb-1">إجابتك:</span>
                                          <span className="font-bold break-all">{detail.userAnswer}</span>
                                      </div>
                                      {!detail.isCorrect && (
                                          <div className="p-3 rounded-xl border-2 bg-green-100 dark:bg-green-900/50 border-green-400 text-green-800 dark:text-green-300">
                                              <span className="block text-xs font-bold opacity-70 mb-1">الإجابة الصحيحة:</span>
                                              <span className="font-bold break-all">{detail.correctAnswer}</span>
                                          </div>
                                      )}
                                  </div>

                                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm leading-relaxed shadow-inner">
                                      <strong className="text-primary-600 dark:text-primary-400 block mb-1">الشرح:</strong> {detail.explanation}
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>

              <div className="fixed bottom-8 left-0 right-0 flex justify-center gap-4 z-30 pointer-events-none">
                  <button onClick={() => setMode('SETUP')} className="pointer-events-auto px-10 py-4 bg-gray-900 dark:bg-primary-600 text-white rounded-full font-bold shadow-2xl shadow-gray-900/50 dark:shadow-primary-600/50 hover:scale-105 transition-transform duration-300 flex items-center gap-3 border-4 border-white dark:border-gray-800"><RotateCcw className="w-5 h-5" /> اختبار جديد</button>
              </div>
          </div>
      );
  }

  return null;
};

// Helper icon
const Check = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"></polyline></svg>
);

export default QuizSystem;