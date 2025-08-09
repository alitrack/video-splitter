use std::error::Error;
use std::fmt;

#[derive(Debug)]
pub enum VideoError {
    FFmpegError(String),
    FileNotFound(String),
    InvalidFormat(String),
    ProcessingError(String),
    IoError(std::io::Error),
}

impl fmt::Display for VideoError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            VideoError::FFmpegError(msg) => write!(f, "FFmpeg error: {}", msg),
            VideoError::FileNotFound(msg) => write!(f, "File not found: {}", msg),
            VideoError::InvalidFormat(msg) => write!(f, "Invalid format: {}", msg),
            VideoError::ProcessingError(msg) => write!(f, "Processing error: {}", msg),
            VideoError::IoError(err) => write!(f, "IO error: {}", err),
        }
    }
}

impl Error for VideoError {}

impl From<std::io::Error> for VideoError {
    fn from(err: std::io::Error) -> Self {
        VideoError::IoError(err)
    }
}

pub type VideoResult<T> = Result<T, VideoError>;

#[allow(dead_code)]
pub fn format_duration(seconds: f64) -> String {
    let hours = (seconds / 3600.0) as u32;
    let minutes = ((seconds % 3600.0) / 60.0) as u32;
    let secs = (seconds % 60.0) as u32;
    
    if hours > 0 {
        format!("{:02}:{:02}:{:02}", hours, minutes, secs)
    } else {
        format!("{:02}:{:02}", minutes, secs)
    }
}

#[allow(dead_code)]
pub fn format_file_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    format!("{:.1} {}", size, UNITS[unit_index])
}

pub fn validate_video_file(path: &std::path::Path) -> VideoResult<()> {
    if !path.exists() {
        return Err(VideoError::FileNotFound(path.to_string_lossy().to_string()));
    }
    
    if !path.is_file() {
        return Err(VideoError::InvalidFormat("Not a file".to_string()));
    }
    
    let extension = path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");
    
    let supported_formats = ["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm"];
    if !supported_formats.contains(&extension.to_lowercase().as_str()) {
        return Err(VideoError::InvalidFormat(format!("Unsupported format: {}", extension)));
    }
    
    Ok(())
}