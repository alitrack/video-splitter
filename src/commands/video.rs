use tauri::{State, WebviewWindow};
use serde::{Deserialize, Serialize};
use crate::models::*;
use crate::AppState;

#[derive(Serialize, Deserialize)]
pub struct SplitResult {
    pub success: bool,
    pub output_files: Vec<String>,
    pub errors: Vec<String>,
    pub processing_time: f64,
}

#[derive(Serialize, Deserialize)]
pub struct VideoInfoRequest {
    pub path: String,
}

#[derive(Serialize, Deserialize)]
pub struct DetectScenesRequest {
    pub video_path: String,
    pub threshold: f32,
    pub min_duration: Option<f64>,
}

#[tauri::command]
pub async fn get_video_info(
    path: String,
    state: State<'_, AppState>,
) -> Result<VideoInfo, String> {
    let video_processor = state.video_processor.lock().await;
    video_processor.get_video_info(&path)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SplitRequestFrontend {
    pub video_path: String,
    pub output_dir: String,
    pub output_format: String,
    pub split_type: serde_json::Value, // 使用通用的JSON值来处理复杂的嵌套结构
}

#[tauri::command]
pub async fn split_video(
    request: SplitRequestFrontend,
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<SplitResult, String> {
    println!("Received split request: {:?}", request);
    
    let video_splitter = state.video_splitter.lock().await;
    
    // 转换前端请求到后端格式
    let split_type = if let Some(time_obj) = request.split_type.get("time") {
        let duration = time_obj.get("duration").and_then(|v| v.as_f64()).unwrap_or(60.0);
        let count = time_obj.get("count").and_then(|v| v.as_u64()).map(|v| v as u32);
        println!("Time split: duration={}, count={:?}", duration, count);
        crate::models::SplitType::Time { duration, count }
    } else if let Some(scenes_obj) = request.split_type.get("scenes") {
        let threshold = scenes_obj.get("threshold").and_then(|v| v.as_f64()).unwrap_or(0.3) as f32;
        let min_duration = scenes_obj.get("min_duration").and_then(|v| v.as_f64());
        println!("Scenes split: threshold={}, min_duration={:?}", threshold, min_duration);
        crate::models::SplitType::Scenes { threshold, min_duration }
    } else if let Some(manual_obj) = request.split_type.get("manual") {
        let split_points = manual_obj.get("split_points")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_f64()).collect())
            .unwrap_or_default();
        println!("Manual split: split_points={:?}", split_points);
        crate::models::SplitType::Manual { split_points }
    } else {
        println!("Invalid split_type format: {:?}", request.split_type);
        return Err(format!("Invalid split_type format: {:?}", request.split_type));
    };
    
    let split_request = crate::models::SplitRequest {
        video_path: std::path::PathBuf::from(&request.video_path),
        split_type,
        output_dir: std::path::PathBuf::from(&request.output_dir),
        output_format: request.output_format,
    };
    
    println!("Calling video_splitter.split_video with request: {:?}", split_request);
    
    let result = video_splitter.split_video(split_request, &window).await
        .map_err(|e| {
            println!("Split video error: {}", e);
            e.to_string()
        })?;
    
    // 转换结果中的PathBuf为字符串
    let output_files: Vec<String> = result.output_files
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect();
    
    println!("Split completed successfully with {} files", output_files.len());
    
    Ok(SplitResult {
        success: result.success,
        output_files,
        errors: result.errors,
        processing_time: result.processing_time,
    })
}

#[tauri::command]
pub async fn detect_scenes(
    request: DetectScenesRequest,
    state: State<'_, AppState>,
) -> Result<Vec<ScenePoint>, String> {
    let video_processor = state.video_processor.lock().await;
    let min_duration = request.min_duration.unwrap_or(2.0);
    video_processor.detect_scenes(&request.video_path, request.threshold, min_duration)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_video_thumbnail(
    video_path: String,
    time_seconds: f64,
    output_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let video_processor = state.video_processor.lock().await;
    video_processor.extract_thumbnail(&video_path, time_seconds, &output_path)
        .await
        .map_err(|e| e.to_string())
}