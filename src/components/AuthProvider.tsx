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
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set persistence to LOCAL so the user stays logged in across sessions
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Check if user has an admin role in the users collection
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        setIsAdmin(userDoc.exists() && userDoc.data().role === 'admin');
        
        // Save user profile without overwriting existing role
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
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
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const mockLogin = (role: 'citizen' | 'admin', email?: string) => {
    const mockUser = {
      uid: role === 'admin' ? `mock_admin_${email ? email.replace(/[^a-zA-Z0-9]/g, '_') : 'default'}` : 'mock_citizen_uid',
      email: email || (role === 'admin' ? 'admin@city.gov' : 'citizen@civicpulse.org'),
      displayName: role === 'admin' ? (email ? email.split('@')[0].split('.').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Admin Officer') : 'Malav',
      photoURL: role === 'admin' ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${email || 'Admin'}` : 'https://api.dicebear.com/7.x/avataaars/svg?seed=Malav',
    } as any;
    setUser(mockUser);
    setIsAdmin(role === 'admin');
    setLoading(false);
  };

  const logout = async () => {
    if (user?.uid?.startsWith('mock_')) {
      setUser(null);
      setIsAdmin(false);
    } else {
      await signOut(auth);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, loginWithGoogle, loginWithEmail, logout, mockLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
