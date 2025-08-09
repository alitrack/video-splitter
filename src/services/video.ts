import { invoke } from '@tauri-apps/api/core';
import { VideoInfo, SplitRequest, SplitResult, ScenePoint } from '../types/video';

export class VideoService {
  static async getFilePath(_file: File): Promise<string | null> {
    try {
      // 在浏览器环境中，无法直接获取文件的完整路径
      // 出于安全考虑，浏览器不允许JavaScript访问文件的完整路径
      // 这里返回null，需要通过系统文件对话框来获取完整路径
      return null;
    } catch (error) {
      console.error('获取文件路径失败:', error);
      return null;
    }
  }

  static async getVideoInfo(filePath: string): Promise<VideoInfo> {
    try {
      const info = await invoke<VideoInfo>('get_video_info', { path: filePath });
      return info;
    } catch (error) {
      console.error('获取视频信息失败:', error);
      throw new Error('获取视频信息失败');
    }
  }

  static async splitVideo(request: SplitRequest): Promise<SplitResult> {
    try {
      const result = await invoke<SplitResult>('split_video', { request });
      return result;
    } catch (error) {
      console.error('视频分割失败:', error);
      throw new Error('视频分割失败');
    }
  }

  static async detectScenes(filePath: string, threshold: number = 0.3): Promise<ScenePoint[]> {
    try {
      const scenes = await invoke<ScenePoint[]>('detect_scenes', { 
        video_path: filePath, 
        threshold,
        min_duration: 2.0
      });
      return scenes;
    } catch (error) {
      console.error('场景检测失败:', error);
      throw new Error('场景检测失败');
    }
  }

  static async selectVideoFile(): Promise<string | null> {
    try {
      const filePath = await invoke<string>('select_video_file');
      return filePath;
    } catch (error) {
      console.error('选择文件失败:', error);
      return null;
    }
  }

  static async selectOutputDirectory(): Promise<string | null> {
    try {
      const dirPath = await invoke<string>('select_output_directory');
      return dirPath;
    } catch (error) {
      console.error('选择输出目录失败:', error);
      return null;
    }
  }

  static async openFile(path: string): Promise<void> {
    try {
      await invoke('open_file_explorer', { path });
    } catch (error) {
      console.error('打开文件失败:', error);
      throw new Error('打开文件失败');
    }
  }

  static async showInFolder(path: string): Promise<void> {
    try {
      await invoke('open_file_explorer', { path });
    } catch (error) {
      console.error('显示文件失败:', error);
      throw new Error('显示文件失败');
    }
  }

  static async fileExists(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>('file_exists', { path });
    } catch (error) {
      console.error('检查文件存在失败:', error);
      return false;
    }
  }

  static async createDirectory(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>('create_directory', { path });
    } catch (error) {
      console.error('创建目录失败:', error);
      return false;
    }
  }

  static async getFileSize(path: string): Promise<number> {
    try {
      return await invoke<number>('get_file_size', { path });
    } catch (error) {
      console.error('获取文件大小失败:', error);
      return 0;
    }
  }

  static async deleteFile(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>('delete_file', { path });
    } catch (error) {
      console.error('删除文件失败:', error);
      return false;
    }
  }

  static async getVideoThumbnail(videoPath: string, timeSeconds: number, outputPath: string): Promise<string> {
    try {
      return await invoke<string>('get_video_thumbnail', { 
        video_path: videoPath, 
        time_seconds: timeSeconds, 
        output_path: outputPath 
      });
    } catch (error) {
      console.error('获取视频缩略图失败:', error);
      throw new Error('获取视频缩略图失败');
    }
  }

  static async checkSystemRequirements(): Promise<any> {
    try {
      return await invoke('check_system_requirements');
    } catch (error) {
      console.error('检查系统要求失败:', error);
      throw new Error('检查系统要求失败');
    }
  }

  static async getCpuUsage(): Promise<number> {
    try {
      return await invoke<number>('get_cpu_usage');
    } catch (error) {
      console.error('获取CPU使用率失败:', error);
      return 0;
    }
  }

  static async getMemoryUsage(): Promise<[number, number]> {
    try {
      return await invoke<[number, number]>('get_memory_usage');
    } catch (error) {
      console.error('获取内存使用率失败:', error);
      return [0, 0];
    }
  }
}