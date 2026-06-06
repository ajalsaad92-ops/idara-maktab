import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { File, FileText, FileImage, FileSpreadsheet, FileCode, Trash2, Download, Loader2 } from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (type.includes("pdf")) return FileText;
  if (type.includes("spreadsheet") || type.includes("excel")) return FileSpreadsheet;
  if (type.includes("word")) return FileText;
  return FileCode;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function TaskAttachments({ taskId }: { taskId: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = async () => {
    const { data } = await supabase
      .from("task_attachments")
      .select("*, profiles(uploaded_by:full_name)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    setFiles(data || []);
    setLoading(false);
  };

  useState(() => {
    loadFiles();
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user || !taskId) return;
    if (files.length + acceptedFiles.length > MAX_FILES) {
      toast.error(t("max_files_reached") || "Maximum 5 files allowed");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    for (const file of acceptedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: ${t("file_too_large") || "File too large (max 10MB)"}`);
        continue;
      }

      const filePath = `${taskId}/${Date.now()}_${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("task-attachments")
        .upload(filePath, file, {
          upsert: false,
        });

      if (uploadError) {
        toast.error(`${file.name}: ${uploadError.message}`);
        continue;
      }

      const { error: dbError } = await supabase.from("task_attachments").insert({
        task_id: taskId,
        uploaded_by: user.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
      });

      if (dbError) {
        toast.error(`${file.name}: ${dbError.message}`);
        await supabase.storage.from("task-attachments").remove([filePath]);
        continue;
      }

      setUploadProgress((prev) => prev + (100 / acceptedFiles.length));
    }

    setUploading(false);
    setUploadProgress(0);
    loadFiles();
    toast.success(t("upload_success") || "Files uploaded successfully");
  }, [user, taskId, files, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    disabled: uploading,
  });

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage.from("task-attachments").download(filePath);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const deleteFile = async (fileId: string, filePath: string) => {
    const { error } = await supabase.from("task_attachments").delete().eq("id", fileId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.storage.from("task-attachments").remove([filePath]);
    loadFiles();
    toast.success(t("file_deleted") || "File deleted");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <File className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {isDragActive ? t("drop_files_here") || "Drop files here..." : t("drag_drop_files") || "Drag & drop files here, or click to select"}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("supported_formats") || "PDF, Word, Excel, Images (max 10MB each, max 5 files)"}
          </p>
        </div>
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t("uploading") || "Uploading..."}</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      <div className="space-y-2">
        {files.map((file: any) => {
          const Icon = getFileIcon(file.file_type);
          return (
            <Card key={file.id} className="p-3 flex items-center gap-3">
              <Icon className="h-8 w-8 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.file_size)} · {file.profiles?.uploaded_by || "—"} · {new Date(file.created_at).toLocaleDateString("ar-IQ")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => downloadFile(file.file_path, file.file_name)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteFile(file.id, file.file_path)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          );
        })}
        {files.length === 0 && !uploading && (
          <p className="text-center text-muted-foreground py-4 text-sm">
            {t("no_attachments") || "No attachments yet"}
          </p>
        )}
      </div>
    </div>
  );
}
