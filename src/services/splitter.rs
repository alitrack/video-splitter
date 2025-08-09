use crate::models::*;
use crate::utils::{validate_video_file, VideoError, VideoResult};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::WebviewWindow;

pub struct VideoSplitter {
    ffmpeg_path: String,
}

impl VideoSplitter {
    pub fn new() -> Self {
        Self {
            ffmpeg_path: "ffmpeg".to_string(),
        }
    }

    pub async fn split_video(
        &self,
        request: SplitRequest,
        window: &WebviewWindow,
    ) -> VideoResult<SplitResult> {
        validate_video_file(&request.video_path)?;

        let start_time = std::time::Instant::now();

        let split_points = match &request.split_type {
            SplitType::Time { duration, count } => {
                self.generate_time_splits(&request.video_path, *duration, *count)?
            }
            SplitType::Scenes {
                threshold,
                min_duration,
            } => {
                // 使用视频处理器进行场景检测
                let video_processor = crate::services::video_processor::VideoProcessor::new();
                let scenes = video_processor
                    .detect_scenes(
                        &request.video_path.to_string_lossy(),
                        *threshold,
                        min_duration.unwrap_or(2.0),
                    )
                    .await?;

                // 提取场景时间点
                scenes.into_iter().map(|scene| scene.time).collect()
            }
            SplitType::Manual {
                split_points: manual_points,
            } => manual_points.clone(),
        };

        if split_points.is_empty() {
            return Err(VideoError::ProcessingError(
                "No split points generated".to_string(),
            ));
        }

        let output_files = self.process_splits(&request, &split_points, window).await?;

        let processing_time = start_time.elapsed().as_secs_f64();

        Ok(SplitResult {
            success: true,
            output_files,
            errors: Vec::new(),
            processing_time,
        })
    }

    fn generate_time_splits(
        &self,
        video_path: &Path,
        duration: f64,
        count: Option<u32>,
    ) -> VideoResult<Vec<f64>> {
        let total_duration = self.get_video_duration(video_path)?;

        let mut split_points = Vec::new();

        if let Some(count) = count {
            let segment_duration = total_duration / count as f64;
            for i in 1..count {
                split_points.push(i as f64 * segment_duration);
            }
        } else {
            let mut current_time = duration;
            while current_time < total_duration {
                split_points.push(current_time);
                current_time += duration;
            }
        }

        Ok(split_points)
    }

    fn get_video_duration(&self, video_path: &Path) -> VideoResult<f64> {
        let output = Command::new("ffprobe")
            .args([
                "-v",
                "quiet",
                "-show_entries",
                "format=duration",
                "-of",
                "csv=p=0",
                video_path.to_str().unwrap(),
            ])
            .output()
            .map_err(|e| VideoError::FFmpegError(format!("Failed to run ffprobe: {}", e)))?;

        if !output.status.success() {
            return Err(VideoError::FFmpegError(
                "Failed to get video duration".to_string(),
            ));
        }

        let duration_str = String::from_utf8_lossy(&output.stdout);
        duration_str
            .trim()
            .parse()
            .map_err(|_| VideoError::FFmpegError("Invalid duration format".to_string()))
    }

    async fn process_splits(
        &self,
        request: &SplitRequest,
        split_points: &[f64],
        window: &WebviewWindow,
    ) -> VideoResult<Vec<PathBuf>> {
        let mut output_files = Vec::new();

        // 创建分割段：每个段从前一个分割点到当前分割点
        let mut segments = Vec::new();
        let mut start_time = 0.0;

        for &end_time in split_points {
            segments.push((start_time, end_time));
            start_time = end_time;
        }

        // 添加最后一个段（从最后一个分割点到视频结束）
        let total_duration = self.get_video_duration(&request.video_path)?;
        if start_time < total_duration {
            segments.push((start_time, total_duration));
        }

        // 处理每个段
        for (i, (start, end)) in segments.iter().enumerate() {
            let output_file = self
                .process_segment(request, *start, *end, i, segments.len(), window)
                .await?;
            output_files.push(output_file);
        }

        Ok(output_files)
    }

    async fn process_segment(
        &self,
        request: &SplitRequest,
        start_time: f64,
        end_time: f64,
        segment_index: usize,
        total_segments: usize,
        _window: &WebviewWindow,
    ) -> VideoResult<PathBuf> {
        let output_filename = format!(
            "segment_{}_{:03}.{}",
            request
                .video_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("segment"),
            segment_index + 1,
            request.output_format
        );

        let output_path = request.output_dir.join(output_filename);

        println!(
            "Processing segment {} of {}: {:.2}s - {:.2}s",
            segment_index + 1,
            total_segments,
            start_time,
            end_time
        );

        let duration = end_time - start_time;

        let output = Command::new("ffmpeg")
            .args([
                "-y", // 覆盖输出文件
                "-ss",
                &start_time.to_string(), // 先设置开始时间
                "-i",
                request.video_path.to_str().unwrap(),
                "-t",
                &duration.to_string(), // 使用持续时间
                "-c:v", "libx264", // 重新编码视频以确保精确分割
                "-c:a", "aac", // 重新编码音频
                "-preset", "fast", // 使用快速预设
                "-crf", "23", // 质量设置
                "-avoid_negative_ts",
                "make_zero",
                output_path.to_str().unwrap(),
            ])
            .output()
            .map_err(|e| VideoError::FFmpegError(format!("Failed to run ffmpeg: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(VideoError::FFmpegError(format!(
                "ffmpeg failed for segment {}: {}",
                segment_index + 1,
                stderr
            )));
        }

        Ok(output_path)
    }

    pub async fn split_by_scenes(
        &self,
        video_path: &Path,
        scenes: &[ScenePoint],
        output_dir: &Path,
        output_format: &str,
    ) -> VideoResult<Vec<PathBuf>> {
        let mut output_files = Vec::new();

        for (i, scene) in scenes.iter().enumerate() {
            let start_time = if i == 0 { 0.0 } else { scenes[i - 1].time };
            let end_time = scene.time;

            let output_filename = format!(
                "scene_{}_{:03}.{}",
                video_path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("scene"),
                i + 1,
                output_format
            );

            let output_path = output_dir.join(output_filename);

            let output = Command::new(&self.ffmpeg_path)
                .args([
                    "-i",
                    video_path.to_str().unwrap(),
                    "-ss",
                    &start_time.to_string(),
                    "-to",
                    &end_time.to_string(),
                    "-c",
                    "copy",
                    "-avoid_negative_ts",
                    "make_zero",
                    output_path.to_str().unwrap(),
                ])
                .output()
                .map_err(|e| VideoError::FFmpegError(format!("Failed to run ffmpeg: {}", e)))?;

            if !output.status.success() {
                return Err(VideoError::FFmpegError(format!(
                    "ffmpeg failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                )));
            }

            output_files.push(output_path);
        }

        Ok(output_files)
    }
}
