/**
 * Client-side image compression utility.
 * Resizes large smartphone photos to standard medical inspection dimensions (max 1280px)
 * and applies high-quality JPEG compression, reducing typical 3-8MB photos to ~150-250KB.
 */

export interface CompressionOptions {
  maxWidthOrHeight?: number;
  quality?: number;
  outputType?: "image/jpeg" | "image/webp";
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidthOrHeight = 1280,
    quality = 0.82,
    outputType = "image/jpeg",
  } = options;

  const originalSize = file.size;

  // If not an image, return original file
  if (!file.type.startsWith("image/")) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      width: 0,
      height: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = (err) => reject(err);

    img.onload = () => {
      let { width, height } = img;

      // Calculate scaled dimensions while preserving aspect ratio
      if (width > height) {
        if (width > maxWidthOrHeight) {
          height = Math.round((height * maxWidthOrHeight) / width);
          width = maxWidthOrHeight;
        }
      } else {
        if (height > maxWidthOrHeight) {
          width = Math.round((width * maxWidthOrHeight) / height);
          height = maxWidthOrHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback if canvas context is unavailable
        return resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          width: img.width,
          height: img.height,
        });
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return resolve({
              file,
              originalSize,
              compressedSize: originalSize,
              width,
              height,
            });
          }

          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const extension = outputType === "image/webp" ? ".webp" : ".jpg";
          const compressedFile = new File([blob], `${baseName}${extension}`, {
            type: outputType,
            lastModified: Date.now(),
          });

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize: compressedFile.size,
            width,
            height,
          });
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      // Fallback if image fails to render in Image element
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        width: 0,
        height: 0,
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes to readable Persian KB/MB string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
}
