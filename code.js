// 플러그인 메인 코드
figma.showUI(__html__, { width: 320, height: 480 });

// 클립된 요소들을 저장할 배열
let clippedElements = [];
let indicators = [];
let originalFrameSizes = new Map(); // 프레임 원본 크기 저장

// 디버그 모드 설정 (개발 시에만 true로 설정)
const DEBUG_MODE = false;

// 플러그인 시작 시 클립된 요소들 검색
function findClippedElements() {
  clippedElements = [];
  let processedNodes = 0;
  const MAX_NODES = 1000; // 최대 처리 노드 수 제한
  const MAX_DEPTH = 20;   // 최대 재귀 깊이 제한

  // 현재 페이지의 모든 노드를 순회 (깊이 제한 포함)
  function traverseNode(node, depth = 0) {
    // 처리 한계 체크
    if (processedNodes >= MAX_NODES || depth >= MAX_DEPTH) {
      if (DEBUG_MODE) console.warn(`노드 처리 제한 도달: 노드 수 ${processedNodes}, 깊이 ${depth}`);
      return;
    }

    processedNodes++;

    try {
      // 프레임이나 컴포넌트인 경우
      if (
        node.type === "FRAME" ||
        node.type === "COMPONENT" ||
        node.type === "INSTANCE"
      ) {
        // 클리핑이 활성화된 경우
        if (node.clipsContent) {
          const clippedChildren = findElementsBelowFrame(node);
          if (clippedChildren.length > 0) {
            clippedElements.push({
              frame: node,
              clippedChildren: clippedChildren,
              frameId: node.id,
            });
          }
        }
      }

      // 자식 노드들도 순회 (깊이 증가)
      if ("children" in node && node.children) {
        for (const child of node.children) {
          if (child) { // null 체크
            traverseNode(child, depth + 1);
          }
        }
      }
    } catch (error) {
      if (DEBUG_MODE) console.error(`노드 처리 중 오류 (${node.name || 'unnamed'}):`, error);
    }
  }

  try {
    traverseNode(figma.currentPage);
    if (DEBUG_MODE) console.log(`총 ${processedNodes}개 노드 처리 완료, ${clippedElements.length}개 클립된 프레임 발견`);
    
    // 성공 피드백 (사용자에게 알림)
    if (clippedElements.length > 0) {
      console.log(`✅ Clip Notifier: ${clippedElements.length}개 클립된 프레임 발견됨`);
    } else {
      console.log(`✅ Clip Notifier: 모든 프레임이 정상적으로 표시되고 있습니다`);
    }
  } catch (error) {
    console.error("클립된 요소 검색 중 오류:", error);
    figma.ui.postMessage({ 
      type: "error", 
      message: "노드 검색 중 오류가 발생했습니다. 페이지가 너무 복잡할 수 있습니다." 
    });
  }

  return clippedElements;
}

// 프레임 하단 영역을 벗어난 요소들 찾기
function findElementsBelowFrame(frame) {
  const clippedChildren = [];
  const frameBottom = frame.y + frame.height;
  const MAX_CHILD_DEPTH = 15; // 자식 탐색 최대 깊이 제한
  let checkedNodes = 0;
  const MAX_CHILD_NODES = 500; // 최대 자식 노드 검사 수

  function checkChildren(node, parentY = 0, depth = 0) {
    // 깊이 및 노드 수 제한 체크
    if (depth >= MAX_CHILD_DEPTH || checkedNodes >= MAX_CHILD_NODES) {
      if (DEBUG_MODE) console.warn(`자식 노드 탐색 제한 도달: 깊이 ${depth}, 검사된 노드 ${checkedNodes}`);
      return;
    }

    try {
      if ("children" in node && node.children) {
        for (const child of node.children) {
          if (!child) continue; // null 체크
          
          checkedNodes++;
          
          const childAbsoluteY = parentY + child.y;
          const childBottom = childAbsoluteY + child.height;

          // 자식 요소가 프레임 하단을 벗어나는 경우
          if (childBottom > frameBottom) {
            clippedChildren.push({
              node: child,
              name: child.name || 'unnamed',
              type: child.type,
              clippedHeight: childBottom - frameBottom,
              absoluteY: childAbsoluteY,
            });
          }

          // 재귀적으로 자식의 자식들도 확인 (깊이 증가)
          checkChildren(child, childAbsoluteY, depth + 1);
        }
      }
    } catch (error) {
      if (DEBUG_MODE) console.error(`자식 노드 검사 중 오류 (${node.name || 'unnamed'}):`, error);
    }
  }

  try {
    checkChildren(frame, frame.y);
    if (DEBUG_MODE) console.log(`프레임 ${frame.name}: ${checkedNodes}개 자식 노드 검사, ${clippedChildren.length}개 클립된 요소 발견`);
  } catch (error) {
    console.error(`프레임 ${frame.name} 분석 중 오류:`, error);
  }

  return clippedChildren;
}

