import React, { useState } from 'react';
import { MapStickyNote, StickyNoteColor } from '../types/cyclone';
import { STICKY_NOTE_COLORS } from '../services/stickyNotesService';
import {
  StickyNote,
  X,
  MapPin,
  Edit2,
  Trash2,
  Plus,
  Navigation,
  Clock,
  User,
  Filter,
} from 'lucide-react';

interface StickyNotesListModalProps {
  isOpen: boolean;
  onClose: () => void;
  stickyNotes: MapStickyNote[];
  onSelectNoteToEdit: (note: MapStickyNote) => void;
  onDeleteNote: (id: string) => void;
  onFocusCoordinate: (coord: { lat: number; lng: number }) => void;
  onAddNewNote: () => void;
}

export const StickyNotesListModal: React.FC<StickyNotesListModalProps> = ({
  isOpen,
  onClose,
  stickyNotes,
  onSelectNoteToEdit,
  onDeleteNote,
  onFocusCoordinate,
  onAddNewNote,
}) => {
  const [filterColor, setFilterColor] = useState<string>('ALL');

  if (!isOpen) return null;

  const filteredNotes = stickyNotes.filter((note) => {
    if (filterColor !== 'ALL' && note.color !== filterColor) {
      return false;
    }
    return true;
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh] ring-1 ring-white/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                  Session Map Sticky Notes
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                  {stickyNotes.length} Notes Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Field operational annotations placed directly on geospatial infrastructure coordinates
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

        {/* Toolbar & Filters */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 uppercase font-bold mr-1">Filter:</span>
            <button
              onClick={() => setFilterColor('ALL')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                filterColor === 'ALL'
                  ? 'bg-slate-800 text-cyan-300 font-bold border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({stickyNotes.length})
            </button>
            {(Object.keys(STICKY_NOTE_COLORS) as StickyNoteColor[]).map((cKey) => {
              const count = stickyNotes.filter((n) => n.color === cKey).length;
              if (count === 0 && filterColor !== cKey) return null;
              const conf = STICKY_NOTE_COLORS[cKey];
              return (
                <button
                  key={cKey}
                  onClick={() => setFilterColor(cKey)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition flex items-center gap-1 ${
                    filterColor === cKey
                      ? 'bg-slate-800 text-white font-bold border border-slate-600'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: conf.borderHex }}
                  />
                  <span>{conf.name.split(' ')[0]}</span>
                  <span className="font-mono text-[9px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              onClose();
              onAddNewNote();
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Note</span>
          </button>
        </div>

        {/* List of Notes */}
        <div className="p-5 space-y-3 overflow-y-auto max-h-[calc(85vh-160px)]">
          {filteredNotes.length > 0 ? (
            filteredNotes.map((note) => {
              const theme = STICKY_NOTE_COLORS[note.color] || STICKY_NOTE_COLORS.yellow;
              return (
                <div
                  key={note.id}
                  className="p-3.5 rounded-xl border shadow-md relative overflow-hidden transition-all group"
                  style={{
                    backgroundColor: theme.bgHex,
                    borderColor: theme.borderHex,
                    color: theme.textHex,
                  }}
                >
                  {/* Folded paper dog-ear */}
                  <div
                    className="absolute top-0 right-0 w-6 h-6 shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.12) 50%), ${theme.headerBg}`,
                      borderBottomLeftRadius: '6px',
                    }}
                  />

                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2 pr-6 mb-1">
                    <div className="font-bold text-xs sm:text-sm leading-snug">
                      {note.title}
                    </div>
                    <span
                      className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase shrink-0"
                      style={{
                        backgroundColor: theme.badgeBg,
                        color: theme.badgeText,
                      }}
                    >
                      {note.priority}
                    </span>
                  </div>

                  {/* Coordinates & Node */}
                  <div className="flex items-center gap-2 text-[10px] opacity-85 mb-2 font-mono">
                    <span className="flex items-center gap-1 font-semibold">
                      <MapPin className="w-3 h-3" />
                      {note.coordinates.lat.toFixed(3)}°N, {note.coordinates.lng.toFixed(3)}°E
                    </span>
                    {note.nodeName && (
                      <>
                        <span>•</span>
                        <span className="font-sans font-medium truncate">{note.nodeName}</span>
                      </>
                    )}
                  </div>

                  {/* Note Content */}
                  <p className="text-xs leading-relaxed mb-3 italic">
                    "{note.content}"
                  </p>

                  {/* Footer & Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-black/10 text-[10px] font-mono">
                    <div className="flex items-center gap-2 opacity-80">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {note.author}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(note.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          onFocusCoordinate(note.coordinates);
                          onClose();
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-sans font-bold flex items-center gap-1 transition shadow-sm"
                        style={{
                          backgroundColor: theme.badgeBg,
                          color: theme.badgeText,
                        }}
                        title="Pan and zoom map to this sticky note marker"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Zoom</span>
                      </button>

                      <button
                        onClick={() => {
                          onSelectNoteToEdit(note);
                          onClose();
                        }}
                        className="p-1 rounded hover:bg-black/10 transition"
                        title="Edit note"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDeleteNote(note.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-rose-800 transition"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <StickyNote className="w-8 h-8 mx-auto text-slate-600" />
              <div className="text-xs text-slate-400 font-medium">No sticky notes found</div>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Toggle the "Add Note" tool on the map or click any infrastructure marker to place field annotations.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
