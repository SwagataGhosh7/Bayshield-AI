import { MapStickyNote, StickyNoteColor } from '../types/cyclone';
import { CRITICAL_INFRASTRUCTURE_NODES } from '../data/cycloneScenarios';

const STORAGE_KEY = 'bayshield_session_sticky_notes_v1';

export const STICKY_NOTE_COLORS: Record<
  StickyNoteColor,
  {
    name: string;
    bgHex: string;
    borderHex: string;
    headerBg: string;
    textHex: string;
    badgeBg: string;
    badgeText: string;
    tailwindBg: string;
    tailwindBorder: string;
    tailwindText: string;
  }
> = {
  yellow: {
    name: 'Tactical Yellow',
    bgHex: '#fef08a',
    borderHex: '#eab308',
    headerBg: '#fde047',
    textHex: '#713f12',
    badgeBg: '#fef9c3',
    badgeText: '#854d0e',
    tailwindBg: 'bg-yellow-100',
    tailwindBorder: 'border-yellow-400',
    tailwindText: 'text-yellow-950',
  },
  cyan: {
    name: 'Hydro Cyan',
    bgHex: '#cffafe',
    borderHex: '#06b6d4',
    headerBg: '#a5f3fc',
    textHex: '#164e63',
    badgeBg: '#ecfeff',
    badgeText: '#0e7490',
    tailwindBg: 'bg-cyan-100',
    tailwindBorder: 'border-cyan-400',
    tailwindText: 'text-cyan-950',
  },
  rose: {
    name: 'Danger Rose',
    bgHex: '#ffe4e6',
    borderHex: '#f43f5e',
    headerBg: '#fecdd3',
    textHex: '#881337',
    badgeBg: '#fff1f2',
    badgeText: '#be123c',
    tailwindBg: 'bg-rose-100',
    tailwindBorder: 'border-rose-400',
    tailwindText: 'text-rose-950',
  },
  amber: {
    name: 'Warning Amber',
    bgHex: '#fef3c7',
    borderHex: '#f59e0b',
    headerBg: '#fde68a',
    textHex: '#78350f',
    badgeBg: '#fffbeb',
    badgeText: '#b45309',
    tailwindBg: 'bg-amber-100',
    tailwindBorder: 'border-amber-400',
    tailwindText: 'text-amber-950',
  },
  emerald: {
    name: 'Safe Emerald',
    bgHex: '#d1fae5',
    borderHex: '#10b981',
    headerBg: '#a7f3d0',
    textHex: '#064e3b',
    badgeBg: '#ecfdf5',
    badgeText: '#047857',
    tailwindBg: 'bg-emerald-100',
    tailwindBorder: 'border-emerald-400',
    tailwindText: 'text-emerald-950',
  },
  purple: {
    name: 'Strategic Purple',
    bgHex: '#f3e8ff',
    borderHex: '#a855f7',
    headerBg: '#e9d5ff',
    textHex: '#581c87',
    badgeBg: '#faf5ff',
    badgeText: '#7e22ce',
    tailwindBg: 'bg-purple-100',
    tailwindBorder: 'border-purple-400',
    tailwindText: 'text-purple-950',
  },
};

export const INITIAL_SESSION_NOTES: MapStickyNote[] = [
  {
    id: 'note-seed-01',
    nodeId: 'infra-sub-01',
    nodeName: 'Kakdwip 132kV Substation',
    coordinates: { lat: 21.875, lng: 88.195 },
    title: 'Elevated Transformer Yard & Pumping Unit Ready',
    content:
      'Perimeter sandbagging reinforced to +1.8m crest. Mobile diesel de-watering unit positioned on standby near Feeder 4. Busbars verified sealed.',
    author: 'Chief Engineer Sen (WBSEDCL)',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    color: 'yellow',
    priority: 'urgent',
  },
  {
    id: 'note-seed-02',
    nodeId: 'infra-sub-03',
    nodeName: 'Haldia Industrial Complex 220kV Grid',
    coordinates: { lat: 22.062, lng: 88.075 },
    title: 'Hooghly Estuary Sluice Gate Tested',
    content:
      'Automated backflow flapper gates #1 through #4 inspected. Concrete ring bund intact at 4.2m elevation. Heavy vehicle access open along NH-116.',
    author: 'Disaster Ops Cell Haldia',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    color: 'cyan',
    priority: 'high',
  },
];

export function loadSessionStickyNotes(): MapStickyNote[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Initialize with default session seeds
      saveSessionStickyNotes(INITIAL_SESSION_NOTES);
      return INITIAL_SESSION_NOTES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_SESSION_NOTES;
  } catch (err) {
    console.warn('Failed to load session sticky notes from sessionStorage:', err);
    return INITIAL_SESSION_NOTES;
  }
}

export function saveSessionStickyNotes(notes: MapStickyNote[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    console.warn('Failed to save session sticky notes to sessionStorage:', err);
  }
}

export function findNearestInfrastructureNode(
  lat: number,
  lng: number,
  maxDistanceKm = 15
): { id: string; name: string; district: string; distanceKm: number } | null {
  let nearest: { id: string; name: string; district: string; distanceKm: number } | null = null;
  let minDistance = Infinity;

  CRITICAL_INFRASTRUCTURE_NODES.forEach((node) => {
    // Approximate distance in km using equirectangular projection
    const dLat = (node.lat - lat) * 111;
    const dLng = (node.lng - lng) * 111 * Math.cos(((lat + node.lat) / 2) * (Math.PI / 180));
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);

    if (dist < minDistance) {
      minDistance = dist;
      nearest = {
        id: node.id,
        name: node.name,
        district: node.district,
        distanceKm: Number(dist.toFixed(1)),
      };
    }
  });

  if (minDistance <= maxDistanceKm) {
    return nearest;
  }
  return null;
}
