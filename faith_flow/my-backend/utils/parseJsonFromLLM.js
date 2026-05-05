// Mistral 有時把 JSON 包在 markdown code block 裡（```json ... ```）
// 這個 helper 兩種格式都能解析，解析失敗回傳 null
function parseJsonFromLLM(raw) {
  if (!raw) return null;
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch {}
  }
  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace) {
    try { return JSON.parse(brace[0]); } catch {}
  }
  return null;
}

module.exports = { parseJsonFromLLM };
