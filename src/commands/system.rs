use serde::{Deserialize, Serialize};
use sysinfo::System;

#[derive(Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub memory_total: u64,
    pub disk_usage: u64,
    pub disk_total: u64,
    pub cpu_cores: usize,
}

#[derive(Serialize, Deserialize)]
pub struct SystemRequirements {
    pub ffmpeg_available: bool,
    pub recommended_memory: u64,
    pub recommended_disk_space: u64,
}

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    let os = System::long_os_version().unwrap_or_else(|| "Unknown".to_string());
    let cpu_usage = sys.global_cpu_info().cpu_usage();
    let memory_usage = sys.used_memory();
    let memory_total = sys.total_memory();
    let disk_total = sys.total_memory(); // Using memory as proxy for now
    let disk_usage = sys.used_memory();
    let cpu_cores = sys.cpus().len();
    
    Ok(SystemInfo {
        os,
        cpu_usage,
        memory_usage,
        memory_total,
        disk_usage,
        disk_total,
        cpu_cores,
    })
}

#[tauri::command]
pub async fn check_system_requirements() -> Result<SystemRequirements, String> {
    let ffmpeg_available = check_ffmpeg_available();
    
    Ok(SystemRequirements {
        ffmpeg_available,
        recommended_memory: 4 * 1024 * 1024 * 1024, // 4GB
        recommended_disk_space: 10 * 1024 * 1024 * 1024, // 10GB
    })
}

#[tauri::command]
pub async fn get_cpu_usage() -> Result<f32, String> {
    let mut sys = System::new_all();
    sys.refresh_cpu();
    Ok(sys.global_cpu_info().cpu_usage())
}

#[tauri::command]
pub async fn get_memory_usage() -> Result<(u64, u64), String> {
    let mut sys = System::new_all();
    sys.refresh_memory();
    Ok((sys.used_memory(), sys.total_memory()))
}

fn check_ffmpeg_available() -> bool {
    println!("Checking FFmpeg availability...");
    
    let result = std::process::Command::new("ffmpeg")
        .arg("-version")
        .output()
        .map(|output| {
            let success = output.status.success();
            println!("FFmpeg command result: success={}, stderr={}", 
                success, String::from_utf8_lossy(&output.stderr));
            success
        })
        .unwrap_or_else(|e| {
            println!("FFmpeg command failed: {}", e);
            false
        });
    
    println!("FFmpeg available: {}", result);
    result
}

#[tauri::command]
pub async fn open_file_explorer(path: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map(|_| true)
            .map_err(|e| format!("Failed to open explorer: {}", e))
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(&path)
            .spawn()
            .map(|_| true)
            .map_err(|e| format!("Failed to open finder: {}", e))
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map(|_| true)
            .map_err(|e| format!("Failed to open file manager: {}", e))
    }
}