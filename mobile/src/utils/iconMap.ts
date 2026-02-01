import { Ionicons } from "@expo/vector-icons";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// Маппинг Lucide иконок на Ionicons
export const LUCIDE_TO_IONICONS: Record<string, IoniconsName> = {
  // Еда и напитки
  Utensils: "restaurant-outline",
  Pizza: "pizza-outline",
  Coffee: "cafe-outline",
  Beer: "beer-outline",
  Cake: "ice-cream-outline",
  Salad: "nutrition-outline",
  Wine: "wine-outline",
  
  // Транспорт
  Car: "car-outline",
  Bus: "bus-outline",
  Train: "train-outline",
  Bike: "bicycle-outline",
  Plane: "airplane-outline",
  Fuel: "speedometer-outline",
  
  // Развлечения
  Film: "film-outline",
  Gamepad2: "game-controller-outline",
  Music: "musical-notes-outline",
  Tv: "tv-outline",
  
  // Здоровье
  Hospital: "medkit-outline",
  Pill: "medical-outline",
  Heart: "heart-outline",
  Dumbbell: "barbell-outline",
  
  // Одежда и покупки
  Shirt: "shirt-outline",
  ShoppingCart: "cart-outline",
  Gift: "gift-outline",
  Tag: "pricetag-outline",
  
  // Дом
  Home: "home-outline",
  Lightbulb: "bulb-outline",
  Plug: "flash-outline",
  Thermometer: "thermometer-outline",
  Wrench: "hammer-outline",
  
  // Финансы
  Wallet: "wallet-outline",
  CreditCard: "card-outline",
  Briefcase: "briefcase-outline",
  BarChart3: "bar-chart-outline",
  TrendingUp: "trending-up-outline",
  
  // Образование
  GraduationCap: "school-outline",
  BookOpen: "book-outline",
  
  // Технологии
  Smartphone: "phone-portrait-outline",
  Laptop: "laptop-outline",
  Camera: "camera-outline",
  
  // Общее
  Package: "cube-outline",
  Umbrella: "umbrella-outline",
  Palette: "color-palette-outline",
  Star: "star-outline",
  Bookmark: "bookmark-outline",
  Bell: "notifications-outline",
  Calendar: "calendar-outline",
  Clock: "time-outline",
  Settings: "settings-outline",
  User: "person-outline",
  Users: "people-outline",
  Mail: "mail-outline",
  Phone: "call-outline",
  MessageSquare: "chatbubble-outline",
  Image: "image-outline",
  File: "document-outline",
  Folder: "folder-outline",
  Download: "download-outline",
  Upload: "cloud-upload-outline",
  Share: "share-outline",
  Edit: "create-outline",
  Trash2: "trash-outline",
  Plus: "add-outline",
  Minus: "remove-outline",
  Check: "checkmark-outline",
  X: "close-outline",
  ArrowRight: "arrow-forward-outline",
  ArrowLeft: "arrow-back-outline",
  ArrowUp: "arrow-up-outline",
  ArrowDown: "arrow-down-outline",
  Search: "search-outline",
  Filter: "filter-outline",
};

// Маппинг эмодзи на Ionicons (для старых данных)
export const EMOJI_TO_IONICONS: Record<string, IoniconsName> = {
  "🍔": "restaurant-outline",
  "🚗": "car-outline",
  "🎬": "film-outline",
  "🏥": "medkit-outline",
  "👕": "shirt-outline",
  "🏠": "home-outline",
  "💰": "wallet-outline",
  "📦": "cube-outline",
  "🍕": "pizza-outline",
  "☕": "cafe-outline",
  "🍺": "beer-outline",
  "🎮": "game-controller-outline",
  "📱": "phone-portrait-outline",
  "💻": "laptop-outline",
  "✈️": "airplane-outline",
  "🏖️": "umbrella-outline",
  "🎓": "school-outline",
  "💊": "medical-outline",
  "🎁": "gift-outline",
  "💳": "card-outline",
  "🏋️": "barbell-outline",
  "🎨": "color-palette-outline",
  "📚": "book-outline",
  "🎵": "musical-notes-outline",
};

// Получить иконку Ionicons по имени Lucide или эмодзи
export function getIoniconsName(iconName: string | undefined): IoniconsName {
  if (!iconName) return "ellipse-outline";
  
  // Проверяем маппинг Lucide
  if (LUCIDE_TO_IONICONS[iconName]) {
    return LUCIDE_TO_IONICONS[iconName];
  }
  
  // Проверяем маппинг эмодзи
  if (EMOJI_TO_IONICONS[iconName]) {
    return EMOJI_TO_IONICONS[iconName];
  }
  
  // Fallback
  return "ellipse-outline";
}
