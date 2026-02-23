import React from 'react';
import { GripVertical } from 'lucide-react';

export default function DraggableBlock({ id, children, width = 'half', editMode, onDragStart, onDragEnd, onDragOver, onDrop, isDragging }) {
  const widthClasses = {
    full: 'col-span-12',
    half: 'col-span-12 lg:col-span-6',
    third: 'col-span-12 lg:col-span-4'
  };

  return (
    <div
      draggable={editMode}
      onDragStart={(e) => editMode && onDragStart(e, id)}
      onDragEnd={editMode ? onDragEnd : undefined}
      onDragOver={editMode ? onDragOver : undefined}
      onDrop={(e) => editMode && onDrop(e, id)}
      className={`${widthClasses[width]} transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
    >
      <div className="glass-card rounded-2xl border border-white/10 hover:border-teal-500/30 transition-all duration-300 overflow-hidden group h-full">
        {editMode && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-white/5 draggable">
            <GripVertical className="h-4 w-4 text-slate-500 group-hover:text-teal-400 transition-colors" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}