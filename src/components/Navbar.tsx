import React from 'react';
import { Sparkles, LogOut, Plus, BookOpen, Clock, ShieldCheck, User as UserIcon } from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  activeView: 'editor' | 'history';
  onViewChange: (view: 'editor' | 'history') => void;
  onNewEntry: () => void;
  onSignOut: () => void;
  isSaving?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeView,
  onViewChange,
  onNewEntry,
  onSignOut,
  isSaving,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-[#FDFCF8]/90 backdrop-blur-md border-b border-[#E8E2D6] text-[#38332E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-6">
          <div
            id="brand-logo-btn"
            onClick={() => onViewChange('editor')}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#5F6F52] to-[#7A8D7D] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-[#FDFCF8] stroke-[2.2]" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-[#2E2A25] group-hover:text-[#5F6F52] transition-colors">
                Confidant
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-[#F3EFE6] text-[#635A52] border border-[#E0D8CA]">
                Gemini 3.6 Flash
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          {user && (
            <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-[#E8E2D6]">
              <button
                id="nav-journal-btn"
                onClick={() => onViewChange('editor')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeView === 'editor'
                    ? 'bg-[#EDE7DC] text-[#2E2A25] border border-[#DDD5C7] shadow-xs'
                    : 'text-[#685F56] hover:text-[#2E2A25] hover:bg-[#F4EFE6]'
                }`}
              >
                <BookOpen className="w-4 h-4 text-[#5F6F52]" />
                <span>Current Reflection</span>
              </button>

              <button
                id="nav-history-btn"
                onClick={() => onViewChange('history')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeView === 'history'
                    ? 'bg-[#EDE7DC] text-[#2E2A25] border border-[#DDD5C7] shadow-xs'
                    : 'text-[#685F56] hover:text-[#2E2A25] hover:bg-[#F4EFE6]'
                }`}
              >
                <Clock className="w-4 h-4 text-[#5F6F52]" />
                <span>Past Entries</span>
              </button>
            </nav>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center space-x-3">
          {user ? (
            <>
              {/* Saving status */}
              {isSaving && (
                <div className="hidden sm:flex items-center space-x-1.5 text-xs text-[#5F6F52] bg-[#F0F4EE] border border-[#CFDBCF] px-2.5 py-1 rounded-full animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-[#5F6F52]" />
                  <span>Syncing Firestore...</span>
                </div>
              )}

              {/* New Entry Button */}
              <button
                id="header-new-entry-btn"
                onClick={onNewEntry}
                className="flex items-center space-x-1.5 bg-[#5F6F52] hover:bg-[#4E5D43] text-[#FDFCF8] font-semibold px-3.5 py-1.5 rounded-lg text-sm shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">New Reflection</span>
              </button>

              {/* User Profile info */}
              <div className="flex items-center space-x-2.5 pl-2 border-l border-[#E8E2D6]">
                {user.photoURL ? (
                  <img
                    id="user-avatar-img"
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-[#DDD5C7] object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#EAE4D8] border border-[#DDD5C7] flex items-center justify-center text-[#5A524A]">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}

                <div className="hidden lg:block text-left">
                  <p className="text-xs font-semibold text-[#2E2A25] truncate max-w-[130px]">
                    {user.displayName || 'Journalist'}
                  </p>
                  <p className="text-[10px] text-[#7A7268] truncate max-w-[130px]">
                    {user.email}
                  </p>
                </div>

                {/* Sign Out Button */}
                <button
                  id="signout-btn"
                  onClick={onSignOut}
                  title="Sign Out"
                  className="p-1.5 text-[#7A7268] hover:text-[#9B4D4D] hover:bg-[#F6ECE9] rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-2 text-xs text-[#685F56]">
              <ShieldCheck className="w-4 h-4 text-[#5F6F52]" />
              <span>Isolated Firestore Security</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
