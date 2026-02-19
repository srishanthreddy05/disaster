'use client';

import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { AuthContextType } from '@/lib/types';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);


  
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
