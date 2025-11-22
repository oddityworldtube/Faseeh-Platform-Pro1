
import { Book, StoredBookFile, Folder } from '../types';

const DB_NAME = 'FaseehLibraryDB';
const STORE_FILES = 'bookFiles';
const STORE_META = 'bookMetadata';
const STORE_FOLDERS = 'folders';
const DB_VERSION = 2; // Incremented for folders support

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        const metaStore = db.createObjectStore(STORE_META, { keyPath: 'id' });
        // Create index for searching by folderId if needed later
        metaStore.createIndex('folderId', 'folderId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
        db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' });
      }
    };
  });
};

export const saveBook = async (book: Book, file: Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_FILES, STORE_META], 'readwrite');
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    const filesStore = transaction.objectStore(STORE_FILES);
    const metaStore = transaction.objectStore(STORE_META);

    filesStore.put({ id: book.id, fileData: file });
    metaStore.put(book);
  });
};

export const updateBookFolder = async (bookId: string, folderId: string | undefined): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_META], 'readwrite');
    const store = transaction.objectStore(STORE_META);
    
    const getReq = store.get(bookId);
    
    getReq.onsuccess = () => {
      const book = getReq.result as Book;
      if (book) {
        book.folderId = folderId;
        store.put(book);
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getAllBooks = async (): Promise<Book[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_META, 'readonly');
    const store = transaction.objectStore(STORE_META);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getBookFile = async (id: string): Promise<Blob | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_FILES, 'readonly');
    const store = transaction.objectStore(STORE_FILES);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result ? request.result.fileData : null);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteBook = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_FILES, STORE_META], 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    transaction.objectStore(STORE_FILES).delete(id);
    transaction.objectStore(STORE_META).delete(id);
  });
};

// --- Folder Operations ---

export const createFolder = async (name: string): Promise<Folder> => {
  const db = await initDB();
  const newFolder: Folder = {
    id: Date.now().toString(),
    name,
    createdAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_FOLDERS], 'readwrite');
    transaction.oncomplete = () => resolve(newFolder);
    transaction.onerror = () => reject(transaction.error);
    
    transaction.objectStore(STORE_FOLDERS).add(newFolder);
  });
};

export const getAllFolders = async (): Promise<Folder[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_FOLDERS, 'readonly');
    const request = transaction.objectStore(STORE_FOLDERS).getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteFolder = async (folderId: string): Promise<void> => {
  const db = await initDB();
  // When deleting a folder, we move its books to root (undefined folderId)
  const books = await getAllBooks();
  const booksInFolder = books.filter(b => b.folderId === folderId);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_FOLDERS, STORE_META], 'readwrite');
    const metaStore = transaction.objectStore(STORE_META);
    
    // Move books to root
    booksInFolder.forEach(book => {
      book.folderId = undefined;
      metaStore.put(book);
    });

    // Delete folder
    transaction.objectStore(STORE_FOLDERS).delete(folderId);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};
