export interface VideoInfo {
  path: string;
  filename: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  format: string;
  size: number;
}

export interface SplitProgress {
  current: number;
  total: number;
  message: string;
  percentage: number;
}

export interface SplitResult {
  success: boolean;
  output_files: string[];
  errors: string[];
  processing_time: number;
}

export interface SplitRequest {
  video_path: string;
  output_dir: string;
  output_format: string;
  split_type: SplitType;
}

export type SplitType = 
  | { time: { duration: number; count?: number } }
  | { scenes: { threshold: number; min_duration?: number } }
  | { manual: { split_points: number[] } };

export interface ScenePoint {
  time: number;
  confidence: number;
  frame_number: number;
}

export interface VideoFile {
  name: string;
  path: string;
  size: number;
  duration: number;
  format: string;
}