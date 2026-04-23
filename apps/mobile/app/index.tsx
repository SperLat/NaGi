import { Redirect } from 'expo-router';

// Step 4 will check real auth state; for now always redirect to sign-in
export default function Index() {
  return <Redirect href="/(auth)/sign-in" />;
}
