'use client';

/**
 * ReferenceUploader — drag-and-drop & file picker for background reference images.
 *
 * Allows uploading concept art, weapon silhouettes (e.g. Warglaives of Azzinoth),
 * or paperdoll sprites as guides behind the parametric SVG canvas.
 */
import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';

export interface ReferenceUploaderProps {
  readonly referenceImage: string | null;
  readonly referenceOpacity: number;
  readonly onImageLoaded: (dataUrl: string) => void;
  readonly onClearImage: () => void;
  readonly onOpacityChange: (opacity: number) => void;
}

export function ReferenceUploader({
  referenceImage,
  referenceOpacity,
  onImageLoaded,
  onClearImage,
  onOpacityChange,
}: ReferenceUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        onImageLoaded(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 shadow-xl">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">🖼️</span>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Reference Overlay
          </h4>
        </div>
        {referenceImage ? (
          <button
            type="button"
            onClick={onClearImage}
            className="text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors px-1.5 py-0.5 rounded hover:bg-rose-950/40 border border-rose-900/40"
          >
            Clear
          </button>
        ) : null}
      </div>

      {!referenceImage ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={[
            'border-2 border-dashed rounded-lg p-3.5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5',
            isDragging
              ? 'border-arcane-400 bg-arcane-500/10 scale-[0.99]'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-950',
          ].join(' ')}
        >
          <div className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 text-sm">
            📁
          </div>
          <span className="text-xs text-slate-300 font-medium">
            Arraste imagem de referência
          </span>
          <span className="text-[11px] text-slate-500">
            ou clique para carregar PNG/JPG
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-2.5 bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md border border-slate-700 bg-slate-900 overflow-hidden shrink-0 shadow-inner">
              <img
                src={referenceImage}
                alt="Ref thumbnail"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span className="text-[11px] font-semibold text-slate-300">Opacity</span>
                <span className="font-mono text-[11px] text-arcane-400 font-bold">
                  {Math.round(referenceOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={referenceOpacity}
                onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none bg-slate-800 accent-arcane-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
