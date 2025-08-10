import React, { useState } from 'react';
import { Layout, Typography, Card, Row, Col, Button, Input, InputNumber, message, Progress, Divider, Space, Tag } from 'antd';
import { VideoCameraOutlined, ScissorOutlined, ClockCircleOutlined, PartitionOutlined, PlayCircleOutlined, InfoCircleOutlined, DownloadOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { VideoService } from './services/video';
import { ffmpegWasmService } from './services/ffmpegWasm';
import { VideoInfo, SplitRequest, SplitType } from './types/video';
import { formatFileSize, formatTime } from './utils/format';
import './App.css';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

interface SplitProgress {
  current: number;
  total: number;
  message: string;
  percentage: number;
}

const App: React.FC = () => {

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [videoPath, setVideoPath] = useState<string>('');
  const [splitType, setSplitType] = useState<'time' | 'scenes' | 'manual'>('time');
  const [splitParams, setSplitParams] = useState({
    duration: 60,
    count: 0,
    sceneThreshold: 0.3,
    manualPoints: [] as number[],
  });
  const [progress, setProgress] = useState<SplitProgress | null>(null);
  const [results, setResults] = useState<{filename: string, filepath: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [outputDir, setOutputDir] = useState<string>('');
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean>(true);
  const [ffmpegWasmAvailable, setFfmpegWasmAvailable] = useState<boolean>(false);
  const [ffmpegWasmLoading, setFfmpegWasmLoading] = useState<boolean>(false);
  const [scenes, setScenes] = useState<any[]>([]);

  // 检查FFmpeg是否可用
  React.useEffect(() => {
    const checkFFmpeg = async () => {
      try {
        // 这里可以添加一个检查FFmpeg是否可用的API调用
        setFfmpegAvailable(true);
      } catch (error) {
        setFfmpegAvailable(false);
        // 如果系统FFmpeg不可用，尝试初始化FFmpeg.wasm
        initializeFFmpegWasm();
      }
    };
    
    checkFFmpeg();
  }, []);

  const initializeFFmpegWasm = async () => {
    setFfmpegWasmLoading(true);
    try {
      await ffmpegWasmService.initialize();
      setFfmpegWasmAvailable(true);
      message.success('FFmpeg.wasm 已加载，可以使用浏览器内视频处理');
    } catch (error) {
      console.error('FFmpeg.wasm initialization failed:', error);
      message.error('FFmpeg.wasm 加载失败，请安装系统FFmpeg或检查网络连接');
    } finally {
      setFfmpegWasmLoading(false);
    }
  };



  const handleFileSelect = async (file: File) => {
    console.log('拖拽文件选择:', file);
    
    // 验证文件类型
    const videoTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
    const fileType = file.type;
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    const supportedFormats = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'];
    
    if (!videoTypes.includes(fileType) && !supportedFormats.includes(fileExtension || '')) {
      message.error(`不支持的视频格式：${fileExtension || fileType}。支持的格式：${supportedFormats.join(', ')}`);
      return false;
    }
    
    // 验证文件大小（限制为10GB）
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
    if (file.size > maxSize) {
      message.error('文件过大，请选择小于10GB的视频文件');
      return false;
    }
    
    setVideoFile(file);
    message.success(`拖拽文件已验证：${file.name} (${formatFileSize(file.size)})`);
    message.info('请点击"选择文件路径"按钮来设置完整的文件路径');
    
    return false;
  };

  const handleSplit = async () => {
    if (!videoPath) {
      message.error('请先输入视频文件路径并获取信息');
      return;
    }

    if (!ffmpegAvailable && !ffmpegWasmAvailable) {
      message.error('视频处理引擎不可用，请安装FFmpeg或加载FFmpeg.wasm');
      return;
    }

    // 选择输出目录
    let selectedOutputDir = outputDir;
    if (!selectedOutputDir) {
      try {
        const dir = await VideoService.selectOutputDirectory();
        if (!dir) {
          message.error('请选择输出目录');
          return;
        }
        selectedOutputDir = dir;
        setOutputDir(selectedOutputDir);
      } catch (error) {
        message.error('请手动输入输出目录路径');
        return;
      }
    }

    setLoading(true);
    setProgress({
      current: 0,
      total: 100,
      message: '正在分割视频...',
      percentage: 0,
    });

    try {
      // 构建分割请求
      let splitTypeObj: SplitType;
      switch (splitType) {
        case 'time':
          if (splitParams.duration <= 0) {
            throw new Error('分割时长必须大于0');
          }
          splitTypeObj = {
            time: {
              duration: splitParams.duration,
              count: splitParams.count || undefined
            }
          };
          break;
        case 'scenes':
          if (splitParams.sceneThreshold < 0.1 || splitParams.sceneThreshold > 1.0) {
            throw new Error('场景阈值必须在0.1到1.0之间');
          }
          splitTypeObj = {
            scenes: {
              threshold: splitParams.sceneThreshold,
              min_duration: 2.0 // 默认最小2秒
            }
          };
          break;
        case 'manual':
          if (splitParams.manualPoints.length === 0) {
            throw new Error('请至少添加一个分割点');
          }
          splitTypeObj = {
            manual: {
              split_points: splitParams.manualPoints
            }
          };
          break;
        default:
          throw new Error('不支持的分割类型');
      }

      const request: SplitRequest = {
        video_path: videoPath,
        output_dir: selectedOutputDir,
        output_format: 'mp4',
        split_type: splitTypeObj
      };

      // 调用后端API进行视频分割
      const result = await VideoService.splitVideo(request);
      
      if (result.success) {
        // 转换结果格式
        const splitResults = result.output_files.map(filepath => ({
          filename: filepath.split('/').pop() || 'unknown',
          filepath: filepath
        }));
        setResults(splitResults);
        message.success(`视频分割完成！生成了 ${splitResults.length} 个片段，耗时 ${result.processing_time.toFixed(2)} 秒`);
      } else {
        throw new Error(result.errors.join(', '));
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      message.error('分割失败：' + errorMessage);
      
      // 根据错误类型提供更详细的反馈
      if (errorMessage.includes('FFmpeg')) {
        message.error('请确保FFmpeg正确安装并配置');
      } else if (errorMessage.includes('file not found')) {
        message.error('视频文件不存在或无法访问');
      } else if (errorMessage.includes('permission')) {
        message.error('没有足够的权限访问文件或目录');
      } else if (errorMessage.includes('format')) {
        message.error('不支持的视频格式');
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleDownload = async (filepath: string) => {
    try {
      // 检查文件是否存在
      const fileExists = await checkFileExists(filepath);
      if (!fileExists) {
        message.error('文件不存在或已被移动');
        return;
      }
      
      await VideoService.openFile(filepath);
      message.success('文件已打开');
    } catch (error) {
      const errorMessage = (error as Error).message;
      message.error('打开文件失败：' + errorMessage);
      
      if (errorMessage.includes('not found')) {
        message.error('文件不存在，请检查文件路径');
      } else if (errorMessage.includes('permission')) {
        message.error('没有权限访问该文件');
      }
    }
  };

  const handleShowInFolder = async (filepath: string) => {
    try {
      // 检查文件是否存在
      const fileExists = await checkFileExists(filepath);
      if (!fileExists) {
        message.error('文件不存在或已被移动');
        return;
      }
      
      await VideoService.showInFolder(filepath);
      message.success('已在文件夹中显示');
    } catch (error) {
      const errorMessage = (error as Error).message;
      message.error('显示文件失败：' + errorMessage);
      
      if (errorMessage.includes('not found')) {
        message.error('文件不存在，请检查文件路径');
      } else if (errorMessage.includes('permission')) {
        message.error('没有权限访问该文件夹');
      }
    }
  };

  // 检查文件是否存在的辅助函数
  const checkFileExists = async (filepath: string): Promise<boolean> => {
    try {
      return await VideoService.fileExists(filepath);
    } catch (error) {
      return false;
    }
  };

  // 手动分割点处理函数
  const addManualSplitPoint = (timeInput: string) => {
    try {
      let seconds: number;
      
      // 检查是否是时:分:秒格式
      if (timeInput.includes(':')) {
        const parts = timeInput.split(':').map(p => parseInt(p.trim()));
        if (parts.length === 3) {
          // 时:分:秒
          seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          // 分:秒
          seconds = parts[0] * 60 + parts[1];
        } else {
          throw new Error('时间格式错误');
        }
      } else {
        // 直接是秒数
        seconds = parseFloat(timeInput);
      }

      if (isNaN(seconds) || seconds < 0) {
        message.error('请输入有效的时间');
        return;
      }

      // 允许分割点接近视频结尾，但不能超过视频时长减去1秒
      if (videoInfo && seconds >= (videoInfo.duration - 1)) {
        message.error(`分割点不能超过视频时长 ${formatTime(videoInfo.duration)}，输入的时间为 ${formatTime(seconds)}。建议设置在 ${formatTime(videoInfo.duration - 1)} 之前`);
        return;
      }

      // 检查是否已存在相同的分割点
      if (splitParams.manualPoints.includes(seconds)) {
        message.error('该分割点已存在');
        return;
      }

      // 添加分割点并排序
      const newPoints = [...splitParams.manualPoints, seconds].sort((a, b) => a - b);
      setSplitParams(prev => ({ ...prev, manualPoints: newPoints }));
      message.success(`已添加分割点：${formatTime(seconds)}`);
    } catch (error) {
      message.error('时间格式错误，请使用 时:分:秒 或 秒数 格式');
    }
  };

  const removeManualSplitPoint = (index: number) => {
    const newPoints = splitParams.manualPoints.filter((_, i) => i !== index);
    setSplitParams(prev => ({ ...prev, manualPoints: newPoints }));
    message.success('分割点已删除');
  };


  const handlePreviewSplitPoints = async () => {
    if (!videoPath) {
      message.error('请先选择视频文件');
      return;
    }

    if (splitType === 'scenes') {
      setLoading(true);
      try {
        const detectedScenes = await VideoService.detectScenes(videoPath, splitParams.sceneThreshold);
        setScenes(detectedScenes);
        
        // 将场景点设置为手动分割点
        const scenePoints = detectedScenes.map(scene => scene.time);
        setSplitParams(prev => ({ ...prev, manualPoints: scenePoints }));
        
        message.success(`检测到 ${detectedScenes.length} 个场景变化点`);
      } catch (error) {
        message.error('场景检测失败：' + (error as Error).message);
      } finally {
        setLoading(false);
      }
    } else if (splitType === 'time') {
      // 计算时间分割点
      const duration = videoInfo?.duration || 0;
      const segmentDuration = splitParams.duration;
      const segmentCount = splitParams.count || Math.ceil(duration / segmentDuration);
      
      const timePoints: number[] = [];
      for (let i = 1; i < segmentCount; i++) {
        timePoints.push(i * segmentDuration);
      }
      
      setSplitParams(prev => ({ ...prev, manualPoints: timePoints }));
      message.success(`生成了 ${timePoints.length} 个时间分割点`);
    } else {
      message.info('请先选择分割类型');
    }
  };

  return (
    <Layout className="app">
      <Header className="header">
        <div className="header-content">
          <Title level={1} style={{ color: 'white', margin: '-8px 0 0 0', fontSize: '2.5rem', fontWeight: 'bold' }}>
            <VideoCameraOutlined style={{ marginRight: '12px', fontSize: '2.2rem' }} /> 
            视频分割工具
          </Title>
          <Paragraph style={{ 
            color: 'rgba(255, 255, 255, 0.9)', 
            margin: '12px 0 0 0', 
            fontSize: '1.1rem',
            fontWeight: '300'
          }}>
            🎬 专业视频分割工具 - 支持场景检测、时间分割、手动分割
          </Paragraph>
          <div style={{ 
            marginTop: '16px', 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '24px',
            fontSize: '0.9rem',
            color: 'rgba(255, 255, 255, 0.8)'
          }}>
            <span>⚡ 高性能处理</span>
            <span>🎯 精确分割</span>
            <span>🚀 简单易用</span>
          </div>
        </div>
      </Header>

      <Content className="main-container">
        {/* FFmpeg可用性检查 */}
        {!ffmpegAvailable && !ffmpegWasmAvailable && !ffmpegWasmLoading && (
          <Card className="warning-card" style={{ marginBottom: '16px', backgroundColor: '#fff2f0', borderColor: '#ffccc7' }}>
            <Title level={4} style={{ color: '#cf1322' }}>
              ⚠️ 视频处理引擎不可用
            </Title>
            <Paragraph style={{ color: '#cf1322' }}>
              系统FFmpeg和FFmpeg.wasm都不可用。请选择以下方案之一：
              <br />
              <strong>方案1 - 安装系统FFmpeg（推荐，性能更好）：</strong>
              <br />
              macOS: <code>brew install ffmpeg</code>
              <br />
              Ubuntu: <code>sudo apt install ffmpeg</code>
              <br />
              Windows: 从 <a href="https://ffmpeg.org/download.html" target="_blank" rel="noopener noreferrer">FFmpeg官网</a> 下载
              <br />
              <strong>方案2 - 使用浏览器内处理：</strong>
              <br />
              <Button type="primary" onClick={initializeFFmpegWasm} style={{ marginTop: '8px' }}>
                加载 FFmpeg.wasm（需要网络连接）
              </Button>
            </Paragraph>
          </Card>
        )}

        {ffmpegWasmLoading && (
          <Card style={{ marginBottom: '16px', backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
            <Title level={4} style={{ color: '#389e0d' }}>
              🔄 正在加载 FFmpeg.wasm...
            </Title>
            <Paragraph style={{ color: '#389e0d' }}>
              首次加载需要下载约25MB的文件，请稍候...
            </Paragraph>
            <Progress percent={50} status="active" />
          </Card>
        )}

        {ffmpegWasmAvailable && (
          <Card style={{ marginBottom: '16px', backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
            <Title level={4} style={{ color: '#389e0d' }}>
              ✅ FFmpeg.wasm 已就绪
            </Title>
            <Paragraph style={{ color: '#389e0d' }}>
              🌐 使用浏览器内视频处理 | 📦 无需安装额外软件 | ⚡ 即开即用
              <br />
              <small>注意：浏览器内处理速度比系统FFmpeg慢，适合小文件处理</small>
            </Paragraph>
          </Card>
        )}

        {/* 文件上传区域 */}
        <Card className="upload-card">
          <Title level={2}>
            <ScissorOutlined /> 选择视频文件
          </Title>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              视频文件路径 <span style={{ color: '#ff4d4f', fontSize: '12px' }}>*</span>：
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Input
                value={videoPath}
                onChange={(e) => setVideoPath(e.target.value)}
                placeholder="请输入视频文件的完整路径，或通过下方按钮选择"
                style={{ flex: 1 }}
              />
              <Button 
                onClick={async () => {
                  try {
                    const filePath = await VideoService.selectVideoFile();
                    if (filePath) {
                      setVideoPath(filePath);
                      message.success('文件路径已选择');
                    }
                  } catch (error) {
                    message.error('选择文件路径失败');
                  }
                }}
              >
                选择文件路径
              </Button>
              <Button 
                type="primary"
                onClick={async () => {
                  if (!videoPath) {
                    message.error('请先输入视频文件路径');
                    return;
                  }
                  
                  try {
                    const info = await VideoService.getVideoInfo(videoPath);
                    setVideoInfo(info);
                    
                    // 设置默认输出目录
                    const defaultOutputDir = info.path.substring(0, info.path.lastIndexOf('/'));
                    setOutputDir(defaultOutputDir);
                    
                    message.success('视频信息获取成功');
                  } catch (error) {
                    const errorMessage = (error as Error).message;
                    message.error('获取视频信息失败：' + errorMessage);
                    
                    if (errorMessage.includes('FFmpeg')) {
                      message.error('FFmpeg未正确安装或配置');
                    } else if (errorMessage.includes('file not found')) {
                      message.error('无法访问视频文件');
                    } else if (errorMessage.includes('format')) {
                      message.error('不支持的视频格式');
                    }
                  }
                }}
              >
                获取信息
              </Button>
            </div>
          </div>

          <div
            className="custom-drag-area"
            style={{
              border: '2px dashed #d9d9d9',
              borderRadius: '8px',
              padding: '40px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backgroundColor: '#fafafa'
            }}
            onClick={async () => {
              if (loading) return;
              try {
                const filePath = await VideoService.selectVideoFile();
                if (filePath) {
                  setVideoPath(filePath);
                  message.success('文件路径已选择，正在获取视频信息...');
                  
                  try {
                    const info = await VideoService.getVideoInfo(filePath);
                    setVideoInfo(info);
                    
                    const defaultOutputDir = info.path.substring(0, info.path.lastIndexOf('/'));
                    setOutputDir(defaultOutputDir);
                    
                    message.success('视频信息获取成功，可以开始分割');
                  } catch (error) {
                    message.error('获取视频信息失败，请检查文件路径');
                  }
                }
              } catch (error) {
                message.error('选择文件失败');
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#1890ff';
              e.currentTarget.style.backgroundColor = '#e6f7ff';
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.borderColor = '#d9d9d9';
              e.currentTarget.style.backgroundColor = '#fafafa';
            }}
            onDrop={async (e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#d9d9d9';
              e.currentTarget.style.backgroundColor = '#fafafa';
              
              if (loading) return;
              
              const files = e.dataTransfer.files;
              if (files.length > 0) {
                await handleFileSelect(files[0]);
              }
            }}
          >
            <p style={{ margin: 0, marginBottom: '16px' }}>
              <VideoCameraOutlined style={{ fontSize: '48px', color: '#667eea' }} />
            </p>
            <p style={{ fontSize: '16px', margin: '8px 0', fontWeight: 'bold' }}>
              点击选择视频文件或拖拽文件到此处
            </p>
            <p style={{ color: '#666', margin: '8px 0' }}>
              支持 MP4, AVI, MOV, MKV 等常见视频格式<br/>
              文件大小限制：10GB
            </p>
          </div>

          {videoFile && (
            <div style={{ marginTop: '16px' }}>
              <Tag color="blue">
                <InfoCircleOutlined /> {videoFile.name}
              </Tag>
              <Tag color="green">{formatFileSize(videoFile.size)}</Tag>
              {videoPath ? (
                <Tag color="success">
                  文件路径已设置
                </Tag>
              ) : (
                <Tag color="warning">
                  请手动选择文件路径
                </Tag>
              )}
            </div>
          )}
        </Card>

        {/* 视频信息展示 */}
        {videoInfo && (
          <Card className="info-card">
            <Title level={3}>
              <InfoCircleOutlined /> 视频信息
            </Title>
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <div className="info-item">
                  <div className="label">时长</div>
                  <div className="value">{formatTime(videoInfo.duration)}</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="info-item">
                  <div className="label">分辨率</div>
                  <div className="value">{videoInfo.width} × {videoInfo.height}</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="info-item">
                  <div className="label">帧率</div>
                  <div className="value">{videoInfo.fps} fps</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="info-item">
                  <div className="label">格式</div>
                  <div className="value">{videoInfo.format.toUpperCase()}</div>
                </div>
              </Col>
            </Row>
          </Card>
        )}

        {/* 分割选项 */}
        {videoInfo && (
          <Card className="split-card">
            <Title level={2}>
              <PartitionOutlined /> 分割设置
            </Title>
            
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col span={8}>
                <Card
                  className={`split-option ${splitType === 'time' ? 'selected' : ''}`}
                  onClick={() => setSplitType('time')}
                  hoverable
                >
                  <ClockCircleOutlined style={{ fontSize: '32px', marginBottom: '8px' }} />
                  <Title level={4}>时间分割</Title>
                  <Paragraph>按固定时长或段数分割</Paragraph>
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  className={`split-option ${splitType === 'scenes' ? 'selected' : ''}`}
                  onClick={() => setSplitType('scenes')}
                  hoverable
                >
                  <PlayCircleOutlined style={{ fontSize: '32px', marginBottom: '8px' }} />
                  <Title level={4}>场景分割</Title>
                  <Paragraph>智能检测场景变化</Paragraph>
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  className={`split-option ${splitType === 'manual' ? 'selected' : ''}`}
                  onClick={() => setSplitType('manual')}
                  hoverable
                >
                  <ScissorOutlined style={{ fontSize: '32px', marginBottom: '8px' }} />
                  <Title level={4}>手动分割</Title>
                  <Paragraph>自定义分割点</Paragraph>
                </Card>
              </Col>
            </Row>

            {/* 分割参数设置 */}
            {splitType === 'time' && (
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <div>
                    <label>每段时长（秒）</label>
                    <InputNumber
                      min={1}
                      max={videoInfo?.duration || 3600}
                      value={splitParams.duration}
                      onChange={(value) => setSplitParams(prev => ({ ...prev, duration: value || 60 }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    <label>分割段数</label>
                    <InputNumber
                      min={1}
                      max={100}
                      value={splitParams.count}
                      onChange={(value) => setSplitParams(prev => ({ ...prev, count: value || 0 }))}
                      placeholder="留空则按时长分割"
                      style={{ width: '100%' }}
                    />
                  </div>
                </Col>
              </Row>
            )}

            {splitType === 'scenes' && (
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <div>
                    <label>场景变化阈值</label>
                    <InputNumber
                      min={0.1}
                      max={1.0}
                      step={0.1}
                      value={splitParams.sceneThreshold}
                      onChange={(value) => setSplitParams(prev => ({ ...prev, sceneThreshold: value || 0.3 }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </Col>
              </Row>
            )}

            {splitType === 'manual' && (
              <div>
                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                  <Col span={24}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px' }}>
                        手动添加分割点（格式：时:分:秒 或 秒数）
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Input
                          placeholder="例如：01:30:00 或 90"
                          onPressEnter={(e) => {
                            const value = (e.target as HTMLInputElement).value.trim();
                            if (value) {
                              addManualSplitPoint(value);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                          style={{ flex: 1 }}
                        />
                        <Button 
                          type="primary" 
                          onClick={() => {
                            const input = document.querySelector('input[placeholder*="例如"]') as HTMLInputElement;
                            if (input && input.value.trim()) {
                              addManualSplitPoint(input.value.trim());
                              input.value = '';
                            }
                          }}
                        >
                          添加
                        </Button>
                        <Button 
                          onClick={() => setSplitParams(prev => ({ ...prev, manualPoints: [] }))}
                        >
                          清空
                        </Button>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                        支持格式：时:分:秒（如 01:30:45）或秒数（如 90）
                      </div>
                    </div>
                  </Col>
                </Row>
                
                {splitParams.manualPoints.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px' }}>
                      当前分割点 ({splitParams.manualPoints.length}个)：
                    </label>
                    <div style={{ 
                      maxHeight: '120px', 
                      overflowY: 'auto', 
                      border: '1px solid #d9d9d9', 
                      borderRadius: '6px', 
                      padding: '8px' 
                    }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {splitParams.manualPoints.map((point, index) => (
                          <div key={index} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '4px 8px',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '4px'
                          }}>
                            <span>分割点 {index + 1}: {formatTime(point)}</span>
                            <Button 
                              type="link" 
                              size="small" 
                              danger
                              onClick={() => removeManualSplitPoint(index)}
                            >
                              删除
                            </Button>
                          </div>
                        ))}
                      </Space>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Divider />

            {/* 输出目录选择 */}
            <div style={{ marginBottom: '16px' }}>
              <label>输出目录：</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <Input
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  placeholder="输入输出目录的完整路径"
                  style={{ flex: 1 }}
                />
                <Button 
                  onClick={() => {
                    // 设置默认输出目录
                    if (videoPath) {
                      const defaultDir = videoPath.substring(0, videoPath.lastIndexOf('/'));
                      setOutputDir(defaultDir);
                      message.success('已设置默认输出目录');
                    } else {
                      message.error('请先选择视频文件');
                    }
                  }}
                >
                  默认目录
                </Button>
              </div>
            </div>

            {/* 操作按钮 */}
            <Space>
              <Button
                type="primary"
                size="large"
                onClick={handleSplit}
                loading={loading}
                disabled={!videoInfo || (!ffmpegAvailable && !ffmpegWasmAvailable)}
                icon={<ScissorOutlined />}
              >
                开始分割
              </Button>
              <Button 
                size="large" 
                disabled={!videoInfo}
                onClick={handlePreviewSplitPoints}
                loading={loading}
              >
                预览分割点
              </Button>
            </Space>
          </Card>
        )}

        {/* 进度显示 */}
        {progress && (
          <Card className="progress-card">
            <Title level={3}>分割进度</Title>
            <Progress percent={Math.round(progress.percentage)} status="active" />
            <div style={{ marginTop: '8px', color: '#666' }}>
              {progress.message}
            </div>
          </Card>
        )}

        {/* 检测到的场景/分割点预览 */}
        {scenes.length > 0 && (
          <Card className="scenes-card">
            <Title level={3}>
              <PlayCircleOutlined /> 检测到的场景点
            </Title>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {scenes.map((scene, index) => (
                  <div key={index} className="scene-item">
                    <span>{formatTime(scene.time)}</span>
                    <Tag color="blue">
                      置信度: {(scene.confidence * 100).toFixed(1)}%
                    </Tag>
                  </div>
                ))}
              </Space>
            </div>
          </Card>
        )}

        {/* 手动分割点 */}
        {splitParams.manualPoints.length > 0 && (
          <Card className="manual-points-card">
            <Title level={3}>
              <ScissorOutlined /> 分割点预览
            </Title>
            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {splitParams.manualPoints.map((point, index) => (
                  <div key={index} className="manual-point-item">
                    <span>分割点 {index + 1}: {formatTime(point)}</span>
                  </div>
                ))}
              </Space>
            </div>
          </Card>
        )}

        {/* 分割结果 */}
        {results.length > 0 && (
          <Card className="results-card">
            <Title level={3}>分割结果</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              {results.map((result, index) => (
                <div key={index} className="result-item">
                  <span>{result.filename}</span>
                  <Space>
                    <Button 
                      type="link" 
                      size="small" 
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(result.filepath)}
                    >
                      下载
                    </Button>
                    <Button 
                      type="link" 
                      size="small" 
                      icon={<FolderOpenOutlined />}
                      onClick={() => handleShowInFolder(result.filepath)}
                    >
                      打开文件夹
                    </Button>
                  </Space>
                </div>
              ))}
            </Space>
          </Card>
        )}
      </Content>
    </Layout>
  );
};

export default App;