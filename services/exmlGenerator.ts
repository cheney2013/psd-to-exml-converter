import { ParsedPsdData, ExtractedLayer, ExtractedTextElement, ExtractedImageElement, ExtractedRectElement, ExtractedXGroupButtonElement, ExtractedGroupElement, ExtractedRewardBarElement, ExtractedSimpleButtonElement, ExtractedBaseItemBoxElement } from '../types';

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function hexToEgretColor(hexColor: string | undefined): string {
  if (!hexColor || !hexColor.startsWith('#') || (hexColor.length !== 7 && hexColor.length !== 9)) { 
    // Handle "0x" prefix if it's already in that format from psdProcessor
    if (hexColor?.startsWith('0x') && (hexColor.length === 8 || hexColor.length === 10)) {
        return `0x${hexColor.substring(2, 8).toUpperCase()}`;
    }
    return '0xFFFFFF'; 
  }
  return `0x${hexColor.substring(1, 7).toUpperCase()}`; 
}

const REFERENCE_DIMENSION = 147; // For RewardBar and BaseItemBox scaling

export function generateExmlForElement(el: ExtractedLayer, indentLevel: number): string {
  const indent = ' '.repeat(indentLevel * 4);
  
  const roundedX = Math.round(el.x);
  const roundedY = Math.round(el.y);
  const roundedWidth = Math.round(el.width);
  const roundedHeight = Math.round(el.height);


  if (el.type === 'text') {
    const textEl = el as ExtractedTextElement;
    const labelAttrs: string[] = [];

    if (textEl.originalName && textEl.originalName.toLowerCase().startsWith('txt')) {
      labelAttrs.push(`id="${escapeXml(textEl.originalName)}"`);
    }

    // x and y are now either top-left or center based on rotation
    if (roundedX !== 0) labelAttrs.push(`x="${roundedX}"`);
    if (roundedY !== 0) labelAttrs.push(`y="${roundedY}"`);
    
    // width and height are of the (potentially rotated) bounding box
    if (typeof textEl.width === 'number' && textEl.width > 0) { 
      labelAttrs.push(`width="${Math.round(textEl.width)}"`);
    }
    // Set height for Label if available, to match PSD bounding box.
    // Egret Labels auto-size height if not set, which might differ from PSD.
    // Height must not be less than fontSize.
    if (typeof textEl.height === 'number' && textEl.height > 0) {
      const minHeight = Math.round(textEl.fontSize);
      labelAttrs.push(`height="${Math.max(Math.round(textEl.height), minHeight)}"`);
    }
    
    const exmlFriendlyText = textEl.text.replace(/\r\n|\r|\n/g, '\\n');
    labelAttrs.push(`text="${escapeXml(exmlFriendlyText)}"`);
    
    labelAttrs.push(`size="${Math.round(textEl.fontSize)}"`);

    // Use the color directly if it's already in 0x format
    const egretTextColor = textEl.textColor.startsWith('0x') ? textEl.textColor : hexToEgretColor(textEl.textColor);
    if (egretTextColor !== '0xFFFFFF') { 
      labelAttrs.push(`textColor="${egretTextColor}"`);
    }

    if (textEl.textAlign && textEl.textAlign !== 'left') { // Ensure textAlign exists before pushing
      labelAttrs.push(`textAlign="${textEl.textAlign}"`);
    }

    if (textEl.text.includes('\n') && typeof textEl.lineSpacing === 'number') {
      labelAttrs.push(`lineSpacing="${Math.round(textEl.lineSpacing)}"`);
    }

    if (textEl.strokeSize && textEl.strokeColor && textEl.strokeSize > 0) { 
      const egretStrokeColor = textEl.strokeColor.startsWith('0x') ? textEl.strokeColor : hexToEgretColor(textEl.strokeColor);
      labelAttrs.push(`stroke="${Math.round(textEl.strokeSize)}"`);
      labelAttrs.push(`strokeColor="${egretStrokeColor}"`);
    }

    if (typeof textEl.rotation === 'number' && Math.abs(textEl.rotation) > 0.01) {
      labelAttrs.push(`rotation="${Number(textEl.rotation.toFixed(2))}"`);
      // Add anchorOffsetX and anchorOffsetY if rotation is applied and they exist
      if (typeof textEl.anchorOffsetX === 'number') {
        labelAttrs.push(`anchorOffsetX="${Math.round(textEl.anchorOffsetX)}"`);
      }
      if (typeof textEl.anchorOffsetY === 'number') {
        labelAttrs.push(`anchorOffsetY="${Math.round(textEl.anchorOffsetY)}"`);
      }
    }
    // else: For non-rotated text, anchorOffset defaults to 0,0 in Egret if not specified, which is fine.

    return `${indent}<e:Label ${labelAttrs.join(' ')}/>`;

  } else if (el.type === 'image') {
    const imgEl = el as ExtractedImageElement;
    const imgAttrs: string[] = [];

    // Add id if originalName starts with "img"
    if (imgEl.originalName && imgEl.originalName.toLowerCase().startsWith('img')) {
        imgAttrs.push(`id="${escapeXml(imgEl.originalName)}"`);
    }
    
    imgAttrs.push(`source="${imgEl.name}"`); // name is the resource name (e.g. prefix_imgLogo_png)

    if (roundedX !== 0) imgAttrs.push(`x="${roundedX}"`);
    if (roundedY !== 0) imgAttrs.push(`y="${roundedY}"`);
    // Opacity is baked into the image dataUrl for "img" prefixed layers and others,
    // so no alpha attribute is needed here generally.
    // If specific alpha was needed for non-baked images, it would be added here.
    return `${indent}<e:Image ${imgAttrs.join(' ')}/>`;
  
  } else if (el.type === 'rect') {
    const rectEl = el as ExtractedRectElement;
    const rectBaseAttrs: string[] = [];
    if (roundedX !== 0) rectBaseAttrs.push(`x="${roundedX}"`);
    if (roundedY !== 0) rectBaseAttrs.push(`y="${roundedY}"`);
    rectBaseAttrs.push(`width="${roundedWidth}"`);
    rectBaseAttrs.push(`height="${roundedHeight}"`);
    
    const egretFillColor = rectEl.fillColor.startsWith('0x') ? rectEl.fillColor : hexToEgretColor(rectEl.fillColor);
    rectBaseAttrs.push(`fillColor="${egretFillColor}"`);
    
    // fillAlpha on e:Rect (0-1 range)
    if (typeof rectEl.fillAlpha === 'number' && rectEl.fillAlpha < 0.99) {
        rectBaseAttrs.push(`fillAlpha="${Number(rectEl.fillAlpha.toFixed(2))}"`);
    }

    if (rectEl.cornerRadius && rectEl.cornerRadius > 0) {
      const ellipseValue = Math.round(rectEl.cornerRadius * 2);
      rectBaseAttrs.push(`ellipseWidth="${ellipseValue}"`);
      rectBaseAttrs.push(`ellipseHeight="${ellipseValue}"`);
    }

    return `${indent}<e:Rect ${rectBaseAttrs.join(' ')}/>`;

  } else if (el.type === 'xGroupButton') { // Changed from groupButton to xGroupButton
    const groupBtnEl = el as ExtractedXGroupButtonElement;
    const groupBtnAttrs: string[] = [];

    const anchorOffsetX = Math.round(roundedWidth / 2);
    const anchorOffsetY = Math.round(roundedHeight / 2);
    const centerX = Math.round(roundedX + anchorOffsetX);
    const centerY = Math.round(roundedY + anchorOffsetY);

    groupBtnAttrs.push(`id="${groupBtnEl.name}"`); // name is the EXML id (e.g., "btnMyButton")

    if (centerX !== 0) groupBtnAttrs.push(`x="${centerX}"`);
    if (centerY !== 0) groupBtnAttrs.push(`y="${centerY}"`);
    
    groupBtnAttrs.push(`width="${roundedWidth}"`);
    groupBtnAttrs.push(`height="${roundedHeight}"`);
    groupBtnAttrs.push(`anchorOffsetX="${anchorOffsetX}"`);
    groupBtnAttrs.push(`anchorOffsetY="${anchorOffsetY}"`);

    if (typeof groupBtnEl.opacity === 'number' && groupBtnEl.opacity < 0.99) {
        groupBtnAttrs.push(`alpha="${Number(groupBtnEl.opacity.toFixed(2))}"`);
    }
    
    let groupButtonXml = `${indent}<ns1:XGroupButton ${groupBtnAttrs.join(' ')}>\n`;
    if (groupBtnEl.children && groupBtnEl.children.length > 0) {
      groupButtonXml += groupBtnEl.children
        .map(child => generateExmlForElement(child, indentLevel + 1))
        .filter(Boolean)
        .join('\n');
      groupButtonXml += '\n';
    }
    groupButtonXml += `${indent}</ns1:XGroupButton>`;
    return groupButtonXml;

  } else if (el.type === 'simpleButton') {
    const simpleBtnEl = el as ExtractedSimpleButtonElement;
    const simpleBtnAttrs: string[] = [];
    
    const anchorOffsetX = Math.round(roundedWidth / 2);
    const anchorOffsetY = Math.round(roundedHeight / 2);
    const centerX = Math.round(roundedX + anchorOffsetX);
    const centerY = Math.round(roundedY + anchorOffsetY);

    simpleBtnAttrs.push(`id="${simpleBtnEl.name}"`); // name is the EXML id (e.g., "submitIcon")

    if (centerX !== 0) simpleBtnAttrs.push(`x="${centerX}"`);
    if (centerY !== 0) simpleBtnAttrs.push(`y="${centerY}"`);
    
    simpleBtnAttrs.push(`width="${roundedWidth}"`);
    simpleBtnAttrs.push(`height="${roundedHeight}"`);
    simpleBtnAttrs.push(`anchorOffsetX="${anchorOffsetX}"`);
    simpleBtnAttrs.push(`anchorOffsetY="${anchorOffsetY}"`);

    if (simpleBtnEl.sourceName) {
      simpleBtnAttrs.push(`source="${simpleBtnEl.sourceName}"`);
    }

    if (typeof simpleBtnEl.opacity === 'number' && simpleBtnEl.opacity < 0.99) {
      simpleBtnAttrs.push(`alpha="${Number(simpleBtnEl.opacity.toFixed(2))}"`);
    }

    return `${indent}<ns1:XSimpleButton ${simpleBtnAttrs.join(' ')}/>`;

  } else if (el.type === 'group') {
    const groupEl = el as ExtractedGroupElement;
    const groupPlainAttrs: string[] = [];

    if (roundedX !== 0) groupPlainAttrs.push(`x="${roundedX}"`);
    if (roundedY !== 0) groupPlainAttrs.push(`y="${roundedY}"`);
    groupPlainAttrs.push(`width="${roundedWidth}"`);
    groupPlainAttrs.push(`height="${roundedHeight}"`);

    if (typeof groupEl.opacity === 'number' && groupEl.opacity < 0.99) {
        groupPlainAttrs.push(`alpha="${Number(groupEl.opacity.toFixed(2))}"`);
    }
        
    let groupXml = `${indent}<e:Group ${groupPlainAttrs.join(' ')}>\n`;
    if (groupEl.children && groupEl.children.length > 0) {
      groupXml += groupEl.children
        .map(child => generateExmlForElement(child, indentLevel + 1))
        .filter(Boolean)
        .join('\n');
      groupXml += '\n';
    }
    groupXml += `${indent}</e:Group>`;
    return groupXml;
  
  } else if (el.type === 'rewardBar') {
    const rewardBarEl = el as ExtractedRewardBarElement;
    const rewardBarAttrs: string[] = [];

    rewardBarAttrs.push(`id="${rewardBarEl.name}"`);
    rewardBarAttrs.push(`skinName="skins.RewardBarSkin"`);

    if (roundedX !== 0) rewardBarAttrs.push(`x="${roundedX}"`);
    if (roundedY !== 0) rewardBarAttrs.push(`y="${roundedY}"`);

    if (el.width > 0 && REFERENCE_DIMENSION > 0) {
        const scaleX = el.width / REFERENCE_DIMENSION;
        if (Math.abs(scaleX - 1.0) > 1e-6) { // Only add if not 1.0
            rewardBarAttrs.push(`scaleX="${Number(scaleX.toFixed(3))}"`);
        }
    }
    if (el.height > 0 && REFERENCE_DIMENSION > 0) {
        const scaleY = el.height / REFERENCE_DIMENSION;
         if (Math.abs(scaleY - 1.0) > 1e-6) { // Only add if not 1.0
            rewardBarAttrs.push(`scaleY="${Number(scaleY.toFixed(3))}"`);
        }
    }

    if (typeof rewardBarEl.opacity === 'number' && rewardBarEl.opacity < 0.99) {
        rewardBarAttrs.push(`alpha="${Number(rewardBarEl.opacity.toFixed(2))}"`);
    }

    return `${indent}<ns1:RewardBar ${rewardBarAttrs.join(' ')}/>`;
  } else if (el.type === 'baseItemBox') {
    const itemBoxEl = el as ExtractedBaseItemBoxElement;
    const itemBoxAttrs: string[] = [];

    itemBoxAttrs.push(`id="${itemBoxEl.name}"`);
    itemBoxAttrs.push(`skinName="skins.BaseItemBoxSkin"`); // Assuming skin name

    if (roundedX !== 0) itemBoxAttrs.push(`x="${roundedX}"`);
    if (roundedY !== 0) itemBoxAttrs.push(`y="${roundedY}"`);

    if (el.width > 0 && REFERENCE_DIMENSION > 0) {
        const scaleX = el.width / REFERENCE_DIMENSION;
        if (Math.abs(scaleX - 1.0) > 1e-6) { 
            itemBoxAttrs.push(`scaleX="${Number(scaleX.toFixed(3))}"`);
        }
    }
    if (el.height > 0 && REFERENCE_DIMENSION > 0) {
        const scaleY = el.height / REFERENCE_DIMENSION;
         if (Math.abs(scaleY - 1.0) > 1e-6) { 
            itemBoxAttrs.push(`scaleY="${Number(scaleY.toFixed(3))}"`);
        }
    }

    if (typeof itemBoxEl.opacity === 'number' && itemBoxEl.opacity < 0.99) {
        itemBoxAttrs.push(`alpha="${Number(itemBoxEl.opacity.toFixed(2))}"`);
    }

    return `${indent}<ns1:BaseItemBox ${itemBoxAttrs.join(' ')}/>`;
  }
  return '';
}

export const generateExml = (parsedPsdData: ParsedPsdData, effectiveSkinClassName: string): string => {
  if (!parsedPsdData) return '';

  const elementsXml = parsedPsdData.elements
    .map(el => generateExmlForElement(el, 1)) 
    .filter(Boolean)
    .join('\n');
  
  // effectiveSkinClassName is expected to be like "MyPsdSkin" (already suffixed)
  // The skins path becomes "skins.MyPsdSkin"
  const exmlSkinClassAttributeValue = `skins.${escapeXml(effectiveSkinClassName)}`;

  return `<?xml version="1.0" encoding="utf-8"?>
<e:Skin class="${exmlSkinClassAttributeValue}" width="${Math.round(parsedPsdData.width)}" height="${Math.round(parsedPsdData.height)}" xmlns:e="http://ns.egret.com/eui" xmlns:w="http://ns.egret.com/wing" xmlns:ns1="*">
${elementsXml}
</e:Skin>
`;
};