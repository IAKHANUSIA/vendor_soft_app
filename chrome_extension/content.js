// Vendor Soft - WhatsApp Web Auto Direct Image Sender & Express Queue Controller
console.log("🚀 Vendor Soft WhatsApp Web Extension 3.0 Active");

const waChannel = new BroadcastChannel("vendorsoft_wa_channel");
let isBusy = false;
let currentDispatchData = null;

// Inject floating status badge into WhatsApp Web UI
function injectStatusHUD() {
  if (document.getElementById("vs_wa_status_hud")) return;
  const hud = document.createElement("div");
  hud.id = "vs_wa_status_hud";
  hud.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999999;
    background: rgba(15, 23, 42, 0.95);
    color: #f8fafc;
    border: 1.5px solid #22c55e;
    border-radius: 30px;
    padding: 8px 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: none;
    transition: all 0.3s ease;
  `;
  hud.innerHTML = `
    <span style="width:10px; height:10px; background:#22c55e; border-radius:50%; box-shadow:0 0 8px #22c55e; animation:pulse 1.5s infinite;"></span>
    <span id="vs_wa_hud_text">📰 Vendor Soft: સિંગલ ટેબ ઓટો-ડિસ્પેચર સક્રિય છે</span>
  `;
  document.body.appendChild(hud);
}

function updateHUDText(text, isError = false) {
  injectStatusHUD();
  const hud = document.getElementById("vs_wa_status_hud");
  const textEl = document.getElementById("vs_wa_hud_text");
  if (hud && textEl) {
    textEl.textContent = text;
    hud.style.borderColor = isError ? "#ef4444" : "#22c55e";
  }
}

// Heartbeat to Vendor Soft
function sendHeartbeat() {
  waChannel.postMessage({ type: "EXTENSION_READY", version: "3.0", timestamp: Date.now() });
}
setInterval(sendHeartbeat, 2500);
sendHeartbeat();
setTimeout(injectStatusHUD, 1500);

// Convert base64 data URL to File
function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

// Helper: Wait for selector
function waitForElement(selector, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const elNow = document.querySelector(selector);
      if (elNow) {
        observer.disconnect();
        resolve(elNow);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeoutMs);
  });
}

// Helper: Wait for element to disappear
function waitForDisappear(selector, timeoutMs = 15000) {
  return new Promise((resolve) => {
    if (!document.querySelector(selector)) return resolve(true);
    const observer = new MutationObserver(() => {
      if (!document.querySelector(selector)) {
        observer.disconnect();
        resolve(true);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(true);
    }, timeoutMs);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Switch to Customer Chat inside the SAME active tab
async function navigateToCustomerChat(phone, customerName) {
  const cleanPhone = (phone || "").replace(/[^0-9]/g, "").slice(-10);
  if (!cleanPhone) return true;

  updateHUDText(`🔍 ગ્રાહક શોધી રહ્યું છે: ${customerName} (${cleanPhone})...`);

  // Try 1: WhatsApp Search input in sidebar
  const searchInput = document.querySelector('input[aria-label="Search or start a new chat"], #side input[role="textbox"], input[placeholder*="Search"], div[contenteditable="true"][data-tab="3"]');
  if (searchInput) {
    try {
      searchInput.focus();
      // Set search query
      if (searchInput.tagName.toLowerCase() === "input") {
        searchInput.value = cleanPhone;
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        searchInput.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        searchInput.textContent = cleanPhone;
        searchInput.dispatchEvent(new InputEvent("input", { bubbles: true, data: cleanPhone }));
      }
      
      await sleep(1200);

      // Check search results in sidebar pane
      const searchResultItem = document.querySelector('#pane-side div[role="listitem"], #pane-side div[data-testid="cell-frame-container"], #pane-side div[role="row"]');
      if (searchResultItem) {
        searchResultItem.click();
        console.log("Chat opened via sidebar search result click");
        await sleep(1000);
        return true;
      }
    } catch (sErr) {
      console.log("Sidebar search fallback:", sErr);
    }
  }

  // Try 2: URL direct navigation in the SAME window
  const targetUrl = `https://web.whatsapp.com/send?phone=91${cleanPhone}`;
  if (!window.location.href.includes(cleanPhone)) {
    console.log("Navigating to direct URL:", targetUrl);
    window.location.href = targetUrl;
    // Wait for chat to load after URL change
    await sleep(2500);
  }

  return true;
}

