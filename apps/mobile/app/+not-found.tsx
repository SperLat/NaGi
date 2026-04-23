import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFound() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-6xl mb-4">凪</Text>
        <Text className="text-xl font-semibold text-gray-800 mb-2">
          Page not found
        </Text>
        <Link href="/">
          <Text className="text-accent-600 font-medium mt-4">Go home</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
