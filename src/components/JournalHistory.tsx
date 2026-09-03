import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Calendar,
  Clock,
  Trash2,
  ArrowRight,
  Sparkles,
  Tag,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { JournalEntry, UserProfile } from '../types';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface JournalHistoryProps {
  user: UserProfile;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onEntryDeleted?: (deletedEntryId: string) => void;
}

const MOOD_EMOJIS: Record<string, string> = {
  reflective: '🤔',
  calm: '🌿',
  focused: '🎯',
  energized: '⚡',
  grateful: '🙏',
  curious: '🔍',
  overwhelmed: '🌊',
};

export const JournalHistory: React.FC<JournalHistoryProps> = ({
  user,
  onSelectEntry,
  onNewEntry,
  onEntryDeleted,
}) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const entriesRef = collection(db, 'users', user.uid, 'entries');
      const q = query(entriesRef, orderBy('updatedAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const loadedEntries: JournalEntry[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as JournalEntry;
        loadedEntries.push({
          ...data,
          id: docSnap.id,
        });
      });

      setEntries(loadedEntries);
    } catch (err: any) {
      console.error('Error fetching entries from Firestore:', err);
      setError(err?.message || 'Failed to load entries from Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [user.uid]);

  const handleDeleteClick = (e: React.MouseEvent, entry: JournalEntry) => {
    e.stopPropagation();
    setError(null);
    setEntryToDelete(entry);
  };

  const handleConfirmDelete = async () => {
    if (!entryToDelete || !user) return;
    setIsDeleting(true);
    setError(null);
    const targetId = entryToDelete.id;
    const targetTitle = entryToDelete.title || 'Untitled Reflection';

    try {
      const entryRef = doc(db, 'users', user.uid, 'entries', targetId);
      await deleteDoc(entryRef);
      setEntries((prev) => prev.filter((item) => item.id !== targetId));
      setEntryToDelete(null);
      setDeleteFeedback(`Successfully deleted "${targetTitle}" from Firestore.`);
      setTimeout(() => setDeleteFeedback(null), 4000);
      if (onEntryDeleted) {
        onEntryDeleted(targetId);
      }
    } catch (err: any) {
      console.error('Error deleting entry from Firestore:', err);
      setError(err?.message || 'Could not delete entry from Cloud Firestore. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      searchQuery === '' ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.summary && entry.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (entry.tags && entry.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      entry.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesMood = selectedMood === 'all' || entry.mood === selectedMood;

    return matchesSearch && matchesMood;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-4rem)] flex flex-col relative">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#26221E] tracking-tight flex items-center gap-3">
            <span>Reflection History</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#F3EFE6] text-[#5F6F52] border border-[#DDD5C7] font-semibold">
              {entries.length} {entries.length === 1 ? 'Entry' : 'Entries'}
            </span>
          </h1>
          <p className="text-sm text-[#685F56] mt-1">
            Review your past multi-turn reflections, insights, and summaries.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="refresh-history-btn"
            onClick={fetchEntries}
            title="Refresh from Firestore"
            className="p-2.5 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#685F56] hover:text-[#26221E] border border-[#E8E2D6] transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="history-new-entry-btn"
            onClick={onNewEntry}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#5F6F52] hover:bg-[#4E5D43] text-[#FDFCF8] font-bold text-sm shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Reflection</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E8E2D6] rounded-2xl p-4 mb-6 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8C8276] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="history-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reflections by title, topic, or keywords..."
              className="w-full bg-[#FDFCF8] text-sm text-[#282420] placeholder-[#A39B90] pl-10 pr-4 py-2 rounded-xl border border-[#DDD5C7] focus:outline-none focus:border-[#5F6F52] transition-colors"
            />
          </div>

          {/* Mood Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedMood('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                selectedMood === 'all'
                  ? 'bg-[#EDE7DC] text-[#2E2A25] border border-[#DDD5C7] font-semibold shadow-xs'
                  : 'bg-[#FAF7F2] text-[#685F56] hover:text-[#2E2A25] hover:bg-[#F2ECE1] border border-[#E8E2D6]'
              }`}
            >
              All Moods
            </button>
            {Object.keys(MOOD_EMOJIS).map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMood(m)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center space-x-1 capitalize cursor-pointer ${
                  selectedMood === m
                    ? 'bg-[#EDE7DC] text-[#2E2A25] border border-[#DDD5C7] font-semibold shadow-xs'
                    : 'bg-[#FAF7F2] text-[#685F56] hover:text-[#2E2A25] hover:bg-[#F2ECE1] border border-[#E8E2D6]'
                }`}
              >
                <span>{MOOD_EMOJIS[m]}</span>
                <span>{m}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Success / Feedback Banner */}
      {deleteFeedback && (
        <div className="mb-6 p-4 rounded-xl bg-[#EFF3EE] border border-[#C8D6C9] text-[#3C5843] text-xs flex items-center space-x-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#3C5843] shrink-0" />
          <span className="font-medium">{deleteFeedback}</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-[#FDF2F0] border border-[#EAC4BE] text-[#933B34] text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-[#933B34] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Entries List or Empty State */}
      {loading ? (
        <div className="my-auto py-16 text-center">
          <RefreshCw className="w-8 h-8 text-[#5F6F52] animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#685F56]">Loading your private reflections from Firestore...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="my-auto py-16 text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-white border border-[#E8E2D6] flex items-center justify-center text-[#7A7268] mx-auto mb-4 shadow-xs">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[#26221E] mb-1">
            {searchQuery || selectedMood !== 'all' ? 'No matching reflections found' : 'No reflections yet'}
          </h3>
          <p className="text-xs text-[#685F56] mb-6 leading-relaxed">
            {searchQuery || selectedMood !== 'all'
              ? 'Try changing your search keywords or mood filter.'
              : 'Begin your first conversation with Gemini to reflect, brainstorm, or summarize your day.'}
          </p>
          <button
            id="empty-state-new-entry-btn"
            onClick={onNewEntry}
            className="px-5 py-2.5 rounded-xl bg-[#5F6F52] hover:bg-[#4E5D43] text-[#FDFCF8] font-semibold text-xs transition-all shadow-xs cursor-pointer"
          >
            Start First Reflection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              id={`history-card-${entry.id}`}
              onClick={() => onSelectEntry(entry)}
              className="bg-white hover:bg-[#FAF8F5] border border-[#E8E2D6] hover:border-[#DDD5C7] rounded-2xl p-5 transition-all group cursor-pointer flex flex-col justify-between shadow-xs"
            >
              <div>
                {/* Header Row: Mood & Date */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center space-x-2">
                    {entry.mood && (
                      <span className="px-2 py-0.5 rounded-full bg-[#F4F0E6] text-xs font-medium text-[#4A443F] border border-[#E0D8CA] flex items-center gap-1 capitalize">
                        <span>{MOOD_EMOJIS[entry.mood] || '🤔'}</span>
                        <span>{entry.mood}</span>
                      </span>
                    )}
                    <span className="text-[11px] text-[#7A7268] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#5F6F52]" />
                      {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Delete Button */}
                  <button
                    id={`delete-entry-btn-${entry.id}`}
                    onClick={(e) => handleDeleteClick(e, entry)}
                    title="Delete Entry"
                    className="p-1.5 rounded-lg text-[#8C8276] hover:text-[#933B34] hover:bg-[#FDF2F0] transition-colors opacity-80 group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-[#26221E] group-hover:text-[#5F6F52] transition-colors mb-2 line-clamp-1">
                  {entry.title || 'Untitled Reflection'}
                </h3>

                {/* Summary or Message Preview */}
                <p className="text-xs text-[#685F56] line-clamp-3 leading-relaxed mb-4">
                  {entry.summary ||
                    (entry.messages.length > 0
                      ? entry.messages[0].content
                      : 'No reflection content.')}
                </p>
              </div>

              {/* Footer: Tags & Turns Count */}
              <div className="pt-3 border-t border-[#E8E2D6] flex items-center justify-between text-xs text-[#7A7268]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {entry.tags && entry.tags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-[#F4F0E6] text-[10px] text-[#635A52] border border-[#E0D8CA]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center space-x-1 font-medium text-[#5F6F52] group-hover:text-[#4E5D43] transition-colors">
                  <span>{entry.messages.length} messages</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {entryToDelete && (
        <div
          id="delete-confirmation-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeleting) setEntryToDelete(null);
          }}
        >
          <div
            className="bg-[#FDFCF8] rounded-2xl border border-[#E8E2D6] shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#FDF2F0] border border-[#EAC4BE] flex items-center justify-center text-[#933B34]">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#26221E]">
                    Delete Reflection?
                  </h3>
                  <p className="text-xs text-[#7A7268]">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEntryToDelete(null)}
                disabled={isDeleting}
                className="p-1 rounded-lg text-[#8C8276] hover:text-[#26221E] hover:bg-[#F3EFE6] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#685F56] leading-relaxed mb-6">
              Are you sure you want to permanently delete{' '}
              <strong className="text-[#26221E] font-semibold">
                "{entryToDelete.title || 'Untitled Reflection'}"
              </strong>
              ? This will remove all conversation turns, summaries, and tags from your isolated Cloud Firestore storage.
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                id="cancel-delete-btn"
                type="button"
                onClick={() => setEntryToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#F3EFE6] hover:bg-[#EAE4D8] text-[#5A524A] font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                id="confirm-delete-btn"
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#933B34] hover:bg-[#7D322C] text-[#FDFCF8] font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-all disabled:opacity-60 cursor-pointer active:scale-95"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting from Firestore...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Reflection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
