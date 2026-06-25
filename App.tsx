import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>HEALZ MOBILE</Text>
      <Text style={styles.title}>Этап 0 готов</Text>
      <Text style={styles.body}>
        Expo-проект и среда разработки настроены. WebView и импорт документов
        будут добавлены следующими вертикальными срезами.
      </Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff8fa',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  eyebrow: {
    color: '#a94d6f',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    color: '#2d262e',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 14,
  },
  body: {
    color: '#655c63',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 420,
    textAlign: 'center',
  },
});
