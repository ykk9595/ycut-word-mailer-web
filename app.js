/* global JSZip */
"use strict";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const form = document.querySelector("#generator-form");
const submitButton = document.querySelector("#submit-button");
const progressPanel = document.querySelector("#progress-panel");
const progressBar = document.querySelector("#progress-bar");
const progressText = document.querySelector("#progress-text");
const resultPanel = document.querySelector("#result-panel");
const resultIcon = document.querySelector("#result-icon");
const resultTitle = document.querySelector("#result-title");
const resultMessage = document.querySelector("#result-message");
const caseSummary = document.querySelector("#case-summary");
const downloadAgain = document.querySelector("#download-again");

let lastDownload = null;

function setProgress(percent, text) {
  progressPanel.hidden = false;
  progressBar.style.width = `${percent}%`;
  progressText.textContent = text;
}

function showResult({ ok, title, message, summary = [] }) {
  resultPanel.hidden = false;
  resultPanel.classList.toggle("error", !ok);
  resultIcon.textContent = ok ? "✓" : "!";
  resultTitle.textContent = title;
  resultMessage.textContent = message;
  caseSummary.replaceChildren();
  for (const [label, value] of summary) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    caseSummary.append(dt, dd);
  }
  downloadAgain.hidden = !lastDownload;
}

function caseIdFromUrl(value) {
  const url = new URL(value);
  if (!["ycut.com.tw", "www.ycut.com.tw"].includes(url.hostname)) {
    throw new Error("請輸入 ycut.com.tw 的案件網址");
  }
  const match = url.pathname.match(/\/case-info\/([0-9a-f-]{36})(?:\/|$)/i);
  if (!match) throw new Error("網址中找不到有效的 YCut 案件 ID");
  return match[1];
}

function findCasePayload(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCasePayload(item);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    if (value.caseName && (value.nCaseNo || value.addrSimp)) return value;
    for (const item of Object.values(value)) {
      const found = findCasePayload(item);
      if (found) return found;
    }
  }
  return null;
}

async function fetchCase(url) {
  const id = caseIdFromUrl(url);
  const response = await fetch(`https://www.ycut.com.tw/case-info/${id}`);
  if (!response.ok) throw new Error(`YCut 回應錯誤（${response.status}）`);
  const html = await response.text();
  const page = new DOMParser().parseFromString(html, "text/html");
  const state = page.querySelector("#ng-state")?.textContent;
  if (!state) throw new Error("YCut 案件頁中找不到資料");
  const payload = findCasePayload(JSON.parse(state));
  if (!payload) throw new Error("YCut 回應中找不到案件資料");
  return payload;
}

function text(value) { return value == null ? "" : String(value).trim(); }
function number(value) { const result = Number(value || 0); return Number.isFinite(result) ? result : 0; }
function formatNumber(value, decimals = 3) {
  const fixed = Number(value).toFixed(decimals);
  return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}
function formatPhone(value) {
  const digits = text(value).replace(/\D/g, "");
  return /^09\d{8}$/.test(digits) ? `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}` : text(value);
}

function normalizeCase(raw) {
  const name = text(raw.caseName);
  const description = text(raw.caseSpec);
  const parts = name.replace(/[^0-9A-Za-z\u4e00-\u9fff｜|]/g, "").split(/[｜|]/).filter(Boolean);
  let location = parts.find(part => ["中山醫", "捷運", "車站", "商圈"].some(key => part.includes(key))) || parts[0] || "物件";
  const keyword = ["中山醫", "捷運", "車站", "商圈"].find(key => location.includes(key));
  if (keyword) location = keyword;
  let layout = [...parts].reverse().find(part => part.includes("房")) || "";
  layout = layout.match(/大兩房|小兩房|[一二三四五六七八九0-9]房|兩房/)?.[0] || layout;

  const featureRules = [
    [["前後陽台", "通風"], "前後陽台通風"],
    [["方正", "採光"], "方正採光佳"],
    [["兩房", "好規劃"], "大兩房好規劃"],
    [["雙鐵", "捷運", "火車"], "雙鐵交通便利"],
    [["綠園道"], "綠園道旁機能佳"],
    [["生活機能", "機能"], "生活機能便利"]
  ];
  const features = [];
  for (const [needles, output] of featureRules) {
    if (needles.some(key => description.includes(key) || name.includes(key)) && !features.includes(output)) features.push(output);
    if (features.length === 5) break;
  }
  for (const fallback of ["格局方正好規劃", "採光通風良好", "交通生活便利", "社區環境清幽", "自住置產皆宜"]) {
    if (features.length === 5) break;
    if (!features.includes(fallback)) features.push(fallback);
  }
  const allText = `${name}\n${description}`;
  const typeName = text(raw.typeCode || raw.typeCodeName);
  const typeCode = /大樓|華廈/.test(typeName) ? "4" : /公寓/.test(typeName) ? "3" : /透天|別墅/.test(typeName) ? "2" : "4";

  return {
    listingNo: text(raw.nCaseNo), caseName: name, shortName: `${location}${layout}`.slice(0, 12),
    buildingName: text(raw.buildingName), address: text(raw.addrSimp),
    landPing: number(raw.landShPin), totalPing: number(raw.buiTotPin),
    mainAuxPing: number(raw.buiMPin) + number(raw.buiAuxPin), typeCode,
    primarySchool: text(raw.priSchoolName).replace(/^市立/, ""),
    juniorSchool: text(raw.junSchoolName).replace(/^市立/, ""),
    age: number(raw.buiYear), floorsAbove: Math.trunc(number(raw.upFloor)),
    rooms: Math.trunc(number(raw.rm)), livingRooms: Math.trunc(number(raw.livingRm)), bathrooms: Math.trunc(number(raw.bathRm)),
    price: number(raw.price), agentName: text(raw.empName), agentMobile: text(raw.empMobile), features,
    college: allText.includes("中山醫") ? "中山醫" : "",
    shopping: /全聯|超商|便利商店/.test(allText) ? "全聯／超商" : "",
    park: allText.includes("綠園道") ? "綠園道" : "",
    hospital: allText.includes("中山醫") ? "中山醫附醫" : ""
  };
}

