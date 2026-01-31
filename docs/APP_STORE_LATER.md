# Публикация в App Store (iOS) — на потом

Текущий план ориентирован на Android и RuStore. Когда будете готовы к публикации в App Store:

1. **Apple Developer Account:** зарегистрироваться на [developer.apple.com](https://developer.apple.com) ($99/год).
2. **Сборка iOS:** в папке `mobile` выполнить `eas build --platform ios --profile production` (нужен Mac или EAS Build в облаке).
3. **Материалы:** иконка 1024×1024, скриншоты для разных размеров iPhone, описание на русском и английском, политика конфиденциальности, возрастная категория.
4. **App Store Connect:** создать приложение, загрузить сборку через Transporter или Xcode, заполнить карточку и отправить на модерацию.

Веб-приложение и Android-приложение при этом не меняются.
