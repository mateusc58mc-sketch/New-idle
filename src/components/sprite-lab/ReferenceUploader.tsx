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
    <div className="flex flex-col gap-2 p-3 bg-void-900 border-b border-void-700">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Reference Image
        </h4>
        {referenceImage ? (
          <button
            type="button"
            onClick={onClearImage}
            className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
          >
            Clear Ref
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
            'border border-dashed rounded p-3 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1',
            isDragging
              ? 'border-arcane-400 bg-arcane-500/10'
              : 'border-void-600 hover:border-slate-500 bg-void-800/50',
          ].join(' ')}
        >
          <span className="text-lg">🖼️</span>
          <span className="text-xs text-slate-400">
            Drop reference image here, or <span className="text-arcane-400 underline">browse</span>
          </span>
          <span className="text-[10px] text-slate-500">PNG, JPG or WebP</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded border border-void-700 bg-void-950 overflow-hidden shrink-0">
              <img
                src={referenceImage}
                alt="Ref thumbnail"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Ref Opacity</span>
                <span className="font-mono text-slate-500">{Math.round(referenceOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={referenceOpacity}
                onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-void-700 accent-arcane-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
