use std::path::Path;
use std::process::Command;
use serde_json::Value;
use crate::models::*;
use crate::utils::{VideoResult, VideoError, validate_video_file};

pub struct VideoProcessor {
    ffmpeg_path: String,
    ffprobe_path: String,
}

impl VideoProcessor {
    pub fn new() -> Self {
        // 尝试不同的FFmpeg路径
        let ffmpeg_path = Self::find_ffmpeg_path();
        let ffprobe_path = Self::find_ffprobe_path();
        
        println!("Using ffmpeg path: {}", ffmpeg_path);
        println!("Using ffprobe path: {}", ffprobe_path);
        
        Self {
            ffmpeg_path,
            ffprobe_path,
        }
    }
    
    fn find_ffmpeg_path() -> String {
        let possible_paths = vec![
            "ffmpeg",
            "/usr/local/bin/ffmpeg",
            "/opt/homebrew/bin/ffmpeg",
            "/usr/bin/ffmpeg",
        ];
        
        for path in possible_paths {
            if std::process::Command::new(path)
                .arg("-version")
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
            {
                return path.to_string();
            }
        }
        
        "ffmpeg".to_string() // 默认回退
    }
    
    fn find_ffprobe_path() -> String {
        let possible_paths = vec![
            "ffprobe",
            "/usr/local/bin/ffprobe",
            "/opt/homebrew/bin/ffprobe",
            "/usr/bin/ffprobe",
        ];
        
        for path in possible_paths {
            if std::process::Command::new(path)
                .arg("-version")
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
            {
                return path.to_string();
            }
        }
        
        "ffprobe".to_string() // 默认回退
    }
    
    pub async fn get_video_info(&self, path: &str) -> VideoResult<VideoInfo> {
        let path_obj = Path::new(path);
        validate_video_file(path_obj)?;
        
        let output = Command::new(&self.ffprobe_path)
            .args([
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                path,
            ])
            .output()
            .map_err(|e| VideoError::FFmpegError(format!("Failed to run ffprobe: {}", e)))?;
            
        if !output.status.success() {
            return Err(VideoError::FFmpegError(format!(
                "ffprobe failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }
        
        let json: Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| VideoError::FFmpegError(format!("Failed to parse ffprobe output: {}", e)))?;
        
        self.parse_video_info(path, &json)
    }
    
    fn parse_video_info(&self, path: &str, json: &Value) -> VideoResult<VideoInfo> {
        let format = json.get("format")
            .ok_or_else(|| VideoError::FFmpegError("No format information".to_string()))?;
        
        let duration = format.get("duration")
            .and_then(|d| d.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.0);
        
        let size = format.get("size")
            .and_then(|s| s.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        
        let format_name = format.get("format_name")
            .and_then(|f| f.as_str())
            .unwrap_or("unknown");
        
        let streams = json.get("streams")
            .and_then(|s| s.as_array())
            .ok_or_else(|| VideoError::FFmpegError("No streams information".to_string()))?;
        
        let mut video_stream = None;
        
        for stream in streams {
            let codec_type = stream.get("codec_type")
                .and_then(|t| t.as_str())
                .unwrap_or("unknown");
            
            if codec_type == "video" {
                video_stream = Some(stream);
            }
        }
        
        let video_stream = video_stream
            .ok_or_else(|| VideoError::FFmpegError("No video stream found".to_string()))?;
        
        let width = video_stream.get("width")
            .and_then(|w| w.as_u64())
            .map(|w| w as u32)
            .unwrap_or(0);
        
        let height = video_stream.get("height")
            .and_then(|h| h.as_u64())
            .map(|h| h as u32)
            .unwrap_or(0);
        
        let fps = video_stream.get("r_frame_rate")
            .and_then(|r| r.as_str())
            .and_then(|s| {
                let parts: Vec<&str> = s.split('/').collect();
                if parts.len() == 2 {
                    let num = parts[0].parse::<f64>().unwrap_or(0.0);
                    let den = parts[1].parse::<f64>().unwrap_or(1.0);
                    if den != 0.0 { Some(num / den) } else { None }
                } else {
                    None
                }
            })
            .unwrap_or(0.0);
        
        let bitrate = format.get("bit_rate")
            .and_then(|b| b.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        
        let path_obj = Path::new(path);
        let filename = path_obj.file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("unknown")
            .to_string();
        
        Ok(VideoInfo {
            path: path_obj.to_path_buf(),
            filename,
            duration,
            width,
            height,
            fps,
            bitrate,
            format: format_name.to_string(),
            size,
        })
    }
    
    pub async fn detect_scenes(&self, video_path: &str, threshold: f32, min_duration: f64) -> VideoResult<Vec<ScenePoint>> {
        println!("Detecting scenes with threshold: {}, min_duration: {}", threshold, min_duration);
        
        let output = Command::new(&self.ffmpeg_path)
            .args([
                "-i", video_path,
                "-vf", &format!("select='gt(scene,{})',showinfo", threshold),
                "-f", "null",
                "-",
            ])
            .output()
            .map_err(|e| VideoError::FFmpegError(format!("Failed to run ffmpeg: {}", e)))?;
        
        // FFmpeg的showinfo输出在stderr中
        let stderr_output = String::from_utf8_lossy(&output.stderr);
        println!("FFmpeg stderr output: {}", stderr_output);
        
        self.parse_scene_detection_output(&output.stderr, min_duration)
    }
    
    fn parse_scene_detection_output(&self, output: &[u8], min_duration: f64) -> VideoResult<Vec<ScenePoint>> {
        let output_str = String::from_utf8_lossy(output);
        let mut scenes = Vec::new();
        let mut last_time = 0.0;
        
        for line in output_str.lines() {
            if line.contains("pts_time:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                for i in 0..parts.len() - 1 {
                    if parts[i] == "pts_time:" {
                        if let Ok(time) = parts[i + 1].parse::<f64>() {
                            if time - last_time >= min_duration {
                                scenes.push(ScenePoint {
                                    time,
                                    confidence: 1.0,
                                    frame_number: 0,
                                });
                                last_time = time;
                            }
                        }
                        break;
                    }
                }
            }
        }
        
        Ok(scenes)
    }
    
    pub async fn extract_thumbnail(&self, video_path: &str, time: f64, output_path: &str) -> VideoResult<String> {
        let output = Command::new(&self.ffmpeg_path)
            .args([
                "-i", video_path,
                "-ss", &time.to_string(),
                "-vframes", "1",
                "-q:v", "2",
                output_path,
            ])
            .output()
            .map_err(|e| VideoError::FFmpegError(format!("Failed to run ffmpeg: {}", e)))?;
            
        if !output.status.success() {
            return Err(VideoError::FFmpegError(format!(
                "ffmpeg failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }
        
        Ok(output_path.to_string())
    }
}