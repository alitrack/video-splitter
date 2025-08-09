// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::sync::Arc;
use tokio::sync::Mutex;

mod commands;
mod services;
mod utils;
mod models;

use services::video_processor::VideoProcessor;
use services::splitter::VideoSplitter;

pub struct AppState {
    pub video_processor: Arc<Mutex<VideoProcessor>>,
    pub video_splitter: Arc<Mutex<VideoSplitter>>,
}

fn main() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            
            // Initialize services
            let video_processor = Arc::new(Mutex::new(VideoProcessor::new()));
            let video_splitter = Arc::new(Mutex::new(VideoSplitter::new()));
            
            // Manage state
            app.manage(AppState {
                video_processor,
                video_splitter,
            });
            
            // Set window size and title
            window.set_title("Video Splitter").unwrap();
            window.set_size(tauri::LogicalSize::new(1200.0, 800.0)).unwrap();
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::video::get_video_info,
            commands::video::split_video,
            commands::video::detect_scenes,
            commands::video::get_video_thumbnail,
            commands::file::select_video_file,
            commands::file::select_output_directory,
            commands::file::file_exists,
            commands::file::create_directory,
            commands::file::get_file_size,
            commands::file::delete_file,
            commands::system::get_system_info,
            commands::system::check_system_requirements,
            commands::system::get_cpu_usage,
            commands::system::get_memory_usage,
            commands::system::open_file_explorer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
