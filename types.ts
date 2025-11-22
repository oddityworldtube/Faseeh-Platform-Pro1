
export enum ContentType {
  TOPIC = 'TOPIC',
  AUDIO = 'AUDIO',
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  PDF = 'PDF',
  YOUTUBE = 'YOUTUBE'
}

export interface ProcessedContent {
  originalText: string;
  formattedText: string; // Structured, Fusha Arabic
  summary: SummaryPoint[];
}

export interface SummaryPoint {
  point: string;
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export enum QuestionType {
  TRUE_FALSE = 'TRUE_FALSE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  SHORT_ANSWER = 'SHORT_ANSWER',
  FILL_BLANKS = 'FILL_BLANKS',
  ORDERING = 'ORDERING',
  MATCHING = 'MATCHING'
}

export enum DifficultyLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export interface QuizConfig {
  typeCounts: Partial<Record<QuestionType, number>>;
  mode?: 'CUSTOM' | 'COMPREHENSIVE' | 'MANUAL_ONLY';
  difficulty: DifficultyLevel;
  enableTimer?: boolean;
  timerDuration?: number; // in minutes
  instantFeedback?: boolean;
}

export interface Question {
  id: number;
  text: string;
  type: QuestionType;
  options?: string[]; // For MCQ (choices), MATCHING (right column items), ORDERING (shuffled items)
  matches?: { left: string; right: string }[]; // For MATCHING pair definition
  correctAnswer: string | boolean | string[]; // string[] for Ordering (correct sequence)
  explanation: string;
}

export interface Quiz {
  title: string;
  questions: Question[];
  config?: QuizConfig;
}

export interface QuizResult {
  id: string;
  date: string;
  score: number;
  total: number;
  details: {
    questionText: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }[];
  quizSnapshot?: Quiz;
  aiAnalysis?: string; // New field for AI feedback
}

export interface UserHistory {
  results: QuizResult[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 image string
  timestamp: Date;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface TaskModels {
  processing: string;
  summary: string;
  quiz: string;
  chat: string;
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  lastLoginDate: string;
}

export interface AppSettings {
  studentName?: string; // Added student name
  theme: 'light' | 'dark';
  colorTheme: string;
  apiKeys: string[];
  activeModel: string;
  customModels: string[];
  taskModels: TaskModels;
  userStats: UserStats;
}

export interface LessonSession {
  id: string;
  date: string;
  title: string;
  content: string;
  summary: SummaryPoint[];
  flashcards?: Flashcard[];
  messages: ChatMessage[];
  mindMap?: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export interface Book {
  id: string;
  title: string;
  uploadDate: string;
  fileSize: string;
  coverImage?: string;
  totalPages: number;
  folderId?: string;
}

export interface StoredBookFile {
  id: string;
  fileData: Blob;
}
