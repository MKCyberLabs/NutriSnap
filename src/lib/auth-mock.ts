
'use client';

import { User, UserRole } from './types';

type ManagedUser = User & { password?: string };

const INITIAL_MOCK_USERS: Record<string, ManagedUser> = {
  'admin@mkcyberlabs.in': {
    id: 'admin-1',
    name: 'MK CyberLabs Admin',
    email: 'admin@mkcyberlabs.in',
    role: 'ADMIN',
    onboarded: true,
    password: 'ProductionPassword123!'
  },
  'user@nutrisnap.com': {
    id: '1',
    name: 'Alex Johnson',
    email: 'user@nutrisnap.com',
    role: 'USER',
    onboarded: true,
    password: 'ProductionPassword123!'
  },
};

const STORAGE_KEY = 'nutrisnap_managed_users';

export function getManagedUsers(): ManagedUser[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const initial = Object.values(INITIAL_MOCK_USERS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(stored);
}

export function saveManagedUsers(users: ManagedUser[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }
}

/**
 * Prototype Authentication Helper
 * Checks credentials against the local managed user registry.
 */
export function authenticateUser(email: string, password?: string): ManagedUser | null {
  const users = getManagedUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (user && user.password === password) {
    return user;
  }
  
  return null;
}

export function saveAuthSession(user: User) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nutrisnap_user', JSON.stringify(user));
  }
}

export function getAuthSession(): User | null {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('nutrisnap_user');
    return saved ? JSON.parse(saved) : null;
  }
  return null;
}

export function clearAuthSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('nutrisnap_user');
  }
}
