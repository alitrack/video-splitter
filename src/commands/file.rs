use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct FileDialogOptions {
    pub title: String,
    pub filters: Vec<FileDialogFilter>,
}

#[derive(Serialize, Deserialize)]
pub struct FileDialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[tauri::command]
pub async fn select_video_file() -> Result<String, String> {
    use rfd::FileDialog;
    
    let result = FileDialog::new()
        .add_filter("Video files", &["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm"])
        .pick_file();
    
    match result {
        Some(file_path) => Ok(file_path.to_string_lossy().to_string()),
        None => Err("No file selected".to_string()),
    }
}

#[tauri::command]
pub async fn select_output_directory() -> Result<String, String> {
    use rfd::FileDialog;
    
    let result = FileDialog::new().pick_folder();
    
    match result {
        Some(folder_path) => Ok(folder_path.to_string_lossy().to_string()),
        None => Err("No folder selected".to_string()),
    }
}

#[tauri::command]
pub async fn file_exists(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).exists())
}

#[tauri::command]
pub async fn create_directory(path: String) -> Result<bool, String> {
    match std::fs::create_dir_all(&path) {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Failed to create directory: {}", e)),
    }
}

#[tauri::command]
pub async fn get_file_size(path: String) -> Result<u64, String> {
    match std::fs::metadata(&path) {
        Ok(metadata) => Ok(metadata.len()),
        Err(e) => Err(format!("Failed to get file size: {}", e)),
    }
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<bool, String> {
    match std::fs::remove_file(&path) {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Failed to delete file: {}", e)),
    }
}

