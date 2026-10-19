/**
 * Splits a long text message into chunks that do not exceed maxLength.
 * Preserves paragraphs (\n\n), lines (\n), or words (spaces) where possible.
 */
export function splitMessage(text: string, maxLength = 1900): string[] {
  if (!text) {
    return [];
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.length <= maxLength) {
    return [trimmed];
  }

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = -1;
    const window = remaining.slice(0, maxLength);
    const minThreshold = Math.floor(maxLength * 0.3);

    // 1. Try finding double newline \n\n (paragraph break) in the window
    const lastDoubleNewline = window.lastIndexOf('\n\n');
    if (lastDoubleNewline >= minThreshold) {
      splitIndex = lastDoubleNewline;
    } else {
      // 2. Try finding single newline \n
      const lastNewline = window.lastIndexOf('\n');
      if (lastNewline >= minThreshold) {
        splitIndex = lastNewline;
      } else {
        // 3. Try finding space (word boundary)
        const lastSpace = window.lastIndexOf(' ');
        if (lastSpace >= minThreshold) {
          splitIndex = lastSpace;
        } else {
          // 4. Hard break at maxLength
          splitIndex = maxLength;
        }
      }
    }

    if (splitIndex <= 0) {
      splitIndex = maxLength;
    }

    const chunk = remaining.slice(0, splitIndex).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}
