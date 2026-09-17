/* global JSZip */
"use strict";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const PRIMARY_EMAIL = "zook7402@gmail.com";
const CC_EMAIL = "zook7408@gmail.com";
const SITE_PASSWORD = "1688";
const ACCESS_SESSION_KEY = "property-sheet-access";
const accessGate = document.querySelector("#access-gate");
const siteContent = document.querySelector("#site-content");
const passwordForm = document.querySelector("#password-form");
const passwordInput = document.querySelector("#site-password");
const passwordError = document.querySelector("#password-error");
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

function unlockSite() {
  accessGate.hidden = true;
  siteContent.hidden = false;
  document.querySelector("#case-url").focus();
}

try {
  if (sessionStorage.getItem(ACCESS_SESSION_KEY) === "granted") unlockSite();
} catch {
  // The password gate still works if browser storage is unavailable.
}

passwordForm.addEventListener("submit", event => {
  event.preventDefault();
  if (passwordInput.value !== SITE_PASSWORD) {
    passwordError.hidden = false;
    passwordInput.value = "";
    passwordInput.focus();
    return;
  }

  try {
    sessionStorage.setItem(ACCESS_SESSION_KEY, "granted");
  } catch {
    // Continue without remembering access for this tab.
  }
  passwordError.hidden = true;
  unlockSite();
});

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