// 시각적 인디케이터 생성
async function createIndicators() {
  // 기존 인디케이터 제거
  removeIndicators();

  // 기본 폰트 로드 (숫자 표시용)
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  } catch (error) {
    if (DEBUG_MODE) console.warn("Inter 폰트 로딩 실패, 기본 폰트 사용:", error);
  }

  for (const item of clippedElements) {
    const frame = item.frame;

        try {
      // 간단한 파란 원형 뱃지 생성
      const badgeSize = 20;
      
      // 파란 원형 배경
      const badge = figma.createEllipse();
      badge.name = "클립 카운트 뱃지";
      badge.resize(badgeSize, badgeSize);
      badge.x = frame.x + frame.width - badgeSize - 8;
      badge.y = frame.y + frame.height - badgeSize - 8;
      badge.fills = [{
        type: "SOLID",
        color: { r: 0.2, g: 0.6, b: 1 } // 파란색
      }];

      // 개수 텍스트
      const countText = figma.createText();
      countText.name = "클립 개수";
      countText.characters = item.clippedChildren.length.toString();
      countText.fontSize = 10;
      countText.fills = [{
        type: "SOLID",
        color: { r: 1, g: 1, b: 1 } // 흰색
      }];
      countText.textAlignHorizontal = "CENTER";
      countText.textAlignVertical = "CENTER";
      countText.x = frame.x + frame.width - badgeSize - 8;
      countText.y = frame.y + frame.height - badgeSize - 8;
      countText.resize(badgeSize, badgeSize);

      // 그룹으로 묶기
      const group = figma.group([badge, countText], frame.parent);
      group.name = "📍 심플 클립 인디케이터";
      
      // 클릭 이벤트를 위한 메타데이터 저장
      group.setPluginData("frameId", item.frameId);
      group.setPluginData("clippedCount", item.clippedChildren.length.toString());
      group.setPluginData("isClickable", "true");

      indicators.push(group);
    } catch (error) {
      if (DEBUG_MODE) console.error("인디케이터 생성 중 오류:", error);
    }
  }
}

