
import React, { useState, useEffect, useRef } from 'react';
import { ContentType } from '../types';
import { FileText, Image as ImageIcon, Youtube, Type, Upload, Loader2, Link, Sparkles, PenTool, Save, Trash2, ChevronDown, ChevronUp, Settings, RotateCcw, Mic, Square, Clock } from 'lucide-react';
import * as YouTubeService from '../services/youtubeService';
import { soundManager } from '../utils/soundEffects';

interface InputSectionProps {
  onProcess: (type: ContentType, data: string, mimeType?: string) => void;
  isProcessing: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ onProcess, isProcessing }) => {
  const [activeTab, setActiveTab] = useState<ContentType>(ContentType.TOPIC);
  const [textInput, setTextInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [isExtractingYoutube, setIsExtractingYoutube] = useState(false);
  const [youtubeStatus, setYoutubeStatus] = useState<string>('');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // Advanced Prompts State
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  
  const defaultCustomInstructions = `قاعدة لغة الشرح (هام جداً):
1. إذا كان المنهج (مصري/لغات) والمادة (لغة إنجليزية أو علوم باللغة الإنجليزية):
   - الشرح والأمثلة: باللغة العربية (للتوضيح والفهم).
   - المصطلحات والنصوص: باللغة الإنجليزية.
   - النطق: أضف طريقة نطق (Pronunciation) للكلمات الصعبة بين قوسين بالعربية.
   
2. إذا كان المنهج (دولي/International) والمادة إنجليزية:
   - الشرح: باللغة الإنجليزية بالكامل (English Only).

3. إذا كانت المادة عربية:
   - الشرح: باللغة العربية الفصحى.`;

  const defaultNegativeInstructions = `لا تستخدم اللهجة العامية. لا تقدم معلومات سطحية أو قصيرة جداً. لا تكرر المعلومات بدون داعٍ.`;

  const [customInstructions, setCustomInstructions] = useState(defaultCustomInstructions);
  const [negativeInstructions, setNegativeInstructions] = useState(defaultNegativeInstructions);

  // Topic Generator State - Initialized with Defaults
  const [topicData, setTopicData] = useState({
    lessonName: 'الكسور',
    gradeLevel: 'الصف الثالث الابتدائي',
    subject: 'الرياضيات',
    curriculum: 'egyptian'
  });

  // Load saved preferences on mount
  useEffect(() => {
    // Topic Prefs
    const savedPrefs = localStorage.getItem('faseeh_topic_prefs');
    if (savedPrefs) {
      const parsed = JSON.parse(savedPrefs);
      setTopicData(prev => ({
        ...prev,
        gradeLevel: parsed.gradeLevel || 'الصف الثالث الابتدائي',
        subject: parsed.subject || 'الرياضيات',
        curriculum: parsed.curriculum || 'egyptian'
      }));
    }

    // Prompt Prefs
    const savedPrompts = localStorage.getItem('faseeh_custom_prompts');
    if (savedPrompts) {
        const parsed = JSON.parse(savedPrompts);
        setCustomInstructions(parsed.positive || defaultCustomInstructions);
        setNegativeInstructions(parsed.negative || defaultNegativeInstructions);
    }

    return () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const handleSavePrompts = () => {
      localStorage.setItem('faseeh_custom_prompts', JSON.stringify({
          positive: customInstructions,
          negative: negativeInstructions
      }));
      soundManager.play('SUCCESS');
  };

  const handleRestoreDefaultPrompts = () => {
      setCustomInstructions(defaultCustomInstructions);
      setNegativeInstructions(defaultNegativeInstructions);
      soundManager.play('CLICK');
  };

  const handleTopicChange = (field: string, value: string) => {
    setTopicData(prev => ({ ...prev, [field]: value }));
  };

  const clearTopicFields = () => {
      setTopicData({
          lessonName: '',
          gradeLevel: '',
          subject: '',
          curriculum: 'egyptian'
      });
  };

  // Helper to wrap content with instructions for the service
  const wrapPayload = (content: any, isRaw: boolean = false) => {
      return JSON.stringify({
          content: content,
          customInstructions,
          negativeInstructions,
          isWrapper: true,
          raw: isRaw // Flag to tell service if content is raw data (like base64) or metadata
      });
  };

  const handleTopicSubmit = () => {
    if (!topicData.lessonName || !topicData.subject) return;

    // Save preferences
    localStorage.setItem('faseeh_topic_prefs', JSON.stringify({
      gradeLevel: topicData.gradeLevel,
      subject: topicData.subject,
      curriculum: topicData.curriculum
    }));

    const payloadData = { ...topicData };
    onProcess(ContentType.TOPIC, wrapPayload(payloadData));
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: ContentType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result?.toString().split(',')[1];
      if (base64String) {
        // Wrap base64 content
        onProcess(type, wrapPayload(base64String, true), file.type);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- Recording Logic ---
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleRecording = async () => {
    if (isRecording) {
        // Stop Recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            soundManager.play('CLICK');
        }
    } else {
        // Start Recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // or audio/mp3 if supported
                
                // Stop all tracks to release mic
                stream.getTracks().forEach(track => track.stop());

                // Convert to Base64 and Process
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64String = reader.result?.toString().split(',')[1];
                    if (base64String) {
                        setFileName(`تسجيل صوتي - ${new Date().toLocaleTimeString()}`);
                        onProcess(ContentType.AUDIO, wrapPayload(base64String, true), 'audio/webm');
                    }
                };
                
                setIsRecording(false);
                clearInterval(timerIntervalRef.current);
                setRecordingDuration(0);
            };

            mediaRecorder.start();
            setIsRecording(true);
            soundManager.play('CLICK');
            
            // Timer
            timerIntervalRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("يرجى السماح بصلاحيات الميكروفون للتسجيل.");
        }
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;

    if (activeTab === ContentType.YOUTUBE) {
        const videoId = YouTubeService.getVideoId(textInput);
        if (!videoId) {
            alert("رابط يوتيوب غير صحيح");
            return;
        }

        setIsExtractingYoutube(true);
        setYoutubeStatus('جاري الاتصال بيوتيوب...');

        try {
            setYoutubeStatus('جاري استخراج النص والترجمة...');
            const transcript = await YouTubeService.fetchTranscript(videoId);
            
            const finalContent = `
            --- YOUTUBE VIDEO METADATA ---
            Video URL: ${textInput}
            Video ID: ${videoId}
            
            --- VIDEO TRANSCRIPT (AUTO-GENERATED) ---
            ${transcript}
            `;

            setYoutubeStatus('جاري المعالجة بالذكاء الاصطناعي...');
            // Process as text with wrapped instructions
            onProcess(ContentType.TEXT, wrapPayload(finalContent));

        } catch (error) {
            console.warn("Extraction failed, falling back to AI direct analysis", error);
            setYoutubeStatus('لم يتم العثور على ترجمة، جاري إرسال الفيديو للتحليل الذكي...');
            
            setTimeout(() => {
                // Send URL wrapped
                onProcess(ContentType.YOUTUBE, wrapPayload(textInput));
                setIsExtractingYoutube(false);
            }, 1500);
            return;
        } finally {
           if (youtubeStatus !== 'لم يتم العثور على ترجمة، جاري إرسال الفيديو للتحليل الذكي...') {
               setIsExtractingYoutube(false);
               setYoutubeStatus('');
           }
        }
    } else {
        // Normal Text Processing with wrapper
        onProcess(activeTab, wrapPayload(textInput));
    }
  };

  const tabs = [
    { id: ContentType.TOPIC, label: 'المنشئ الذكي', icon: Sparkles },
    { id: ContentType.AUDIO, label: 'درس صوتي', icon: Mic },
    { id: ContentType.TEXT, label: 'نص', icon: Type },
    { id: ContentType.IMAGE, label: 'صورة', icon: ImageIcon },
    { id: ContentType.PDF, label: 'ملف PDF', icon: FileText },
    { id: ContentType.YOUTUBE, label: 'يوتيوب', icon: Youtube },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
      <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setFileName(''); setTextInput(''); setYoutubeStatus(''); }}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6">
        {/* TOPIC GENERATOR TAB */}
        {activeTab === ContentType.TOPIC && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-800/30 flex justify-between items-start">
                <div className="flex gap-3">
                    <div className="bg-white dark:bg-purple-900/30 p-2 rounded-lg h-fit">
                    <PenTool className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h4 className="font-bold text-purple-800 dark:text-purple-300 text-sm mb-1">إنشاء درس من الصفر</h4>
                        <p className="text-xs text-purple-600 dark:text-purple-400 leading-relaxed">
                            أدخل عنوان الدرس والتفاصيل لإنشاء محتوى تعليمي كامل.
                        </p>
                    </div>
                </div>
                <button 
                   onClick={clearTopicFields}
                   className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                   title="تفريغ جميع الحقول"
                >
                    <Trash2 className="w-3 h-3" /> مسح الحقول
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2 col-span-1 md:col-span-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">اسم الدرس (الموضوع)</label>
                    <input 
                        type="text" 
                        value={topicData.lessonName}
                        onChange={(e) => handleTopicChange('lessonName', e.target.value)}
                        placeholder="مثلاً: الكسور، الجهاز الهضمي..."
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 outline-none transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">المادة العلمية</label>
                    <input 
                        type="text" 
                        value={topicData.subject}
                        onChange={(e) => handleTopicChange('subject', e.target.value)}
                        placeholder="مثلاً: الرياضيات، العلوم..."
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:border-purple-500 outline-none transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">الصف الدراسي</label>
                    <input 
                        type="text" 
                        value={topicData.gradeLevel}
                        onChange={(e) => handleTopicChange('gradeLevel', e.target.value)}
                        placeholder="مثلاً: الثالث الابتدائي..."
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:border-purple-500 outline-none transition-all"
                    />
                </div>

                <div className="space-y-2 col-span-1 md:col-span-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">نظام المنهج</label>
                    <select 
                        value={topicData.curriculum}
                        onChange={(e) => handleTopicChange('curriculum', e.target.value)}
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:border-purple-500 outline-none transition-all cursor-pointer"
                    >
                        <option value="egyptian">المنهج المصري (وزارة التربية والتعليم)</option>
                        <option value="saudi">المنهج السعودي</option>
                        <option value="american">المنهج الأمريكي (American Diploma)</option>
                        <option value="british">المنهج البريطاني (IGCSE)</option>
                        <option value="general">منهج عام / دولي</option>
                    </select>
                </div>
            </div>

            <button
              onClick={handleTopicSubmit}
              disabled={isProcessing || !topicData.lessonName || !topicData.subject}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-primary-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transform active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              <span>إنشاء الدرس وحفظ الإعدادات</span>
            </button>
          </div>
        )}

        {activeTab === ContentType.TEXT && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="الصق النص التعليمي هنا..."
              className="w-full h-48 p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900 outline-none resize-none transition-all"
            />
            <button
              onClick={handleTextSubmit}
              disabled={isProcessing || !textInput.trim()}
              className="btn-primary w-full"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'معالجة النص'}
            </button>
          </div>
        )}

        {activeTab === ContentType.AUDIO && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                {/* Audio Recorder */}
                <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-primary-50 to-transparent dark:from-primary-900/20 rounded-2xl border border-primary-100 dark:border-primary-900/30">
                    <div className="relative mb-4">
                         {isRecording && (
                            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75"></span>
                         )}
                         <button 
                            onClick={toggleRecording}
                            disabled={isProcessing}
                            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all transform active:scale-95 ${
                                isRecording 
                                ? 'bg-red-500 text-white hover:bg-red-600' 
                                : 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-gray-600 border-4 border-primary-100 dark:border-gray-600'
                            }`}
                            title={isRecording ? "إيقاف ومعالجة" : "بدء التسجيل"}
                         >
                             {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8" />}
                         </button>
                    </div>
                    
                    <div className="text-center space-y-1">
                        <div className={`text-2xl font-mono font-bold ${isRecording ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                            {formatTime(recordingDuration)}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {isRecording ? 'جاري التسجيل... اضغط للإيقاف والمعالجة' : 'اضغط على الميكروفون لتسجيل الدرس'}
                        </p>
                    </div>
                </div>

                <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">أو</span>
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                </div>

                {/* File Upload */}
                <div className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-8 text-center hover:border-primary-400 dark:hover:border-primary-500 transition-colors bg-gray-50 dark:bg-gray-900/50">
                    <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleFileUpload(e, ContentType.AUDIO)}
                    className="hidden"
                    id="audio-upload"
                    disabled={isProcessing || isRecording}
                    />
                    <label
                    htmlFor="audio-upload"
                    className="cursor-pointer flex flex-col items-center gap-4"
                    >
                    <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full shadow-sm flex items-center justify-center text-primary-500 dark:text-primary-400 border border-gray-100 dark:border-gray-700">
                        <Upload className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-700 dark:text-gray-200">
                        {fileName ? fileName : 'رفع ملف صوتي جاهز'}
                        </h3>
                        <p className="text-gray-400 text-sm mt-1">
                        {isProcessing ? 'جارٍ المعالجة...' : 'MP3, WAV, M4A (محاضرة أو شرح)'}
                        </p>
                    </div>
                    </label>
                </div>
            </div>
        )}

        {(activeTab === ContentType.IMAGE || activeTab === ContentType.PDF) && (
          <div className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-10 text-center hover:border-primary-400 dark:hover:border-primary-500 transition-colors bg-gray-50 dark:bg-gray-900/50 animate-in fade-in slide-in-from-bottom-2">
            <input
              type="file"
              accept={activeTab === ContentType.IMAGE ? "image/*" : "application/pdf"}
              onChange={(e) => handleFileUpload(e, activeTab)}
              className="hidden"
              id="file-upload"
              disabled={isProcessing}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full shadow-sm flex items-center justify-center text-primary-500 dark:text-primary-400 border border-gray-100 dark:border-gray-700">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-gray-700 dark:text-gray-200 text-lg">
                  {fileName ? fileName : (activeTab === ContentType.IMAGE ? 'رفع صورة' : 'رفع ملف PDF')}
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                  {isProcessing ? 'جارٍ المعالجة...' : 'اضغط للاختيار من جهازك'}
                </p>
              </div>
            </label>
          </div>
        )}

        {activeTab === ContentType.YOUTUBE && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="relative">
              <Link className="absolute right-4 top-3.5 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full p-3 pr-12 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900 outline-none text-left"
                dir="ltr"
              />
            </div>
             
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30 flex gap-3 items-start">
                <Youtube className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                <div>
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-1">محلل الفيديو الذكي</h4>
                    <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                        سيقوم النظام باستخراج النص تلقائياً. في حال عدم توفر ترجمة، سيتم إرسال الرابط للذكاء الاصطناعي لتحليله مباشرة.
                    </p>
                </div>
            </div>

            <button
              onClick={handleTextSubmit}
              disabled={isProcessing || isExtractingYoutube || !textInput.trim()}
              className="btn-primary w-full"
            >
              {isProcessing || isExtractingYoutube ? (
                <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {youtubeStatus || 'جاري التحليل...'}
                </span>
              ) : (
                'استخراج الشرح وتحويله لدرس'
              )}
            </button>
          </div>
        )}

         {/* Advanced Prompts Section - Global for all tabs */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
            <button 
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors w-full"
            >
                <Settings className="w-4 h-4" />
                إعدادات التوجيه المتقدمة (طريقة الشرح لجميع المداخلات)
                {isAdvancedOpen ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
            </button>

            {isAdvancedOpen && (
                <div className="mt-4 space-y-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                             توجيهات إيجابية (تطبق على جميع أنواع الدروس)
                        </label>
                        <textarea 
                            value={customInstructions}
                            onChange={(e) => setCustomInstructions(e.target.value)}
                            className="w-full p-3 rounded-xl border border-green-200 dark:border-green-900 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 h-32 focus:ring-2 focus:ring-green-500 outline-none resize-none"
                            placeholder="اكتب تعليمات خاصة للمساعد الذكي..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-red-700 dark:text-red-400">توجيهات سلبية (ما يجب تجنبه)</label>
                        <textarea 
                            value={negativeInstructions}
                            onChange={(e) => setNegativeInstructions(e.target.value)}
                            className="w-full p-3 rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 h-20 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                            placeholder="ما الذي يجب على الذكاء الاصطناعي تجنبه..."
                        />
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                        <button 
                           onClick={handleSavePrompts}
                           className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                        >
                            <Save className="w-4 h-4" /> حفظ التوجيهات
                        </button>
                        <button 
                           onClick={handleRestoreDefaultPrompts}
                           className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                           title="استعادة الافتراضي"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default InputSection;
