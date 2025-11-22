
import React, { useState, useEffect, useRef } from 'react';
import { Book, Folder } from '../types';
import * as DB from '../utils/db';
import { Plus, Trash2, BookOpen, CheckCircle, Loader2, Image as ImageIcon, ChevronRight, ArrowLeft, Maximize2, Minimize2, ZoomIn, ZoomOut, ChevronLeft, X, Eye, Folder as FolderIcon, FolderPlus, MoreVertical, ArrowRight, Home, FileText } from 'lucide-react';
import { soundManager } from '../utils/soundEffects';
import * as pdfjsLib from 'pdfjs-dist';

// Handle ESM/CDN import inconsistencies for PDF.js
const pdfjs: any = pdfjsLib;

// Initialize worker securely
const workerUrl = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
} else if (pdfjs.default && pdfjs.default.GlobalWorkerOptions) {
  pdfjs.default.GlobalWorkerOptions.workerSrc = workerUrl;
}

// Safely extract getDocument function
const getDocument = pdfjs.getDocument || (pdfjs.default && pdfjs.default.getDocument);

interface LibraryProps {
  onProcessPages: (images: string[]) => void;
  onExtractText: (text: string) => void;
}

const Library: React.FC<LibraryProps> = ({ onProcessPages, onExtractText }) => {
  // Data State
  const [books, setBooks] = useState<Book[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  
  // View State
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null); // null = Root
  const [isUploading, setIsUploading] = useState(false);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  
  // Selection & Processing State
  const [bookPages, setBookPages] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [isLoadingBook, setIsLoadingBook] = useState(false);
  
  // UI Action State
  const [activeMenuBookId, setActiveMenuBookId] = useState<string | null>(null);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reader State
  const [viewingPageIndex, setViewingPageIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Keyboard navigation for reader
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewingPageIndex === null) return;
      
      if (e.key === 'ArrowRight') handlePrevPage(); // RTL: Right is Prev
      if (e.key === 'ArrowLeft') handleNextPage();  // RTL: Left is Next
      if (e.key === 'Escape') closeReader();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingPageIndex, bookPages.length]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuBookId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      const [loadedBooks, loadedFolders] = await Promise.all([
        DB.getAllBooks(),
        DB.getAllFolders()
      ]);
      setBooks(loadedBooks.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()));
      setFolders(loadedFolders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error("Failed to load library data", e);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    soundManager.play('CLICK');
    try {
      const newFolder = await DB.createFolder(newFolderName.trim());
      setFolders(prev => [newFolder, ...prev]);
      setNewFolderName('');
      setIsCreateFolderModalOpen(false);
      soundManager.play('SUCCESS');
    } catch (e) {
      console.error(e);
      soundManager.play('ERROR');
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    if (!confirm('هل أنت متأكد من حذف المجلد؟ سيتم نقل الكتب الموجودة بداخله إلى المكتبة الرئيسية.')) return;
    
    await DB.deleteFolder(folderId);
    await loadData(); // Reload to update books' folderId
    soundManager.play('CLICK');
  };

  const handleMoveBook = async (e: React.MouseEvent, bookId: string, targetFolderId: string | undefined) => {
    e.stopPropagation();
    soundManager.play('CLICK');
    try {
      await DB.updateBookFolder(bookId, targetFolderId);
      setBooks(prev => prev.map(b => b.id === bookId ? { ...b, folderId: targetFolderId } : b));
      setActiveMenuBookId(null);
    } catch (error) {
      console.error("Failed to move book", error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    if (!getDocument) {
      alert("حدث خطأ في تحميل مكتبة PDF. يرجى تحديث الصفحة.");
      return;
    }

    setIsUploading(true);
    soundManager.play('CLICK');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext: any = {
          canvasContext: context,
          viewport: viewport
        };
        await page.render(renderContext).promise;
        
        const coverImage = canvas.toDataURL('image/jpeg', 0.7);

        const newBook: Book = {
            id: Date.now().toString(),
            title: file.name.replace('.pdf', ''),
            uploadDate: new Date().toISOString(),
            fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
            totalPages: pdf.numPages,
            coverImage,
            folderId: currentFolder?.id // Assign to current folder
        };

        await DB.saveBook(newBook, file);
        setBooks(prev => [newBook, ...prev]);
        soundManager.play('SUCCESS');
      }
    } catch (error) {
      console.error("Upload failed", error);
      soundManager.play('ERROR');
      alert("حدث خطأ أثناء معالجة ملف PDF. تأكد من سلامة الملف.");
    } finally {
      setIsUploading(false);
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteBook = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('هل أنت متأكد من حذف هذا الكتاب من المكتبة؟')) return;
    
    await DB.deleteBook(id);
    setBooks(prev => prev.filter(b => b.id !== id));
    soundManager.play('CLICK');
    if (activeBook?.id === id) setActiveBook(null);
  };

  const openBook = async (book: Book) => {
    soundManager.play('CLICK');
    setActiveBook(book);
    setIsLoadingBook(true);
    setBookPages([]);
    setSelectedPages([]);

    if (!getDocument) {
      setIsLoadingBook(false);
      alert("مكتبة PDF غير جاهزة.");
      return;
    }

    try {
      const fileBlob = await DB.getBookFile(book.id);
      if (!fileBlob) throw new Error("File not found");

      const arrayBuffer = await fileBlob.arrayBuffer();
      
      const loadingTask = getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      const renderedPages: string[] = [];
      const limit = Math.min(pdf.numPages, 50); 

      for (let i = 1; i <= limit; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const renderContext: any = { canvasContext: context, viewport: viewport };
            await page.render(renderContext).promise;
            renderedPages.push(canvas.toDataURL('image/jpeg', 0.85));
        }
      }

      setBookPages(renderedPages);
    } catch (error) {
      console.error("Error opening book", error);
      alert("فشل في فتح الكتاب");
    } finally {
      setIsLoadingBook(false);
    }
  };

  const togglePageSelection = (index: number) => {
    setSelectedPages(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleProcessSelection = () => {
    if (selectedPages.length === 0) return;
    const sortedIndices = [...selectedPages].sort((a, b) => a - b);
    const images = sortedIndices.map(i => bookPages[i].split(',')[1]);
    soundManager.play('SUCCESS');
    onProcessPages(images);
  };

  const handleExtractTextFromSelection = async () => {
    if (!activeBook || selectedPages.length === 0) return;
    
    setIsLoadingBook(true);
    soundManager.play('CLICK');

    try {
        const fileBlob = await DB.getBookFile(activeBook.id);
        if (!fileBlob) throw new Error("File not found");
        
        const arrayBuffer = await fileBlob.arrayBuffer();
        const loadingTask = getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        let fullText = "";
        const sortedPages = [...selectedPages].sort((a, b) => a - b);

        for (const pageIndex of sortedPages) {
            // Pages are 1-indexed in PDF.js
            const page = await pdf.getPage(pageIndex + 1);
            const textContent = await page.getTextContent();
            // join items with space
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            
            if (pageText.trim()) {
               fullText += `\n\n--- صفحة ${pageIndex + 1} ---\n${pageText}`;
            }
        }

        if (!fullText.trim()) {
             alert("لم يتم العثور على نص قابل للاستخراج. قد يكون الملف عبارة عن صور ممسوحة ضوئياً. يرجى استخدام زر 'شرح الصفحات' للمعالجة كصور.");
        } else {
             soundManager.play('SUCCESS');
             onExtractText(fullText.trim());
        }

    } catch (error) {
        console.error("Extraction failed", error);
        alert("حدث خطأ أثناء استخراج النص.");
        soundManager.play('ERROR');
    } finally {
        setIsLoadingBook(false);
    }
  };


  // --- READER LOGIC (Same as before) ---
  const openReader = (index: number) => { setViewingPageIndex(index); setZoomLevel(1); setIsFullscreen(false); };
  const closeReader = () => { if (document.fullscreenElement) document.exitFullscreen().catch(()=>{}); setViewingPageIndex(null); };
  const handleNextPage = () => { if (viewingPageIndex !== null && viewingPageIndex < bookPages.length - 1) setViewingPageIndex(viewingPageIndex + 1); };
  const handlePrevPage = () => { if (viewingPageIndex !== null && viewingPageIndex > 0) setViewingPageIndex(viewingPageIndex - 1); };
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  const toggleFullscreen = () => {
    if (!readerRef.current) return;
    if (!document.fullscreenElement) {
      readerRef.current.requestFullscreen().catch(()=>{}); setIsFullscreen(true);
    } else {
      document.exitFullscreen(); setIsFullscreen(false);
    }
  };

  // --- FILTER DATA ---
  const displayedBooks = books.filter(b => b.folderId === (currentFolder?.id || undefined));

  // --- RENDER ---

  if (activeBook) {
    return (
      <div className="animate-in slide-in-from-right duration-300 h-full flex flex-col relative">
        {viewingPageIndex !== null && (
          <div ref={readerRef} className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
             <div className="flex justify-between items-center p-4 bg-black/40 text-white z-50">
                <div className="flex items-center gap-4">
                   <h3 className="font-bold text-lg">{activeBook.title}</h3>
                   <span className="bg-gray-700 px-3 py-1 rounded-full text-sm font-mono">{viewingPageIndex + 1} / {bookPages.length}</span>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={handleZoomOut} className="p-2 hover:bg-white/10 rounded-full"><ZoomOut className="w-5 h-5" /></button>
                   <span className="font-mono text-sm min-w-[3ch] text-center">{Math.round(zoomLevel * 100)}%</span>
                   <button onClick={handleZoomIn} className="p-2 hover:bg-white/10 rounded-full"><ZoomIn className="w-5 h-5" /></button>
                   <div className="h-6 w-px bg-gray-600 mx-2"></div>
                   <button onClick={toggleFullscreen} className="p-2 hover:bg-white/10 rounded-full">{isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}</button>
                   <button onClick={closeReader} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full"><X className="w-6 h-6" /></button>
                </div>
             </div>
             <div className="flex-1 overflow-auto flex items-center justify-center p-4 cursor-grab active:cursor-grabbing relative">
                <button onClick={handlePrevPage} disabled={viewingPageIndex <= 0} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full disabled:opacity-20 transition-all z-40"><ChevronLeft className="w-8 h-8 rtl:rotate-180" /></button>
                <img src={bookPages[viewingPageIndex]} alt={`Page ${viewingPageIndex + 1}`} style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s ease-out' }} className="max-w-full max-h-full shadow-2xl object-contain bg-white" />
                <button onClick={handleNextPage} disabled={viewingPageIndex >= bookPages.length - 1} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full disabled:opacity-20 transition-all z-40"><ChevronRight className="w-8 h-8 rtl:rotate-180" /></button>
             </div>
             <div className="bg-black/60 p-4 flex justify-center">
                <button onClick={() => { togglePageSelection(viewingPageIndex); soundManager.play('CLICK'); }} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${selectedPages.includes(viewingPageIndex) ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-white hover:bg-gray-200 text-gray-900'}`}>
                    {selectedPages.includes(viewingPageIndex) ? <><CheckCircle className="w-5 h-5" /> صفحة محددة للشرح</> : <><Plus className="w-5 h-5" /> تحديد الصفحة للشرح</>}
                </button>
             </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm flex-wrap gap-3">
           <button onClick={() => setActiveBook(null)} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 font-bold transition-colors"><ArrowLeft className="w-5 h-5" /> عودة للمكتبة</button>
           <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-lg">تم تحديد {selectedPages.length} صفحة</span>
              
              {/* Text Extraction Button */}
              <button 
                onClick={handleExtractTextFromSelection} 
                disabled={selectedPages.length === 0} 
                className="px-5 py-2 rounded-xl font-bold text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all flex items-center gap-2 disabled:opacity-50"
                title="استخراج النص مباشرة من ملف PDF لمعالجة أسرع"
              >
                <FileText className="w-4 h-4" /> استخراج النص
              </button>

              <button 
                onClick={handleProcessSelection} 
                disabled={selectedPages.length === 0} 
                className="btn-primary py-2 px-6 text-sm"
                title="تحليل الصفحات كصور للحصول على شرح مفصل"
              >
                {selectedPages.length > 0 ? 'تحليل الصور' : 'اختر صفحات'} <ChevronRight className="w-4 h-4" />
              </button>
           </div>
        </div>

        {isLoadingBook ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500"><Loader2 className="w-12 h-12 animate-spin mb-4 text-primary-500" /><p>جاري معالجة الكتاب...</p></div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
               {bookPages.map((imgSrc, idx) => (
                 <div key={idx} onClick={() => togglePageSelection(idx)} className={`relative group rounded-xl overflow-hidden border-2 transition-all duration-200 shadow-sm ${selectedPages.includes(idx) ? 'border-primary-500 ring-4 ring-primary-500/20 transform scale-[1.02]' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'}`}>
                   <img src={imgSrc} alt={`Page ${idx + 1}`} className="w-full h-auto object-cover" />
                   <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-center py-2 text-sm font-bold backdrop-blur-sm z-10">صفحة {idx + 1}</div>
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
                        <button onClick={(e) => { e.stopPropagation(); openReader(idx); }} className="p-3 bg-white text-gray-900 rounded-full hover:bg-primary-500 hover:text-white transition-colors shadow-lg transform hover:scale-110" title="قراءة مكبرة"><Eye className="w-6 h-6" /></button>
                   </div>
                   {selectedPages.includes(idx) && <div className="absolute top-2 right-2 bg-primary-500 text-white rounded-full p-1.5 shadow-lg z-20"><CheckCircle className="w-6 h-6" /></div>}
                 </div>
               ))}
             </div>
             {activeBook.totalPages > 50 && <div className="text-center py-8 text-gray-500"><p className="bg-yellow-50 dark:bg-yellow-900/20 inline-block px-4 py-2 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">ملاحظة: يتم عرض أول 50 صفحة فقط لضمان سرعة التطبيق.</p></div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col">
      {/* Create Folder Modal */}
      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">إنشاء مجلد جديد</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="اسم المجلد (مثلاً: فيزياء، مذكرات الأستاذ...)"
              className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsCreateFolderModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-bold">إلغاء</button>
              <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="px-4 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50">إنشاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h2 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary-500" />
            المكتبة الرقمية
            </h2>
            
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 mt-2 text-sm font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 px-3 py-1.5 rounded-lg w-fit">
              <button 
                onClick={() => setCurrentFolder(null)}
                className={`hover:text-primary-600 flex items-center gap-1 ${!currentFolder ? 'text-primary-600' : ''}`}
              >
                <Home className="w-4 h-4" />
                الرئيسية
              </button>
              {currentFolder && (
                <>
                  <ChevronRight className="w-4 h-4 rtl:rotate-180 text-gray-400" />
                  <span className="text-primary-600">{currentFolder.name}</span>
                </>
              )}
            </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setIsCreateFolderModalOpen(true)}
            className="btn-secondary px-4 py-2.5 text-sm"
          >
            <FolderPlus className="w-5 h-5" />
            <span>مجلد جديد</span>
          </button>

          <input 
            type="file" 
            accept="application/pdf" 
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn-primary px-4 py-2.5 text-sm"
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            <span>رفع كتاب</span>
          </button>
        </div>
      </div>

      {books.length === 0 && folders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center bg-white dark:bg-dark-card rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 m-4">
          <div className="w-24 h-24 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-6">
             <BookOpen className="w-10 h-10 text-primary-500" />
          </div>
          <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-200">المكتبة فارغة حالياً</h3>
          <p className="text-gray-400 dark:text-gray-500 mt-2 max-w-md mx-auto">
            قم بإنشاء مجلدات لتنظيم موادك، أو ارفع كتب PDF مباشرة.
          </p>
        </div>
      ) : (
        <div className="pb-20 overflow-y-auto custom-scrollbar p-2">
          
          {/* Folders Section (Only show in Root) */}
          {!currentFolder && folders.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3">المجلدات</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {folders.map(folder => (
                  <div 
                    key={folder.id}
                    onClick={() => setCurrentFolder(folder)}
                    className="group bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md cursor-pointer transition-all flex flex-col items-center text-center relative"
                  >
                    <FolderIcon className="w-12 h-12 text-yellow-400 fill-yellow-400/20 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate w-full">{folder.name}</span>
                    <button 
                      onClick={(e) => handleDeleteFolder(e, folder.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Books Section */}
          <div>
             <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3">
               {currentFolder ? `كتب: ${currentFolder.name}` : 'جميع الكتب (غير المصنفة)'}
             </h3>
             
             {displayedBooks.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/30">
                  <p className="text-gray-400">لا توجد كتب في هذا المجلد</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {displayedBooks.map((book) => (
                    <div 
                      key={book.id}
                      onClick={() => openBook(book)}
                      className="group bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-primary-400 dark:hover:border-primary-500 transition-all duration-300 cursor-pointer flex flex-col relative"
                    >
                      <div className="h-56 bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
                        {book.coverImage ? (
                          <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <ImageIcon className="w-16 h-16" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                        
                        {/* Menu Trigger */}
                        <div className="absolute top-2 left-2 z-20">
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveMenuBookId(activeMenuBookId === book.id ? null : book.id); }}
                            className="p-2 bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur-md transition-colors"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          
                          {/* Context Menu */}
                          {activeMenuBookId === book.id && (
                            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-600 overflow-hidden animate-in zoom-in-95 origin-top-left z-30">
                              <div className="p-2">
                                <p className="text-xs font-bold text-gray-400 px-2 py-1">نقل إلى...</p>
                                <button 
                                  onClick={(e) => handleMoveBook(e, book.id, undefined)}
                                  className={`w-full text-right px-2 py-1.5 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${!book.folderId ? 'text-primary-500 font-bold' : 'text-gray-700 dark:text-gray-300'}`}
                                >
                                  <Home className="w-4 h-4" /> المكتبة الرئيسية
                                </button>
                                {folders.map(f => (
                                  <button 
                                    key={f.id}
                                    onClick={(e) => handleMoveBook(e, book.id, f.id)}
                                    className={`w-full text-right px-2 py-1.5 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${book.folderId === f.id ? 'text-primary-500 font-bold' : 'text-gray-700 dark:text-gray-300'}`}
                                  >
                                    <FolderIcon className="w-4 h-4" /> {f.name}
                                  </button>
                                ))}
                                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                                <button 
                                  onClick={(e) => handleDeleteBook(e, book.id)}
                                  className="w-full text-right px-2 py-1.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" /> حذف الكتاب
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1 line-clamp-1" title={book.title}>
                          {book.title}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
                          <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-medium">
                              {book.totalPages} صفحة
                          </span>
                          <span>•</span>
                          <span>{book.fileSize}</span>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                           <span className="text-primary-600 dark:text-primary-400 font-bold text-sm group-hover:underline flex items-center gap-1">
                             فتح الكتاب <ArrowLeft className="w-4 h-4" />
                           </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;
