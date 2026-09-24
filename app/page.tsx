'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Sun and Moon icons for theme toggle
const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const MoonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

// Theme Toggle Component
const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
      title="Toggle theme"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <MoonIcon />
      ) : (
        <SunIcon />
      )}
    </button>
  );
};

// Stat Card Component
const StatCard = ({ value, label }: { value: string; label: string }) => (
  <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-lg rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
    <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
      {value}
    </div>
    <div className="text-sm text-slate-500 dark:text-slate-400">
      {label}
    </div>
  </div>
);

// Feature Card Component
const FeatureCard = ({ title, description }: { title: string; description: string }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow duration-200">
    <h3 className="text-lg font-semibold text-blue-500 dark:text-blue-400 mb-3">
      {title}
    </h3>
    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
      {description}
    </p>
  </div>
);

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Navigation */}
      <header className="sticky top-0 z-10 backdrop-blur-lg bg-slate-50/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500 dark:bg-blue-400 flex items-center justify-center text-white font-bold text-lg">
                S
              </div>
              <span className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                Scheduology
              </span>
            </Link>

            {/* Navigation Links */}
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-500 dark:hover:text-blue-400 rounded-lg transition-colors duration-200"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 dark:bg-blue-400 dark:hover:bg-blue-500 dark:text-slate-900"
              >
                Create account
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
              Built for students who cannot afford a surprise on the attendance sheet
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-bold text-slate-800 dark:text-slate-100 leading-tight">
              Know, before finals week, whether you can sit the exam.
            </h1>
            
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-lg">
              Enter your real weekly timetable once. Scheduology counts every lecture of the semester,
              skips weekends and public holidays, and tells you — course by course — how many classes
              you still need to attend to stay above your university&apos;s requirement.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors duration-200 dark:bg-blue-400 dark:hover:bg-blue-500 dark:text-slate-900"
              >
                Start with your semester
              </Link>
              <Link
                href="/login"
                className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200"
              >
                I already have an account
              </Link>
              <button
                type="button"
                className="px-6 py-3 bg-blue-500/10 dark:bg-blue-400/20 text-blue-500 dark:text-blue-400 font-semibold rounded-lg hover:bg-blue-500/20 dark:hover:bg-blue-400/30 transition-colors duration-200"
              >
                Open a sample semester
              </button>
            </div>
          </div>

          {/* Right Card */}
          <div className="glass-card rounded-2xl p-8 shadow-lg">
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
              Example · Calculus I · 75% required
            </p>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              39 of 52 lectures
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              That&apos;s the floor. Miss more than 13 and you are not eligible, no matter how well you write the paper.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <StatCard value="12" label="attended so far" />
              <StatCard value="27" label="still to attend" />
              <StatCard value="11" label="you can still miss" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            title="Your timetable, not a guess"
            description="Upload a photo or PDF as a reference, then place each course on the week. The count comes from that grid — not from tapping +1 and hoping."
          />
          <FeatureCard
            title="Holidays are already out"
            description="Weekends, public holidays, midterms, and finals are removed from the teaching calendar. Add cancelled lectures or extra university holidays when they happen."
          />
          <FeatureCard
            title="A calm daily check-in"
            description="Each day you simply say whether you were in the room, away, or the class itself was cancelled. No counters. No jargon."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        <p>
          Scheduology keeps your data on this device. A companion app can come later — the same semester logic will travel with you.
        </p>
      </footer>
    </main>
  );
}
