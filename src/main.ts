figma.showUI(__html__, { width: 320, height: 240, themeColors: true });

const DEFAULT_FONT: FontName = { family: 'Inter', style: 'Regular' };
const FALLBACK_COLOR: RGB = { r: 0, g: 0, b: 0 };

const toNumber = (value: unknown, fallback = 0): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const parseHexColor = (value: string): RGB => {
  const hex = value.replace('#', '').trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { r: r / 255, g: g / 255, b: b / 255 };
  }
  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r: r / 255, g: g / 255, b: b / 255 };
  }
  return FALLBACK_COLOR;
};

const normalizeFontName = (value: any): FontName => {
  if (value && typeof value === 'object' && value.family && value.style) {
    return { family: String(value.family), style: String(value.style) };
  }
  return DEFAULT_FONT;
};

const applyPosition = (node: SceneNode, item: any) => {
  node.x = toNumber(item.x, node.x);
  node.y = toNumber(item.y, node.y);
};

const applySize = (node: SceneNode, item: any) => {
  if (!('resize' in node)) return;
  const widthValue = typeof item.w !== 'undefined' ? item.w : item.width;
  const heightValue = typeof item.h !== 'undefined' ? item.h : item.height;
  const hasWidth = typeof widthValue !== 'undefined';
  const hasHeight = typeof heightValue !== 'undefined';
  if (!hasWidth && !hasHeight) return;
  const width = hasWidth ? toNumber(widthValue, (node as any).width) : (node as any).width;
  const height = hasHeight ? toNumber(heightValue, (node as any).height) : (node as any).height;
  (node as any).resize(width, height);
};

const applyCornerRadius = (node: SceneNode, item: any) => {
  if (!('cornerRadius' in node)) return;
  if (typeof item.cornerRadius === 'undefined') return;
  (node as any).cornerRadius = toNumber(item.cornerRadius, 0);
};

const applyFills = (node: SceneNode, item: any) => {
  if (!('fills' in node)) return;
  if (!Array.isArray(item.fills)) return;
  const paints: Paint[] = item.fills
    .map((fill: any) => {
      if (typeof fill === 'string') {
        return { type: 'SOLID', color: parseHexColor(fill) } as SolidPaint;
      }
      if (fill && typeof fill === 'object' && fill.type === 'SOLID' && fill.color) {
        return fill as SolidPaint;
      }
      return null;
    })
    .filter(Boolean) as Paint[];
  if (paints.length > 0) {
    (node as any).fills = paints;
  }
};

const applyEffects = (node: SceneNode, item: any) => {
  if (!('effects' in node)) return;
  if (!Array.isArray(item.effects)) return;
  const effects: Effect[] = item.effects
    .map((effect: any) => {
      if (!effect || typeof effect !== 'object') return null;
      if (effect.type === 'DROP_SHADOW') {
        const color = typeof effect.color === 'string' ? parseHexColor(effect.color) : FALLBACK_COLOR;
        const opacity = toNumber(effect.opacity, 1);
        return {
          type: 'DROP_SHADOW',
          color: { ...color, a: opacity },
          offset: {
            x: toNumber(effect.offset?.x, 0),
            y: toNumber(effect.offset?.y, 0),
          },
          radius: toNumber(effect.radius, 0),
          spread: toNumber(effect.spread, 0),
          visible: effect.visible !== false,
          blendMode: 'NORMAL',
        } as DropShadowEffect;
      }
      return null;
    })
    .filter(Boolean) as Effect[];
  if (effects.length > 0) {
    (node as any).effects = effects;
  }
};

