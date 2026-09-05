import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Save,
  Check,
  RefreshCw,
  Tag,
  Smile,
  Bot,
  User,
  Copy,
  CheckCheck,
  Flame,
  Lightbulb,
  FileText,
  ListTodo,
  AlertCircle,
  X,
  Compass,
  HeartHandshake
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  JournalEntry,
  ChatMessage,
  ReflectionMode,
  sanitizeForFirestore,
  UserProfile
} from '../types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface JournalEditorProps {
  user: UserProfile;
  currentEntry: JournalEntry;
  onUpdateEntry: (entry: JournalEntry) => void;
  onEntrySaved?: () => void;
}

const MODES: { id: ReflectionMode; label: string; icon: React.FC<{ className?: string }>; desc: string }[] = [
  { id: 'reflection', label: 'Deep Reflection', icon: Sparkles, desc: 'Empathetic insights & thoughtful questions' },
  { id: 'summary', label: 'Executive Summary', icon: FileText, desc: 'Synthesize core takeaways & milestones' },
  { id: 'brainstorm', label: 'Brainstorm Ideas', icon: Lightbulb, desc: 'Creative angles & alternative pathways' },
  { id: 'action_plan', label: 'Action Plan', icon: ListTodo, desc: 'Prioritized next steps & milestones' },
];

const PROMPT_SUGGESTIONS = [
  {
    title: 'Daily Decompression',
    text: 'Today was packed. Here is what happened, what went well, and what felt challenging...',
    mode: 'reflection' as ReflectionMode,
  },
  {
    title: 'Strategic Decision',
    text: 'I am weighing a difficult decision between two choices. Option A is... and Option B is...',
    mode: 'brainstorm' as ReflectionMode,
  },
  {
    title: 'Energy & Focus Audit',
    text: 'Looking back at my week, here is what gave me high energy vs what drained my motivation...',
    mode: 'summary' as ReflectionMode,
  },
  {
    title: 'Goal Execution Roadblock',
    text: 'I have set a goal to accomplish X by next month, but I am encountering resistance around...',
    mode: 'action_plan' as ReflectionMode,
  },
];

const MOODS = [
  { id: 'reflective', label: 'Reflective', emoji: '🤔' },
  { id: 'calm', label: 'Calm', emoji: '🌿' },
  { id: 'focused', label: 'Focused', emoji: '🎯' },
  { id: 'energized', label: 'Energized', emoji: '⚡' },
  { id: 'grateful', label: 'Grateful', emoji: '🙏' },
  { id: 'curious', label: 'Curious', emoji: '🔍' },
  { id: 'overwhelmed', label: 'Overwhelmed', emoji: '🌊' },
] as const;

function formatUserErrorMessage(err: any, fallbackMessage: string): string {
  if (!navigator.onLine || err?.message === 'Failed to fetch' || err?.name === 'TypeError') {
    return 'Network disconnected or unreachable. Your reflection has been saved, but Gemini could not generate a response. Click Retry once your connection is restored.';
  }

  let raw = err?.message || (typeof err === 'string' ? err : fallbackMessage);

  // Handle unexpected HTML / non-JSON responses gracefully
  if (
    typeof raw === 'string' &&
    (raw.includes('<!doctype') ||
      raw.includes('Unexpected token') ||
      raw.includes('not valid JSON') ||
      raw.includes('non-JSON'))
  ) {
    return 'The reflection service returned an unexpected response format. Please click Retry in a few moments.';
  }

  try {
    if (typeof raw === 'string' && raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
      const parsed = JSON.parse(raw.trim());
      if (parsed?.error?.message) {
        return parsed.error.message;
      }
      if (parsed?.error && typeof parsed.error === 'string') {
        return parsed.error;
      }
    }
  } catch {
    // Keep raw
  }

  return raw || fallbackMessage;
}

