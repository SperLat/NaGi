import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OrganizationScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-6">
        <Text className="text-2xl font-bold text-gray-900 mb-1">Organization</Text>
        <Text className="text-gray-500 text-sm">Step 4 wires org membership here.</Text>
      </View>
    </SafeAreaView>
  );
}
