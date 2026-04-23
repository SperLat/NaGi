import { createContext, useContext, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { getElder, type Elder } from '@/features/elders';
import { useSession } from '@/state';

interface ElderCtx {
  elder: Elder | null;
  textSize: 'lg' | 'xl' | '2xl';
  highContrast: boolean;
  orgId: string;
}

const Ctx = createContext<ElderCtx>({
  elder: null,
  textSize: 'xl',
  highContrast: false,
  orgId: '',
});

export function useElderCtx() {
  return useContext(Ctx);
}

export default function ElderLayout() {
  const { activeElderId, activeOrgId } = useSession();
  const [elder, setElder] = useState<Elder | null>(null);

  useEffect(() => {
    if (!activeElderId) return;
    getElder(activeElderId).then(({ data }) => setElder(data));
  }, [activeElderId]);

  const ctx: ElderCtx = {
    elder,
    textSize: (elder?.ui_config.text_size ?? 'xl') as 'lg' | 'xl' | '2xl',
    highContrast: elder?.ui_config.high_contrast ?? false,
    orgId: activeOrgId ?? '',
  };

  return (
    <Ctx.Provider value={ctx}>
      <Stack screenOptions={{ headerShown: false }} />
    </Ctx.Provider>
  );
}
