import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getCurrentAccount, MockAccount } from '@/src/api/auth';

export function useAccount() {
  const [account, setAccount] = useState<MockAccount | null>(null);
  useFocusEffect(useCallback(() => { getCurrentAccount().then(setAccount); }, []));
  return account;
}