const applyAutoLayout = (node: SceneNode, item: any) => {
  if (!('layoutMode' in node)) return;
  if (typeof item.layoutMode !== 'undefined') {
    (node as any).layoutMode = item.layoutMode;
  }
  if (typeof item.primaryAxisSizingMode !== 'undefined') {
    (node as any).primaryAxisSizingMode = item.primaryAxisSizingMode;
  }
  if (typeof item.counterAxisSizingMode !== 'undefined') {
    (node as any).counterAxisSizingMode = item.counterAxisSizingMode;
  }
  if (typeof item.primaryAxisAlignItems !== 'undefined') {
    (node as any).primaryAxisAlignItems = item.primaryAxisAlignItems;
  }
  if (typeof item.counterAxisAlignItems !== 'undefined') {
    (node as any).counterAxisAlignItems = item.counterAxisAlignItems;
  }
  if (typeof item.paddingTop !== 'undefined') (node as any).paddingTop = toNumber(item.paddingTop, 0);
  if (typeof item.paddingBottom !== 'undefined') (node as any).paddingBottom = toNumber(item.paddingBottom, 0);
  if (typeof item.paddingLeft !== 'undefined') (node as any).paddingLeft = toNumber(item.paddingLeft, 0);
  if (typeof item.paddingRight !== 'undefined') (node as any).paddingRight = toNumber(item.paddingRight, 0);
  if (typeof item.itemSpacing !== 'undefined') (node as any).itemSpacing = toNumber(item.itemSpacing, 0);
};

const applyLayoutProps = (node: SceneNode, item: any) => {
  if ('layoutAlign' in node && typeof item.layoutAlign !== 'undefined') {
    (node as any).layoutAlign = item.layoutAlign;
  }
  if ('layoutGrow' in node && typeof item.layoutGrow !== 'undefined') {
    (node as any).layoutGrow = toNumber(item.layoutGrow, 0);
  }
};

const applyTextProps = (node: TextNode, item: any) => {
  if (typeof item.characters === 'string') {
    node.characters = item.characters;
  }
  if (typeof item.fontSize !== 'undefined') {
    node.fontSize = toNumber(item.fontSize, Number(node.fontSize));
  }
  if (item.lineHeight && typeof item.lineHeight === 'object') {
    node.lineHeight = {
      unit: item.lineHeight.unit,
      value: toNumber(item.lineHeight.value, 0),
    };
  }
};

const extractItemPayload = (item: any): any => {
  if (!item) return null;
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        console.warn('Failed to parse action string as JSON:', error);
      }
    }
    return null;
  }
  if (typeof item !== 'object') return null;
  if (item.create && typeof item.create === 'object') return item.create;
  if (item.payload && typeof item.payload === 'object') return item.payload;
  if (item.node && typeof item.node === 'object') return item.node;
  if (item.element && typeof item.element === 'object') return item.element;
  if (item.action && typeof item.action === 'object') return item.action;
  return item;
};

const normalizeAction = (value: any): string => {
  if (typeof value !== 'string') return 'CREATE';
  const upper = value.toUpperCase();
  if (upper.includes('CREATE') || upper.includes('ADD')) return 'CREATE';
  return upper;
};

const normalizeType = (value: any, fallbackAction?: string): string => {
  const raw =
    typeof value === 'string'
      ? value
      : typeof fallbackAction === 'string'
        ? fallbackAction
        : '';
  const upper = raw.toUpperCase();
  if (upper.includes('TEXT')) return 'TEXT';
  if (upper.includes('RECT')) return 'RECTANGLE';
  if (upper.includes('ELLIPSE') || upper.includes('OVAL')) return 'ELLIPSE';
  if (upper.includes('FRAME')) return 'FRAME';
  if (upper.includes('LINE')) return 'LINE';
  if (upper.includes('COMPONENT')) return 'COMPONENT';
  return upper;
};

const createInstanceFromPayload = async (payload: any): Promise<InstanceNode | null> => {
  if (payload.componentKey) {
    try {
      const component = await figma.importComponentByKeyAsync(String(payload.componentKey));
      return component.createInstance();
    } catch (error) {
      console.warn('Failed to import component by key:', error);
    }
  }
  if (payload.componentId) {
    const component = figma.getNodeById(String(payload.componentId));
    if (component && component.type === 'COMPONENT') {
      return component.createInstance();
    }
  }
  return null;
};