function safeFilename(value, fallback) {
  let filename = text(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
  if (!filename || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(filename)) filename = fallback;
  return Array.from(filename).slice(0, 120).join("");
}

function mapUseCode(value) {
  const name = text(value);
  if (/住宅|住家/.test(name)) return "1";
  if (/店面|店鋪/.test(name)) return "2";
  if (/辦公/.test(name)) return "3";
  if (/住辦/.test(name)) return "4";
  if (/住店/.test(name)) return "5";
  if (/車位/.test(name)) return "6";
  if (/廠房/.test(name)) return "7";
  if (/土地/.test(name)) return "8";
  if (/倉庫/.test(name)) return "9";
  return "A";
}

function mapTypeCode(value) {
  const name = text(value);
  if (/無電梯公寓|公寓/.test(name)) return "2";
  if (/華廈/.test(name)) return "3";
  if (/大樓/.test(name)) return "4";
  if (/透天/.test(name)) return "5";
  if (/別墅/.test(name)) return "6";
  if (/一般套房/.test(name)) return "7";
  if (/商務套房/.test(name)) return "8";
  if (/學生套房/.test(name)) return "9";
  if (/農舍/.test(name)) return "10";
  if (/樓中樓/.test(name)) return "11";
  return "";
}

function mapManagementFeeCode(value) {
  const name = text(value);
  if (/^無$/.test(name)) return "1";
  if (/^月繳$/.test(name)) return "2";
  if (/雙月繳/.test(name)) return "3";
  if (/季繳/.test(name)) return "4";
  if (/半年繳/.test(name)) return "5";
  if (/^年繳$/.test(name)) return "6";
  if (/一次繳/.test(name)) return "7";
  return "";
}

function mapParkingTypeCode(value, hasParking) {
  const name = text(value).replace(/／/g, "/");
  if (/坡道\/平面/.test(name)) return "1";
  if (/坡道\/機械/.test(name)) return "2";
  if (/昇降\/平面/.test(name)) return "3";
  if (/昇降\/機械/.test(name)) return "4";
  if (/平移\/機械/.test(name)) return "5";
  if (/庭院/.test(name)) return "6";
  if (/獨立車庫/.test(name)) return "7";
  if (/機械循環|停車塔/.test(name)) return "8";
  if (/騎樓/.test(name)) return "10";
  if (/^無$/.test(name) || !hasParking) return "9";
  return name ? "11" : "";
}

function extractFeatureLines(description) {
  return text(description)
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*\d+\s*[.．、]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeCase(raw) {
  const name = text(raw.caseName);
  const description = text(raw.caseSpec);

  const featureRules = [
    [["前後陽台", "通風"], "前後陽台通風"],
    [["方正", "採光"], "方正採光佳"],
    [["兩房", "好規劃"], "大兩房好規劃"],
    [["雙鐵", "捷運", "火車"], "雙鐵交通便利"],
    [["綠園道"], "綠園道旁機能佳"],
    [["生活機能", "機能"], "生活機能便利"]
  ];
  const features = extractFeatureLines(description);
  if (!features.length) {
    for (const [needles, output] of featureRules) {
      if (needles.some(key => description.includes(key) || name.includes(key)) && !features.includes(output)) features.push(output);
      if (features.length === 5) break;
    }
    for (const fallback of ["格局方正好規劃", "採光通風良好", "交通生活便利", "社區環境清幽", "自住置產皆宜"]) {
      if (features.length === 5) break;
      if (!features.includes(fallback)) features.push(fallback);
    }
  }
  const allText = `${name}\n${description}`;
  const typeCode = mapTypeCode(raw.typeCode || raw.typeCodeName);
  const useCode = mapUseCode(raw.useCode || raw.useCodeName);
  const parkingSpace = text(raw.parkingSpace);
  const hasParking = Boolean(parkingSpace) && !/^(無|否|0)$/.test(parkingSpace);

  return {
    listingNo: text(raw.nCaseNo), caseName: name,
    buildingName: text(raw.buildingName), address: text(raw.addrSimp),
    landPing: number(raw.landShPin), totalPing: number(raw.buiTotPin),
    mainAuxPing: number(raw.buiMPin) + number(raw.buiAuxPin), typeCode, useCode,
    direction: text(raw.positionName || raw.position || raw.direction),
    managementFee: number(raw.mgExpense), managementFeeCode: mapManagementFeeCode(raw.mgCode),
    parkingNo: text(raw.parkingNO), parkingTypeCode: mapParkingTypeCode(raw.parkingMode, hasParking),
    parkingUseCode: hasParking ? "2" : "1",
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
  setIf(n, 1, `${c.listingNo}  `); setIf(n, 4, c.caseName); n[5].textContent = "  "; n[6].textContent = "  ";
  setIf(n, 8, c.buildingName); n[9].textContent = " "; n[10].textContent = " ";

  n = findNodes(xml, s => s.startsWith("所有權人：") && s.includes("屬性：□"), "交易屬性");
  n[0].textContent = n[0].textContent.replace("屬性：□", "屬性：2");
  n = findNodes(xml, s => s.startsWith("物件地址：") && s.includes("地圖加密"), "物件地址"); setIf(n, 2, c.address);
  n = findNodes(xml, s => s.startsWith("登記面積") && s.includes("土地持分面積"), "登記面積");
  setIf(n, 5, formatNumber(c.totalPing)); setIf(n, 8, formatNumber(c.mainAuxPing)); setIf(n, 13, formatNumber(c.landPing));

  for (const [prefix, code] of [["案件類別：□", "1"], ["物件用途：□", c.useCode], ["物件型態：□", c.typeCode]]) {
    n = findNodes(xml, s => s.startsWith(prefix), prefix);
    if (code) n[0].textContent = n[0].textContent.replace("□", code);
  }
  n = findNodes(xml, s => s.startsWith("地上樓層：") && s.includes("建物格局"), "樓層格局");
  setIf(n, 2, c.floorsAbove ? String(c.floorsAbove) : ""); setIf(n, 12, c.rooms ? String(c.rooms) : "");
  setIf(n, 14, c.livingRooms ? String(c.livingRooms) : ""); setIf(n, 16, c.bathrooms ? String(c.bathrooms) : "");
  n = findNodes(xml, s => s.startsWith("建物方位：") && s.includes("建物屋齡"), "建物屋齡");
  setIf(n, 2, c.direction ? `${c.direction}  ` : "");
  setIf(n, 6, formatNumber(c.age, 1)); n[7].textContent = ""; n[8].textContent = "";
  n = findNodes(xml, s => s.startsWith("建物管理費：") && s.includes("繳費方式"), "建物管理費");
  setIf(n, 2, c.managementFee ? formatNumber(c.managementFee, 0) : "");
  if (c.managementFeeCode) n[10].textContent = c.managementFeeCode;
  n = findNodes(xml, s => s.startsWith("【售】委託售價："), "委託售價"); setIf(n, 2, formatNumber(c.price, 0));

  for (const [prefix, code] of [["車位產權：□", "1"], ["車位種類：□", c.parkingTypeCode], ["使用狀況：□", c.parkingUseCode]]) {
    n = findNodes(xml, s => s.startsWith(prefix), prefix);
    if (code) n[0].textContent = n[0].textContent.replace("□", code);
  }
  n = findNodes(xml, s => s.startsWith("位置：在") && s.includes("車位編號"), "車位編號");
  setIf(n, 5, c.parkingNo);
  n = findNodes(xml, s => s.startsWith("小學學區：") && s.includes("高中或大學"), "學區");
  setIf(n, 1, c.primarySchool); setIf(n, 5, c.juniorSchool); setIf(n, 9, c.college);
  n = findNodes(xml, s => s.startsWith("市場購物：") && s.includes("醫療機構"), "生活環境");
  setIf(n, 1, c.shopping); setIf(n, 4, c.park); setIf(n, 6, c.hospital); n[7].textContent = ""; n[8].textContent = "";

  n = findNodes(xml, s => s.startsWith("開發人員比例：") && s.includes("開發銷售比例"), "開發人員比例");
  if (n.length < 22) throw new Error("母版開發人員比例欄格式不符");
  [n[3].textContent, n[5].textContent, n[7].textContent, n[9].textContent] = [" 明仁", "50 ", " ]  [ 媛宜", "50 "];
  [n[15].textContent, n[19].textContent] = ["[ 50 ", "50 "];

  n = findNodes(xml, s => s.includes("外商圈說明書簽名："), "外商圈說明書簽名");
  if (n.length < 16) throw new Error("母版外商圈說明書簽名欄格式不符");
  n[15].textContent = "楊明仁";

  const cells = [...xml.getElementsByTagNameNS(W_NS, "tc")];
  const featureCell = cells.find(cell => cell.textContent.includes("物件特性：") && cell.textContent.includes("帶看方式"));
  if (!featureCell) throw new Error("母版找不到物件特性欄");
  const lines = [...featureCell.getElementsByTagNameNS(W_NS, "p")].filter(p => /^[1-5]\.\s*$/.test(directText(p)));
  if (lines.length !== 5) throw new Error("母版物件特性欄格式不符");
  lines.forEach((p, index) => {
    const nodes = directTextNodes(p);
    const feature = c.features[index] || "";
    nodes[0].textContent = feature ? `${index + 1}.${feature}` : `${index + 1}.`;
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
  const fallbackName = `物件明細表_${caseData.listingNo || "未編號"}`;
  const filename = `${safeFilename(caseData.caseName, fallbackName)}.docx`;
  return { blob, filename, caseData };
}

function downloadWord(blob, filename) {
  if (lastDownload?.url) URL.revokeObjectURL(lastDownload.url);
  const url = URL.createObjectURL(blob);
  lastDownload = { url, filename };
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
}

function appendHidden(formElement, name, value) {
  const input = document.createElement("input");
  input.type = "hidden"; input.name = name; input.value = value;
  formElement.append(input);
}

async function sendByEmail(blob, filename, caseData, sourceUrl) {
  if (blob.size > 10 * 1024 * 1024) throw new Error("Word 附件超過寄信服務的 10MB 上限");

  const mailForm = document.createElement("form");
  mailForm.method = "POST";
  mailForm.action = `https://formsubmit.co/${PRIMARY_EMAIL}`;
  mailForm.enctype = "multipart/form-data";
  mailForm.target = "mail-submit-frame";
  mailForm.hidden = true;

  const attachment = document.createElement("input");
  attachment.type = "file";
  attachment.name = "attachment";
  const transfer = new DataTransfer();
  transfer.items.add(new File([blob], filename, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  attachment.files = transfer.files;
  mailForm.append(attachment);

  appendHidden(mailForm, "_subject", `物件明細表｜${caseData.listingNo} ${caseData.caseName}`);
  appendHidden(mailForm, "_template", "table");
  appendHidden(mailForm, "_captcha", "false");
  appendHidden(mailForm, "_cc", CC_EMAIL);
  appendHidden(mailForm, "_url", window.location.href);
  appendHidden(mailForm, "案件編號", caseData.listingNo);
  appendHidden(mailForm, "案件名稱", caseData.caseName);
  appendHidden(mailForm, "資料來源", sourceUrl);

  document.body.append(mailForm);
  mailForm.submit();
  window.setTimeout(() => mailForm.remove(), 1500);
}

downloadAgain.addEventListener("click", () => {
  if (!lastDownload) return;
  const anchor = document.createElement("a"); anchor.href = lastDownload.url; anchor.download = lastDownload.filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  submitButton.disabled = true; resultPanel.hidden = true; lastDownload = null;
  const caseUrlInput = document.querySelector("#case-url");
  const sourceUrl = caseUrlInput.value.trim();
  caseUrlInput.value = "";
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
      await sendByEmail(generated.blob, generated.filename, generated.caseData, sourceUrl);
      mailMessage = "Word 已下載，附件寄送已送出。請稍候查看信箱。";
    }
    setProgress(100, "完成");
    showResult({
      ok: true, title: "物件明細表已完成", message: mailMessage,
      summary: [["案件編號", generated.caseData.listingNo], ["案件名稱", generated.caseData.caseName], ["檔案名稱", generated.filename]]
    });
  } catch (error) {
    showResult({ ok: false, title: "處理未完成", message: error instanceof Error ? error.message : String(error) });
  } finally {
    submitButton.disabled = false;
  }
});

window.addEventListener("beforeunload", () => { if (lastDownload?.url) URL.revokeObjectURL(lastDownload.url); });
