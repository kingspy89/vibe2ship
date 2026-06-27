import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  mockLogin?: (role: 'citizen' | 'admin', email?: string) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const getStoredMockUser = () => {
    try {
      const stored = localStorage.getItem('civicpulse_mock_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const initialMockUser = getStoredMockUser();
  const [user, setUser] = useState<User | null>(initialMockUser);
  const [isAdmin, setIsAdmin] = useState(initialMockUser ? initialMockUser.role === 'admin' : false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If a mock user is already loaded from local storage, skip Firebase auth checks
    const mock = localStorage.getItem('civicpulse_mock_user');
    if (mock) {
      setLoading(false);
      return;
    }

    // Set persistence to LOCAL so the user stays logged in across sessions
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // If a mock login occurred in the meantime, ignore this trigger
      if (localStorage.getItem('civicpulse_mock_user')) return;

      setUser(firebaseUser);
      if (firebaseUser) {
        // Check if user has an admin role in the users collection
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        setIsAdmin(userDoc.exists() && userDoc.data().role === 'admin');
        
        // Save user profile without overwriting existing role
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          lastLogin: Date.now()
        }, { merge: true });
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    localStorage.removeItem('civicpulse_mock_user');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    localStorage.removeItem('civicpulse_mock_user');
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const mockLogin = (role: 'citizen' | 'admin', email?: string) => {
    const mockUser = {
      uid: role === 'admin' ? `mock_admin_${email ? email.replace(/[^a-zA-Z0-9]/g, '_') : 'default'}` : 'mock_citizen_uid',
      email: email || (role === 'admin' ? 'admin@city.gov' : 'citizen@civicpulse.org'),
      displayName: role === 'admin' ? (email ? email.split('@')[0].split('.').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Admin Officer') : 'Malav',
      photoURL: role === 'admin' ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${email || 'Admin'}` : 'https://api.dicebear.com/7.x/avataaars/svg?seed=Malav',
      role: role
    } as any;
    
    localStorage.setItem('civicpulse_mock_user', JSON.stringify(mockUser));
    setUser(mockUser);
    setIsAdmin(role === 'admin');
    setLoading(false);
  };

  const logout = async () => {
    localStorage.removeItem('civicpulse_mock_user');
    await signOut(auth);
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, loginWithGoogle, loginWithEmail, logout, mockLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
