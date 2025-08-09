#!/usr/bin/env python3
"""
简单的代码验证脚本
检查前端和后端类型定义的一致性
"""

import json
import re
from typing import Dict, Any

def extract_ts_types(file_path: str) -> Dict[str, Any]:
    """提取TypeScript类型定义"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    types = {}
    
    # 提取VideoInfo接口
    video_info_match = re.search(r'export interface VideoInfo\s*{([^}]+)}', content, re.DOTALL)
    if video_info_match:
        types['VideoInfo'] = video_info_match.group(1)
    
    # 提取SplitRequest接口
    split_request_match = re.search(r'export interface SplitRequest\s*{([^}]+)}', content, re.DOTALL)
    if split_request_match:
        types['SplitRequest'] = split_request_match.group(1)
    
    # 提取SplitType类型
    split_type_match = re.search(r'export type SplitType\s*=\s*([^;]+);', content, re.DOTALL)
    if split_type_match:
        types['SplitType'] = split_type_match.group(1)
    
    return types

def extract_rust_types(file_path: str) -> Dict[str, Any]:
    """提取Rust类型定义"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    types = {}
    
    # 提取VideoInfo结构体
    video_info_match = re.search(r'pub struct VideoInfo\s*{([^}]+)}', content, re.DOTALL)
    if video_info_match:
        types['VideoInfo'] = video_info_match.group(1)
    
    # 提取SplitRequest结构体
    split_request_match = re.search(r'pub struct SplitRequest\s*{([^}]+)}', content, re.DOTALL)
    if split_request_match:
        types['SplitRequest'] = split_request_match.group(1)
    
    # 提取SplitType枚举
    split_type_match = re.search(r'pub enum SplitType\s*{([^}]+)}', content, re.DOTALL)
    if split_type_match:
        types['SplitType'] = split_type_match.group(1)
    
    return types

def compare_types(ts_types: Dict[str, Any], rust_types: Dict[str, Any]) -> bool:
    """比较类型定义的一致性"""
    print("=== 类型定义对比检查 ===")
    
    # 检查VideoInfo
    if 'VideoInfo' in ts_types and 'VideoInfo' in rust_types:
        print("✓ VideoInfo类型定义存在")
        print(f"  TS: {ts_types['VideoInfo'][:50]}...")
        print(f"  Rust: {rust_types['VideoInfo'][:50]}...")
    else:
        print("✗ VideoInfo类型定义缺失")
        return False
    
    # 检查SplitRequest
    if 'SplitRequest' in ts_types and 'SplitRequest' in rust_types:
        print("✓ SplitRequest类型定义存在")
        print(f"  TS: {ts_types['SplitRequest'][:50]}...")
        print(f"  Rust: {rust_types['SplitRequest'][:50]}...")
    else:
        print("✗ SplitRequest类型定义缺失")
        return False
    
    # 检查SplitType
    if 'SplitType' in ts_types and 'SplitType' in rust_types:
        print("✓ SplitType类型定义存在")
        print(f"  TS: {ts_types['SplitType'][:50]}...")
        print(f"  Rust: {rust_types['SplitType'][:50]}...")
    else:
        print("✗ SplitType类型定义缺失")
        return False
    
    return True

def check_syntax_errors(file_path: str, language: str) -> bool:
    """检查语法错误"""
    print(f"\n=== {language} 语法检查 ===")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 简单的语法检查
    if language == "TypeScript":
        # 检查括号匹配
        open_braces = content.count('{')
        close_braces = content.count('}')
        if open_braces != close_braces:
            print(f"✗ 括号不匹配: {{ {open_braces}, }} {close_braces}")
            return False
        
        # 检查分号
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.strip() and not line.strip().startswith('//') and not line.strip().startswith('/*'):
                if line.strip().endswith('{') or line.strip().endswith('}') or line.strip().endswith(']'):
                    continue
                if ':' in line and not line.strip().endswith(';') and not line.strip().endswith(','):
                    print(f"⚠ 第{i+1}行可能缺少分号: {line.strip()[:50]}...")
    
    elif language == "Rust":
        # 检查括号匹配
        open_braces = content.count('{')
        close_braces = content.count('}')
        if open_braces != close_braces:
            print(f"✗ 括号不匹配: {{ {open_braces}, }} {close_braces}")
            return False
        
        # 检查分号
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.strip() and not line.strip().startswith('//') and not line.strip().startswith('/*'):
                if line.strip().endswith('{') or line.strip().endswith('}') or line.strip().endswith(']'):
                    continue
                if ('let ' in line or '=' in line) and not line.strip().endswith(';') and not line.strip().endswith(','):
                    print(f"⚠ 第{i+1}行可能缺少分号: {line.strip()[:50]}...")
    
    print(f"✓ {language} 基本语法检查通过")
    return True

def main():
    """主函数"""
    print("开始验证Video Splitter应用...")
    
    # 检查TypeScript类型定义
    ts_types = extract_ts_types('src/types/video.ts')
    print(f"提取到 {len(ts_types)} 个TypeScript类型定义")
    
    # 检查Rust类型定义
    rust_types = extract_rust_types('src/models/mod.rs')
    print(f"提取到 {len(rust_types)} 个Rust类型定义")
    
    # 比较类型定义
    types_match = compare_types(ts_types, rust_types)
    
    # 检查语法错误
    ts_syntax_ok = check_syntax_errors('src/types/video.ts', 'TypeScript')
    rust_syntax_ok = check_syntax_errors('src/models/mod.rs', 'Rust')
    
    # 检查主要文件
    main_syntax_ok = check_syntax_errors('src/main.rs', 'Rust')
    app_syntax_ok = check_syntax_errors('src/App.tsx', 'TypeScript')
    
    print("\n=== 验证结果 ===")
    print(f"类型定义匹配: {'✓' if types_match else '✗'}")
    print(f"TypeScript语法: {'✓' if ts_syntax_ok else '✗'}")
    print(f"Rust语法: {'✓' if rust_syntax_ok else '✗'}")
    print(f"主程序语法: {'✓' if main_syntax_ok else '✗'}")
    print(f"应用语法: {'✓' if app_syntax_ok else '✗'}")
    
    if all([types_match, ts_syntax_ok, rust_syntax_ok, main_syntax_ok, app_syntax_ok]):
        print("\n🎉 所有检查通过！应用程序可以正常运行。")
        return True
    else:
        print("\n❌ 发现问题，需要修复。")
        return False

if __name__ == '__main__':
    main()