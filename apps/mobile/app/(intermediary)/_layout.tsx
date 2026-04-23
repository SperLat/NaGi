import { Stack } from 'expo-router';

export default function IntermediaryLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'My Elders' }} />
      <Stack.Screen name="organization" options={{ title: 'Organization' }} />
      <Stack.Screen name="elders/[id]/index" options={{ title: 'Elder' }} />
      <Stack.Screen name="elders/[id]/configure" options={{ title: 'Configure' }} />
      <Stack.Screen name="elders/[id]/activity" options={{ title: 'Activity' }} />
    </Stack>
  );
}
