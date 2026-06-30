import React from 'react'
import {
  ArrowRight, ArrowLeft, ArrowLeftRight, Check, ChevronDown, ChevronLeft, ChevronRight, X,
  CloudOff, HardDrive, RefreshCw, Skull, TriangleAlert, Shield, Drama, Info, CircleHelp,
  LayoutDashboard, Waypoints, History, Map, MapPin, Dices, ListChecks, BookOpen, ScrollText,
  Printer, Settings, Plus, Search, Filter, Pencil, Trash2, ExternalLink, Sun, Moon, Palette,
  Github, PanelLeft, PanelLeftClose, Calendar, Users, Tag, Copy, Download, Upload, Link, Globe,
  Pointer, Image as ImageIcon,
  MousePointer2, Highlighter, Square, Circle, Minus, Type, Eraser, Undo2, Smile, Clapperboard, ArrowUpRight,
} from 'lucide-react'

/**
 * Icon — renders a Lucide glyph by kebab-case name (e.g. "map-pin"). The
 * codebase shipped emoji module icons; the design system standardises on Lucide
 * (thin 1.75px stroke). Icons are imported explicitly (not the whole set) so the
 * bundle only carries what the app uses.
 */
const MAP = {
  'arrow-right': ArrowRight, 'arrow-left': ArrowLeft, 'arrow-left-right': ArrowLeftRight,
  check: Check, 'chevron-down': ChevronDown, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
  x: X, 'cloud-off': CloudOff, 'hard-drive': HardDrive, 'refresh-cw': RefreshCw, skull: Skull,
  'triangle-alert': TriangleAlert, shield: Shield, drama: Drama, info: Info, 'circle-help': CircleHelp,
  'layout-dashboard': LayoutDashboard, waypoints: Waypoints, history: History, map: Map, 'map-pin': MapPin,
  dices: Dices, 'list-checks': ListChecks, 'book-open': BookOpen, 'scroll-text': ScrollText, printer: Printer,
  settings: Settings, plus: Plus, search: Search, filter: Filter, pencil: Pencil, 'trash-2': Trash2,
  'external-link': ExternalLink, sun: Sun, moon: Moon, palette: Palette, github: Github,
  'panel-left': PanelLeft, 'panel-left-close': PanelLeftClose, calendar: Calendar, users: Users, tag: Tag,
  copy: Copy, download: Download, upload: Upload, link: Link, globe: Globe, pointer: Pointer, image: ImageIcon,
  'mouse-pointer-2': MousePointer2, highlighter: Highlighter, square: Square, circle: Circle, minus: Minus,
  type: Type, eraser: Eraser, 'undo-2': Undo2, smile: Smile, clapperboard: Clapperboard, 'arrow-up-right': ArrowUpRight,
}

export function Icon({ name, size = 20, className = '', style, ...rest }) {
  const Cmp = name ? MAP[name] : null
  if (!Cmp && name && import.meta.env && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[ds/Icon] unknown icon "${name}" — add it to the MAP in Icon.jsx`)
  }
  return (
    <span
      className={`mb-icon ${className}`.trim()}
      aria-hidden="true"
      style={{ width: size, height: size, color: 'currentColor', ...style }}
      {...rest}
    >
      {Cmp ? <Cmp width={size} height={size} strokeWidth={1.75} /> : null}
    </span>
  )
}
