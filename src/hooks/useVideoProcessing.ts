import { useState, useCallback } from 'react';
import { VideoService } from '../services';
import { VideoInfo, SplitRequest, SplitResult, SplitProgress, ScenePoint } from '../types';

export const useVideoProcessing = () => {
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<SplitProgress | null>(null);
  const [results, setResults] = useState<SplitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVideoInfo = useCallback(async (filePath: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const info = await VideoService.getVideoInfo(filePath);
      setVideoInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取视频信息失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const splitVideo = useCallback(async (request: SplitRequest) => {
    setLoading(true);
    setError(null);
    setProgress(null);
    setResults(null);

    try {
      // 模拟进度更新（实际应该通过Tauri事件监听）
      setProgress({
        current: 0,
        total: 100,
        message: '正在准备分割...',
        percentage: 0,
      });

      // 这里应该监听Tauri的进度事件
      const result = await VideoService.splitVideo(request);
      setResults(result);
      
      setProgress({
        current: 100,
        total: 100,
        message: '分割完成！',
        percentage: 100,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '视频分割失败');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(null), 2000);
    }
  }, []);

  const detectScenes = useCallback(async (filePath: string, threshold: number = 0.3): Promise<ScenePoint[]> => {
    setLoading(true);
    setError(null);

    try {
      const scenes = await VideoService.detectScenes(filePath, threshold);
      return scenes;
    } catch (err) {
      setError(err instanceof Error ? err.message : '场景检测失败');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const selectVideoFile = useCallback(async () => {
    try {
      const filePath = await VideoService.selectVideoFile();
      return filePath;
    } catch (err) {
      setError(err instanceof Error ? err.message : '选择文件失败');
      return null;
    }
  }, []);

  const selectOutputDirectory = useCallback(async () => {
    try {
      const dirPath = await VideoService.selectOutputDirectory();
      return dirPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : '选择目录失败');
      return null;
    }
  }, []);

  const openFile = useCallback(async (path: string) => {
    try {
      await VideoService.openFile(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : '打开文件失败');
    }
  }, []);

  const showInFolder = useCallback(async (path: string) => {
    try {
      await VideoService.showInFolder(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : '显示文件失败');
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setProgress(null);
  }, []);

  return {
    videoInfo,
    loading,
    progress,
    results,
    error,
    loadVideoInfo,
    splitVideo,
    detectScenes,
    selectVideoFile,
    selectOutputDirectory,
    openFile,
    showInFolder,
    clearError,
    clearResults,
  };
};