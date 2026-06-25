# Настройка проекта

## Установлено в рабочем окружении

- Node.js `24.18.0`;
- npm `11.17.0`;
- EAS CLI `20.3.0`;
- Temurin JDK `17.0.19`;
- Android SDK Platform 36 и 37;
- Android Build Tools 36 и 37;
- Android Platform Tools / ADB 37;
- `scrcpy 4.0`;
- Git, GitHub CLI, FFmpeg, `pdfinfo`, Chrome и VS Code.

## Требует ручного действия

### Expo/EAS

```bash
eas login
eas whoami
```

Вход интерактивный, поэтому токен или пароль нельзя сохранять в репозитории.

### Физический телефон

1. Включить Developer options.
2. Включить USB debugging.
3. Подключить телефон по USB.
4. Подтвердить RSA fingerprint на телефоне.
5. Проверить:

```bash
adb devices -l
```

Статус устройства должен быть `device`, а не `unauthorized`.

## Что сознательно не установлено

- Android Emulator: используется физический телефон.
- Android Studio: текущего CLI toolchain достаточно для разработки и сборки;
  IDE можно добавить позже при необходимости нативной Kotlin-отладки.
- Maestro: будет добавлен, когда появится стабильный end-to-end сценарий.
- OBS: демонстрацию можно записывать встроенной записью телефона или `scrcpy`.

## Замечание по npm audit

Чистый Expo SDK 56 шаблон сообщает о транзитивных moderate advisory в
инструментах Expo/config plugins. Автоматический `npm audit fix --force`
предлагает несовместимый downgrade Expo и поэтому не применяется. Состояние
нужно повторно проверить перед release.
