

import { ParsedPsdData, ExtractedLayer, ExtractedTextElement, ExtractedImageElement, ExtractedXGroupButtonElement, ExtractedSimpleButtonElement, ExtractedRewardBarElement, ExtractedBaseItemBoxElement, ExtractedGroupElement, ExtractedPanelBottomBarElement } from '../types';

export type ParentClassType = 'BasePage' | 'XNormalPanel' | 'XFullScreenPanel';

interface TsVariable {
    name: string; 
    type: string; 
    originalId: string; // Keep original ID for handler generation
    isButton: boolean;
}

const hasChildren = (el: ExtractedLayer): el is (ExtractedXGroupButtonElement | ExtractedGroupElement) => {
  return (el.type === 'xGroupButton' || el.type === 'group') && Array.isArray((el as ExtractedXGroupButtonElement | ExtractedGroupElement).children);
};

function sanitizeForTsVariable(name: string): string {
    let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');
    if (/^[0-9]/.test(sanitized)) {
        sanitized = '_' + sanitized;
    }
    if (sanitized === "") return "_unnamed"; // Ensure it's never empty
    return sanitized;
}


function capitalizeFirstLetter(string: string): string {
  if (!string) return '';
  // Original ID is already suitable, just needs capitalization
  const sanitizedForMethod = string.replace(/[^a-zA-Z0-9_]/g, ''); // Cleaner for method names
  if (!sanitizedForMethod) return 'UnnamedHandler';
  return sanitizedForMethod.charAt(0).toUpperCase() + sanitizedForMethod.slice(1);
}


