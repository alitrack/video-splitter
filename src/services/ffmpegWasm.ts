import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

class FFmpegWasmService {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;
  private isLoading = false;

  async initialize(): Promise<void> {
    if (this.isLoaded || this.isLoading) return;
    
    this.isLoading = true;
    try {
      this.ffmpeg = new FFmpeg();
      
      // 配置WASM文件路径
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      this.isLoaded = true;
      console.log('FFmpeg.wasm loaded successfully');
    } catch (error) {
      console.error('Failed to load FFmpeg.wasm:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async getVideoInfo(file: File): Promise<any> {
    if (!this.ffmpeg || !this.isLoaded) {
      await this.initialize();
    }

    try {
      const inputName = 'input.' + file.name.split('.').pop();
      
      // 写入文件到FFmpeg虚拟文件系统
      await this.ffmpeg!.writeFile(inputName, await fetchFile(file));
      
      // 获取视频信息
      await this.ffmpeg!.exec([
        '-i', inputName,
        '-f', 'null', '-'
      ]);
      
      // 从日志中解析视频信息
      // 注意：这需要解析FFmpeg的输出日志
      return {
        duration: 0, // 需要从日志解析
        width: 0,
        height: 0,
        fps: 0,
        format: file.name.split('.').pop(),
        size: file.size
      };
    } catch (error) {
      console.error('Error getting video info:', error);
      throw error;
    }
  }

  async splitVideo(
    file: File, 
    splitPoints: number[], 
    onProgress?: (progress: number) => void
  ): Promise<Blob[]> {
    if (!this.ffmpeg || !this.isLoaded) {
      await this.initialize();
    }

    try {
      const inputName = 'input.' + file.name.split('.').pop();
      const outputFiles: Blob[] = [];
      
      // 写入输入文件
      await this.ffmpeg!.writeFile(inputName, await fetchFile(file));
      
      // 处理每个分割段
      let startTime = 0;
      for (let i = 0; i < splitPoints.length + 1; i++) {
        const endTime = i < splitPoints.length ? splitPoints[i] : undefined;
        const outputName = `segment_${i + 1}.mp4`;
        
        const args = ['-i', inputName];
        
        if (startTime > 0) {
          args.push('-ss', startTime.toString());
        }
        
        if (endTime !== undefined) {
          args.push('-t', (endTime - startTime).toString());
        }
        
        args.push('-c', 'copy', outputName);
        
        await this.ffmpeg!.exec(args);
        
        // 读取输出文件
        const data = await this.ffmpeg!.readFile(outputName);
        // 临时处理类型问题，后续完善
        outputFiles.push(new Blob([data as any], { type: 'video/mp4' }));
        
        // 更新进度
        if (onProgress) {
          onProgress((i + 1) / (splitPoints.length + 1) * 100);
        }
        
        startTime = endTime || startTime;
      }
      
      return outputFiles;
    } catch (error) {
      console.error('Error splitting video:', error);
      throw error;
    }
  }

  async detectScenes(file: File, threshold: number = 0.3): Promise<number[]> {
    if (!this.ffmpeg || !this.isLoaded) {
      await this.initialize();
    }

    try {
      const inputName = 'input.' + file.name.split('.').pop();
      
      await this.ffmpeg!.writeFile(inputName, await fetchFile(file));
      
      // 使用场景检测滤镜
      await this.ffmpeg!.exec([
        '-i', inputName,
        '-vf', `select='gt(scene,${threshold})',showinfo`,
        '-f', 'null', '-'
      ]);
      
      // 解析场景检测结果
      // 需要从FFmpeg日志中提取时间点
      return []; // 暂时返回空数组，需要实现日志解析
    } catch (error) {
      console.error('Error detecting scenes:', error);
      throw error;
    }
  }

  isAvailable(): boolean {
    return this.isLoaded;
  }
}

export const ffmpegWasmService = new FFmpegWasmService();