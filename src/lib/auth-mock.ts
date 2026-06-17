
'use client';

import { User, UserRole } from './types';

const MOCK_USERS: Record<string, User> = {
  'user@nutrisnap.com': {
    id: '1',
    name: 'Alex Johnson',
    email: 'user@nutrisnap.com',
    role: 'USER',
    onboarded: false,
  },
  'admin@nutrisnap.com': {
    id: '2',
    name: 'Nutri Admin',
    email: 'admin@nutrisnap.com',
    role: 'ADMIN',
    onboarded: true,
  },
};

export function getMockUser(email: string): User | null {
  return MOCK_USERS[email] || null;
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