// Automatically attach image and click send in WhatsApp Web
async function attachAndSendImage(file, customerName) {
  updateHUDText(`📸 બિલ ઈમેજ જોડી રહ્યું છે: ${customerName}...`);

  // 1. Wait for Chat Area / Footer to be ready
  const chatInputSelectors = [
    'div[role="textbox"][contenteditable="true"][aria-label^="Type a message"]',
    'footer div[role="textbox"][contenteditable="true"]',
    'div[role="textbox"][aria-label*="Type a message"]',
    '#main footer div[contenteditable="true"]',
    'div[data-tab="10"]',
    'div[data-tab="1"]',
    'div[data-tab="6"]',
    'footer'
  ].join(', ');

  const chatInput = await waitForElement(chatInputSelectors, 20000);
  if (!chatInput) {
    throw new Error("ચેટ બોક્સ લોડ થયું નથી. કૃપા કરી WhatsApp Web ચેક કરો.");
  }

  await sleep(600);

  const dt = new DataTransfer();
  dt.items.add(file);

  let uploadTriggered = false;

  // 2. Click the Attach button ("+" icon) to open file picker menu
  const attachBtnSelectors = [
    'button[aria-label="Attach"]',
    'button[title="Attach"]',
    'span[data-icon="plus"]',
    'span[data-icon="attach-menu-plus"]',
    'div[aria-label="Attach"]',
    'div[role="button"][title="Attach"]',
    'span[data-icon="clip"]'
  ].join(', ');

  const attachBtn = document.querySelector(attachBtnSelectors);
  if (attachBtn) {
    const clickTarget = attachBtn.closest('button') || attachBtn.closest('div[role="button"]') || attachBtn;
    clickTarget.click();
    console.log("Clicked Attach '+' button");
    await sleep(400);
  }

  // 3. Find Media File Input and inject File object
  const fileInput = document.querySelector('input[type="file"][accept*="image"]') || 
                    document.querySelector('div[role="menu"] input[type="file"]') ||
                    document.querySelector('input[type="file"]');
  
  if (fileInput) {
    try {
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      uploadTriggered = true;
      console.log("✅ File injected into WhatsApp file input with change event");
    } catch (fErr) {
      console.warn("Direct file input error:", fErr);
    }
  }

  // 4. Fallback: Dispatch synthetic paste event if file input did not open preview
  if (!uploadTriggered) {
    const pasteTarget = document.querySelector('div[role="textbox"][contenteditable="true"]') || chatInput || document.body;
    pasteTarget.focus();
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      composed: true,
      clipboardData: dt
    });
    pasteTarget.dispatchEvent(pasteEvent);
    document.dispatchEvent(pasteEvent);
    console.log("Dispatched fallback paste event");
  }

  updateHUDText(`⏳ સેન્ડ બટનની રાહ જોવાઈ રહી છે: ${customerName}...`);

  // 5. Wait for WhatsApp Media Preview Modal & Send Button
  const sendBtnSelectors = [
    'span[data-icon="send"]',
    'span[data-icon="wds-send-solid"]',
    'span[data-icon="send-light"]',
    'div[aria-label="Send"]',
    'button[aria-label="Send"]',
    'div[role="button"][aria-label="Send"]',
    'button[aria-label="મોકલો"]',
    'div[aria-label="મોકલો"]',
    'div[role="button"][aria-label="મોકલો"]'
  ].join(', ');

  const sendBtn = await waitForElement(sendBtnSelectors, 15000);
  if (!sendBtn) {
    throw new Error("WhatsApp Image Preview મોકલો (Send) બટન દેખાયું નથી.");
  }

  await sleep(600);

  // 6. Click WhatsApp Green Send Button
  const clickSend = sendBtn.closest('button') || sendBtn.closest('div[role="button"]') || sendBtn;
  clickSend.click();
  console.log("🚀 Clicked WhatsApp Image Send button!");

  updateHUDText(`✅ બિલ સફળતાપૂર્વક મોકલાઈ ગયું: ${customerName}!`);

  // 7. Wait for preview modal to close
  await waitForDisappear('div[data-animate-media-viewer="true"], span[data-icon="send"]', 8000);
  await sleep(1000);

  return true;
}

// Process Single Bill Dispatch from Vendor Soft
async function processDispatchBill(data) {
  if (isBusy) {
    console.warn("Extension is busy processing another bill.");
    return;
  }
  isBusy = true;
  currentDispatchData = data;

  try {
    const { phone, customerName, imageBase64, billId } = data;
    console.log(`🚀 Processing bill for ${customerName} (${phone})...`);

    // 1. Navigate to chat
    if (phone) {
      await navigateToCustomerChat(phone, customerName);
    }

    // 2. Prepare file from base64
    const file = dataURLtoFile(imageBase64, `Bill_${(customerName || "Customer").replace(/[^a-zA-Z0-9]/g, "_")}.png`);

    // 3. Attach and Send Image
    await attachAndSendImage(file, customerName);

    // 4. Notify Vendor Soft to advance to next customer!
    console.log(`🎉 Auto-Send finished for ${customerName}! Notifying Vendor Soft to advance.`);
    waChannel.postMessage({
      type: "AUTO_ADVANCE_NEXT",
      customerName: customerName,
      phone: phone,
      billId: billId,
      success: true
    });

  } catch (err) {
    console.error("Error in processDispatchBill:", err);
    updateHUDText(`❌ ભૂલ: ${err.message}`, true);
    waChannel.postMessage({
      type: "SEND_ERROR",
      customerName: data.customerName,
      error: err.message
    });
  } finally {
    isBusy = false;
    currentDispatchData = null;
  }
}

// Check on load if pending URL parameter has bill info
async function checkUrlPendingDispatch() {
  const url = new URL(window.location.href);
  const autoSend = url.searchParams.get("vs_autosend");
  if (autoSend === "1" && currentDispatchData) {
    await processDispatchBill(currentDispatchData);
  }
}

// Listen for messages from Vendor Soft
waChannel.onmessage = async (event) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === "CHECK_EXTENSION") {
    sendHeartbeat();
  } else if (msg.type === "DISPATCH_BILL_IMAGE") {
    await processDispatchBill(msg);
  }
};

window.addEventListener("load", () => {
  sendHeartbeat();
  setTimeout(injectStatusHUD, 1000);
});