function directTextNodes(paragraph) {
  const nodes = [];
  for (const run of paragraph.children) {
    if (run.localName !== "r") continue;
    for (const child of run.children) if (child.localName === "t") nodes.push(child);
  }
  return nodes;
}

function directText(paragraph) { return directTextNodes(paragraph).map(node => node.textContent || "").join(""); }

function findNodes(documentXml, predicate, label) {
  const matches = [...documentXml.getElementsByTagNameNS(W_NS, "p")].filter(p => predicate(directText(p)));
  if (matches.length !== 1) throw new Error(`母版欄位「${label}」數量不正確（${matches.length}）`);
  return directTextNodes(matches[0]);
}

function setIf(nodes, index, value) { if (value) nodes[index].textContent = value; }

function patchDocumentXml(xmlText, c) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("Word 母版 XML 無法解析");
  let n = findNodes(xml, s => s.startsWith("編號：") && s.includes("大樓/社區名稱"), "表頭");
  setIf(n, 1, `${c.listingNo}  `); setIf(n, 4, c.shortName); n[5].textContent = "  "; n[6].textContent = "  ";
  setIf(n, 8, c.buildingName); n[9].textContent = " "; n[10].textContent = " ";

  n = findNodes(xml, s => s.startsWith("所有權人：") && s.includes("屬性：□"), "交易屬性");
  n[0].textContent = n[0].textContent.replace("屬性：□", "屬性：2");
  n = findNodes(xml, s => s.startsWith("物件地址：") && s.includes("地圖加密"), "物件地址"); setIf(n, 2, c.address);
  n = findNodes(xml, s => s.startsWith("登記面積") && s.includes("土地持分面積"), "登記面積");
  setIf(n, 5, formatNumber(c.totalPing)); setIf(n, 8, formatNumber(c.mainAuxPing)); setIf(n, 13, formatNumber(c.landPing));

  for (const [prefix, code] of [["案件類別：□", "1"], ["物件用途：□", "1"], ["物件型態：□", c.typeCode]]) {
    n = findNodes(xml, s => s.startsWith(prefix), prefix); n[0].textContent = n[0].textContent.replace("□", code);
  }
  n = findNodes(xml, s => s.startsWith("地上樓層：") && s.includes("建物格局"), "樓層格局");
  setIf(n, 2, c.floorsAbove ? String(c.floorsAbove) : ""); setIf(n, 12, c.rooms ? String(c.rooms) : "");
  setIf(n, 14, c.livingRooms ? String(c.livingRooms) : ""); setIf(n, 16, c.bathrooms ? String(c.bathrooms) : "");
  n = findNodes(xml, s => s.startsWith("建物方位：") && s.includes("建物屋齡"), "建物屋齡");
  setIf(n, 6, formatNumber(c.age, 1)); n[7].textContent = ""; n[8].textContent = "";
  n = findNodes(xml, s => s.startsWith("【售】委託售價："), "委託售價"); setIf(n, 2, formatNumber(c.price, 0));

  for (const [prefix, code] of [["車位產權：□", "1"], ["車位種類：□", "9"], ["使用狀況：□", "1"]]) {
    n = findNodes(xml, s => s.startsWith(prefix), prefix); n[0].textContent = n[0].textContent.replace("□", code);
  }
  n = findNodes(xml, s => s.startsWith("小學學區：") && s.includes("高中或大學"), "學區");
  setIf(n, 1, c.primarySchool); setIf(n, 5, c.juniorSchool); setIf(n, 9, c.college);
  n = findNodes(xml, s => s.startsWith("市場購物：") && s.includes("醫療機構"), "生活環境");
  setIf(n, 1, c.shopping); setIf(n, 4, c.park); setIf(n, 6, c.hospital); n[7].textContent = ""; n[8].textContent = "";

  const cells = [...xml.getElementsByTagNameNS(W_NS, "tc")];
  const featureCell = cells.find(cell => cell.textContent.includes("物件特性：") && cell.textContent.includes("帶看方式"));
  if (!featureCell) throw new Error("母版找不到物件特性欄");
  const lines = [...featureCell.getElementsByTagNameNS(W_NS, "p")].filter(p => /^[1-5]\.\s*$/.test(directText(p)));
  if (lines.length !== 5) throw new Error("母版物件特性欄格式不符");
  lines.forEach((p, index) => {
    const nodes = directTextNodes(p); nodes[0].textContent = `${index + 1}.${c.features[index]}`;
    nodes.slice(1).forEach(extra => { extra.textContent = ""; });
  });
  n = findNodes(xml, s => s.startsWith("承辦人：") && s.includes("修正"), "承辦人");
  const contact = [c.agentName, formatPhone(c.agentMobile)].filter(Boolean).join(" "); setIf(n, 1, contact ? `${contact}  ` : "");
  return new XMLSerializer().serializeToString(xml);
}