const createNodeFromAction = async (item: any, parent?: BaseNode & ChildrenMixin): Promise<SceneNode | null> => {
  const payload = extractItemPayload(item);
  if (!payload || typeof payload !== 'object') return null;
  const action = normalizeAction(
    payload.action || payload.operation || payload.op || payload.actionType
  );
  if (action !== 'CREATE') return null;

  const type = normalizeType(
    payload.type || payload.nodeType || payload.kind,
    payload.action
  );
  const name = typeof payload.name === 'string' ? payload.name : '';

  let node: SceneNode | null = null;
  switch (type) {
    case 'TEXT': {
      const textNode = figma.createText();
      try {
        const fontName = normalizeFontName(payload.fontName);
        await figma.loadFontAsync(fontName);
        textNode.fontName = fontName;
        const content = payload.text || payload.content || payload.name || 'Text';
        textNode.characters = String(content);
        applyTextProps(textNode, payload);
      } catch (error) {
        console.error('Failed to load font for text:', error);
        return null;
      }
      if (name) textNode.name = name;
      if (typeof payload.w !== 'undefined' || typeof payload.h !== 'undefined') {
        textNode.textAutoResize = 'NONE';
        applySize(textNode, payload);
      }
      applyPosition(textNode, payload);
      node = textNode;
      break;
    }
    case 'RECTANGLE': {
      const rect = figma.createRectangle();
      if (name) rect.name = name;
      applySize(rect, payload);
      applyPosition(rect, payload);
      node = rect;
      break;
    }
    case 'ELLIPSE': {
      const ellipse = figma.createEllipse();
      if (name) ellipse.name = name;
      applySize(ellipse, payload);
      applyPosition(ellipse, payload);
      node = ellipse;
      break;
    }
    case 'FRAME': {
      const frame = figma.createFrame();
      if (name) frame.name = name;
      applyAutoLayout(frame, payload);
      applySize(frame, payload);
      applyPosition(frame, payload);
      node = frame;
      break;
    }
    case 'LINE': {
      const line = figma.createLine();
      if (name) line.name = name;
      applySize(line, payload);
      applyPosition(line, payload);
      node = line;
      break;
    }
    case 'COMPONENT': {
      const component = figma.createComponent();
      if (name) component.name = name;
      applyAutoLayout(component, payload);
      applySize(component, payload);
      applyPosition(component, payload);
      node = component;
      break;
    }
    case 'INSTANCE': {
      const instance = await createInstanceFromPayload(payload);
      if (instance) {
        if (name) instance.name = name;
        applyAutoLayout(instance, payload);
        applySize(instance, payload);
        applyPosition(instance, payload);
        node = instance;
      } else {
        console.warn('No component reference for instance; creating frame instead.');
        const fallback = figma.createFrame();
        if (name) fallback.name = name;
        applyAutoLayout(fallback, payload);
        applySize(fallback, payload);
        applyPosition(fallback, payload);
        node = fallback;
      }
      break;
    }
    default:
      console.warn('Unsupported action type:', { action, type, item: payload });
      return null;
  }

  if (!node) return null;
  applyCornerRadius(node, payload);
  applyFills(node, payload);
  applyEffects(node, payload);
  applyLayoutProps(node, payload);

  if (parent && 'appendChild' in parent) {
    parent.appendChild(node);
  }

  if (Array.isArray(payload.children) && 'appendChild' in node) {
    for (const child of payload.children) {
      const childNode = await createNodeFromAction(child, node as BaseNode & ChildrenMixin);
      if (childNode) {
        applyLayoutProps(childNode, child);
      }
    }
  }

  return node;
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
      
      if (!Array.isArray(actions) && actions && typeof actions === 'object') {
        actions = [actions];
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