export const generateTypeScript = (
    parsedData: ParsedPsdData | null, 
    effectiveSkinClassName: string,
    parentClass: ParentClassType
): string => {
  if (!parsedData) return '// No parsed data available to generate TypeScript.';

  const collectedTsVariables: TsVariable[] = [];
  const buttonEventRegistrations: string[] = [];

  const collectTsVariablesRecursive = (elements: ExtractedLayer[]) => {
    for (const el of elements) {
      let id: string | undefined = undefined; // This will be the sanitized variable name
      let originalIdForHandler: string | undefined = undefined; // This is the EXML ID for handler name
      let tsType: string | undefined = undefined;
      let isButton = false;

      if (el.type === 'text') {
        const textEl = el as ExtractedTextElement;
        if (textEl.originalName && textEl.originalName.toLowerCase().startsWith('txt')) {
          originalIdForHandler = textEl.originalName;
          id = sanitizeForTsVariable(textEl.originalName);
          tsType = 'eui.Label';
        }
      } else if (el.type === 'image') {
        const imgEl = el as ExtractedImageElement;
        if (imgEl.originalName && imgEl.originalName.toLowerCase().startsWith('img')) {
          originalIdForHandler = imgEl.originalName;
          id = sanitizeForTsVariable(imgEl.originalName);
          tsType = 'eui.Image';
        }
      } else if (el.type === 'xGroupButton') {
        const componentEl = el as ExtractedXGroupButtonElement;
        originalIdForHandler = componentEl.name; // name is the EXML id
        id = sanitizeForTsVariable(componentEl.name);
        tsType = 'XGroupButton';
        isButton = true;
      } else if (el.type === 'simpleButton') {
        const componentEl = el as ExtractedSimpleButtonElement;
        originalIdForHandler = componentEl.name; // name is the EXML id
        id = sanitizeForTsVariable(componentEl.name);
        tsType = 'XSimpleButton';
        isButton = true;
      } else if (el.type === 'rewardBar') {
        const componentEl = el as ExtractedRewardBarElement;
        originalIdForHandler = componentEl.name; // name is the EXML id
        id = sanitizeForTsVariable(componentEl.name);
        tsType = 'RewardBar';
      } else if (el.type === 'baseItemBox') {
        const componentEl = el as ExtractedBaseItemBoxElement;
        originalIdForHandler = componentEl.name; // name is the EXML id
        id = sanitizeForTsVariable(componentEl.name);
        tsType = 'BaseItemBox';
      } else if (el.type === 'panelBottomBar') {
        const componentEl = el as ExtractedPanelBottomBarElement;
        originalIdForHandler = componentEl.name; // name is the EXML id
        id = sanitizeForTsVariable(componentEl.name);
        tsType = 'PanelBottomBar';
      } else if (el.type === 'group') {
        const groupEl = el as ExtractedGroupElement;
        // Only create TS variable if original PSD layer name starts with "grp"
        if (groupEl.originalName && groupEl.originalName.toLowerCase().startsWith('grp')) {
            originalIdForHandler = groupEl.name; // Use the generated EXML ID for var name
            id = sanitizeForTsVariable(groupEl.name);
            tsType = 'eui.Group';
        }
      }


      if (id && tsType && originalIdForHandler) {
        if (!collectedTsVariables.some(v => v.name === id)) { 
          collectedTsVariables.push({ name: id, type: tsType, originalId: originalIdForHandler, isButton });
          if (isButton) {
             buttonEventRegistrations.push(`this.addTouchEvent(this.${id}, this.on${capitalizeFirstLetter(originalIdForHandler)}, this);`);
          }
        }
      }

      if (hasChildren(el)) {
        collectTsVariablesRecursive(el.children);
      }
    }
  };

  collectTsVariablesRecursive(parsedData.elements);

  let memberDeclarationsArr = collectedTsVariables
    .map(v => `    private ${v.name}: ${v.type};`);

  if (parentClass === 'XFullScreenPanel') {
    if (!collectedTsVariables.some(v => v.name === 'systemBg' || v.originalId === 'systemBg')) {
        memberDeclarationsArr.unshift('    private systemBg: SystemSpineBg;');
    }
    if (!collectedTsVariables.some(v => v.name === 'pbb' || v.originalId === 'pbb')) {
        memberDeclarationsArr.unshift('    private pbb: PanelBottomBar;');
    }
  }
  
  const memberDeclarations = memberDeclarationsArr.join('\n');


  const eventHandlerMethods = collectedTsVariables
    .filter(v => v.isButton)
    .map(v => `\n    private on${capitalizeFirstLetter(v.originalId)}() {\n    }\n`)
    .join('');

  const skinPath = `skins.${effectiveSkinClassName}`; // Skin class name itself (e.g. MyPsdSkin)
  let classBody = '';

  switch (parentClass) {
    case 'BasePage':
      classBody = `
class ${effectiveSkinClassName.replace(/Skin$/, '')} extends BasePage {

${memberDeclarations}

    constructor() {
        super(0);
        this.skinName = '${skinPath}';
    }

    protected childrenCreated() {
        super.childrenCreated();

        ${buttonEventRegistrations.join('\n        ')}
        this.addDestroyableMembers();
    }
${eventHandlerMethods}
}`;
      break;
    case 'XNormalPanel':
      classBody = `
class ${effectiveSkinClassName.replace(/Skin$/, '')} extends XNormalPanel {

${memberDeclarations}

    constructor() {
        super("${skinPath}");
    }

    protected childrenCreated(): void {
        super.childrenCreated();

        ${buttonEventRegistrations.join('\n        ')}
        this.addDestroyableMembers();
    }

    init(): void {
        super.init();
    }
${eventHandlerMethods}
}`;
      break;
    case 'XFullScreenPanel':
      classBody = `
class ${effectiveSkinClassName.replace(/Skin$/, '')} extends XFullScreenPanel {

${memberDeclarations}

    constructor() {
        super("${skinPath}");
    }

    protected childrenCreated(): void {
        super.childrenCreated();

        ${buttonEventRegistrations.join('\n        ')}
        this.addDestroyableMembers();
    }

    init() {
        super.init();
        
        if (this.systemBg) {
           this.systemBg.update(0, false, \`请改为自己的背景\`);
        }
        if (this.pbb) {
           this.pbb.init(0, this.onClose, this, this.name, GameUtil.tr("请改为自己的key"));
        }
    }
${eventHandlerMethods}
}`;
      break;
    default:
      // Should not happen if ParentClassType is used correctly
      const exhaustiveCheck: never = parentClass; 
      return `// Invalid parent class type selected: ${exhaustiveCheck}`;
  }

  return classBody.trim();
};
