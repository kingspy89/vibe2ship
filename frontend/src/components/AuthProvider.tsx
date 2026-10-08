import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  User, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  userRole: 'citizen' | 'admin';
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, role?: 'citizen' | 'admin', displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'citizen' | 'admin'>('citizen');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Safety fallback: ensure loading spinner never hangs indefinitely
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    // Configure session persistence
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn("Could not set auth persistence:", err);
    });

    // Handle redirect result (for Google Sign-In redirect fallback)
    getRedirectResult(auth).catch((err) => {
      // Silently handle — redirect result is only available after a redirect flow
      if (err?.code !== 'auth/null-user') {
        console.warn("Redirect result check:", err?.code || err);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          try {
            const userRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userRef);

            let role: 'citizen' | 'admin' = 'citizen';
            if (userDoc.exists()) {
              const data = userDoc.data();
              role = data?.role === 'admin' ? 'admin' : 'citizen';
              // Update last login
              await setDoc(userRef, { lastLogin: Date.now() }, { merge: true });
            } else {
              // Provision initial profile in Firestore
              await setDoc(userRef, {
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Citizen'),
                photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
                role: role,
                points: 0,
                reports_count: 0,
                verifications_count: 0,
                createdAt: Date.now(),
                lastLogin: Date.now()
              }, { merge: true });
            }

            setIsAdmin(role === 'admin');
            setUserRole(role);
          } catch (dbErr) {
            console.error("Firestore user profile fetch/init error:", dbErr);
            // Default to citizen if Firestore fetch fails
            setIsAdmin(false);
            setUserRole('citizen');
          }
        } else {
          setIsAdmin(false);
          setUserRole('citizen');
        }
      } catch (err) {
        console.error("Auth state transition error:", err);
      } finally {
        setLoading(false);
        clearTimeout(timer);
      }
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      // Try popup first (works on localhost and whitelisted domains)
      await signInWithPopup(auth, provider);
    } catch (popupErr: any) {
      // If popup fails due to unauthorized domain, try redirect flow
      if (popupErr?.code === 'auth/unauthorized-domain') {
        console.warn("Popup blocked for this domain, falling back to redirect...");
        await signInWithRedirect(auth, provider);
        return;
      }
      // Re-throw other errors (e.g., popup closed by user)
      throw popupErr;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, role: 'citizen' | 'admin' = 'citizen', displayName?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const resolvedName = displayName || (email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1));
    
    try {
      await updateProfile(cred.user, {
        displayName: resolvedName,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(resolvedName)}`
      });
    } catch (profileErr) {
      console.warn("Could not set display name on auth profile:", profileErr);
    }

    // Persist user role and profile to Firestore
    await setDoc(doc(db, 'users', cred.user.uid), {
      email,
      displayName: resolvedName,
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(resolvedName)}`,
      role,
      points: 0,
      reports_count: 0,
      verifications_count: 0,
      createdAt: Date.now(),
      lastLogin: Date.now()
    }, { merge: true });

    setIsAdmin(role === 'admin');
    setUserRole(role);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setIsAdmin(false);
    setUserRole('citizen');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAdmin, 
      userRole,
      loading, 
      loginWithGoogle, 
      loginWithEmail, 
      registerWithEmail, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
