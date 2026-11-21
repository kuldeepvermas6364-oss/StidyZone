import React from 'react';
import {
  Atom,
  BarChart3,
  Bookmark,
  CalendarClock,
  ClipboardCheck,
  Compass,
  FileText,
  GraduationCap,
  LayoutDashboard,
  PlayCircle,
  RotateCcw,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { ModuleIconName } from '../../types/platform';

interface ModuleIconProps {
  name: ModuleIconName;
  className?: string;
}

const ICON_MAP: Record<ModuleIconName, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  GraduationCap,
  Atom,
  Compass,
  FileText,
  PlayCircle,
  ClipboardCheck,
  RotateCcw,
  CalendarClock,
  Sparkles,
  BarChart3,
  Bookmark,
  Settings,
};

export const ModuleIcon: React.FC<ModuleIconProps> = ({ name, className = 'w-4 h-4' }) => {
  const IconComponent = ICON_MAP[name];
  return <IconComponent className={className} aria-hidden="true" />;
};
