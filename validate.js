#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Clip Notifier 플러그인 구조 검증 중...\n');

// 필수 파일들 확인
const requiredFiles = [
  'manifest.json',
  'code.js',
  'ui.html',
  'README.md',
  'package.json'
];

let allValid = true;

console.log('📋 필수 파일 확인:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - 파일이 없습니다!`);
    allValid = false;
  }
});

console.log('\n📝 manifest.json 검증:');
try {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  
  const requiredManifestFields = ['name', 'id', 'api', 'main', 'ui'];
  requiredManifestFields.forEach(field => {
    if (manifest[field]) {
      console.log(`✅ ${field}: ${manifest[field]}`);
    } else {
      console.log(`❌ ${field} - 필드가 없습니다!`);
      allValid = false;
    }
  });
} catch (error) {
  console.log('❌ manifest.json 파싱 오류:', error.message);
  allValid = false;
}

console.log('\n📦 package.json 검증:');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`✅ 이름: ${pkg.name}`);
  console.log(`✅ 버전: ${pkg.version}`);
  console.log(`✅ 설명: ${pkg.description}`);
} catch (error) {
  console.log('❌ package.json 파싱 오류:', error.message);
  allValid = false;
}

console.log('\n🔧 코드 파일 검증:');
if (fs.existsSync('code.js')) {
  const codeContent = fs.readFileSync('code.js', 'utf8');
  if (codeContent.includes('figma.showUI')) {
    console.log('✅ UI 초기화 코드 확인');
  } else {
    console.log('❌ UI 초기화 코드가 없습니다!');
    allValid = false;
  }
  
  if (codeContent.includes('figma.ui.onmessage')) {
    console.log('✅ 메시지 핸들러 확인');
  } else {
    console.log('❌ 메시지 핸들러가 없습니다!');
    allValid = false;
  }
}

console.log('\n🎨 UI 파일 검증:');
if (fs.existsSync('ui.html')) {
  const uiContent = fs.readFileSync('ui.html', 'utf8');
  if (uiContent.includes('<!DOCTYPE html>')) {
    console.log('✅ 올바른 HTML 구조');
  } else {
    console.log('❌ HTML DOCTYPE이 없습니다!');
    allValid = false;
  }
  
  if (uiContent.includes('parent.postMessage')) {
    console.log('✅ 플러그인 통신 코드 확인');
  } else {
    console.log('❌ 플러그인 통신 코드가 없습니다!');
    allValid = false;
  }
}

console.log('\n' + '='.repeat(50));
if (allValid) {
  console.log('🎉 모든 검증 통과! 플러그인이 준비되었습니다.');
  console.log('\n📋 설치 방법:');
  console.log('1. 피그마 → Plugins → Development → Import plugin from manifest...');
  console.log('2. manifest.json 파일 선택');
  console.log('3. 플러그인 실행!');
} else {
  console.log('❌ 일부 검증에 실패했습니다. 위의 오류를 수정해주세요.');
  process.exit(1);
}

console.log('\n💡 개발 팁:');
console.log('- npm run dev: 개발 모드 안내');
console.log('- npm run zip: 배포용 압축 파일 생성');
console.log('- npm run format: 코드 포맷팅'); 