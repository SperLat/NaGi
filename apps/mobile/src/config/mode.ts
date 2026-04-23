export const MODE = process.env.EXPO_PUBLIC_MOCK_MODE === 'true' ? 'mock' : 'real';
export const isMock = MODE === 'mock';
