
import React from 'react';
import { LessonSession } from '../types';
import { X, Clock, ChevronLeft, Trash2 } from 'lucide-react';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: LessonSession[];
  onSelectSession: (session: LessonSession) => void;
  onDeleteSession: (id: string) => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ 
  isOpen, 
  onClose, 
  sessions, 
  onSelectSession,
  onDeleteSession 
}) => {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
          <h2 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-500" />
            سجل الدروس
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sessions.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500">
              <p>لا يوجد دروس محفوظة بعد</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div 
                key={session.id}
                className="group relative bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-all hover:border-primary-200 dark:hover:border-primary-500 cursor-pointer"
                onClick={() => { onSelectSession(session); onClose(); }}
              >
                <h3 className="font-bold text-gray-800 dark:text-gray-100 line-clamp-2 mb-2 text-sm">
                  {session.title || "درس بدون عنوان"}
                </h3>
                <div className="flex justify-between items-end">
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-md">
                    {new Date(session.date).toLocaleDateString('ar-EG')}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default HistorySidebar;
