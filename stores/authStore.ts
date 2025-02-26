import { create } from 'zustand';
import { User, UserRole } from '../types/auth';
import { auth } from '../lib/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setError: (error: string | null) => void;
}

const createUserProfile = (firebaseUser: FirebaseUser): User => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  subscription: {
    role: 'free' as UserRole,
  },
});

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  signUp: async (email: string, password: string) => {
    try {
      set({ error: null, loading: true });
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
      const user = createUserProfile(firebaseUser);
      set({ user, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  signIn: async (email: string, password: string) => {
    try {
      set({ error: null, loading: true });
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
      const user = createUserProfile(firebaseUser);
      set({ user, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  signOut: async () => {
    try {
      await firebaseSignOut(auth);
      set({ user: null, error: null });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
  setError: (error) => set({ error }),
}));

// Set up auth state listener
onAuthStateChanged(auth, (firebaseUser) => {
  useAuthStore.setState({
    user: firebaseUser ? createUserProfile(firebaseUser) : null,
    loading: false,
  });
});