// 인디케이터 제거 (배열 + 실제 피그마에서도 검색하여 제거)
function removeIndicators() {
  let removedCount = 0;
  
  // 1. 배열에 저장된 인디케이터들 제거
  indicators.forEach((indicator) => {
    try {
      if (indicator.parent) {
        indicator.remove();
        removedCount++;
      }
    } catch (error) {
      if (DEBUG_MODE) console.warn("배열 인디케이터 제거 실패:", error);
    }
  });
  indicators = [];
  
  // 2. 혹시 누락된 인디케이터가 있는지 페이지에서 직접 검색하여 제거
  try {
    const allNodes = figma.currentPage.findAll();
    
    allNodes.forEach(node => {
      // 우리가 만든 인디케이터인지 확인
      if (node.name && (
        node.name.includes("심플 클립 인디케이터") ||
        node.name.includes("토스 스타일 클립 인디케이터") ||
        node.name.includes("클립 알림 인디케이터") ||
        node.name.includes("클립 카운트 뱃지") ||
        node.name.includes("클립 개수") ||
        node.getPluginData("isClickable") === "true"
      )) {
        try {
          node.remove();
          removedCount++;
        } catch (error) {
          if (DEBUG_MODE) console.warn(`추가 인디케이터 제거 실패: ${node.name}`, error);
        }
      }
    });
  } catch (error) {
    if (DEBUG_MODE) console.error("추가 인디케이터 검색 중 오류:", error);
  }
  
  if (removedCount > 0 && DEBUG_MODE) {
    console.log(`🧹 총 ${removedCount}개 인디케이터 제거 완료`);
  }
}

// UI로 데이터 전송
function sendDataToUI() {
  figma.ui.postMessage({
    type: "clipped-elements",
    data: clippedElements.map((item) => ({
      frameName: item.frame.name,
      frameId: item.frameId,
      clippedCount: item.clippedChildren.length,
      clippedChildren: item.clippedChildren.map((child) => ({
        name: child.name,
        type: child.type,
        clippedHeight: Math.round(child.clippedHeight),
      })),
    })),
  });
}

// UI에서 메시지 받기
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case "scan":
      try {
        figma.ui.postMessage({ type: "scan-started" });
        await new Promise(resolve => setTimeout(resolve, 10)); // UI 업데이트 시간 확보
        findClippedElements();
        sendDataToUI();
      } catch (error) {
        console.error("스캔 중 오류:", error);
        figma.ui.postMessage({ 
          type: "error", 
          message: "스캔 중 오류가 발생했습니다. 파일이 너무 크거나 복잡할 수 있습니다." 
        });
      }
      break;

    case "show-indicators":
      try {
        await createIndicators();
        figma.ui.postMessage({ type: "indicators-created" });
      } catch (error) {
        console.error("인디케이터 생성 실패:", error);
        figma.ui.postMessage({ type: "error", message: "인디케이터 생성에 실패했습니다." });
      }
      break;

    case "hide-indicators":
      removeIndicators();
      break;

    case "focus-frame":
      const node = figma.getNodeById(msg.frameId);
      if (node) {
        figma.viewport.scrollAndZoomIntoView([node]);
        figma.currentPage.selection = [node];
      }
      break;

    case "expand-frame-temporarily":
      try {
        await expandFrameTemporarily(msg.frameId);
      } catch (error) {
        console.error("프레임 확장 중 오류:", error);
        figma.ui.postMessage({
          type: "error",
          message: "프레임 확장에 실패했습니다."
        });
      }
      break;

    case "cleanup-before-close":
      // X 버튼이나 다른 방법으로 플러그인이 닫힐 때 정리
      try {
        removeIndicators();
        console.log("🧹 플러그인 종료 전 인디케이터 정리 완료");
      } catch (error) {
        if (DEBUG_MODE) console.error("종료 전 정리 중 오류:", error);
      }
      break;

    case "close":
      removeIndicators();
      figma.closePlugin();
      break;
  }
};

