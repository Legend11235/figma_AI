figma.showUI(__html__, { width: 320, height: 240, themeColors: true });

const DEFAULT_FONT: FontName = { family: 'Inter', style: 'Regular' };

const toNumber = (value: unknown, fallback = 0): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const applyPosition = (node: SceneNode, item: any) => {
  node.x = toNumber(item.x, node.x);
  node.y = toNumber(item.y, node.y);
};

const applySize = (node: SceneNode, item: any) => {
  if (!('resize' in node)) return;
  const hasWidth = typeof item.w !== 'undefined';
  const hasHeight = typeof item.h !== 'undefined';
  if (!hasWidth && !hasHeight) return;
  const width = hasWidth ? toNumber(item.w, (node as any).width) : (node as any).width;
  const height = hasHeight ? toNumber(item.h, (node as any).height) : (node as any).height;
  (node as any).resize(width, height);
};

const createNodeFromAction = async (item: any): Promise<SceneNode | null> => {
  if (!item || typeof item !== 'object') return null;
  const action = typeof item.action === 'string' ? item.action.toUpperCase() : 'CREATE';
  if (action !== 'CREATE') return null;

  const type = typeof item.type === 'string' ? item.type.toUpperCase() : '';
  const name = typeof item.name === 'string' ? item.name : '';

  switch (type) {
    case 'TEXT': {
      const textNode = figma.createText();
      try {
        await figma.loadFontAsync(DEFAULT_FONT);
        textNode.fontName = DEFAULT_FONT;
        const content = item.text || item.content || item.name || 'Text';
        textNode.characters = String(content);
      } catch (error) {
        console.error('Failed to load font for text:', error);
        return null;
      }
      if (name) textNode.name = name;
      if (typeof item.w !== 'undefined' || typeof item.h !== 'undefined') {
        textNode.textAutoResize = 'NONE';
        applySize(textNode, item);
      }
      applyPosition(textNode, item);
      return textNode;
    }
    case 'RECTANGLE': {
      const rect = figma.createRectangle();
      if (name) rect.name = name;
      applySize(rect, item);
      applyPosition(rect, item);
      return rect;
    }
    case 'ELLIPSE': {
      const ellipse = figma.createEllipse();
      if (name) ellipse.name = name;
      applySize(ellipse, item);
      applyPosition(ellipse, item);
      return ellipse;
    }
    case 'FRAME': {
      const frame = figma.createFrame();
      if (name) frame.name = name;
      applySize(frame, item);
      applyPosition(frame, item);
      return frame;
    }
    case 'LINE': {
      const line = figma.createLine();
      if (name) line.name = name;
      applySize(line, item);
      applyPosition(line, item);
      return line;
    }
    case 'COMPONENT': {
      const component = figma.createComponent();
      if (name) component.name = name;
      applySize(component, item);
      applyPosition(component, item);
      return component;
    }
    default:
      console.warn('Unknown action type:', item.type);
      return null;
  }
};

figma.ui.onmessage = async (msg) => {
  console.log('Main thread received message:', msg);
  if (msg.type === 'fetch-layers') {
    console.log('Fetching layers from selection');
    const selection = figma.currentPage.selection.map(node => ({
      name: node.name,
      type: node.type,
      x: node.x,
      y: node.y,
      w: node.width,
      h: node.height
    }));
    console.log('Sending selection to UI:', selection);
    figma.ui.postMessage({ type: 'layers-data', selection });
  }

  if (msg.type === 'start-gumloop') {
    console.log('Starting Gumloop via proxy with selection:', msg.selection);
    
    try {
      const response = await fetch('http://localhost:8000/run-flow?saved_item_id=sbTctfNvijqsLZMHmXXqpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figma_json: JSON.stringify(msg.selection) })
      });
      
      console.log('Proxy response status:', response.status);
      const rawBody = await response.text();
      if (!rawBody) {
        figma.ui.postMessage({
          type: 'prediction-error',
          error: `Empty proxy response (status ${response.status})`,
        });
        return;
      }
      let result: any;
      try {
        result = JSON.parse(rawBody);
      } catch (parseError) {
        console.error('Failed to parse proxy response as JSON:', parseError);
        figma.ui.postMessage({
          type: 'prediction-error',
          error: 'Proxy returned non-JSON response',
        });
        return;
      }
      console.log('Proxy response:', result);
      
      if (!result.success) {
        figma.ui.postMessage({ type: 'prediction-error', error: result.error || 'Unknown error' });
        return;
      }
      
      const extractOutputText = (value: any): string => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) {
          const firstString = value.find((item) => typeof item === 'string' && item.trim());
          return firstString || '';
        }
        if (typeof value === 'object') {
          const preferredKeys = ['output', 'Response', 'response', 'text'];
          for (const key of preferredKeys) {
            if (typeof value[key] === 'string' && value[key].trim()) return value[key];
          }
          for (const val of Object.values(value)) {
            if (typeof val === 'string' && val.trim()) return val;
          }
        }
        return '';
      };

      // Extract output from the result
      let outputText = '';
      const outputCandidates = [
        result?.data?.output,
        result?.data?.outputs,
        result?.data?.result?.output,
        result?.data?.result?.outputs,
        result?.data?.result,
      ];
      for (const candidate of outputCandidates) {
        outputText = extractOutputText(candidate);
        if (outputText) break;
      }
      
      console.log('Extracted output:', outputText);
      
      // Parse the JSON array from the output
      let actions = [];
      try {
        let cleanOutput = outputText;
        if (typeof outputText === 'string') {
          cleanOutput = outputText.replace(/```json\n?|\n?```/g, '').trim();
          if (!cleanOutput) {
            figma.ui.postMessage({
              type: 'prediction-error',
              error: 'AI response was empty',
            });
            return;
          }
          actions = JSON.parse(cleanOutput);
        } else {
          actions = outputText;
        }
        console.log('Parsed actions:', actions);
      } catch (e) {
        console.error('Failed to parse output as JSON:', e);
        figma.ui.postMessage({ type: 'prediction-error', error: 'Failed to parse AI response' });
        return;
      }
      
      if (Array.isArray(actions) && actions.length > 0) {
        console.log('Rendering ' + actions.length + ' predictions');
        figma.ui.postMessage({ type: 'prediction-ready', actions });
        
        const nodes: SceneNode[] = [];
        for (const item of actions) {
          const node = await createNodeFromAction(item);
          if (node) nodes.push(node);
        }
        if (nodes.length > 0) {
          figma.currentPage.selection = nodes;
          figma.viewport.scrollAndZoomIntoView(nodes);
        } else {
          figma.ui.postMessage({ type: 'prediction-error', error: 'No supported actions returned from AI' });
        }
      } else {
        figma.ui.postMessage({ type: 'prediction-error', error: 'No actions returned from AI' });
      }
    } catch (error) {
      console.error('Proxy error:', error);
      figma.ui.postMessage({ type: 'prediction-error', error: String(error) });
    }
  }

  if (msg.type === 'render-prediction') {
    console.log('Rendering prediction:', msg.actions);
    const nodes: SceneNode[] = [];
    for (const item of msg.actions) {
      const node = await createNodeFromAction(item);
      if (node) nodes.push(node);
    }
    if (nodes.length > 0) {
      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
    } else {
      figma.ui.postMessage({ type: 'prediction-error', error: 'No supported actions returned from AI' });
    }
  }
};