export const JournalEditor: React.FC<JournalEditorProps> = ({
  user,
  currentEntry,
  onUpdateEntry,
  onEntrySaved,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedMode, setSelectedMode] = useState<ReflectionMode>('reflection');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isSavingFirestore, setIsSavingFirestore] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAutoSummarizing, setIsAutoSummarizing] = useState(false);
  const [dismissedReframe, setDismissedReframe] = useState(false);
  const [isEvaluatingReframe, setIsEvaluatingReframe] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset dismissed reframe state when switching entries
  useEffect(() => {
    setDismissedReframe(false);
  }, [currentEntry.id]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentEntry.messages, isLoadingAi]);

  // Persist entry changes to Firestore
  const saveToFirestore = async (
    entryToSave: JournalEntry,
    options?: { preserveErrorMessage?: boolean; skipReframe?: boolean }
  ) => {
    setIsSavingFirestore(true);
    setSaveStatus('saving');
    if (!options?.preserveErrorMessage) {
      setErrorMessage(null);
    }

    let resolvedEntry = { ...entryToSave };

    // Directive #8: Cognitive Reframe Assistant (Conditional Trigger)
    // On saving a journal entry, evaluate if the entry contains a STRONG signal of a cognitive distortion.
    // If not yet triggered, run the classifier.
    if (!resolvedEntry.reframe?.triggered && !options?.skipReframe) {
      const userText = resolvedEntry.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n\n') || inputText.trim() || resolvedEntry.title;

      if (userText.trim().length > 0) {
        try {
          setIsEvaluatingReframe(true);
          const reframeRes = await fetch('/api/gemini/reframe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: userText }),
          });

          if (reframeRes.ok) {
            const reframeData = await reframeRes.json().catch(() => null);
            if (reframeData && typeof reframeData.triggered === 'boolean') {
              resolvedEntry = {
                ...resolvedEntry,
                reframe: {
                  triggered: Boolean(reframeData.triggered),
                  detectedDistortion: reframeData.detectedDistortion || null,
                  acknowledgment: reframeData.acknowledgment || null,
                  reframeQuestion: reframeData.reframeQuestion || null,
                  createdAt: new Date().toISOString(),
                },
              };
              onUpdateEntry(resolvedEntry);
            }
          }
        } catch (reframeErr) {
          console.warn('Cognitive reframe check deferred:', reframeErr);
        } finally {
          setIsEvaluatingReframe(false);
        }
      }
    }

    try {
      // Direct isolation in /users/{userId}/entries/{entryId}
      const entryRef = doc(db, 'users', user.uid, 'entries', resolvedEntry.id);
      const cleanData = sanitizeForFirestore({
        ...resolvedEntry,
        mood: resolvedEntry.mood || null,
        reframe: resolvedEntry.reframe
          ? {
              triggered: Boolean(resolvedEntry.reframe.triggered),
              detectedDistortion: resolvedEntry.reframe.detectedDistortion || null,
              acknowledgment: resolvedEntry.reframe.acknowledgment || null,
              reframeQuestion: resolvedEntry.reframe.reframeQuestion || null,
              createdAt: resolvedEntry.reframe.createdAt || new Date().toISOString(),
            }
          : null,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
      });

      await setDoc(entryRef, cleanData, { merge: true });
      setSaveStatus('saved');
      if (onEntrySaved) onEntrySaved();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      console.warn('Writing to Firestore encountered an issue (will sync when online):', err);
      setSaveStatus('error');
      if (!options?.preserveErrorMessage) {
        setErrorMessage(err?.message || 'Failed to save entry to Firestore.');
      }
    } finally {
      setIsSavingFirestore(false);
    }
  };

  // Handle sending a message / reflection
  const handleSendMessage = async (customPrompt?: string, modeToUse?: ReflectionMode) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || isLoadingAi) return;

    const currentMode = modeToUse || selectedMode;

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now() + '-user',
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
      mode: currentMode,
    };

    const updatedMessages = [...currentEntry.messages, userMessage];
    const updatedEntry: JournalEntry = {
      ...currentEntry,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };

    onUpdateEntry(updatedEntry);
    setInputText('');
    setIsLoadingAi(true);
    setErrorMessage(null);

    try {
      // Route brainstorm and action_plan to their dedicated endpoints, and other reflection modes to /api/gemini/reflect
      const endpoint =
        currentMode === 'brainstorm'
          ? '/api/gemini/brainstorm'
          : currentMode === 'action_plan'
          ? '/api/gemini/action_plan'
          : '/api/gemini/reflect';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          history: updatedMessages.slice(0, -1),
          mode: currentMode,
        }),
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let errorMsg = `Server responded with status ${response.status}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error) errorMsg = errorData.error;
        } else {
          const errText = await response.text().catch(() => '');
          if (errText.includes('<!doctype') || errText.includes('<html')) {
            errorMsg = `Server route error (${response.status}). Non-JSON response received.`;
          }
        }
        throw new Error(errorMsg);
      }

      if (!contentType.includes('application/json')) {
        throw new Error('Server returned an unexpected response format (non-JSON). Please retry.');
      }

      const data = await response.json();

      const aiMessage: ChatMessage = {
        id: 'msg-' + Date.now() + '-model',
        role: 'model',
        content: data.text || 'I have reflected on your thought.',
        timestamp: data.timestamp || new Date().toISOString(),
        mode: currentMode,
      };

      const finalMessages = [...updatedMessages, aiMessage];
      const finalEntry: JournalEntry = {
        ...updatedEntry,
        messages: finalMessages,
        updatedAt: new Date().toISOString(),
      };

      onUpdateEntry(finalEntry);
      // Guarantee save completeness to Firestore
      await saveToFirestore(finalEntry);
    } catch (err: any) {
      console.warn('Gemini interaction issue:', err);
      const userFriendlyMsg = formatUserErrorMessage(
        err,
        'Failed to generate Gemini reflection. Please retry.'
      );

      // Still persist user message to Firestore with preserveErrorMessage: true
      await saveToFirestore(updatedEntry, { preserveErrorMessage: true });
      // Explicitly set the error banner message AFTER the Firestore write completes
      setErrorMessage(userFriendlyMsg);
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Auto-summarize entry title, summary & tags with Gemini
  const handleAutoSummarize = async () => {
    if (currentEntry.messages.length === 0 || isAutoSummarizing) return;

    setIsAutoSummarizing(true);
    setErrorMessage(null);

    try {
      const fullConversationText = currentEntry.messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Gemini'}: ${m.content}`)
        .join('\n\n');

      const response = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullConversationText }),
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let errorMsg = `Failed to auto-summarize entry (${response.status})`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error) errorMsg = errorData.error;
        }
        throw new Error(errorMsg);
      }

      if (!contentType.includes('application/json')) {
        throw new Error('Server returned an unexpected response format for summarization.');
      }

      const result = await response.json();

      const detectedMood =
        typeof result.mood === 'string'
          ? (result.mood.toLowerCase().trim() as JournalEntry['mood'])
          : undefined;
      const isValidMood = MOODS.some((m) => m.id === detectedMood);

      const updatedEntry: JournalEntry = {
        ...currentEntry,
        title: result.title || currentEntry.title,
        summary: result.summary || currentEntry.summary,
        tags: Array.isArray(result.tags) ? result.tags : currentEntry.tags,
        mood: isValidMood ? detectedMood : currentEntry.mood,
        updatedAt: new Date().toISOString(),
      };

      onUpdateEntry(updatedEntry);
      await saveToFirestore(updatedEntry);
    } catch (err: any) {
      console.warn('Error auto-summarizing:', err);
      const userFriendlyMsg = formatUserErrorMessage(
        err,
        'Could not auto-summarize entry with Gemini.'
      );
      setErrorMessage(userFriendlyMsg);
    } finally {
      setIsAutoSummarizing(false);
    }
  };

  // Retry last action (Gemini reflection or summarization)
  const handleRetry = async () => {
    if (isLoadingAi || isAutoSummarizing) return;
    setErrorMessage(null);

    // If the last message is a user message without an AI reply, retry generating the reflection
    const lastMsg = currentEntry.messages[currentEntry.messages.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
      setIsLoadingAi(true);
      try {
        const history = currentEntry.messages.slice(0, -1);
        const modeToUse = lastMsg.mode || selectedMode;
        const endpoint =
          modeToUse === 'brainstorm'
            ? '/api/gemini/brainstorm'
            : modeToUse === 'action_plan'
            ? '/api/gemini/action_plan'
            : '/api/gemini/reflect';

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: lastMsg.content,
            history,
            mode: modeToUse,
          }),
        });

        const contentType = response.headers.get('content-type') || '';

        if (!response.ok) {
          let errorMsg = `Server responded with status ${response.status}`;
          if (contentType.includes('application/json')) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.error) errorMsg = errorData.error;
          } else {
            const errText = await response.text().catch(() => '');
            if (errText.includes('<!doctype') || errText.includes('<html')) {
              errorMsg = `Server route error (${response.status}). Non-JSON response received.`;
            }
          }
          throw new Error(errorMsg);
        }

        if (!contentType.includes('application/json')) {
          throw new Error('Server returned an unexpected response format (non-JSON). Please retry.');
        }

        const data = await response.json();
        const aiMessage: ChatMessage = {
          id: 'msg-' + Date.now() + '-model',
          role: 'model',
          content: data.text || 'I have reflected on your thought.',
          timestamp: data.timestamp || new Date().toISOString(),
          mode: lastMsg.mode || selectedMode,
        };

        const finalEntry: JournalEntry = {
          ...currentEntry,
          messages: [...currentEntry.messages, aiMessage],
          updatedAt: new Date().toISOString(),
        };

        onUpdateEntry(finalEntry);
        await saveToFirestore(finalEntry);
      } catch (err: any) {
        console.warn('Gemini retry issue:', err);
        const userFriendlyMsg = formatUserErrorMessage(
          err,
          'Retry failed. Please check your connection and try again.'
        );
        setErrorMessage(userFriendlyMsg);
      } finally {
        setIsLoadingAi(false);
      }
    } else if (inputText.trim()) {
      handleSendMessage();
    } else if (currentEntry.messages.length > 0) {
      handleAutoSummarize();
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleManualSave = async () => {
    if (isSavingFirestore) return;
    if (inputText.trim()) {
      const userMessage: ChatMessage = {
        id: 'msg-' + Date.now() + '-user',
        role: 'user',
        content: inputText.trim(),
        timestamp: new Date().toISOString(),
        mode: selectedMode,
      };
      const updated: JournalEntry = {
        ...currentEntry,
        messages: [...currentEntry.messages, userMessage],
        updatedAt: new Date().toISOString(),
      };
      setInputText('');
      onUpdateEntry(updated);
      await saveToFirestore(updated);
    } else {
      await saveToFirestore(currentEntry);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Top Header / Metadata Bar */}
      <div className="bg-white border border-[#E8E2D6] rounded-2xl p-5 mb-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title Editor */}
          <div className="flex-1">
            <input
              id="entry-title-input"
              type="text"
              value={currentEntry.title}
              onChange={(e) => onUpdateEntry({ ...currentEntry, title: e.target.value })}
              placeholder="Untitled Reflection..."
              className="w-full bg-transparent text-xl sm:text-2xl font-bold text-[#26221E] placeholder-[#A89F94] focus:outline-none focus:ring-0 border-b border-transparent hover:border-[#E8E2D6] focus:border-[#5F6F52] transition-colors pb-1"
            />
            <p className="text-xs text-[#7A7268] mt-1">
              Started {new Date(currentEntry.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Actions & Mood selector */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Auto-Summarize Button */}
            <button
              id="auto-summarize-btn"
              onClick={handleAutoSummarize}
              disabled={isAutoSummarizing || currentEntry.messages.length === 0}
              title="Generate Title, Summary & Tags using Gemini"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#F3EFE6] hover:bg-[#EAE4D8] text-xs font-semibold text-[#4A443F] border border-[#DDD5C7] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isAutoSummarizing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#5F6F52]" />
              )}
              <span>AI Summarize</span>
            </button>

            {/* Manual Save Button */}
            <button
              id="manual-save-firestore-btn"
              onClick={handleManualSave}
              disabled={isSavingFirestore}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                saveStatus === 'saved'
                  ? 'bg-[#EFF3EE] text-[#3C5843] border border-[#C8D6C9]'
                  : 'bg-[#EDE7DC] hover:bg-[#E2DBCF] text-[#38332E] border border-[#DDD5C7]'
              }`}
            >
              {isSavingFirestore ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#5F6F52]" />
              ) : saveStatus === 'saved' ? (
                <Check className="w-3.5 h-3.5 text-[#3C5843]" />
              ) : (
                <Save className="w-3.5 h-3.5 text-[#5A524A]" />
              )}
              <span>{saveStatus === 'saved' ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* Mood Selector Row */}
        <div className="mt-4 pt-4 border-t border-[#E8E2D6] flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#7A7268] mr-1 flex items-center gap-1">
            <Smile className="w-3.5 h-3.5" /> Mood:
          </span>
          {!currentEntry.mood && (
            <span className="text-[11px] text-[#9A9084] italic mr-1">Not selected</span>
          )}
          {MOODS.map((m) => {
            const isSelected = currentEntry.mood === m.id;
            return (
              <button
                key={m.id}
                id={`mood-select-${m.id}`}
                aria-pressed={isSelected}
                onClick={() => {
                  const nextMood = isSelected ? undefined : (m.id as any);
                  const updated = { ...currentEntry, mood: nextMood };
                  onUpdateEntry(updated);
                  saveToFirestore(updated);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center space-x-1 cursor-pointer ${
                  isSelected
                    ? 'bg-[#EDE7DC] text-[#2E2A25] border border-[#DDD5C7] font-semibold shadow-xs'
                    : 'bg-[#FAF7F2] text-[#6E665E] hover:text-[#2E2A25] hover:bg-[#F2ECE1] border border-[#E8E2D6]'
                }`}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            );
          })}

          {/* Tags */}
          {currentEntry.tags && currentEntry.tags.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              {currentEntry.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-[#F4F0E6] text-[11px] text-[#635A52] border border-[#E0D8CA] flex items-center gap-1"
                >
                  <Tag className="w-2.5 h-2.5 text-[#5F6F52]" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Summary Snippet banner if present */}
        {currentEntry.summary && (
          <div className="mt-3 p-2.5 rounded-xl bg-[#F8F5EE] border border-[#E5DEC8] text-xs text-[#4A443F]">
            <span className="font-semibold text-[#5F6F52] mr-1.5">Summary:</span>
            {currentEntry.summary}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          id="editor-error-banner"
          className="mb-4 p-4 rounded-xl bg-[#FDF2F0] border border-[#EAC4BE] text-[#933B34] text-xs flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150"
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-[#933B34] shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              id="retry-error-banner-btn"
              onClick={handleRetry}
              disabled={isLoadingAi || isAutoSummarizing}
              className="px-3 py-1.5 rounded-lg bg-[#933B34] hover:bg-[#7D322C] font-bold text-[#FDFCF8] cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
            >
              {isLoadingAi || isAutoSummarizing ? (
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Retrying...
                </span>
              ) : (
                'Retry'
              )}
            </button>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1.5 rounded-lg text-[#933B34] hover:bg-[#F8E3E0] transition-colors cursor-pointer"
              title="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Conversation / Journal Flow */}
      <div className="flex-1 flex flex-col space-y-6 pb-6">
        {currentEntry.messages.length === 0 ? (
          /* Empty state with prompt starters */
          <div className="my-auto py-8 text-center max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#EFF3EE] border border-[#C8D6C9] flex items-center justify-center text-[#5F6F52] mx-auto mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#26221E] mb-2">What is on your mind right now?</h2>
            <p className="text-sm text-[#685F56] mb-8 leading-relaxed">
              Write freely about your day, a tricky decision, an idea you want to explore, or something you are grateful for. Choose a prompt starter below or begin typing.
            </p>

            {/* Prompt Starter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {PROMPT_SUGGESTIONS.map((starter, idx) => (
                <button
                  key={idx}
                  id={`prompt-starter-btn-${idx}`}
                  onClick={() => {
                    setInputText(starter.text);
                    setSelectedMode(starter.mode);
                    textareaRef.current?.focus();
                  }}
                  className="p-4 rounded-xl bg-white hover:bg-[#FAF8F5] border border-[#E8E2D6] hover:border-[#DDD5C7] transition-all text-left group cursor-pointer shadow-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#2E2A25] group-hover:text-[#5F6F52] transition-colors">
                      {starter.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F3EFE6] text-[#635A52] border border-[#E0D8CA] capitalize">
                      {starter.mode.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[#685F56] line-clamp-2">
                    {starter.text}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message Flow */
          <div className="space-y-4">
            {currentEntry.messages.map((msg) => (
              <div
                key={msg.id}
                id={`chat-msg-${msg.id}`}
                className={`flex gap-3.5 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* AI Avatar */}
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#5F6F52] to-[#7A8D7D] flex items-center justify-center text-[#FDFCF8] shrink-0 mt-1 shadow-xs">
                    <Bot className="w-4 h-4 stroke-[2.2]" />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 sm:p-5 transition-all relative group ${
                    msg.role === 'user'
                      ? 'bg-[#EDE7DC] text-[#282420] border border-[#DDD5C7] rounded-tr-sm shadow-xs'
                      : 'bg-white text-[#38332E] border border-[#E8E2D6] rounded-tl-sm shadow-xs'
                  }`}
                >
                  {/* Mode Badge & Copy button */}
                  <div className={`flex items-center justify-between gap-2 mb-2 pb-1.5 border-b text-[11px] ${
                    msg.role === 'user' ? 'border-[#DDD5C7]/70 text-[#685F56]' : 'border-[#F0EBE1] text-[#7A7268]'
                  }`}>
                    <span className="font-semibold capitalize flex items-center gap-1.5">
                      {msg.role === 'user' ? (
                        <>
                          <User className="w-3 h-3 text-[#5F6F52]" />
                          <span>You</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-[#5F6F52]" />
                          <span>Gemini 3.6 Flash</span>
                          {msg.mode && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#F3EFE6] text-[10px] text-[#5F6F52] border border-[#E0D8CA]">
                              {msg.mode.replace('_', ' ')}
                            </span>
                          )}
                        </>
                      )}
                    </span>

                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-[#8C8276]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        title="Copy text"
                        className="p-1 hover:text-[#2E2A25] text-[#8C8276] transition-colors cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#3C5843]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="text-sm leading-relaxed prose prose-stone max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-headings:text-[#26221E] prose-headings:font-bold prose-code:text-[#5F6F52] prose-code:bg-[#F3EFE6] prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>

                {/* User Avatar */}
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-[#EAE4D8] border border-[#DDD5C7] flex items-center justify-center text-[#5A524A] shrink-0 mt-1">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="You"
                        className="w-full h-full rounded-xl object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* AI Loading Bubble */}
            {isLoadingAi && (
              <div className="flex gap-3.5 justify-start">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#5F6F52] to-[#7A8D7D] flex items-center justify-center text-[#FDFCF8] shrink-0 mt-1 shadow-xs">
                  <Bot className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="bg-white border border-[#E8E2D6] rounded-2xl rounded-tl-sm p-4 text-[#685F56] text-sm flex items-center space-x-3 shadow-xs">
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#5F6F52] animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 rounded-full bg-[#5F6F52] animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 rounded-full bg-[#5F6F52] animate-bounce" />
                  </div>
                  <span className="text-xs text-[#7A7268]">Gemini is reflecting...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Cognitive Reframe Card (Per Directive #8: only renders when triggered = true) */}
        {currentEntry.reframe &&
          currentEntry.reframe.triggered &&
          currentEntry.reframe.acknowledgment &&
          currentEntry.reframe.reframeQuestion &&
          !dismissedReframe && (
            <div
              id="cognitive-reframe-card"
              className="mt-6 p-5 sm:p-6 rounded-2xl bg-[#FAF7F2] border border-[#E8E2D6] shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <div className="flex items-start justify-between gap-3 mb-3.5">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#EFF3EE] border border-[#C8D6C9] flex items-center justify-center text-[#5F6F52] shrink-0">
                    <HeartHandshake className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#2E2A25]">
                      Perspective & Reflection
                    </h4>
                    <p className="text-[11px] text-[#7A7268]">
                      A gentle space to explore alternative viewpoints
                    </p>
                  </div>
                </div>

                <button
                  id="dismiss-reframe-btn"
                  onClick={() => setDismissedReframe(true)}
                  className="p-1.5 text-[#8C8276] hover:text-[#2E2A25] hover:bg-[#EDE7DC] rounded-lg transition-colors cursor-pointer"
                  title="Dismiss reflection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step 1: ACKNOWLEDGE first */}
              <div className="text-sm text-[#3E3832] leading-relaxed mb-4">
                {currentEntry.reframe.acknowledgment}
              </div>

              {/* Step 2: ASK, don't tell */}
              <div className="p-4 rounded-xl bg-white/90 border border-[#E2DBD0]">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5F6F52] uppercase tracking-wider mb-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  <span>A Question to Explore</span>
                </div>
                <p className="text-sm font-medium text-[#2E2925] italic leading-relaxed">
                  "{currentEntry.reframe.reframeQuestion}"
                </p>
              </div>
            </div>
          )}
      </div>

      {/* Sticky Bottom Input Area */}
      <div className="sticky bottom-4 z-20 mt-auto">
        <div className="bg-[#FDFCF8]/95 border border-[#E8E2D6] rounded-2xl p-3 shadow-lg backdrop-blur-md">
          {/* Mode Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-2 border-b border-[#E8E2D6] text-xs scrollbar-none">
            <span className="text-[11px] font-semibold text-[#7A7268] uppercase tracking-wider px-1">
              Mode:
            </span>
            {MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  id={`mode-tab-${mode.id}`}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedMode === mode.id
                      ? 'bg-[#EDE7DC] text-[#2E2A25] border border-[#DDD5C7] shadow-xs font-semibold'
                      : 'bg-[#FAF7F2] text-[#685F56] hover:text-[#2E2A25] hover:bg-[#F2ECE1] border border-[#E8E2D6]'
                  }`}
                  title={mode.desc}
                >
                  <Icon className="w-3.5 h-3.5 text-[#5F6F52]" />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          {/* Text Input & Send */}
          <div className="flex items-end gap-2.5">
            <textarea
              id="reflection-textarea"
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Write your thought, reflection, or follow-up (${MODES.find(m => m.id === selectedMode)?.label.toLowerCase()} mode)...`}
              className="flex-1 bg-white text-[#282420] placeholder-[#A39B90] text-sm rounded-xl p-3 border border-[#DDD5C7] focus:outline-none focus:border-[#5F6F52] resize-none max-h-36 min-h-[50px] transition-colors"
            />

            <button
              id="send-reflection-btn"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoadingAi}
              className="px-4 py-3 rounded-xl bg-[#5F6F52] hover:bg-[#4E5D43] text-[#FDFCF8] font-bold text-sm flex items-center justify-center space-x-1.5 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95 shrink-0"
            >
              {isLoadingAi ? (
                <RefreshCw className="w-4 h-4 animate-spin stroke-[2.5]" />
              ) : (
                <>
                  <span>Reflect</span>
                  <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>

          {/* Helpful shortcut tip */}
          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-[#7A7268]">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[#EDE7DC] text-[#5A524A] text-[10px] font-mono border border-[#DDD5C7]">Cmd / Ctrl + Enter</kbd> to send</span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#5F6F52]" />
              Isolated Firestore document store
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
