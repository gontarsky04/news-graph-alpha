interface ArticleUploadButtonProps {
  uploading: boolean;
  onUpload: (files: File[]) => void;
  variant?: "navbar" | "inline" | "dropzone";
  multiple?: boolean;
}

export default function ArticleUploadButton({
  uploading,
  onUpload,
  variant = "inline",
  multiple = true,
}: ArticleUploadButtonProps) {
  const className =
    variant === "navbar"
      ? "btn-primary upload-label upload-label--navbar"
      : variant === "dropzone"
        ? "upload-label upload-label--dropzone"
        : "upload-label upload-label--inline";

  const label =
    variant === "dropzone"
      ? uploading
        ? "Przetwarzanie artykułu…"
        : "Przeciągnij plik JSON lub kliknij, aby wgrać artykuł"
      : uploading
        ? "Przetwarzanie…"
        : "+ Wgraj artykuł";

  return (
    <label className={className}>
      <input
        type="file"
        accept="application/json,.json"
        multiple={multiple}
        disabled={uploading}
        onChange={(e) => {
          const files = e.target.files ? [...e.target.files] : [];
          if (files.length > 0) onUpload(files);
          e.target.value = "";
        }}
      />
      {label}
    </label>
  );
}
