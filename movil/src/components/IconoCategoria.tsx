import {
  Anvil,
  BrickWall,
  Flame,
  Hammer as Generico,
  Key,
  Layers,
  Leaf,
  PaintRoller,
  Scissors,
  Snowflake,
  Sparkles,
  Trees,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react-native'

// La base guarda el nombre lucide en categories.icon.
const iconos: Record<string, LucideIcon> = {
  scissors: Scissors,
  trees: Trees,
  leaf: Leaf,
  wrench: Wrench,
  zap: Zap,
  'paint-roller': PaintRoller,
  'brick-wall': BrickWall,
  sparkles: Sparkles,
  anvil: Anvil,
  layers: Layers,
  key: Key,
  hammer: Generico,
  flame: Flame,
  snowflake: Snowflake,
}

// Fondo suave por categoria (tinta oscura encima, contraste AA).
const fondos = [
  '#FFF1E5',
  '#ECFDF5',
  '#F0FDF4',
  '#EFF6FF',
  '#FEFCE8',
  '#FDF2F8',
  '#F5F3FF',
  '#F0F9FF',
  '#F1F5F9',
  '#FEF3C7',
  '#FCE7F3',
  '#EDE9FE',
  '#FFEDD5',
  '#E0F2FE',
]

export function iconoDe(nombre: string): LucideIcon {
  return iconos[nombre] ?? Generico
}

export function fondoDe(orden: number): string {
  return fondos[(orden - 1 + fondos.length) % fondos.length]
}
