/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, signInWithGoogle, logOut } from './firebase';
import { UserProfile, JournalEntry } from './types';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { JournalEditor } from './components/JournalEditor';
import { JournalHistory } from './components/JournalHistory';
import { motion, AnimatePresence } from 'motion/react';

const createEmptyEntry = (userId: string): JournalEntry => ({
  id: 'entry-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
  userId,
  title: 'Daily Reflection - ' + new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  summary: '',
  tags: ['reflection'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [],
});

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'editor' | 'history'>('editor');
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);

  // Ensure document.title is always 'Confidant' on mount and route updates
  useEffect(() => {
    document.title = 'Confidant';
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        setUser(userProfile);
        setCurrentEntry((prev) => prev || createEmptyEntry(firebaseUser.uid));
      } else {
        setUser(null);
        setCurrentEntry(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setSignInError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setSignInError(err?.message || 'Authentication failed. Please check popup permissions.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      setUser(null);
      setCurrentEntry(null);
      setActiveView('editor');
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const handleNewEntry = () => {
    if (user) {
      const newEntry = createEmptyEntry(user.uid);
      setCurrentEntry(newEntry);
      setActiveView('editor');
    }
  };

  const handleSelectPastEntry = (entry: JournalEntry) => {
    setCurrentEntry(entry);
    setActiveView('editor');
  };

  const handleEntryDeleted = (deletedEntryId: string) => {
    if (user && currentEntry && currentEntry.id === deletedEntryId) {
      setCurrentEntry(createEmptyEntry(user.uid));
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDFCF8] flex flex-col items-center justify-center text-[#5A524A]">
        <div className="w-10 h-10 rounded-full border-3 border-[#5F6F52] border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-medium text-[#78716A]">Verifying authenticated session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-[#38332E] flex flex-col selection:bg-[#E8E2D5] selection:text-[#282420]">
      <Navbar
        user={user}
        activeView={activeView}
        onViewChange={setActiveView}
        onNewEntry={handleNewEntry}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              <LandingPage
                onSignIn={handleSignIn}
                isLoading={isSigningIn}
                error={signInError}
              />
            </motion.div>
          ) : activeView === 'editor' && currentEntry ? (
            <motion.div
              key={`editor-${currentEntry.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              <JournalEditor
                user={user}
                currentEntry={currentEntry}
                onUpdateEntry={setCurrentEntry}
              />
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              <JournalHistory
                user={user}
                onSelectEntry={handleSelectPastEntry}
                onNewEntry={handleNewEntry}
                onEntryDeleted={handleEntryDeleted}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
