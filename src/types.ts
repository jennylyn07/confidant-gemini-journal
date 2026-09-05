export type ReflectionMode = 'reflection' | 'summary' | 'brainstorm' | 'action_plan';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  mode?: ReflectionMode;
}

export interface CognitiveReframe {
  triggered: boolean;
  detectedDistortion: string | null;
  acknowledgment: string | null;
  reframeQuestion: string | null;
  createdAt?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  summary: string;
  tags: string[];
  mood?: 'reflective' | 'energized' | 'calm' | 'focused' | 'curious' | 'grateful' | 'overwhelmed';
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  reframe?: CognitiveReframe | null;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface ReflectionOption {
  id: ReflectionMode;
  label: string;
  description: string;
  iconName: string;
}

export interface PromptTemplate {
  id: string;
  category: string;
  title: string;
  prompt: string;
  mode: ReflectionMode;
}

/**
 * Strips all `undefined` values recursively so Firestore never crashes.
 */
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
