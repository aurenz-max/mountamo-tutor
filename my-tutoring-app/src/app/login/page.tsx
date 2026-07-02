// app/login/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle, Sparkles, ArrowLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GenerativeBackground } from '@/components/lumina/primitives/GenerativeBackground';
import {
  LuminaMark,
  LuminaCard,
  LuminaCardContent,
  LuminaButton,
  LuminaInput,
  LuminaBadge,
} from '@/components/lumina/ui';

const LoginPage: React.FC = () => {
  const searchParams = useSearchParams();
  // Deep-link into signup from the landing page / in-app "save progress" prompt
  // via ?mode=signup. Everything else opens in sign-in mode.
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('K');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { login, register, user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in — honors ?redirect= (the lesson the visitor
  // was in before signing up), falling back to the Lumina experience.
  // `replace` (not push) so this hand-off page never lands in history.
  useEffect(() => {
    if (user) {
      const redirect = searchParams.get('redirect');
      router.replace(redirect || '/lumina');
    }
  }, [user, router, searchParams]);

  const gradeLevels = [
    { value: 'K', label: 'Kindergarten' },
    { value: '1st', label: 'Grade 1' },
    { value: '2nd', label: 'Grade 2' },
    { value: '3rd', label: 'Grade 3' },
    { value: '4th', label: 'Grade 4' },
    { value: '5th', label: 'Grade 5' },
    { value: '6th', label: 'Grade 6' },
    { value: '7th', label: 'Grade 7' },
    { value: '8th', label: 'Grade 8' },
    { value: '9th', label: 'Grade 9' },
    { value: '10th', label: 'Grade 10' },
    { value: '11th', label: 'Grade 11' },
    { value: '12th', label: 'Grade 12' },
  ];

  const validateForm = () => {
    if (!email || !password) {
      setError('Email and password are required');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (!isLogin) {
      if (!displayName.trim()) {
        setError('Display name is required');
        return false;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return false;
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return false;
      }

      // Password strength validation
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);

      if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        setError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        setSuccess('Welcome back! Redirecting...');

        setTimeout(() => {
          const redirect = searchParams.get('redirect');
          router.push(redirect || '/lumina');
        }, 1000);
      } else {
        await register(email, password, displayName, gradeLevel);
        setSuccess('Account created! Taking you to your lesson...');

        setTimeout(() => {
          const redirect = searchParams.get('redirect');
          router.push(redirect || '/lumina');
        }, 1000);
      }
    } catch (error: any) {
      console.error('Auth error:', error);

      // Handle specific Firebase errors
      if (error.message.includes('auth/user-not-found')) {
        setError('No account found with this email address');
      } else if (error.message.includes('auth/wrong-password')) {
        setError('Incorrect password');
      } else if (error.message.includes('auth/email-already-in-use')) {
        setError('An account with this email already exists');
      } else if (error.message.includes('auth/weak-password')) {
        setError('Password is too weak');
      } else if (error.message.includes('auth/invalid-email')) {
        setError('Invalid email address');
      } else if (error.message.includes('auth/too-many-requests')) {
        setError('Too many failed attempts. Please try again later');
      } else {
        setError(error.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
  };

  // Already signed in — render a clean, on-brand hand-off instead of the form.
  // The effect above forwards to /lumina (or the carried ?redirect= lesson), so
  // a signed-in visitor never sees the login form flash.
  if (user) {
    return (
      <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden text-slate-100">
        <div aria-hidden className="fixed inset-0 -z-20 bg-slate-950" />
        <GenerativeBackground color="#8b5cf6" intensity={0.4} />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <LuminaMark size={48} progress={100} />
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Taking you to Lumina…
          </p>
        </div>
      </div>
    );
  }

  // Shared glass field styling for the native <select> (no LuminaInput equivalent).
  const selectClass =
    'w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-slate-100 transition-colors ' +
    'focus:outline-none focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20 disabled:opacity-60';
  const labelClass = 'block text-sm font-medium text-slate-300 mb-1.5';

  return (
    <div className="dark relative min-h-screen overflow-x-hidden text-slate-100 selection:bg-purple-500/30">
      {/* Shared canvas — same background the landing + app run on, so signup
          feels like one continuous product. */}
      <div aria-hidden className="fixed inset-0 -z-20 bg-slate-950" />
      <GenerativeBackground color="#8b5cf6" intensity={0.4} />

      {/* Back to the front door */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="relative z-10 flex min-h-[calc(100vh-140px)] items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="mb-8 flex flex-col items-center text-center">
            <Link href="/" className="mb-4 inline-flex">
              <LuminaMark size={48} />
            </Link>
            <LuminaBadge accent="purple" className="mb-4 gap-1.5 px-3 py-1 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Adaptive learning for K–5
            </LuminaBadge>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {isLogin
                ? 'Sign in to pick up where you left off.'
                : 'Save your progress and let every lesson adapt to you.'}
            </p>
          </div>

          <LuminaCard surface="elevated">
            <LuminaCardContent className="p-8">
              {error && (
                <div className="mb-4 flex items-center rounded-lg border border-rose-400/30 bg-rose-500/10 p-3">
                  <AlertCircle className="mr-2 h-4 w-4 flex-shrink-0 text-rose-400" />
                  <span className="text-sm text-rose-200">{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-4 flex items-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
                  <CheckCircle className="mr-2 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  <span className="text-sm text-emerald-200">{success}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label htmlFor="displayName" className={labelClass}>
                      Full Name
                    </label>
                    <LuminaInput
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full"
                      placeholder="Enter your full name"
                      disabled={loading}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="email" className={labelClass}>
                    Email Address
                  </label>
                  <LuminaInput
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full"
                    placeholder="your@email.com"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className={labelClass}>
                    Password
                  </label>
                  <div className="relative">
                    <LuminaInput
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pr-10"
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {!isLogin && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      At least 8 characters with uppercase, lowercase, and numbers
                    </p>
                  )}
                </div>

                {!isLogin && (
                  <>
                    <div>
                      <label htmlFor="confirmPassword" className={labelClass}>
                        Confirm Password
                      </label>
                      <LuminaInput
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full"
                        placeholder="••••••••"
                        disabled={loading}
                      />
                    </div>

                    <div>
                      <label htmlFor="gradeLevel" className={labelClass}>
                        Grade Level
                      </label>
                      <select
                        id="gradeLevel"
                        value={gradeLevel}
                        onChange={(e) => setGradeLevel(e.target.value)}
                        className={selectClass}
                        disabled={loading}
                      >
                        {gradeLevels.map((grade) => (
                          <option key={grade.value} value={grade.value} className="bg-slate-900">
                            {grade.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <LuminaButton
                  type="submit"
                  tone="primary"
                  size="lg"
                  disabled={loading}
                  className="w-full gap-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isLogin ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : isLogin ? (
                    'Sign In'
                  ) : (
                    'Create Account'
                  )}
                </LuminaButton>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-400">
                  {isLogin ? "Don't have an account?" : 'Already have an account?'}
                  <button
                    onClick={toggleMode}
                    className="ml-1.5 font-medium text-cyan-300 transition-colors hover:text-cyan-200"
                    disabled={loading}
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>

              {isLogin && (
                <div className="mt-3 text-center">
                  <button className="text-sm text-slate-500 transition-colors hover:text-slate-300">
                    Forgot your password?
                  </button>
                </div>
              )}
            </LuminaCardContent>
          </LuminaCard>

          <p className="mt-6 text-center text-xs text-slate-500">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="text-slate-400 underline hover:text-slate-200">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-slate-400 underline hover:text-slate-200">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
