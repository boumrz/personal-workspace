import React from "react";
import * as LucideIcons from "lucide-react";

// Маппинг эмодзи на иконки Lucide
const ICON_MAP: Record<string, string> = {
  "🍔": "Utensils",
  "🚗": "Car",
  "🎬": "Film",
  "🏥": "Hospital",
  "👕": "Shirt",
  "🏠": "Home",
  "💰": "Wallet",
  "📦": "Package",
  "🍕": "Pizza",
  "☕": "Coffee",
  "🍺": "Beer",
  "🎮": "Gamepad2",
  "📱": "Smartphone",
  "💻": "Laptop",
  "✈️": "Plane",
  "🏖️": "Umbrella",
  "🎓": "GraduationCap",
  "💊": "Pill",
  "🎁": "Gift",
  "💳": "CreditCard",
  "🏋️": "Dumbbell",
  "🎨": "Palette",
  "📚": "BookOpen",
  "🎵": "Music",
  "🍰": "Cake",
  "🥗": "Salad",
  "🍷": "Wine",
  "🚌": "Bus",
  "🚇": "Train",
  "🚲": "Bike",
  "⛽": "Fuel",
  "🛒": "ShoppingCart",
  "💄": "Lipstick",
  "🧴": "Bottle",
  "🧹": "Broom",
  "🔧": "Wrench",
  "💡": "Lightbulb",
  "🌡️": "Thermometer",
  "📺": "Tv",
  "🔌": "Plug",
  "💼": "Briefcase",
  "📊": "BarChart3",
  "📈": "TrendingUp",
  "💵": "DollarSign",
  "💴": "Yen",
  "💶": "Euro",
  "💷": "PoundSterling",
  "💸": "Coins",
};

interface IconRendererProps {
  iconName: string;
  size?: number;
  color?: string;
  className?: string;
}

const IconRenderer: React.FC<IconRendererProps> = ({
  iconName,
  size = 20,
  color,
  className,
}) => {
  // Если это уже имя иконки Lucide (не эмодзи), используем его напрямую
  const iconKey = ICON_MAP[iconName] || iconName;
  
  // Получаем компонент иконки
  const IconComponent = LucideIcons[iconKey as keyof typeof LucideIcons] as React.ComponentType<{
    size?: number;
    color?: string;
    className?: string;
  }>;

  if (!IconComponent) {
    // Fallback на эмодзи, если иконка не найдена
    return <span className={className}>{iconName}</span>;
  }

  return <IconComponent size={size} color={color} className={className} />;
};

export default IconRenderer;
export { ICON_MAP };
