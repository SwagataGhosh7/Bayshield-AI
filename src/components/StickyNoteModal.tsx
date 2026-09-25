import React, { useState, useEffect } from 'react';
import { MapStickyNote, StickyNoteColor } from '../types/cyclone';
import { STICKY_NOTE_COLORS } from '../services/stickyNotesService';
import {
  StickyNote,
  X,
  MapPin,
  Save,
  Trash2,
  AlertCircle,
  Building,
  User,
  Palette,
  Flag,
} from 'lucide-react';

interface StickyNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteToEdit?: MapStickyNote | null;
  newCoordinates?: { lat: number; lng: number } | null;
  nodeNameHint?: string | null;
  nodeIdHint?: string | null;
  onSaveNote: (note: MapStickyNote) => void;
  onDeleteNote?: (id: string) => void;
}

export const StickyNoteModal: React.FC<StickyNoteModalProps> = ({
  isOpen,
  onClose,
  noteToEdit,
  newCoordinates,
  nodeNameHint,
  nodeIdHint,
  onSaveNote,
  onDeleteNote,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('Field Command Cell');
  const [color, setColor] = useState<StickyNoteColor>('yellow');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [lat, setLat] = useState<number>(0);
  const [lng, setLng] = useState<number>(0);
  const [nodeName, setNodeName] = useState<string>('');
  const [nodeId, setNodeId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (noteToEdit) {
      setTitle(noteToEdit.title);
      setContent(noteToEdit.content);
      setAuthor(noteToEdit.author || 'Incident Command');
      setColor(noteToEdit.color || 'yellow');
      setPriority(noteToEdit.priority || 'medium');
      setLat(noteToEdit.coordinates.lat);
      setLng(noteToEdit.coordinates.lng);
      setNodeName(noteToEdit.nodeName || '');
      setNodeId(noteToEdit.nodeId || '');
      setErrorMsg(null);
    } else if (newCoordinates) {
      setTitle('');
      setContent('');
      setAuthor('Incident Command Cell');
      setColor('yellow');
      setPriority('medium');
      setLat(newCoordinates.lat);
      setLng(newCoordinates.lng);
      setNodeName(nodeNameHint || '');
      setNodeId(nodeIdHint || '');
      setErrorMsg(null);
    }
  }, [noteToEdit, newCoordinates, nodeNameHint, nodeIdHint, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim()) {
      setErrorMsg('Please provide a title for the sticky note.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Please write some content or operational remarks in the note.');
      return;
    }

    const note: MapStickyNote = {
      id: noteToEdit ? noteToEdit.id : `note-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      nodeId: nodeId.trim() || undefined,
      nodeName: nodeName.trim() || undefined,
      coordinates: {
        lat: Number(lat.toFixed(4)),
        lng: Number(lng.toFixed(4)),
      },
      title: title.trim(),
      content: content.trim(),
      author: author.trim() || 'Disaster Response Cell',
      createdAt: noteToEdit ? noteToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      color,
      priority,
    };

    onSaveNote(note);
    onClose();
  };

  const activeTheme = STICKY_NOTE_COLORS[color];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-white/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                {noteToEdit ? 'Edit Map Sticky Note' : 'Place Map Sticky Note'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Annotate critical infrastructure coordinates with field observations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Coordinate & Node Info Badge */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2 truncate">
              <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="truncate">
                <div className="font-mono text-[11px] text-slate-400">
                  {lat.toFixed(3)}°N, {lng.toFixed(3)}°E
                </div>
                {nodeName ? (
                  <div className="font-bold text-cyan-300 truncate text-[11px] flex items-center gap-1">
                    <Building className="w-3 h-3 text-cyan-400 inline shrink-0" />
                    <span>{nodeName}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">Custom Coastal Coordinate</div>
                )}
              </div>
            </div>
            <div className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
              Session Live
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Note Title / Directive
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Backup Generator Sandbagged, Embankment Sluice Checked"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40"
            />
          </div>

          {/* Content Textarea */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Field Observation / Remarks
            </label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter detailed observations, fuel reserve status, flood barrier elevation, or communication channels..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 resize-none"
            />
          </div>

          {/* Author and Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                <span>Author / Unit Call-sign</span>
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g., WBSEDCL Field Team 4, NDRF Unit"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                <Flag className="w-3 h-3 text-slate-400" />
                <span>Operational Priority</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="low">Low Priority (Advisory)</option>
                <option value="medium">Medium Priority (Routine)</option>
                <option value="high">High Priority (Urgent Action)</option>
                <option value="urgent">Urgent / Life-Safety</option>
              </select>
            </div>
          </div>

          {/* Color Palette Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
              <Palette className="w-3 h-3 text-slate-400" />
              <span>Sticky Note Theme</span>
            </label>
            <div className="grid grid-cols-6 gap-2">
              {(Object.keys(STICKY_NOTE_COLORS) as StickyNoteColor[]).map((cKey) => {
                const conf = STICKY_NOTE_COLORS[cKey];
                const isSelected = color === cKey;
                return (
                  <button
                    key={cKey}
                    type="button"
                    onClick={() => setColor(cKey)}
                    className={`h-9 rounded-xl border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105 shadow-md'
                        : 'hover:scale-102 opacity-75 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: conf.bgHex,
                      borderColor: conf.borderHex,
                    }}
                    title={conf.name}
                  >
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: conf.textHex }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Tactile Sticky Note Preview */}
          <div className="pt-2">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
              Live Map Hover Preview:
            </div>
            <div
              className="p-3.5 rounded-xl border shadow-lg relative overflow-hidden transition-all"
              style={{
                backgroundColor: activeTheme.bgHex,
                borderColor: activeTheme.borderHex,
                color: activeTheme.textHex,
              }}
            >
              {/* Folded paper dog-ear effect */}
              <div
                className="absolute top-0 right-0 w-6 h-6 shadow-sm"
                style={{
                  background: `linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.12) 50%), ${activeTheme.headerBg}`,
                  borderBottomLeftRadius: '6px',
                }}
              />

              <div className="flex items-start justify-between gap-2 pr-4 mb-1">
                <div className="font-bold text-xs leading-snug line-clamp-1">
                  {title || 'Note Title Preview'}
                </div>
                <span
                  className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase shrink-0"
                  style={{
                    backgroundColor: activeTheme.badgeBg,
                    color: activeTheme.badgeText,
                  }}
                >
                  {priority}
                </span>
              </div>

              {nodeName && (
                <div className="text-[10px] font-medium opacity-85 mb-1.5 truncate">
                  📍 {nodeName}
                </div>
              )}

              <p className="text-[11px] leading-relaxed line-clamp-2 italic mb-2">
                "{content || 'Note content will be displayed on marker hover...'}"
              </p>

              <div className="flex items-center justify-between text-[9px] pt-1.5 border-t border-black/10 font-mono opacity-80">
                <span>By {author || 'Command'}</span>
                <span>Just now</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between">
          {noteToEdit && onDeleteNote ? (
            <button
              type="button"
              onClick={() => {
                onDeleteNote(noteToEdit.id);
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Note</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-amber-950/40 active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{noteToEdit ? 'Update Note' : 'Pin Sticky Note'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
