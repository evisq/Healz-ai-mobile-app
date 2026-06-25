# Healz Mobile

Кроссплатформенная мобильная оболочка над публичным
[`app.healz.ai`](https://app.healz.ai) с нативным импортом и локальной
подготовкой медицинских документов.

Сейчас завершён этап 0: окружение, Expo-проект, критерии приёмки и безопасные
тестовые файлы. WebView и Share Intent пока не реализованы.

## Стек

- Expo SDK 56;
- React Native 0.85;
- React 19;
- TypeScript 6;
- EAS Build для Android APK.

Архитектурный план и обоснование выбора стека находятся в [PLAN.md](PLAN.md).

## Требования к окружению

- Node.js 24 LTS;
- npm 11;
- JDK 17;
- Android SDK Platform 36;
- Android Build Tools 36;
- Android Platform Tools (`adb`);
- физический Android-телефон с USB debugging.

Проверить окружение:

```bash
node --version
npm --version
java -version
adb version
```

## Запуск

```bash
npm install
npm start
```

Для запуска на подключённом Android-телефоне:

```bash
adb devices -l
npm run android
```

На этапе с нативным Share Intent будет использоваться development build, а не
Expo Go.

## Проверки

```bash
npm run typecheck
npm run doctor
npm run check
```

## APK

Перед первой сборкой необходимо вручную войти в Expo:

```bash
eas login
eas whoami
```

Профиль `preview` уже настроен на выпуск устанавливаемого APK:

```bash
eas build --platform android --profile preview
```

## Документация

- [Критерии приёмки](docs/ACCEPTANCE.md)
- [Настройка и ручные предпосылки](docs/SETUP.md)
- [Журнал работы AI-агента](docs/agent-log.md)
- [Тестовые документы](test-fixtures/README.md)

## Приватность

В репозиторий нельзя добавлять настоящие медицинские документы, email,
OTP-коды, cookies, access tokens и другие персональные данные. Все fixtures
синтетические и явно помечены как тестовые.
