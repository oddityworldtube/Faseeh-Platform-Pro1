
import React, { useState } from 'react';
import { Download, FileText, Image as ImageIcon, FileType, MousePointerClick, GraduationCap, User } from 'lucide-react';
import { soundManager } from '../utils/soundEffects';
import { Quiz, SummaryPoint } from '../types';
import ReactMarkdown from 'react-markdown';
import { createRoot } from 'react-dom/client';
import remarkGfm from 'remark-gfm';

interface ExportMenuProps {
  elementId?: string;
  filename: string;
  content?: string;
  quizData?: Quiz;
  type?: 'LESSON' | 'QUIZ' | 'REPORT';
  isSummary?: boolean;
  summaryData?: SummaryPoint[];
}

declare global {
  interface Window {
    html2pdf: any;
    html2canvas: any;
  }
}

const ExportMenu: React.FC<ExportMenuProps> = ({ 
  filename, 
  content, 
  quizData, 
  type = 'LESSON',
  isSummary,
  summaryData
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const createDesignElement = (targetContainer: HTMLElement, mode: 'STUDENT' | 'TEACHER' | 'STANDARD' = 'STANDARD') => {
    const root = createRoot(targetContainer);
    const currentDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    const designClass = "w-[800px] min-h-[1123px] bg-white text-gray-900 p-12 relative font-sans mx-auto shadow-none";
    const styles = {
        header: "border-b-2 border-gray-100 pb-6 mb-8 flex justify-between items-end",
        brand: "text-teal-600 font-black text-xl tracking-wide",
        title: "text-4xl font-black text-gray-900 leading-tight",
        meta: "text-sm text-gray-400 font-medium mt-1",
        watermark: "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-[0.02] text-9xl font-black text-gray-900 rotate-45 pointer-events-none select-none z-0",
        footer: "mt-12 pt-6 border-t border-gray-100 flex justify-between items-center text-gray-400 text-xs",
        contentWrapper: "relative z-10"
    };
    
    let mainContent;

    if (type === 'QUIZ' && quizData) {
        mainContent = (
            <div className="space-y-8">
                 <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 mb-8 flex justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 mb-2">بيانات الطالب</h2>
                        <div className="text-gray-500 space-y-2">
                            <p>الاسم: ___________________________</p>
                            <p>الصف: ___________________________</p>
                        </div>
                    </div>
                    <div className="text-left">
                        <div className="border-2 border-gray-300 rounded-lg w-24 h-24 flex items-center justify-center">
                            <span className="text-gray-400 text-xs">الدرجة</span>
                        </div>
                    </div>
                 </div>

                 {quizData.questions.map((q, idx) => (
                    <div key={q.id} className="mb-8 break-inside-avoid border-b border-gray-100 pb-6 last:border-0">
                        <div className="flex items-start gap-4 mb-4">
                            <span className="bg-gray-900 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">{idx + 1}</span>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-gray-800 leading-relaxed">{q.text}</h3>
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 mt-1 inline-block">
                                    {q.type === 'TRUE_FALSE' ? 'صح أم خطأ' : q.type === 'MULTIPLE_CHOICE' ? 'اختيار من متعدد' : 'سؤال'}
                                </span>
                            </div>
                        </div>

                        <div className="mr-12 space-y-3">
                            {/* OPTIONS RENDER */}
                            {q.type === 'TRUE_FALSE' && (
                                <div className="flex gap-6">
                                    <div className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div> صواب</div>
                                    <div className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div> خطأ</div>
                                </div>
                            )}
                            {q.type === 'MULTIPLE_CHOICE' && q.options?.map((opt, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                                    <span className="text-gray-700 text-lg">{opt}</span>
                                </div>
                            ))}
                             {q.type === 'ORDERING' && q.options?.map((opt, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded border border-gray-100">
                                    <div className="w-8 h-8 border border-gray-300 rounded bg-white"></div>
                                    <span className="text-gray-700">{opt}</span>
                                </div>
                            ))}
                             {q.type === 'MATCHING' && q.matches?.map((m, i) => (
                                <div key={i} className="flex justify-between items-center gap-4 border-b border-gray-100 py-2">
                                    <span className="w-1/3 text-right">{m.left}</span>
                                    <span className="flex-1 border-b border-dashed border-gray-300 mx-2"></span>
                                    <span className="w-1/3 text-left bg-gray-50 p-1 rounded border border-gray-200">{mode === 'TEACHER' ? m.right : '..........'}</span>
                                </div>
                            ))}
                            {(q.type === 'SHORT_ANSWER' || q.type === 'FILL_BLANKS') && (
                                <div className="border-b border-gray-300 h-8 w-full mt-2"></div>
                            )}

                            {/* TEACHER MODE: ANSWER KEY */}
                            {mode === 'TEACHER' && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-lg text-sm text-green-800">
                                    <strong>الإجابة النموذجية: </strong> 
                                    {typeof q.correctAnswer === 'object' ? JSON.stringify(q.correctAnswer) : String(q.correctAnswer)}
                                    <br/>
                                    <strong>الشرح: </strong> {q.explanation}
                                </div>
                            )}
                        </div>
                    </div>
                 ))}
            </div>
        );
    } else if (isSummary && summaryData) {
        mainContent = (
            <div className="space-y-6">
                {summaryData.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4 break-inside-avoid bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                         <span className="flex-shrink-0 w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center font-black text-lg border border-teal-100">
                            {idx + 1}
                        </span>
                        <div>
                            <h4 className="font-bold text-gray-900 text-xl mb-2">{item.point}</h4>
                            <p className="text-gray-600 leading-relaxed text-lg">{item.explanation}</p>
                        </div>
                    </div>
                ))}
            </div>
        );
    } else {
        mainContent = (
            <div className="prose prose-lg max-w-none">
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h1: ({node, ...props}) => <h1 className="text-3xl font-black border-b-2 border-teal-500 inline-block pb-2 mb-6 text-teal-700" {...props} />,
                        table: ({node, ...props}) => <div className="my-6 rounded-lg border border-gray-200 overflow-hidden"><table className="w-full text-right bg-white" {...props} /></div>,
                    }}
                >
                    {content || ''}
                </ReactMarkdown>
            </div>
        );
    }

    const DesignComponent = () => (
        <div className={designClass}>
            <div className={styles.watermark}>Faseeh</div>
            <div className={styles.header}>
                <div>
                    <div className={styles.brand}>منصة فصيح</div>
                    <h1 className={styles.title}>{quizData ? quizData.title : (filename || 'مستند')}</h1>
                </div>
                <div className="text-left">
                    <p className={styles.meta}>{currentDate}</p>
                    <p className={styles.meta}>
                        {mode === 'TEACHER' ? 'نسخة المعلم (نموذج الإجابة)' : mode === 'STUDENT' ? 'نسخة الطالب' : 'مذكرة دراسية'}
                    </p>
                </div>
            </div>
            <div className={styles.contentWrapper}>{mainContent}</div>
            <div className={styles.footer}>
                <span>Faseeh Smart Education Platform</span>
                <span>Page 1 of 1</span>
            </div>
        </div>
    );

    root.render(<DesignComponent />);
    return async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        root.unmount();
    };
  };

  const generateInteractiveQuizHTML = (quiz: Quiz) => {
    const jsonQuiz = JSON.stringify(quiz).replace(/</g, '\\u003c'); 
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${quiz.title} - فصيح</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Tajawal', sans-serif; }
      .option-card:hover { border-color: #0d9488; background-color: #f0fdfa; }
      .selected { border-color: #0d9488; background-color: #ccfbf1; color: #115e59; }
      .correct { border-color: #22c55e; background-color: #f0fdf4; }
      .wrong { border-color: #ef4444; background-color: #fef2f2; }
    </style>
</head>
<body class="bg-slate-50 min-h-screen py-8 px-4 md:px-8">
    <div class="max-w-3xl mx-auto">
        <div class="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 mb-6 text-center">
             <h1 class="text-3xl font-black text-slate-800 mb-2">${quiz.title}</h1>
             <p class="text-slate-500">عدد الأسئلة: ${quiz.questions.length}</p>
        </div>

        <div id="quiz-container" class="space-y-6"></div>

        <div class="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none">
            <button id="submit-btn" onclick="checkAnswers()" class="pointer-events-auto px-10 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-full font-bold shadow-xl text-lg transition-transform active:scale-95">
                تصحيح الاختبار
            </button>
        </div>
    </div>

    <script>
        const quiz = ${jsonQuiz};
        const container = document.getElementById('quiz-container');
        const userAnswers = {};

        function render() {
            let html = '';
            quiz.questions.forEach((q, i) => {
                let optionsHtml = '';
                
                if(q.type === 'MULTIPLE_CHOICE') {
                    optionsHtml = '<div class="grid gap-3 mt-4">';
                    q.options.forEach(opt => {
                        optionsHtml += \`
                          <div onclick="selectOption(\${q.id}, '\${opt}', this)" 
                               class="option-card p-4 border-2 border-slate-200 rounded-xl cursor-pointer font-bold transition-all"
                               data-qid="\${q.id}" data-val="\${opt}">
                            \${opt}
                          </div>\`;
                    });
                    optionsHtml += '</div>';
                } else if (q.type === 'TRUE_FALSE') {
                     optionsHtml = \`
                        <div class="flex gap-4 mt-4">
                           <div onclick="selectOption(\${q.id}, 'true', this)" class="option-card flex-1 p-4 border-2 border-slate-200 rounded-xl cursor-pointer font-bold text-center" data-qid="\${q.id}" data-val="true">صواب</div>
                           <div onclick="selectOption(\${q.id}, 'false', this)" class="option-card flex-1 p-4 border-2 border-slate-200 rounded-xl cursor-pointer font-bold text-center" data-qid="\${q.id}" data-val="false">خطأ</div>
                        </div>
                     \`;
                } else {
                     optionsHtml = \`<input onchange="userAnswers[\${q.id}] = this.value" class="w-full p-4 border-2 border-slate-200 rounded-xl mt-4 font-bold" placeholder="اكتب إجابتك هنا..." />\`;
                }

                html += \`
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden" id="q-card-\${q.id}">
                        <div class="flex gap-4">
                           <span class="bg-slate-100 w-10 h-10 rounded-lg flex items-center justify-center font-black text-slate-600">\${i+1}</span>
                           <div class="flex-1">
                              <h3 class="font-bold text-xl mb-2 leading-relaxed">\${q.text}</h3>
                              \${optionsHtml}
                              <div id="feedback-\${q.id}" class="hidden mt-4 p-4 rounded-xl text-sm"></div>
                           </div>
                        </div>
                    </div>
                \`;
            });
            container.innerHTML = html;
        }

        function selectOption(qId, val, el) {
            userAnswers[qId] = val;
            // clear siblings
            document.querySelectorAll(\`div[data-qid="\${qId}"]\`).forEach(d => d.classList.remove('selected'));
            el.classList.add('selected');
        }

        function checkAnswers() {
            let score = 0;
            quiz.questions.forEach(q => {
                const ans = userAnswers[q.id];
                const card = document.getElementById(\`q-card-\${q.id}\`);
                const feedback = document.getElementById(\`feedback-\${q.id}\`);
                let isCorrect = false;

                // Simple check for demo
                if(String(ans).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()) {
                    isCorrect = true;
                    score++;
                }

                feedback.classList.remove('hidden');
                if(isCorrect) {
                    feedback.className = 'mt-4 p-4 rounded-xl bg-green-50 text-green-800 border border-green-200 font-bold';
                    feedback.innerHTML = '✅ إجابة صحيحة!';
                } else {
                    feedback.className = 'mt-4 p-4 rounded-xl bg-red-50 text-red-800 border border-red-200 font-bold';
                    feedback.innerHTML = \`❌ خطأ. الإجابة الصحيحة: \${q.correctAnswer}<br><span class="text-xs font-normal text-slate-600">\${q.explanation || ''}</span>\`;
                }
            });
            
            alert(\`انتهى الاختبار! نتيجتك: \${score} من \${quiz.questions.length}\`);
            document.getElementById('submit-btn').innerText = \`النتيجة: \${score} / \${quiz.questions.length}\`;
            document.getElementById('submit-btn').disabled = true;
            document.getElementById('submit-btn').classList.add('opacity-50');
        }

        render();
    </script>
</body>
</html>`;
  };

  const handleExport = async (format: 'pdf' | 'jpg' | 'interactive_html', mode: 'STUDENT' | 'TEACHER' | 'STANDARD' = 'STANDARD') => {
    soundManager.play('CLICK');
    setIsExporting(true);
    setIsOpen(false);

    if (format === 'interactive_html' && quizData) {
      const htmlContent = generateInteractiveQuizHTML(quizData);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}_interactive.html`;
      link.click();
      setIsExporting(false);
      return;
    }

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '-10000px';
    document.body.appendChild(container);
    const cleanup = createDesignElement(container, mode);
    await new Promise(resolve => setTimeout(resolve, 800));
    const element = container.firstChild as HTMLElement;

    try {
      if (format === 'pdf' && window.html2pdf) {
         await window.html2pdf().set({
              margin: 0,
              filename: `${filename}_${mode.toLowerCase()}.pdf`,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(element).save();
      } else if (format === 'jpg' && window.html2canvas) {
         const canvas = await window.html2canvas(element, { scale: 2 });
         const link = document.createElement('a');
         link.download = `${filename}.jpg`;
         link.href = canvas.toDataURL('image/jpeg');
         link.click();
      }
    } catch (err) {
      alert('حدث خطأ أثناء التصدير.');
    } finally {
      await cleanup();
      document.body.removeChild(container);
      setIsExporting(false);
    }
  };

  return (
    <div className="relative inline-block text-left z-50">
      <button onClick={() => setIsOpen(!isOpen)} disabled={isExporting} className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 font-bold shadow-sm flex items-center gap-2">
        {isExporting ? <span className="animate-spin">⏳</span> : <Download className="w-5 h-5" />}
        <span>تصدير</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 z-[100]">
          <div className="p-2 grid gap-1">
            {type === 'QUIZ' ? (
                <>
                    <button onClick={() => handleExport('pdf', 'STUDENT')} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-right rounded-lg">
                        <div className="w-8 h-8 bg-blue-100 text-blue-500 rounded flex items-center justify-center"><User className="w-4 h-4" /></div>
                        <div><span className="font-bold block text-sm">PDF (نسخة الطالب)</span><span className="text-xs opacity-60">أسئلة فقط</span></div>
                    </button>
                    <button onClick={() => handleExport('pdf', 'TEACHER')} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-right rounded-lg">
                        <div className="w-8 h-8 bg-green-100 text-green-500 rounded flex items-center justify-center"><GraduationCap className="w-4 h-4" /></div>
                        <div><span className="font-bold block text-sm">PDF (نسخة المعلم)</span><span className="text-xs opacity-60">أسئلة + إجابات</span></div>
                    </button>
                    <button onClick={() => handleExport('interactive_html')} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-right rounded-lg">
                        <div className="w-8 h-8 bg-teal-100 text-teal-500 rounded flex items-center justify-center"><MousePointerClick className="w-4 h-4" /></div>
                        <div><span className="font-bold block text-sm">HTML تفاعلي</span><span className="text-xs opacity-60">ملف ويب يعمل بدون نت</span></div>
                    </button>
                </>
            ) : (
                <>
                    <button onClick={() => handleExport('pdf')} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-right rounded-lg">
                         <div className="w-8 h-8 bg-red-100 text-red-500 rounded flex items-center justify-center"><FileText className="w-4 h-4" /></div>
                         <span className="font-bold text-sm">حفظ كملف PDF</span>
                    </button>
                    <button onClick={() => handleExport('jpg')} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-right rounded-lg">
                         <div className="w-8 h-8 bg-purple-100 text-purple-500 rounded flex items-center justify-center"><ImageIcon className="w-4 h-4" /></div>
                         <span className="font-bold text-sm">حفظ كصورة JPG</span>
                    </button>
                </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