async function generateWord(raw) {
  const caseData = normalizeCase(raw);
  const response = await fetch("assets/property-sheet-template.docx");
  if (!response.ok) throw new Error("無法讀取 Word 母版");
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const documentPart = zip.file("word/document.xml");
  if (!documentPart) throw new Error("Word 母版缺少 document.xml");
  zip.file("word/document.xml", patchDocumentXml(await documentPart.async("text"), caseData), { createFolders: false });
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const filename = `物件明細表_${caseData.listingNo || "未編號"}.docx`;
  return { blob, filename, caseData };
}

function downloadWord(blob, filename) {
  if (lastDownload?.url) URL.revokeObjectURL(lastDownload.url);
  const url = URL.createObjectURL(blob);
  lastDownload = { url, filename };
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
}

async function sendByEmail(blob, filename, caseData, sourceUrl, primary, cc) {
  const data = new FormData();
  data.append("attachment", new File([blob], filename, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  data.append("_subject", `物件明細表｜${caseData.listingNo} ${caseData.shortName}`);
  data.append("_template", "table"); data.append("_captcha", "false"); data.append("_honey", "");
  data.append("案件編號", caseData.listingNo); data.append("案件名稱", caseData.shortName); data.append("資料來源", sourceUrl);
  if (cc) data.append("_cc", cc);
  const response = await fetch(`https://formsubmit.co/ajax/${primary}`, { method: "POST", headers: { Accept: "application/json" }, body: data });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) throw new Error(result.message || `寄信服務回應錯誤（${response.status}）`);
  return result;
}

downloadAgain.addEventListener("click", () => {
  if (!lastDownload) return;
  const anchor = document.createElement("a"); anchor.href = lastDownload.url; anchor.download = lastDownload.filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  submitButton.disabled = true; resultPanel.hidden = true; lastDownload = null;
  const sourceUrl = document.querySelector("#case-url").value.trim();
  const primary = document.querySelector("#primary-email").value.trim();
  const cc = document.querySelector("#cc-email").value.trim();
  const shouldSend = document.querySelector("#send-email").checked;
  try {
    setProgress(12, "正在讀取 YCut 案件資料…");
    const raw = await fetchCase(sourceUrl);
    setProgress(48, "正在填入固定格式 Word…");
    const generated = await generateWord(raw);
    setProgress(72, "Word 已完成，正在下載…");
    downloadWord(generated.blob, generated.filename);
    let mailMessage = "Word 已下載到本機。";
    if (shouldSend) {
      setProgress(86, "正在寄送 Word 附件…");
      const response = await sendByEmail(generated.blob, generated.filename, generated.caseData, sourceUrl, primary, cc);
      mailMessage = response.message || `Word 已寄到 ${primary}${cc ? `，副本 ${cc}` : ""}。`;
    }
    setProgress(100, "完成");
    showResult({
      ok: true, title: "物件明細表已完成", message: mailMessage,
      summary: [["案件編號", generated.caseData.listingNo], ["案件名稱", generated.caseData.shortName], ["檔案名稱", generated.filename]]
    });
  } catch (error) {
    showResult({ ok: false, title: "處理未完成", message: error instanceof Error ? error.message : String(error) });
  } finally {
    submitButton.disabled = false;
  }
});

window.addEventListener("beforeunload", () => { if (lastDownload?.url) URL.revokeObjectURL(lastDownload.url); });
