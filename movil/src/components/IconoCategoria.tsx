import {
  BrickWall,
  Leaf,
  PaintRoller,
  Scissors,
  Sparkles,
  Trees,
  Wrench,
  Hammer as Generico,
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
}

// Fondo suave por categoria (tinta oscura encima, contraste AA).
const fondos = ['#FFF1E5', '#ECFDF5', '#F0FDF4', '#EFF6FF', '#FEFCE8', '#FDF2F8', '#F5F3FF', '#F0F9FF']

export function iconoDe(nombre: string): LucideIcon {
  return iconos[nombre] ?? Generico
}

export function fondoDe(orden: number): string {
  return fondos[(orden - 1 + fondos.length) % fondos.length]
}
