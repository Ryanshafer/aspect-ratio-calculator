figma.showUI(__html__, { width: 350, height: 540 });

function selectionSupportsResize(node) {
  return 'resize' in node && 'width' in node && 'height' in node;
}

function approxEqual(a, b, tolerance = 0.01) {
  return Math.abs(a - b) <= tolerance;
}

function getResizableSelection() {
  return figma.currentPage.selection.filter(selectionSupportsResize);
}

function mapToUniformDimensions(nodes) {
  if (!nodes.length) {
    return { width: null, height: null };
  }

  if (nodes.length === 1) {
    const [node] = nodes;
    return { width: node.width, height: node.height };
  }

  const [{ width: baseWidth, height: baseHeight }] = nodes;
  const allEqual = nodes.every(node =>
    approxEqual(node.width, baseWidth) && approxEqual(node.height, baseHeight)
  );

  return allEqual
    ? { width: baseWidth, height: baseHeight }
    : { width: null, height: null };
}

function gatherSelectionPayload() {
  const selection = figma.currentPage.selection;
  const resizableNodes = getResizableSelection();
  const { width, height } = mapToUniformDimensions(resizableNodes);

  return {
    type: 'selection-info',
    selectionCount: selection.length,
    resizableCount: resizableNodes.length,
    width,
    height,
  };
}

function sendSelectionInfo() {
  figma.ui.postMessage(gatherSelectionPayload());
}

function ensureNumericDimensions(msg) {
  if (typeof msg.width !== 'number' || typeof msg.height !== 'number') {
    figma.notify('Width and height must be numbers.');
    return false;
  }
  return true;
}

function prepareTextNodeForResize(node) {
  if (node.type === 'TEXT' && node.textAutoResize !== 'NONE') {
    node.textAutoResize = 'NONE';
  }
}

function lockProportionsIfAvailable(node) {
  if ('constrainProportions' in node) {
    node.constrainProportions = true;
  }
}

function applyRatioToSelection(width, height) {
  const resizableNodes = getResizableSelection();
  if (!resizableNodes.length) {
    figma.notify('Select at least one object that can be resized.');
    return;
  }

  resizableNodes.forEach(node => {
    prepareTextNodeForResize(node);
    node.resize(width, height);
    lockProportionsIfAvailable(node);
  });

  const lockableCount = resizableNodes.filter(node => 'constrainProportions' in node).length;
  const message = lockableCount === resizableNodes.length
    ? 'Applied ratio and locked proportions.'
    : 'Applied ratio to selection.';

  figma.notify(message);
}

sendSelectionInfo();
figma.on('selectionchange', sendSelectionInfo);

figma.ui.onmessage = msg => {
  switch (msg.type) {
    case 'request-selection':
      sendSelectionInfo();
      return;

    case 'apply-ratio':
      if (!ensureNumericDimensions(msg)) {
        return;
      }
      applyRatioToSelection(msg.width, msg.height);
      sendSelectionInfo();
      return;

    default:
      break;
  }
};
