
import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { X, Plus, Trash2, Moon, Sun, Key, Cpu, Save, Edit2, Check, AlertTriangle, ListPlus, BrainCircuit, MessageSquare, FileText, List, ExternalLink, Info } from 'lucide-react';
import { soundManager } from '../utils/soundEffects';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onUpdateSettings }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [singleKeyInput, setSingleKeyInput] = useState('');
  const [bulkKeyInput, setBulkKeyInput] = useState('');
  const [newModelInput, setNewModelInput] = useState('');
  const [editingKeyIndex, setEditingKeyIndex] = useState<number | null>(null);
  const [editingKeyValue, setEditingKeyValue] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'keys' | 'models'>('general');

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      setSingleKeyInput('');
      setBulkKeyInput('');
      setNewModelInput('');
      setEditingKeyIndex(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSaveAll = () => {
    soundManager.play('SUCCESS');
    onUpdateSettings(localSettings);
    onClose();
  };

  const toggleTheme = (theme: 'light' | 'dark') => {
    soundManager.play('CLICK');
    setLocalSettings(prev => ({ ...prev, theme }));
  };

  // --- API Keys Logic ---
  const handleAddSingleKey = () => {
    if (singleKeyInput.trim()) {
      soundManager.play('CLICK');
      setLocalSettings(prev => ({
        ...prev,
        apiKeys: [...prev.apiKeys, singleKeyInput.trim()]
      }));
      setSingleKeyInput('');
    }
  };

  const handleProcessBulkKeys = () => {
    if (!bulkKeyInput.trim()) return;
    soundManager.play('CLICK');
    const newKeys = bulkKeyInput
      .split(',')
      .map(k => k.trim())
      .filter(k => k !== '' && k.length > 5);
    if (newKeys.length > 0) {
      setLocalSettings(prev => ({
        ...prev,
        apiKeys: [...prev.apiKeys, ...newKeys]
      }));
      setBulkKeyInput('');
    }
  };

  const handleRemoveKey = (index: number) => {
    soundManager.play('CLICK');
    setLocalSettings(prev => ({
      ...prev,
      apiKeys: prev.apiKeys.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveAllKeys = () => {
    if (confirm('هل أنت متأكد من حذف جميع مفاتيح API؟')) {
      soundManager.play('CLICK');
      setLocalSettings(prev => ({ ...prev, apiKeys: [] }));
    }
  };

  const startEditingKey = (index: number, currentValue: string) => {
    setEditingKeyIndex(index);
    setEditingKeyValue(currentValue);
  };

  const saveEditedKey = () => {
    if (editingKeyIndex !== null && editingKeyValue.trim()) {
      const updatedKeys = [...localSettings.apiKeys];
      updatedKeys[editingKeyIndex] = editingKeyValue.trim();
      setLocalSettings(prev => ({ ...prev, apiKeys: updatedKeys }));
      setEditingKeyIndex(null);
      setEditingKeyValue('');
    }
  };

  // --- Models Logic ---
  const handleAddModel = () => {
    if (newModelInput.trim()) {
      soundManager.play('CLICK');
      setLocalSettings(prev => ({
        ...prev,
        customModels: [...prev.customModels, newModelInput.trim()]
      }));
      setNewModelInput('');
    }
  };

  const defaultModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite-latest', 'gemini-3-pro-preview', 'gemini-2.0-flash'];
  const allModels = [...defaultModels, ...localSettings.customModels];

  // Task specific update helper
  const updateTaskModel = (task: keyof typeof localSettings.taskModels, model: string) => {
    soundManager.play('CLICK');
    setLocalSettings(prev => ({
      ...prev,
      taskModels: {
        ...prev.taskModels,
        [task]: model
      }
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-opacity">
      <div className="bg-white dark:bg-dark-card rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-200 dark:border-dark-border flex flex-col h-[85vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <div>
            <h3 className="font-extrabold text-2xl text-gray-800 dark:text-white">إعدادات المنصة</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">تحكم في النماذج، المفاتيح، والمظهر</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-64 bg-gray-50 dark:bg-gray-900/30 border-l border-gray-200 dark:border-gray-700 p-4 space-y-2 hidden md:block">
            {[
              { id: 'general', label: 'عام والمظهر', icon: Sun },
              { id: 'keys', label: 'مفاتيح API', icon: Key },
              { id: 'models', label: 'تخصيص النماذج', icon: Cpu },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { soundManager.play('CLICK'); setActiveTab(tab.id as any); }}
                className={`w-full text-right px-4 py-3 rounded-xl flex items-center gap-3 font-bold transition-all ${
                  activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-dark-card">
            
            {/* Mobile Tabs */}
            <div className="flex md:hidden gap-2 mb-6 overflow-x-auto pb-2">
               {[
              { id: 'general', label: 'عام', icon: Sun },
              { id: 'keys', label: 'مفاتيح API', icon: Key },
              { id: 'models', label: 'النماذج', icon: Cpu },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold ${
                   activeTab === tab.id ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                 <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
            </div>

            {activeTab === 'general' && (
              <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div>
                  <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <Sun className="w-5 h-5 text-primary-500" /> مظهر التطبيق
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => toggleTheme('light')}
                      className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                        localSettings.theme === 'light' 
                          ? 'border-primary-500 bg-primary-50 dark:bg-gray-800 text-primary-700 dark:text-primary-400 scale-105 shadow-lg' 
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Sun className="w-8 h-8" /> 
                      <span className="font-bold">الوضع النهاري</span>
                    </button>
                    <button
                      onClick={() => toggleTheme('dark')}
                      className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                        localSettings.theme === 'dark' 
                          ? 'border-primary-500 bg-gray-800 text-primary-400 scale-105 shadow-lg' 
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Moon className="w-8 h-8" /> 
                      <span className="font-bold">الوضع الليلي</span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'keys' && (
              <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center">
                   <h4 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Key className="w-5 h-5 text-primary-500" /> إدارة مفاتيح API
                  </h4>
                  <button onClick={handleRemoveAllKeys} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1 rounded-lg text-sm font-bold transition-colors">
                    حذف الكل
                  </button>
                </div>

                {/* Instructions Banner */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-indigo-600 hidden sm:block">
                            <Info className="w-6 h-6" />
                        </div>
                        <div>
                            <h5 className="font-bold text-indigo-900 dark:text-indigo-200 text-lg mb-2">كيف أحصل على مفتاح API؟</h5>
                            <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-4 leading-relaxed">
                                لتشغيل المنصة بكفاءة، تحتاج إلى مفتاح (API Key) مجاني من Google Gemini.
                                العملية سهلة ولا تتطلب بطاقة ائتمان.
                            </p>
                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md hover:shadow-lg transform active:scale-95"
                            >
                                <span>اضغط هنا لاستخراج المفتاح مجاناً</span>
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>

                 <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                  <label className="block text-blue-800 dark:text-blue-300 font-bold text-sm mb-2 flex items-center gap-2">
                    <ListPlus className="w-4 h-4" /> إضافة جماعية (CSV)
                  </label>
                  <textarea
                    value={bulkKeyInput}
                    onChange={(e) => setBulkKeyInput(e.target.value)}
                    placeholder="الصق المفاتيح هنا مفصولة بفاصلة..."
                    className="w-full p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-white text-sm h-24 resize-none focus:ring-2 focus:ring-blue-400 outline-none font-mono"
                  />
                  <div className="flex justify-end mt-3">
                    <button onClick={handleProcessBulkKeys} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md shadow-blue-200 dark:shadow-none transition-all">
                      معالجة وإضافة
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <input
                    type="text"
                    value={singleKeyInput}
                    onChange={(e) => setSingleKeyInput(e.target.value)}
                    placeholder="مفتاح فردي (AIza...)"
                    className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500 font-mono text-sm"
                  />
                  <button onClick={handleAddSingleKey} disabled={!singleKeyInput} className="bg-gray-800 dark:bg-gray-700 text-white px-6 rounded-xl hover:bg-gray-900 transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                  {localSettings.apiKeys.map((key, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 group hover:border-primary-300 transition-all">
                      <div className="flex-1 font-mono text-xs text-gray-600 dark:text-gray-300 truncate">
                        {editingKeyIndex === idx ? (
                          <input 
                            type="text" 
                            value={editingKeyValue}
                            onChange={(e) => setEditingKeyValue(e.target.value)}
                            className="w-full p-2 rounded border border-primary-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none"
                            autoFocus
                          />
                        ) : (
                          key
                        )}
                      </div>
                      <div className="flex gap-1">
                         {editingKeyIndex === idx ? (
                          <button onClick={saveEditedKey} className="p-2 bg-green-100 text-green-600 rounded-lg"><Check className="w-4 h-4" /></button>
                        ) : (
                          <button onClick={() => startEditingKey(idx, key)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => handleRemoveKey(idx)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'models' && (
              <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                
                 <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-1" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">يمكنك تخصيص نموذج مختلف لكل عملية لتحسين الأداء. استخدم النماذج الأكبر (Pro) للعمليات المعقدة، والنماذج الأسرع (Flash) للمحادثات.</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                   {/* Task Allocations */}
                   {[
                     { key: 'processing', label: 'معالجة الدروس وتحليل المحتوى', icon: FileText, desc: 'يستخدم لتحويل النص والفيديو والصور' },
                     { key: 'summary', label: 'التلخيص الذكي', icon: List, desc: 'يستخدم لاستخراج النقاط الهامة' },
                     { key: 'quiz', label: 'توليد الاختبارات', icon: BrainCircuit, desc: 'يستخدم لإنشاء الأسئلة والأجوبة' },
                     { key: 'chat', label: 'المساعد الشخصي (الشات)', icon: MessageSquare, desc: 'يستخدم للردود السريعة والتفاعلية' },
                   ].map((task) => (
                     <div key={task.key} className="space-y-2">
                        <div className="flex items-center gap-2">
                           <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600">
                              <task.icon className="w-5 h-5" />
                           </div>
                           <div>
                              <h5 className="font-bold text-gray-800 dark:text-white">{task.label}</h5>
                              <p className="text-xs text-gray-500">{task.desc}</p>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                           {allModels.map(model => (
                             <button
                               key={model}
                               onClick={() => updateTaskModel(task.key as any, model)}
                               className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all truncate ${
                                 localSettings.taskModels?.[task.key as keyof typeof localSettings.taskModels] === model
                                 ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                                 : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-300'
                               }`}
                               title={model}
                             >
                               {model.replace('gemini-', '').replace('-preview', '')}
                             </button>
                           ))}
                        </div>
                     </div>
                   ))}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                   <h4 className="font-bold text-sm mb-3 text-gray-700 dark:text-gray-300">إضافة نموذج مخصص للقائمة</h4>
                   <div className="flex gap-2">
                    <input
                      type="text"
                      value={newModelInput}
                      onChange={(e) => setNewModelInput(e.target.value)}
                      placeholder="اسم النموذج (مثلاً gemini-1.5-pro)"
                      className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500 font-mono text-sm"
                    />
                    <button onClick={handleAddModel} disabled={!newModelInput} className="bg-gray-800 dark:bg-gray-700 text-white px-6 rounded-xl hover:bg-gray-900 transition-colors">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button 
            onClick={handleSaveAll}
            className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white rounded-2xl font-bold shadow-xl shadow-primary-500/20 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg"
          >
            <Save className="w-6 h-6" />
            حفظ وتطبيق الإعدادات
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
