import React from 'react';
import { Sparkles, Shield, Lock, BrainCircuit, BookText, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  isLoading: boolean;
  error?: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, isLoading, error }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#FDFCF8] text-[#38332E] flex flex-col justify-between">
      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 text-center">
        {/* Pill Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#F3EFE6] border border-[#E0D8CA] text-[#5A524A] text-xs font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-[#5F6F52] animate-pulse" />
          <span>Gemini 3.6 Flash + Isolated Firestore</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#26221E] leading-tight mb-6">
          A Private Space to Reflect, <br />
          <span className="text-[#5F6F52]">
            Think Clearly, & Converse with Gemini.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-[#685F56] mb-10 leading-relaxed">
          Express your uncensored thoughts, daily reflections, and strategic dilemmas. Gemini acts as an empathetic thought partner to summarize key takeaways, brainstorm options, and outline structured action steps.
        </p>

        {/* Error Alert if any */}
        {error && (
          <div className="max-w-md mx-auto mb-6 p-4 rounded-xl bg-[#FDF2F0] border border-[#EAC4BE] text-[#933B34] text-sm">
            {error}
          </div>
        )}

        {/* Sign In CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-16">
          <button
            id="landing-google-signin-btn"
            onClick={onSignIn}
            disabled={isLoading}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#2E2A25] hover:bg-[#1E1B18] text-[#FDFCF8] font-bold text-base flex items-center justify-center space-x-3 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-[#FDFCF8] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {/* Google "G" Icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
                <ArrowRight className="w-4 h-4 text-[#FDFCF8]" />
              </>
            )}
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-5xl mx-auto">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-white border border-[#E8E2D6] shadow-xs hover:border-[#DDD5C7] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#EFF3EE] border border-[#C8D6C9] flex items-center justify-center text-[#5F6F52] mb-4">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#2E2A25] mb-2">Multi-Turn AI Reflections</h3>
            <p className="text-sm text-[#685F56] leading-relaxed">
              Don't just write and forget. Engage in multi-turn dialogues with Gemini to deep-dive into dilemmas, explore blindspots, and clarify mental models.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-white border border-[#E8E2D6] shadow-xs hover:border-[#DDD5C7] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#F5EFE6] border border-[#E2D4C0] flex items-center justify-center text-[#936B3C] mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#2E2A25] mb-2">Isolated User Storage</h3>
            <p className="text-sm text-[#685F56] leading-relaxed">
              Every journal entry is sandboxed in Cloud Firestore under strict owner-only security rules (<code className="text-xs text-[#936B3C] font-mono">request.auth.uid == userId</code>).
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-white border border-[#E8E2D6] shadow-xs hover:border-[#DDD5C7] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#EFF2F5] border border-[#CAD4DD] flex items-center justify-center text-[#4A6478] mb-4">
              <BookText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#2E2A25] mb-2">Structured Summaries</h3>
            <p className="text-sm text-[#685F56] leading-relaxed">
              Automated title generation, executive summaries, mood detection, and actionable task lists so you can track personal progress over time.
            </p>
          </div>
        </div>

        {/* Security & Verification Badges */}
        <div className="mt-14 pt-8 border-t border-[#E8E2D6] flex flex-wrap items-center justify-center gap-6 text-xs text-[#7A7268]">
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#5F6F52]" />
            <span>Zero Password Storage (Firebase Federated Auth)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#5F6F52]" />
            <span>Server-side Secret Manager Integration</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#5F6F52]" />
            <span>Multi-Model Resilient Fallback Ladder</span>
          </div>
        </div>
      </div>
    </div>
  );
};
