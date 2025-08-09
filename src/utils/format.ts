export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatFileSize = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export const formatBitrate = (bitrate: number): string => {
  if (bitrate < 1000) return `${bitrate} bps`;
  if (bitrate < 1000000) return `${(bitrate / 1000).toFixed(1)} Kbps`;
  return `${(bitrate / 1000000).toFixed(1)} Mbps`;
};

export const generateFileName = (originalName: string, index: number, format: string): string => {
  const nameWithoutExt = originalName.split('.').slice(0, -1).join('.');
  return `${nameWithoutExt}_segment_${index.toString().padStart(3, '0')}.${format}`;
};

export const validateVideoFile = (file: File): boolean => {
  const validTypes = [
    'video/mp4',
    'video/avi',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm',
  ];
  
  const validExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'];
  
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  
  return validTypes.includes(file.type) || validExtensions.includes(fileExtension);
};

export const calculateSegments = (duration: number, segmentDuration: number): number => {
  return Math.ceil(duration / segmentDuration);
};

export const parseTimeString = (timeString: string): number => {
  const parts = timeString.split(':').map(Number);
  
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  
  return 0;
};

export const secondsToTimeString = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};