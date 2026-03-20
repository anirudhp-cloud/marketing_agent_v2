interface UploadZoneProps {
  id: string;
  label: string;
  sublabel: string;
  accept?: string;
  fileName?: string;
  onFileChange?: (file: File) => void;
  onClear?: () => void;
}

export function UploadZone({
  id,
  label,
  sublabel,
  accept = ".pdf,.zip,.png,.jpg,.ai",
  fileName,
  onFileChange,
  onClear,
}: UploadZoneProps) {
  const hasFile = !!fileName;

  return (
    <div
      className={`relative border-2 border-dashed rounded-r p-7 text-center transition-all bg-glass hover:border-coral/35 hover:bg-coral/[0.02] ${
        hasFile ? "border-mint/40 bg-mint/[0.04]" : "border-rim"
      }`}
    >
      <label htmlFor={id} className="block cursor-pointer">
        <input
          type="file"
          id={id}
          className="hidden"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onFileChange) onFileChange(file);
            // Reset so re-uploading the same file works
            e.target.value = "";
          }}
        />
        <div className="text-2xl mb-2">📋</div>
        {hasFile ? (
          <div>
            <strong className="text-mint">✓ {fileName}</strong>
            <br />
            <span className="text-[0.72rem] text-fg-3">
              File ready · Brand guidelines loaded
            </span>
          </div>
        ) : (
          <div className="text-[0.83rem] text-fg-2 leading-relaxed">
            <strong className="text-fg">{label}</strong>
            <br />
            Drag & drop or <span className="text-coral cursor-pointer">browse</span>{" "}
            — {accept.replace(/\./g, "").toUpperCase()} accepted
            <br />
            <em className="text-[0.72rem] text-fg-3 not-italic">{sublabel}</em>
          </div>
        )}
      </label>
      {hasFile && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-ink-3 border border-rim text-fg-3 text-xs flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 hover:border-red-400/40 transition-all"
          title="Remove file"
        >
          ✕
        </button>
      )}
    </div>
  );
}
