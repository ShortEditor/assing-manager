'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { SessionUser } from '@/types';

const SESSION_KEY = 'marks_tracker_session';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  loginAdmin: (email: string, password: string) => Promise<void>;
  loginStaff: (staffCode: string, pin: string) => Promise<void>;
  loginStudent: (rollNo: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SessionUser;
        if (parsed.role !== 'super_admin') {
          setUser(parsed);
          setLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
        if (adminDoc.exists()) {
          const session: SessionUser = {
            id: firebaseUser.uid,
            name: adminDoc.data().name ?? firebaseUser.displayName ?? 'Admin',
            role: 'super_admin',
          };
          setUser(session);
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } else {
          await firebaseSignOut(auth);
          setUser(null);
        }
      } else {
        const stored2 = localStorage.getItem(SESSION_KEY);
        if (!stored2) setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginAdmin = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const adminDoc = await getDoc(doc(db, 'admins', cred.user.uid));
      if (!adminDoc.exists()) {
        await firebaseSignOut(auth);
        throw new Error('Account not registered as admin. Contact HOD.');
      }
      const session: SessionUser = {
        id: cred.user.uid,
        name: adminDoc.data().name ?? email,
        role: 'super_admin',
      };
      setUser(session);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      const clean = msg.replace('Firebase: ', '').replace(/\(auth\/.*?\)\.?/, '').trim();
      setError(clean);
      throw err;
    }
  }, []);

  const loginStaff = useCallback(async (staffCode: string, pin: string) => {
    setError(null);
    try {
      const q = query(
        collection(db, 'staff'),
        where('staffCode', '==', staffCode.trim().toUpperCase()),
        where('pin', '==', pin.trim())
      );
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('Invalid Staff ID or PIN. Please try again.');
      const data = snap.docs[0].data();
      const session: SessionUser = {
        id: snap.docs[0].id,
        name: data.name,
        role: 'staff',
        subjects: data.subjects ?? [],
        staffCode: data.staffCode,
      };
      setUser(session);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      throw err;
    }
  }, []);

  const loginStudent = useCallback(async (rollNo: string) => {
    setError(null);
    try {
      const q = query(
        collection(db, 'students'),
        where('rollNo', '==', rollNo.trim().toUpperCase())
      );
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('Invalid Roll Number. Please try again.');
      const data = snap.docs[0].data();
      const session: SessionUser = {
        id: snap.docs[0].id,
        name: data.name,
        role: 'student',
        rollNo: data.rollNo,
        class: data.class,
        year: data.year,
        semester: data.semester,
        section: data.section,
      };
      setUser(session);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    const role = user?.role;
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    if (role === 'super_admin') await firebaseSignOut(auth);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, loginAdmin, loginStaff, loginStudent, logout, error, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