// 프레임 임시 확장/복원 함수
async function expandFrameTemporarily(frameId) {
  const frameData = clippedElements.find(item => item.frameId === frameId);
  if (!frameData) {
    throw new Error("프레임을 찾을 수 없습니다.");
  }

  const frame = frameData.frame;
  const frameKey = frame.id;

  try {
    if (originalFrameSizes.has(frameKey)) {
      // 이미 확장되어 있음 → 원본 크기로 복원
      const originalSize = originalFrameSizes.get(frameKey);
      frame.resize(originalSize.width, originalSize.height);
      originalFrameSizes.delete(frameKey);
      
      figma.ui.postMessage({
        type: "frame-restored",
        message: `${frame.name} 프레임이 원본 크기로 복원되었습니다.`
      });
      
      console.log(`📐 프레임 복원: ${frame.name} → ${originalSize.height}px`);
    } else {
      // 원본 크기 저장
      originalFrameSizes.set(frameKey, {
        width: frame.width,
        height: frame.height
      });

      // 클립된 요소들의 최대 하단 위치 계산
      let maxBottomY = frame.y + frame.height;
      frameData.clippedChildren.forEach(child => {
        const childBottomY = child.absoluteY + child.node.height;
        if (childBottomY > maxBottomY) {
          maxBottomY = childBottomY;
        }
      });

      // 새로운 높이 계산 (여유 공간 20px 추가)
      const newHeight = Math.max(frame.height, maxBottomY - frame.y + 20);
      
      // 프레임 크기 변경
      frame.resize(frame.width, newHeight);
      
      figma.ui.postMessage({
        type: "frame-expanded",
        message: `${frame.name} 프레임이 확장되었습니다. (${frame.height}px → ${newHeight}px)`
      });
      
      console.log(`📐 프레임 확장: ${frame.name} → ${newHeight}px (${frameData.clippedChildren.length}개 요소 표시)`);
    }

    // 해당 프레임으로 뷰포트 이동
    figma.viewport.scrollAndZoomIntoView([frame]);
    figma.currentPage.selection = [frame];

  } catch (error) {
    if (originalFrameSizes.has(frameKey)) {
      originalFrameSizes.delete(frameKey);
    }
    throw error;
  }
}

// 선택 변경 이벤트 리스너 (인디케이터 클릭 감지)
figma.on("selectionchange", () => {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 1) {
    const selectedNode = selection[0];
    
    // 선택된 노드가 우리가 만든 클릭 가능한 인디케이터인지 확인
    if (selectedNode.getPluginData("isClickable") === "true") {
      const frameId = selectedNode.getPluginData("frameId");
      const clippedCount = selectedNode.getPluginData("clippedCount");
      
      // 해당 프레임의 상세 정보 찾기
      const frameData = clippedElements.find(item => item.frameId === frameId);
      
      if (frameData) {
        // UI에 상세 정보 전송
        figma.ui.postMessage({
          type: "show-frame-details",
          data: {
            frameName: frameData.frame.name,
            frameId: frameId,
            clippedCount: parseInt(clippedCount),
            clippedChildren: frameData.clippedChildren.map(child => ({
              name: child.name,
              type: child.type,
              clippedHeight: Math.round(child.clippedHeight)
            }))
          }
        });
        
        console.log(`🔍 인디케이터 클릭: ${frameData.frame.name} (${clippedCount}개 클립된 요소)`);
      }
    }
  }
});

// 플러그인 시작 시 기존 인디케이터 정리
function cleanupExistingIndicators() {
  try {
    const allNodes = figma.currentPage.findAll();
    let cleanedCount = 0;
    
    allNodes.forEach(node => {
      // 우리가 만든 인디케이터인지 확인
      if (node.name && (
        node.name.includes("심플 클립 인디케이터") ||
        node.name.includes("토스 스타일 클립 인디케이터") ||
        node.name.includes("클립 알림 인디케이터") ||
        node.name.includes("클립 카운트 뱃지") ||
        node.name.includes("클립 개수") ||
        node.getPluginData("isClickable") === "true"
      )) {
        try {
          node.remove();
          cleanedCount++;
        } catch (error) {
          if (DEBUG_MODE) console.warn(`인디케이터 제거 실패: ${node.name}`, error);
        }
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`🧹 기존 인디케이터 ${cleanedCount}개 정리 완료`);
    }
  } catch (error) {
    if (DEBUG_MODE) console.error("기존 인디케이터 정리 중 오류:", error);
  }
}

// 초기 스캔 실행
cleanupExistingIndicators(); // 먼저 기존 인디케이터 정리
findClippedElements();
sendDataToUI();
