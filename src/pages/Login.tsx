import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MapPin, Lock, Mail, Loader2 } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export function Login() {
  const { loginWithGoogle, loginWithEmail, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  if (user) {
    navigate('/');
  }

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      await loginWithGoogle();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to login with Google');
      setLoading(false);
    }
  };

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      setLoading(true);
      setError('');
      if (isRegistering) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', cred.user.uid), { email, role: 'admin' }, { merge: true });
      } else {
        await loginWithEmail(email, password);
      }
      navigate('/admin');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to authenticate');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 space-y-6">
      <div className="text-center space-y-2 mb-8">
        <MapPin className="h-12 w-12 text-indigo-600 mx-auto" />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Civic Issue Tracker</h1>
        <p className="text-slate-500">Report, track, and solve community issues.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Citizen Login</CardTitle>
          <CardDescription>Join your community to report issues and track progress.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleGoogleLogin} 
            disabled={loading}
            className="w-full bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-indigo-600" />
            Authority {isRegistering ? 'Registration' : 'Login'}
          </CardTitle>
          <CardDescription>For city officials and admins only.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdminAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-9 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600" 
                  placeholder="admin@city.gov" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600" 
                  placeholder="••••••••" 
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isRegistering ? "Register Admin" : "Sign In")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-slate-100 pt-4">
          <button 
            type="button"
            onClick={() => setIsRegistering(!isRegistering)} 
            className="text-xs text-indigo-600 hover:underline"
          >
            {isRegistering ? "Already have an admin account? Sign in" : "Need to register an admin account?"}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
