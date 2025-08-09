use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoInfo {
    pub path: PathBuf,
    pub filename: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub bitrate: u64,
    pub format: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SplitRequest {
    pub video_path: PathBuf,
    pub split_type: SplitType,
    pub output_dir: PathBuf,
    pub output_format: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum SplitType {
    #[serde(rename = "time")]
    Time { duration: f64, count: Option<u32> },
    #[serde(rename = "scenes")]
    Scenes { threshold: f32, min_duration: Option<f64> },
    #[serde(rename = "manual")]
    Manual { split_points: Vec<f64> },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SplitResult {
    pub success: bool,
    pub output_files: Vec<PathBuf>,
    pub errors: Vec<String>,
    pub processing_time: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressInfo {
    pub current: u32,
    pub total: u32,
    pub message: String,
    pub percentage: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScenePoint {
    pub time: f64,
    pub confidence: f32,
    pub frame_number: u64,
}