
import React from 'react';
import { QuizResult } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Award, Clock, RotateCcw, UserCircle, BookOpen, Trophy } from 'lucide-react';
import ExportMenu from './ExportMenu';

interface DashboardProps {
  history: QuizResult[];
  onRetakeQuiz?: (result: QuizResult) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ history, onRetakeQuiz }) => {
  
  const chartData = history.map((res, idx) => ({
    name: `اختبار ${idx + 1}`,
    score: Math.round((res.score / res.total) * 100),
    date: new Date(res.date).toLocaleDateString('ar-EG')
  })).reverse(); // Show oldest to newest

  const averageScore = history.length > 0 
    ? Math.round(history.reduce((acc, curr) => acc + (curr.score / curr.total) * 100, 0) / history.length)
    : 0;

  const totalQuizzes = history.length;

  // Strict Grading Logic
  const getProgressLabel = (avg: number) => {
      if (totalQuizzes === 0) return "لم يبدأ";
      if (avg >= 90) return "ممتاز";
      if (avg >= 75) return "جيد جداً";
      if (avg >= 60) return "جيد";
      if (avg >= 50) return "مقبول";
      return "ضعيف - يحتاج تحسين";
  };

  return (
    <div className="space-y-8 relative">
       <div className="absolute top-0 left-0 z-10">
          <ExportMenu elementId="dashboard-report" filename="student-report" />
       </div>

      <div id="dashboard-report" className="space-y-8 bg-transparent">
        
        {/* Student Identity Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-bl-full -mr-10 -mt-10"></div>
            
            <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 border-4 border-white dark:border-gray-600 shadow-lg flex items-center justify-center text-gray-400">
                <UserCircle className="w-16 h-16" />
            </div>
            
            <div className="text-center md:text-right flex-1 z-10">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">طالب مجتهد</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">الصف الثالث الابتدائي (افتراضي)</p>
                <div className="flex items-center gap-3 mt-4 justify-center md:justify-start">
                    <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold border border-blue-100 dark:border-blue-800">
                        المنهج المصري
                    </span>
                    <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold border border-purple-100 dark:border-purple-800">
                        ID: #ST-2024-001
                    </span>
                </div>
            </div>

            <div className="flex gap-4 border-r border-gray-100 dark:border-gray-700 pr-6 mr-2">
                <div className="text-center">
                    <div className="text-3xl font-black text-primary-600 dark:text-primary-400">{totalQuizzes}</div>
                    <div className="text-xs text-gray-500 font-bold">اختبارات</div>
                </div>
                <div className="text-center">
                    <div className={`text-3xl font-black ${averageScore >= 50 ? 'text-green-500' : 'text-red-500'}`}>{averageScore}%</div>
                    <div className="text-xs text-gray-500 font-bold">المعدل</div>
                </div>
            </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 transition-colors">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">معدل الأداء العام</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{averageScore}%</h3>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 transition-colors">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">إجمالي الاختبارات</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{totalQuizzes}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 transition-colors">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${averageScore >= 50 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">مستوى التقدم</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {getProgressLabel(averageScore)}
              </h3>
            </div>
          </div>
        </div>

        {/* Chart & Empty State */}
        {history.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6">منحنى التحسن الدراسي</h3>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} unit="%" domain={[0, 100]} />
                    <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#0d9488" 
                    strokeWidth={3}
                    dot={{ fill: '#0d9488', strokeWidth: 2 }}
                    activeDot={{ r: 8 }}
                    />
                </LineChart>
                </ResponsiveContainer>
            </div>
            </div>
        ) : (
            <div className="bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center">
                <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-500">لا توجد بيانات كافية</h3>
                <p className="text-gray-400 mt-2">قم بإجراء اختبار واحد على الأقل لعرض الرسوم البيانية</p>
            </div>
        )}

        {/* History List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-700 dark:text-gray-200">سجل الاختبارات المفصل</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {history.length === 0 ? (
                <div className="p-8 text-center text-gray-400">السجل فارغ</div>
            ) : history.map((res) => (
              <div key={res.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                      {res.quizSnapshot?.title || "اختبار بدون عنوان"}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(res.date).toLocaleDateString('ar-EG')} • {res.total} سؤال
                  </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <span className={`block text-lg font-black ${
                            (res.score / res.total) >= 0.5 ? 'text-green-600' : 'text-red-500'
                        }`}>
                            {res.score} / {res.total}
                        </span>
                        <span className="text-xs text-gray-400">الدرجة</span>
                    </div>
                    {onRetakeQuiz && (
                         <button 
                            onClick={() => onRetakeQuiz(res)}
                            className="p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            title="إعادة هذا الاختبار"
                         >
                             <RotateCcw className="w-5 h-5" />
                         </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
