
'use client';

import { User, UserRole } from './types';

type ManagedUser = User & { password?: string };

const INITIAL_MOCK_USERS: Record<string, ManagedUser> = {
  'user@nutrisnap.com': {
    id: '1',
    name: 'Alex Johnson',
    email: 'user@nutrisnap.com',
    role: 'USER',
    onboarded: false,
    password: 'password123'
  },
  'admin@nutrisnap.com': {
    id: '2',
    name: 'Nutri Admin',
    email: 'admin@nutrisnap.com',
    role: 'ADMIN',
    onboarded: true,
    password: 'password123'
  },
};

const STORAGE_KEY = 'nutrisnap_managed_users';

export function getManagedUsers(): ManagedUser[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    // Initialize with defaults if empty
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

export function getMockUser(email: string, password?: string): User | null {
  const users = getManagedUsers();
  // We find the user by email
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  // Optional: In a full implementation, we would check password here
  // if (password && user?.password !== password) return null;
  
  return user || null;
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
