'use client';

import { User } from './types';

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
