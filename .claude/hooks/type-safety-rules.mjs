import { readFileSync } from "node:fs";

export function checkTypeSafety(code, filename = "") {
  const violations = [];
  const lines = code.split(/\r?\n/);

  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check suppression comments
    if (/\/\/\s*@ts-ignore\b/.test(rawLine) || /\/\*\s*@ts-ignore\b/.test(rawLine)) {
      violations.push({
        line: lineNum,
        code: trimmed,
        rule: "ts-ignore",
        message: "Nghiêm cấm sử dụng '@ts-ignore' để bypass type check. Hãy sửa lỗi type tận gốc.",
      });
    }
    if (/\/\/\s*@ts-nocheck\b/.test(rawLine) || /\/\*\s*@ts-nocheck\b/.test(rawLine)) {
      violations.push({
        line: lineNum,
        code: trimmed,
        rule: "ts-nocheck",
        message: "Nghiêm cấm sử dụng '@ts-nocheck' để tắt kiểm tra kiểu toàn file.",
      });
    }
    if (/\/\/\s*@ts-expect-error\b/.test(rawLine) || /\/\*\s*@ts-expect-error\b/.test(rawLine)) {
      violations.push({
        line: lineNum,
        code: trimmed,
        rule: "ts-expect-error",
        message: "Nghiêm cấm sử dụng '@ts-expect-error' để bỏ qua lỗi type check.",
      });
    }
    if (/\/\/\s*eslint-disable(?:-next-line)?\s+.*no-explicit-any\b/.test(rawLine)) {
      violations.push({
        line: lineNum,
        code: trimmed,
        rule: "eslint-disable-no-explicit-any",
        message: "Nghiêm cấm dùng eslint-disable để trốn tránh quy chuẩn cấm 'any'.",
      });
    }

    // Handle block comments
    let lineCode = rawLine;
    if (inBlockComment) {
      const endIdx = lineCode.indexOf("*/");
      if (endIdx !== -1) {
        lineCode = lineCode.slice(endIdx + 2);
        inBlockComment = false;
      } else {
        continue;
      }
    }

    // Strip single-line block comments /* ... */
    lineCode = lineCode.replace(/\/\*.*?\*\//g, "");

    // Check if new block comment starts
    const startIdx = lineCode.indexOf("/*");
    if (startIdx !== -1) {
      lineCode = lineCode.slice(0, startIdx);
      inBlockComment = true;
    }

    // Strip line comment // ...
    const lineCommentIdx = lineCode.indexOf("//");
    if (lineCommentIdx !== -1) {
      lineCode = lineCode.slice(0, lineCommentIdx);
    }

    // Check code patterns for 'any'
    if (/\bas\s+any\b/.test(lineCode)) {
      violations.push({
        line: lineNum,
        code: trimmed,
        rule: "as-any",
        message: "Cấm ép kiểu 'as any'. Hãy dùng Type Guard, Zod schema hoặc generic type an toàn.",
      });
    }

    if (/:\s*any(?:\s*[;,)\]}=|&]|$)/.test(lineCode)) {
      violations.push({
        line: lineNum,
        code: trimmed,
        rule: "type-annotation-any",
        message: "Cấm khai báo kiểu ': any'. Hãy dùng kiểu tường minh, 'unknown' hoặc Generic '<T>'.",
      });
    }

    if (
      /<any>|<any,|,[\s]*any>|any\[\]|\[\s*any\b|\bany\s*\]|Array<any>|Record<[^,]+,\s*any>|Promise<any>|Map<[^,]+,\s*any>|Set<any>/.test(
        lineCode,
      )
    ) {
      violations.push({
        line: lineNum,
        code: trimmed,
        rule: "generic-or-array-any",
        message:
          "Cấm sử dụng 'any' trong generic, array, tuple hoặc collection (như <any>, any[], [any], Array<any>, Record<..., any>, Promise<any>, Map<..., any>, Set<any>). Hãy dùng 'unknown' hoặc kiểu cụ thể.",
      });
    }
  }

  return violations;
}

export function isTypeScriptFile(filePath) {
  if (typeof filePath !== "string") return false;
  const lower = filePath.toLowerCase();
  return (
    (lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".mts") || lower.endsWith(".cts")) &&
    !lower.endsWith(".d.ts") &&
    !lower.includes("/tests/") &&
    !lower.includes(".test.")
  );
}

async function main() {
  try {
    let input = "";
    try {
      input = readFileSync(0, "utf8");
    } catch (_e) {}

    if (!input || !input.trim()) {
      console.log(JSON.stringify({ decision: "allow" }));
      process.exit(0);
    }

    let payload = {};
    try {
      payload = JSON.parse(input);
    } catch (_e) {
      console.log(JSON.stringify({ decision: "allow" }));
      process.exit(0);
    }

    const toolCall = payload.toolCall || payload;
    const toolName = toolCall.name || toolCall.tool_name || payload.name || payload.tool_name;
    const args = toolCall.args || toolCall.tool_args || payload.args || payload.tool_args || {};

    let targetFile = args.TargetFile || args.target_file || args.file_path || args.path || "";
    let codeContent = "";

    if (toolName === "write_to_file") {
      codeContent = args.CodeContent || args.code_content || args.content || "";
    } else if (toolName === "replace_file_content") {
      codeContent = args.ReplacementContent || args.replacement_content || "";
    }

    if (isTypeScriptFile(targetFile) && typeof codeContent === "string" && codeContent.length > 0) {
      const violations = checkTypeSafety(codeContent, targetFile);

      if (violations.length > 0) {
        const errorDetails = violations
          .map((v) => `  - Dòng ${v.line}: [${v.rule}] ${v.message}\n    Code: \`${v.code}\``)
          .join("\n");

        console.log(
          JSON.stringify({
            decision: "deny",
            reason: `[Type Safety Guard - VI PHẠM ZERO-ANY RULE]\nPhát hiện ${violations.length} vi phạm an toàn kiểu trong file '${targetFile}':\n${errorDetails}\n\nHãy sửa lại bằng kiểu tường minh, 'unknown' kết hợp Zod/Type Guard, hoặc Generics <T>.`,
          }),
        );
        process.exit(0);
      }
    }

    console.log(JSON.stringify({ decision: "allow" }));
  } catch (_err) {
    console.log(JSON.stringify({ decision: "allow" }));
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
