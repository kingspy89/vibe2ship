import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MapPin, Lock, Mail, Loader2, User as UserIcon, ShieldCheck, AlertCircle, Building2 } from 'lucide-react';

export function Login() {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Tab: 'citizen' or 'official'
  const [activeTab, setActiveTab] = useState<'citizen' | 'official'>('citizen');
  // Mode: 'signin' or 'register'
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  React.useEffect(() => {
    if (user) {
      if (isAdmin) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    }
  }, [user, isAdmin, navigate]);

  const parseFirebaseError = (err: any): string => {
    const code = err?.code || '';
    const message = err?.message || '';

    if (code === 'auth/unauthorized-domain') {
      const currentHost = window.location.hostname;
      return `Domain "${currentHost}" is not authorized in your Firebase Project (civicpulse-app-9bdfd). Please add "${currentHost}" to Firebase Console -> Authentication -> Settings -> Authorized Domains, or sign in / register with Email & Password below.`;
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google Sign-In was cancelled.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password. Please verify your credentials or register a new account.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'This email address is already in use. Please sign in instead.';
    }
    if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters.';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    return message || 'Authentication failed. Please check your credentials and try again.';
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      setInfoMessage('');
      await loginWithGoogle();
      navigate('/');
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setError(parseFirebaseError(err));
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      setError('');
      setInfoMessage('');

      const normalizedEmail = email.toLowerCase().trim();

      if (authMode === 'register') {
        const targetRole = activeTab === 'official' ? 'admin' : 'citizen';
        await registerWithEmail(normalizedEmail, password, targetRole, displayName.trim());
        setInfoMessage('Account registered successfully! Redirecting...');
      } else {
        await loginWithEmail(normalizedEmail, password);
      }
      
      if (activeTab === 'official') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error("Email Auth Error:", err);
      setError(parseFirebaseError(err));
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 space-y-6 px-4">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-1">
          <MapPin className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">CivicPulse AI</h1>
        <p className="text-slate-400 text-sm">Real-time civic intelligence, reporting, and triage platform.</p>
      </div>

      {/* Role Tabs */}
      <div className="grid grid-cols-2 p-1 bg-[#161722] border border-slate-800 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setActiveTab('citizen');
            setError('');
          }}
          className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'citizen'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserIcon className="h-4 w-4" />
          Citizen Portal
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('official');
            setError('');
          }}
          className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'official'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Municipal Authority
        </button>
      </div>

      <Card className="bg-[#1C1D26] border-slate-800/80 shadow-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-white text-xl font-bold flex items-center justify-between">
            <span>
              {activeTab === 'citizen' ? 'Citizen Account' : 'Authority Officer Access'}
            </span>
            <span className="text-xs font-normal text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              {authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </span>
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            {activeTab === 'citizen'
              ? (authMode === 'signin' ? 'Sign in to submit reports and track city resolution progress.' : 'Register as a citizen to help improve your neighborhood.')
              : (authMode === 'signin' ? 'Authorized access for municipal officers and administrators.' : 'Register as an authorized city inspector or officer.')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error / Alert banner */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2 leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Google OAuth Option (Citizen Portal) */}
          {activeTab === 'citizen' && (
            <>
              <Button 
                onClick={handleGoogleLogin} 
                disabled={loading}
                type="button"
                className="w-full bg-[#12131A] text-slate-200 border border-slate-700/80 hover:bg-slate-800/70 transition-all font-medium py-5"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" /> : (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                Sign in with Google
              </Button>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-[#1C1D26] px-3 text-[11px] text-slate-500 uppercase tracking-wider">
                  or email login
                </span>
                <div className="border-t border-slate-800 w-full" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            {authMode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {activeTab === 'official' ? 'Full Name & Designation' : 'Full Name'}
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input 
                    type="text"
                    required
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full pl-9 rounded-lg border border-slate-800 bg-[#12131A] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/50" 
                    placeholder={activeTab === 'official' ? 'Inspector R. Sharma (Ward 12)' : 'Alex Rivera'} 
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                {activeTab === 'official' ? 'Official Department Email' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-9 rounded-lg border border-slate-800 bg-[#12131A] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/50" 
                  placeholder={activeTab === 'official' ? 'officer@city.gov' : 'citizen@example.com'} 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input 
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 rounded-lg border border-slate-800 bg-[#12131A] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/50" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 mt-2 transition-colors shadow-lg shadow-indigo-600/20" 
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
              ) : authMode === 'register' ? (
                `Create ${activeTab === 'official' ? 'Authority' : 'Citizen'} Account`
              ) : (
                `Sign In as ${activeTab === 'official' ? 'Authority' : 'Citizen'}`
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col items-center justify-center border-t border-slate-800/80 pt-4 pb-4">
          <button 
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'signin' ? 'register' : 'signin');
              setError('');
            }} 
            className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors font-medium"
          >
            {authMode === 'signin' 
              ? "Don't have an account yet? Register here" 
              : "Already have an account? Sign in here"}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
