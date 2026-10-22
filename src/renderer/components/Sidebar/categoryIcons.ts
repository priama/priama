import {
  BookOpen,
  Briefcase,
  Clock,
  Crown,
  Film,
  Flame,
  FlaskConical,
  Gift,
  Globe,
  Hash,
  Layers,
  Lightbulb,
  MapPin,
  MessageSquare,
  Music,
  PawPrint,
  Pencil,
  Phone,
  Scroll,
  Settings2,
  Star,
  StickyNote,
  Tag,
  Target,
  Trophy,
  UserCircle,
  Users
} from 'lucide-react'

export const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Users,
  MapPin,
  Scroll,
  StickyNote,
  UserCircle,
  Lightbulb,
  Tag,
  Star,
  Globe,
  Briefcase,
  FlaskConical,
  Clock,
  Layers,
  Music,
  Film,
  Hash,
  Crown,
  Flame,
  Gift,
  Trophy,
  Target,
  MessageSquare,
  Phone,
  PawPrint,
  Pencil,
  Settings2
}

/** Resolves an icon name string to a Lucide component, falling back to Tag. */
export function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  return CATEGORY_ICON_MAP[name] ?? Tag
}
