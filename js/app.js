// Vendor Soft - Main Application Controller
let currentActiveView = "dashboard";
let cachedAgency = null;

// Global date display formatter — always dd/mm/yyyy
function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  // Handle ISO (2026-09-10T...) and plain (2026-09-10)
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
window.formatDisplayDate = formatDisplayDate;

// Refresh on language toggle
window.addEventListener("languageChanged", () => {
  refreshAllViews();
});

function toggleAppLanguage() {
  const nextLang = getLanguage() === "gu" ? "en" : "gu";
  setLanguage(nextLang);
}

function initDateDefaults() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const dailyDateEl = document.getElementById("dailyDeliveryDate");
  if (dailyDateEl) dailyDateEl.value = todayStr;

  const payDateEl = document.getElementById("payFormDate");
  if (payDateEl) payDateEl.value = todayStr;

  const vacStartEl = document.getElementById("vacFormStart");
  if (vacStartEl) vacStartEl.value = todayStr;

  const vacEndEl = document.getElementById("vacFormEnd");
  if (vacEndEl) {
    const defaultEnd = new Date(today);
    defaultEnd.setDate(today.getDate() + 3);
    vacEndEl.value = defaultEnd.toISOString().split("T")[0];
  }

  const curDateDisp = document.getElementById("currentDateDisplay");
  if (curDateDisp) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const locale = getLanguage() === "gu" ? "gu-IN" : "en-IN";
    curDateDisp.textContent = today.toLocaleDateString(locale, options);
  }

  // Set default billing month and year to current date
  const bMonthEl = document.getElementById("billingMonthSelect");
  if (bMonthEl && !bMonthEl.value) {
    bMonthEl.value = String(today.getMonth() + 1);
  }
  const bYearEl = document.getElementById("billingYearSelect");
  if (bYearEl && !bYearEl.value) {
    bYearEl.value = String(today.getFullYear());
  }
}

// Navigation View Switcher
function switchView(viewName) {
  currentActiveView = viewName;

  // Toggle View Panels
  document.querySelectorAll(".view-panel").forEach(p => p.classList.remove("active"));
  const targetPanel = document.getElementById(`view-${viewName}`);
  if (targetPanel) targetPanel.classList.add("active");

  // Update Desktop Sidebar
  document.querySelectorAll(".app-sidebar .nav-item").forEach(btn => {
    const onclickAttr = btn.getAttribute("onclick") || "";
    if (onclickAttr.includes(`'${viewName}'`)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Update Mobile Bottom Bar
  document.querySelectorAll(".mobile-nav-bar .mobile-nav-item").forEach(btn => {
    const onclickAttr = btn.getAttribute("onclick") || "";
    if (onclickAttr.includes(`'${viewName}'`)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Render specific view data
  switch (viewName) {
    case "dashboard": renderDashboard(); break;
    case "daily": renderDailyDeliveryView(); break;
    case "depot": renderDepotPurchaseView(); break;
    case "customers": renderCustomersView(); break;
    case "vacations":
      renderVacationsView();
      renderPaperHolidaysView();
      renderMassIssuesView();
      break;
    case "billing": renderBillingView(); break;
    case "payments": renderPaymentsView(); break;
    case "items": renderItemsView(); break;
    case "routes": renderRoutesView(); break;
    case "reports": renderReportsView(); break;
    case "expenses": renderExpensesView(); break;
    case "settings": renderSettingsView(); break;
  }
}
window.switchView = switchView;

async function refreshAllViews() {
  await renderDashboard();
  if (currentActiveView !== "dashboard") {
    switchView(currentActiveView);
  }
}
window.refreshAllViews = refreshAllViews;

// Agency Profile
async function loadAgencySettings() {
  if (!window.vendorDB || !window.vendorDB.get) return;
  const firm = await window.vendorDB.get("firms", "primary");
  if (firm) {
    cachedAgency = firm;
    const subTitle = document.getElementById("agencyHeaderSubtitle");
    if (subTitle) {
      subTitle.textContent = `${firm.name} • ${firm.phone}`;
    }
  }
}
window.loadAgencySettings = loadAgencySettings;

// -------------------------------------------------------------
// 1. DASHBOARD CONTROLLER
// -------------------------------------------------------------
async function renderDashboard() {
  if (!window.vendorDB || !window.vendorDB.getAll) return;
  const todayStr = new Date().toISOString().split("T")[0];
  const customers = await window.vendorDB.getAll("customers") || [];
  const routes = await window.vendorDB.getAll("routes") || [];
  const demandSummary = await window.vendorDB.getMorningDepotSummary(todayStr) || [];
  const vacations = await window.vendorDB.getAll("vacations") || [];

  let totalCopies = 0;
  demandSummary.forEach(item => {
    totalCopies += (item.count || 0) + (item.extra || 0);
  });

  let activeCustCount = 0;
  let totalPending = 0;
  customers.forEach(c => {
    if (c.status === "active") activeCustCount++;
    totalPending += (c.currentBalance || 0);
  });

  // Count customers on vacation today
  let onVacationToday = 0;
  for (const c of customers) {
    const isVac = await window.vendorDB.isCustomerOnVacation(c.id, todayStr);
    if (isVac) onVacationToday++;
  }

  // Update KPI Tiles
  document.getElementById("dashTotalCopies").textContent = totalCopies;
  document.getElementById("dashActiveCust").textContent = activeCustCount;
  document.getElementById("dashOnVacation").textContent = onVacationToday;
  document.getElementById("dashTotalPending").textContent = `₹${Math.round(totalPending).toLocaleString("en-IN")}`;
  document.getElementById("dashRouteCountInfo").textContent = `${routes.length} ${t("customerLine")} પર`;

  // Render Demand Summary Table
  const tbody = document.getElementById("dashDemandTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (demandSummary.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-dim);">No newspapers configured</td></tr>`;
    return;
  }

  demandSummary.forEach(item => {
    const total = (item.count || 0) + (item.extra || 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge badge-blue">${item.code || ""}</span></td>
      <td style="font-weight:600;">${item.name}</td>
      <td><span class="badge badge-emerald">${item.count}</span></td>
      <td><span class="badge badge-amber">${item.extra || 0}</span></td>
      <td style="font-size:1.1rem; font-weight:700; color:var(--accent-cyan);">${total}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// 2. DAILY DELIVERY HAWKER SHEET CONTROLLER
// -------------------------------------------------------------
async function renderDailyDeliveryView() {
  const dateInput = document.getElementById("dailyDeliveryDate");
  const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split("T")[0];

  const routes = await window.vendorDB.getAll("routes");
  const routeSelect = document.getElementById("dailyRouteFilter");

  if (routeSelect && routeSelect.options.length <= 1) {
    routeSelect.innerHTML = "";
    routes.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.code} - ${r.name}`;
      routeSelect.appendChild(opt);
    });
  }

  const activeRouteId = routeSelect ? parseInt(routeSelect.value) || (routes[0]?.id || 1) : 1;
  const sheetData = await window.vendorDB.getHawkerRouteSheet(activeRouteId, selectedDate);
  const salesmen = await window.vendorDB.getAll("salesmen") || [];
  const routeObj = routes.find(r => r.id === activeRouteId);
  const salesmanObj = routeObj?.salesmanId ? salesmen.find(s => s.id === routeObj.salesmanId) : null;

  const banner = document.getElementById("dailySalesmanBanner");
  const textEl = document.getElementById("dailySalesmanText");
  if (banner && textEl) {
    banner.style.display = "inline-flex";
    if (salesmanObj) {
      textEl.textContent = `વિતરક: ${salesmanObj.name} ${salesmanObj.mobile ? '(📞 ' + salesmanObj.mobile + ')' : ''}`;
    } else {
      textEl.textContent = `વિતરક: -`;
    }
  }

  const tbody = document.getElementById("dailyDeliveryTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (sheetData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:2rem;">આ લાઇન પર કોઈ સક્રિય ગ્રાહક મળ્યા નથી (No active customers on this line)</td></tr>`;
    return;
  }

  sheetData.forEach(cust => {
    const tr = document.createElement("tr");
    const paperList = Array.isArray(cust.subscribedPapers) ? cust.subscribedPapers : [];
    const paperPills = paperList.map(p => `<span class="badge badge-blue" style="margin-right:4px;">${p}</span>`).join("");

    let statusBadge = `<span class="badge badge-emerald">✓ ${t("delivered")}</span>`;
    if (cust.onVacation) {
      statusBadge = `<span class="badge badge-rose">🌴 ${t("skippedVacation")}</span>`;
    }

    const isNewBadge = (cust.isRecentlyAdded || cust.isNew)
      ? `<span class="badge" style="background:#0284c7; color:#fff; font-size:0.7rem; margin-left:6px; font-weight:700;">🆕 નવો ગ્રાહક</span>`
      : "";

    tr.innerHTML = `
      <td style="font-weight:700; color:var(--accent-cyan);">${cust.sequenceNo}</td>
      <td style="font-weight:600;">
        ${cust.name} ${isNewBadge}
        <div style="font-size:0.75rem; color:var(--text-dim);">${cust.code || ""} • 📞 ${cust.mobile || "-"}</div>
      </td>
      <td>${paperPills || `<span style="color:var(--text-dim);">-</span>`}</td>
      <td style="font-size:0.85rem; color:var(--text-muted);">${cust.address || "-"}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openVacationModalForCustomer(${cust.id})">
          🌴 રજા
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// 3. CUSTOMER MASTER CONTROLLER
// -------------------------------------------------------------
async function renderCustomersView() {
  const salesmen = await window.vendorDB.getAll("salesmen") || [];
  const collectionMen = await window.vendorDB.getAll("collectionMen") || [];

  // Populate Salesman Filter
  const smSelect = document.getElementById("custSalesmanFilter");
  if (smSelect) {
    const savedSm = localStorage.getItem("vendor_cust_filter_sm") || "all";
    smSelect.innerHTML = `<option value="all">🚴‍♂️ બધા વિતરક (Salesman)</option>`;
    salesmen.forEach(sm => {
      const opt = document.createElement("option");
      opt.value = sm.id;
      opt.textContent = `${sm.name}`;
      smSelect.appendChild(opt);
    });
    smSelect.value = savedSm;
    if (smSelect.value !== savedSm) {
      smSelect.value = "all";
      localStorage.setItem("vendor_cust_filter_sm", "all");
    }
  }

  // Populate Collection Man Filter
  const cmSelect = document.getElementById("custCollManFilter");
  if (cmSelect) {
    const savedCm = localStorage.getItem("vendor_cust_filter_cm") || "all";
    cmSelect.innerHTML = `<option value="all">💼 બધા ઉઘરાણી મેન</option>`;
    collectionMen.forEach(cm => {
      const opt = document.createElement("option");
      opt.value = cm.id;
      opt.textContent = `${cm.name}`;
      cmSelect.appendChild(opt);
    });
    cmSelect.value = savedCm;
    if (cmSelect.value !== savedCm) {
      cmSelect.value = "all";
      localStorage.setItem("vendor_cust_filter_cm", "all");
    }
  }

  // Always apply filter and render table
  filterCustomersTable();
}

function onCustomerFilterChange() {
  const smVal = document.getElementById("custSalesmanFilter")?.value || "all";
  const cmVal = document.getElementById("custCollManFilter")?.value || "all";
  localStorage.setItem("vendor_cust_filter_sm", smVal);
  localStorage.setItem("vendor_cust_filter_cm", cmVal);
  filterCustomersTable();
}
window.onCustomerFilterChange = onCustomerFilterChange;

let currentCustomerStatusFilter = "all";

function setCustomerStatusFilter(status) {
  currentCustomerStatusFilter = status;
  ["All", "Active", "Inactive"].forEach(s => {
    const btn = document.getElementById(`custFilterBtn${s}`);
    if (btn) {
      if (s.toLowerCase() === status) {
        btn.className = "btn btn-sm btn-primary";
      } else {
        btn.className = "btn btn-sm btn-secondary";
      }
    }
  });
  filterCustomersTable();
}
window.setCustomerStatusFilter = setCustomerStatusFilter;

function filterCustomersTable() {
  const search = (document.getElementById("custSearchInput")?.value || "").toLowerCase();
  const smVal = document.getElementById("custSalesmanFilter")?.value || localStorage.getItem("vendor_cust_filter_sm") || "all";
  const cmVal = document.getElementById("custCollManFilter")?.value || localStorage.getItem("vendor_cust_filter_cm") || "all";

  // Ensure dropdowns reflect the active value if they exist
  const smSelect = document.getElementById("custSalesmanFilter");
  if (smSelect && smSelect.value !== smVal && smSelect.querySelector(`option[value="${smVal}"]`)) {
    smSelect.value = smVal;
  }
  const cmSelect = document.getElementById("custCollManFilter");
  if (cmSelect && cmSelect.value !== cmVal && cmSelect.querySelector(`option[value="${cmVal}"]`)) {
    cmSelect.value = cmVal;
  }

  window.vendorDB.getAll("customers").then(async (customers) => {
    const routes = await window.vendorDB.getAll("routes") || [];
    const items = await window.vendorDB.getAll("items") || [];
    const salesmen = await window.vendorDB.getAll("salesmen") || [];
    const collectionMen = await window.vendorDB.getAll("collectionMen") || [];
    const routeMap = new Map(routes.map(r => [r.id, r.name]));
    const routeObjMap = new Map(routes.map(r => [r.id, r]));
    const itemMap = new Map(items.map(i => [i.id, i.name]));
    const salesmanMap = new Map(salesmen.map(s => [s.id, s.name]));
    const collManMap = new Map(collectionMen.map(c => [c.id, c.name]));

    const filtered = customers.filter(c => {
      const custNoStr = String(c.custNo || c.id || "");
      const bTypeStr = (c.billingType === "fixed" || c.billingType === "monthly") ? "માસિક fixed monthly" : "દૈનિક daily";
      const matchSearch = c.name.toLowerCase().includes(search) ||
        (c.mobile && c.mobile.includes(search)) ||
        (c.code && c.code.toLowerCase().includes(search)) ||
        custNoStr.includes(search) ||
        (c.societyShort && c.societyShort.toLowerCase().includes(search)) ||
        (c.address && c.address.toLowerCase().includes(search)) ||
        bTypeStr.toLowerCase().includes(search);

      // Match Salesman (either explicitly on customer or inherited from route)
      const cSmId = c.salesmanId || routeObjMap.get(c.routeId)?.salesmanId;
      const matchSalesman = (smVal === "all") || (String(cSmId) === String(smVal));

      // Match Collection Man (either explicitly on customer or inherited from route)
      const cCmId = c.collectionManId || routeObjMap.get(c.routeId)?.collectionManId;
      const matchCollMan = (cmVal === "all") || (String(cCmId) === String(cmVal));

      const matchStatus = (currentCustomerStatusFilter === "all") || (c.status === currentCustomerStatusFilter);

      return matchSearch && matchSalesman && matchCollMan && matchStatus;
    });

    renderCustomerTableFiltered(filtered, routeMap, itemMap, salesmanMap, collManMap);
  });
}

function renderCustomerTableFiltered(customers, routeMap, itemMap, salesmanMap = new Map(), collManMap = new Map()) {
  const countBadge = document.getElementById("customerTotalBadge");
  if (countBadge) {
    countBadge.textContent = `${customers.length} ${getLanguage() === 'gu' ? 'ગ્રાહકો' : 'Customers'}`;
  }
  const tbody = document.getElementById("customersTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; color:var(--text-dim); padding:2rem;">ગ્રાહક મળ્યા નથી (No customers found)</td></tr>`;
    return;
  }

  customers.sort((a, b) => (Number(a.sequenceNo) || 0) - (Number(b.sequenceNo) || 0));

  customers.forEach(c => {
    const tr = document.createElement("tr");
    const subList = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(c.subscriptions) : (Array.isArray(c.subscriptions) ? c.subscriptions : []);
    const paperPills = subList
      .map(id => {
        const name = itemMap.get(id);
        if (!name) return "";
        let badgeSuffix = "";
        const subConfig = c.subscriptions ? (c.subscriptions[id] ?? c.subscriptions[String(id)]) : null;
        if (subConfig && typeof subConfig === "object" && !Array.isArray(subConfig)) {
          if (subConfig.endDate) {
            badgeSuffix = ` <span style="color:#fca5a5; font-size:0.68rem;">(${formatDisplayDate(subConfig.endDate)} સુધી)</span>`;
          } else if (subConfig.startDate) {
            badgeSuffix = ` <span style="color:#7dd3fc; font-size:0.68rem;">(${formatDisplayDate(subConfig.startDate)} થી)</span>`;
          }
        }
        return `<span class="badge badge-blue" style="margin-right:4px;">${name}${badgeSuffix}</span>`;
      })
      .filter(Boolean)
      .join("");

    const bal = c.currentBalance || 0;
    const balColor = bal > 0 ? "color:#fb7185; font-weight:700;" : "color:#34d399;";
    const socBadge = c.societyShort ? `<span class="badge" style="background:#2563eb; color:#fff; font-size:0.7rem; margin-right:4px;" title="સોસાયટી શોર્ટ">${c.societyShort}</span>` : "";
    const delChargeBadge = (c.delChargeEnabled === "yes" || c.delChargeEnabled === true || (c.deliveryCharge > 0))
      ? `<span class="badge" style="background:rgba(16, 185, 129, 0.2); color:#34d399; font-size:0.68rem; margin-left:4px;" title="માસિક ડિલિવરી ચાર્જ">+₹${c.delChargeAmt || c.deliveryCharge || 10}</span>`
      : "";
    const smName = salesmanMap.get(c.salesmanId) || "";
    const cmName = collManMap.get(c.collectionManId) || "";
    const custNum = c.custNo || c.id || "-";

    const isMonthly = (c.billingType === "fixed" || c.billingType === "monthly");
    const billingBadge = isMonthly
      ? `<button class="btn btn-sm" onclick="toggleCustomerBillingType(${c.id})" 
          style="padding:3px 8px; font-size:0.75rem; border-radius:12px; background:rgba(245, 158, 11, 0.18); color:#fbbf24; border:1px solid rgba(245, 158, 11, 0.4); font-weight:600; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; gap:4px;" 
          title="માસિક ફિક્સ બિલિંગ - ક્લિક કરીને દૈનિક/માસિક બદલો">
          📆 માસિક${c.fixedMonthlyAmount > 0 ? ` (₹${c.fixedMonthlyAmount})` : ''}
        </button>`
      : `<button class="btn btn-sm" onclick="toggleCustomerBillingType(${c.id})" 
          style="padding:3px 8px; font-size:0.75rem; border-radius:12px; background:rgba(56, 189, 248, 0.18); color:#38bdf8; border:1px solid rgba(56, 189, 248, 0.4); font-weight:600; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; gap:4px;" 
          title="રોજિંદો ભાવ (દૈનિક ગણતરી) - ક્લિક કરીને દૈનિક/માસિક બદલો">
          📅 દૈનિક
        </button>`;

    tr.innerHTML = `
      <td style="font-weight:700; color:#38bdf8; text-align:center; font-family:monospace; font-size:0.95rem;">#${custNum}</td>
      <td style="font-weight:700; color:var(--accent-cyan); text-align:center;">${c.sequenceNo || '-'}</td>
      <td style="font-weight:700; color:var(--accent-amber); text-align:center;">${c.collectionSequence || c.sequenceNo || '-'}</td>
      <td style="font-weight:600;">
        ${socBadge}${c.name} ${delChargeBadge}
        <div style="font-size:0.75rem; color:var(--text-dim);">${c.code || ""} • ${c.address || ""}</div>
      </td>
      <td>
        <span class="badge badge-amber">${routeMap.get(c.routeId) || "-"}</span>
        ${smName ? `<div style="font-size:0.75rem; color:#38bdf8; margin-top:3px; font-weight:600;">🚴‍♂️ ${smName}</div>` : ""}
        ${cmName ? `<div style="font-size:0.75rem; color:#34d399; margin-top:2px; font-weight:600;">💼 ${cmName}</div>` : ""}
      </td>
      <td>${paperPills || `<span style="color:var(--text-dim);">-</span>`}</td>
      <td style="text-align:center;">${billingBadge}</td>
      <td>📞 ${c.mobile || "-"}</td>
      <td style="${balColor}">₹${bal}</td>
      <td>
        <button class="btn btn-sm ${c.status === 'active' ? 'btn-emerald' : 'btn-danger'}" 
          style="padding:2px 8px; font-size:0.75rem;" 
          onclick="toggleCustomerStatus(${c.id})" 
          title="ક્લિક કરીને સક્રિય/બંધ કરો">
          ${c.status === 'active' ? '🟢 સક્રિય' : '🔴 બંધ'}
        </button>
        ${c.status === 'inactive' && c.inactiveDate ? `<div style="font-size:0.68rem; color:#fb7185; margin-top:2px;">${formatDisplayDate(c.inactiveDate)} થી</div>` : ''}
      </td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-secondary btn-icon" title="મહિનાની વચ્ચે પેપર બદલો (Switch Paper)" style="color:var(--accent-cyan);" onclick="openSwitchPaperModal(${c.id})">🔄</button>
          <button class="btn btn-secondary btn-icon" title="Edit" onclick="editCustomer(${c.id})">✏️</button>
          <button class="btn btn-secondary btn-icon" title="Collect Payment" onclick="openPaymentModalForCustomer(${c.id})">💰</button>
          <button class="btn btn-danger btn-icon" title="Delete" onclick="deleteCustomer(${c.id})">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function toggleCustomerBillingType(id) {
  const cust = await window.vendorDB.get("customers", id);
  if (!cust) return;
  const isCurrentlyMonthly = (cust.billingType === "fixed" || cust.billingType === "monthly");
  const newType = isCurrentlyMonthly ? "daily" : "fixed";
  cust.billingType = newType;
  await window.vendorDB.put("customers", cust);
  showToast(newType === "fixed" ? `ગ્રાહક #${cust.custNo || cust.id} માટે 'માસિક' બિલિંગ સેટ થયું` : `ગ્રાહક #${cust.custNo || cust.id} માટે 'દૈનિક' બિલિંગ સેટ થયું`);
  filterCustomersTable();
}
window.toggleCustomerBillingType = toggleCustomerBillingType;

async function toggleCustomerStatus(id) {
  const cust = await window.vendorDB.get("customers", id);
  if (!cust) return;

  if (cust.status === "active") {
    const todayStr = new Date().toISOString().split("T")[0];
    const userDate = prompt(`ગ્રાહક "${cust.name}" ને બંધ (Inactive) કરવો છે?\nકઈ તારીખથી બંધ કરવા છે? (YYYY-MM-DD):`, todayStr);
    if (userDate === null) return;
    cust.status = "inactive";
    cust.inactiveDate = userDate.trim() || todayStr;
    await window.vendorDB.put("customers", cust);
    showToast(`ગ્રાહક ${cust.name} બંધ (Inactive) થયો (${formatDisplayDate(cust.inactiveDate)} થી)`);
  } else {
    if (confirm(`શું તમે ગ્રાહક "${cust.name}" ને ફરીથી સક્રિય (Active) કરવા માંગો છો?`)) {
      cust.status = "active";
      cust.inactiveDate = null;
      await window.vendorDB.put("customers", cust);
      showToast(`ગ્રાહક ${cust.name} ફરીથી સક્રિય (Active) થયો`);
    }
  }
  await refreshAllViews();
}
window.toggleCustomerStatus = toggleCustomerStatus;

// -------------------------------------------------------------
// 4. CUSTOMER MODAL (ADD / EDIT)
// -------------------------------------------------------------
let currentCustomerEditingData = null;
window.currentCustomerEditingData = null;

async function openCustomerModal(id = null) {
  const routes = await window.vendorDB.getAll("routes");
  const items = await window.vendorDB.getAll("items");
  const collectionMen = await window.vendorDB.getAll("collectionMen");
  const salesmen = await window.vendorDB.getAll("salesmen") || [];

  // Populate Route Dropdown
  const routeSelect = document.getElementById("custFormRoute");
  routeSelect.innerHTML = "";
  routes.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = `${r.code} - ${r.name}`;
    routeSelect.appendChild(opt);
  });

  // Populate Salesman Dropdown
  const salesmanSelect = document.getElementById("custFormSalesman");
  if (salesmanSelect) {
    salesmanSelect.innerHTML = `<option value="">-- સેલ્સમેન પસંદ કરો --</option>`;
    salesmen.forEach(sm => {
      const opt = document.createElement("option");
      opt.value = sm.id;
      opt.textContent = `${sm.name} (${sm.mobile || '-'})`;
      salesmanSelect.appendChild(opt);
    });
  }

  // Populate Collection Man Dropdown
  const collManSelect = document.getElementById("custFormCollectionMan");
  if (collManSelect) {
    collManSelect.innerHTML = `<option value="">-- પસંદ કરો (વૈકલ્પિક) --</option>`;
    collectionMen.forEach(cm => {
      const opt = document.createElement("option");
      opt.value = cm.id;
      opt.textContent = `${cm.name} (${cm.mobile || '-'})`;
      collManSelect.appendChild(opt);
    });
  }

  // Populate Papers Checkbox List
  const checkList = document.getElementById("custPapersCheckboxList");
  checkList.innerHTML = "";
  items.forEach(i => {
    const itemDiv = document.createElement("div");
    itemDiv.style.background = "rgba(255,255,255,0.05)";
    itemDiv.style.padding = "6px";
    itemDiv.style.borderRadius = "4px";

    const lbl = document.createElement("label");
    lbl.style.display = "flex";
    lbl.style.alignItems = "center";
    lbl.style.gap = "6px";
    lbl.style.fontSize = "0.85rem";
    lbl.style.cursor = "pointer";
    lbl.innerHTML = `
      <input type="checkbox" value="${i.id}" class="cust-paper-checkbox" onchange="document.getElementById('days_${i.id}').style.display = this.checked ? 'flex' : 'none'">
      <span style="font-weight:600; color:var(--accent-cyan);">${i.name}</span>
    `;

    const daysDiv = document.createElement("div");
    daysDiv.id = `days_${i.id}`;
    daysDiv.style.display = "none";
    daysDiv.style.flexWrap = "wrap";
    daysDiv.style.gap = "6px";
    daysDiv.style.marginTop = "6px";
    daysDiv.style.fontSize = "0.75rem";

    const dayNames = { mon: "સોમ", tue: "મંગળ", wed: "બુધ", thu: "ગુરુ", fri: "શુક્ર", sat: "શનિ", sun: "રવિ" };
    Object.entries(dayNames).forEach(([k, v]) => {
      const dLbl = document.createElement("label");
      dLbl.style.display = "flex";
      dLbl.style.alignItems = "center";
      dLbl.style.gap = "3px";
      dLbl.style.cursor = "pointer";
      dLbl.innerHTML = `<input type="checkbox" value="${k}" class="day-cb-${i.id}" checked> ${v}`;
      daysDiv.appendChild(dLbl);
    });

    itemDiv.appendChild(lbl);
    itemDiv.appendChild(daysDiv);
    checkList.appendChild(itemDiv);
  });

currentCustomerEditingData = null;

  if (id) {
    const cust = await window.vendorDB.get("customers", id);
    if (cust) {
      currentCustomerEditingData = cust;
      const switchBtn = document.getElementById("custModalSwitchPaperBtn");
      if (switchBtn) switchBtn.style.display = "inline-block";

      document.getElementById("custFormId").value = cust.id;
      if (document.getElementById("custFormCustNo")) {
        document.getElementById("custFormCustNo").value = cust.custNo || cust.id || "";
      }
      document.getElementById("custFormName").value = cust.name;
      document.getElementById("custFormAddress").value = cust.address || "";
      if (document.getElementById("custFormSocietyShort")) {
        document.getElementById("custFormSocietyShort").value = cust.societyShort || "";
      }
      document.getElementById("custFormRoute").value = cust.routeId;

      // Auto-fill Salesman & Collection Man from route (read-only)
      const editRoute = await window.vendorDB.get("routes", cust.routeId);
      if (editRoute) {
        if (document.getElementById("custFormSalesman")) {
          document.getElementById("custFormSalesman").value = editRoute.salesmanId || "";
        }
        if (document.getElementById("custFormCollectionMan")) {
          document.getElementById("custFormCollectionMan").value = editRoute.collectionManId || "";
        }
      }

      document.getElementById("custFormSeq").value = cust.sequenceNo || 1;
      if (document.getElementById("custFormCollSeq")) {
        document.getElementById("custFormCollSeq").value = cust.collectionSequence || cust.sequenceNo || 1;
      }
      if (document.getElementById("custFormDelChargeEnabled")) {
        document.getElementById("custFormDelChargeEnabled").value = cust.delChargeEnabled || ((cust.deliveryCharge > 0) ? "yes" : "no");
      }
      if (document.getElementById("custFormDelChargeAmt")) {
        document.getElementById("custFormDelChargeAmt").value = (cust.delChargeAmt !== undefined && cust.delChargeAmt !== null) ? cust.delChargeAmt : (cust.deliveryCharge || 10);
      }
      if (document.getElementById("custFormPrintBill")) {
        document.getElementById("custFormPrintBill").value = cust.printBill || "yes";
      }
      if (document.getElementById("custFormStatus")) {
        document.getElementById("custFormStatus").value = cust.status || "active";
      }
      if (document.getElementById("custFormInactiveDate")) {
        document.getElementById("custFormInactiveDate").value = cust.inactiveDate || "";
      }
      toggleCustomerInactiveDateInput();
      document.getElementById("custFormMobile").value = cust.mobile || "";
      document.getElementById("custFormWhatsApp").value = cust.whatsapp || "";
      document.getElementById("custFormBalance").value = cust.currentBalance || 0;
      document.getElementById("custFormBillingType").value = cust.billingType || "daily";
      document.getElementById("custFormFixedAmt").value = cust.fixedMonthlyAmount || 0;
      toggleCustomerFixedBillInput();

      // Select subscribed papers
      const rawSubs = cust.subscriptions || {};

      if (Array.isArray(rawSubs)) {
        // Legacy format: [1, 2]
        document.querySelectorAll(".cust-paper-checkbox").forEach(cb => {
          const id = parseInt(cb.value);
          const isSubbed = rawSubs.includes(id);
          cb.checked = isSubbed;
          document.getElementById(`days_${id}`).style.display = isSubbed ? 'flex' : 'none';
        });
      } else {
        // Object format: { "1": ["mon", "sun"] } OR { "1": { days: [...], startDate, endDate } }
        document.querySelectorAll(".cust-paper-checkbox").forEach(cb => {
          const id = parseInt(cb.value);
          const subConfig = rawSubs[id] ?? rawSubs[String(id)];
          if (subConfig) {
            cb.checked = true;
            document.getElementById(`days_${id}`).style.display = 'flex';
            let subDays = [];
            let dateHint = "";
            if (Array.isArray(subConfig)) {
              subDays = subConfig;
            } else if (typeof subConfig === "object") {
              subDays = subConfig.days || [];
              if (subConfig.endDate) {
                dateHint = ` <span style="color:#fb7185; font-size:0.75rem; font-weight:normal;">(${formatDisplayDate(subConfig.endDate)} સુધી)</span>`;
              } else if (subConfig.startDate) {
                dateHint = ` <span style="color:#38bdf8; font-size:0.75rem; font-weight:normal;">(${formatDisplayDate(subConfig.startDate)} થી)</span>`;
              }
            }

            document.querySelectorAll(`.day-cb-${id}`).forEach(dCb => {
              dCb.checked = subDays.includes(dCb.value);
            });

            const spanEl = cb.parentElement.querySelector("span");
            if (spanEl && dateHint) {
              spanEl.innerHTML += dateHint;
            }
          } else {
            cb.checked = false;
            document.getElementById(`days_${id}`).style.display = 'none';
          }
        });
      }
    // Populate Insert After dropdown for Edit
    await populateInsertAfterDropdown(cust.routeId, cust.id);
    document.getElementById("customerModalTitle").textContent = t("editCustomer");
    }
  } else {
    currentCustomerEditingData = null;
    const switchBtn = document.getElementById("custModalSwitchPaperBtn");
    if (switchBtn) switchBtn.style.display = "none";

    document.getElementById("custFormId").value = "";
    document.getElementById("customerForm").reset();

    // Auto-calculate next customer numeric number
    const nextCustNo = await window.vendorDB.getNextCustomerNumber();
    if (document.getElementById("custFormCustNo")) {
      document.getElementById("custFormCustNo").value = nextCustNo;
    }
    if (document.getElementById("custFormSocietyShort")) document.getElementById("custFormSocietyShort").value = "";
    if (document.getElementById("custFormDelChargeEnabled")) document.getElementById("custFormDelChargeEnabled").value = "no";
    if (document.getElementById("custFormDelChargeAmt")) document.getElementById("custFormDelChargeAmt").value = "10";
    if (document.getElementById("custFormPrintBill")) document.getElementById("custFormPrintBill").value = "yes";

    document.getElementById("custFormBillingType").value = "daily";
    document.getElementById("custFormFixedAmt").value = "0";

    const activeRouteId = parseInt(document.getElementById("custFormRoute")?.value) || (routes[0]?.id || 1);
    await populateInsertAfterDropdown(activeRouteId, null);

    // Auto-fill Salesman & Collection Man from route
    const addRoute = await window.vendorDB.get("routes", activeRouteId);
    if (addRoute) {
      if (document.getElementById("custFormSalesman")) document.getElementById("custFormSalesman").value = addRoute.salesmanId || "";
      if (document.getElementById("custFormCollectionMan")) document.getElementById("custFormCollectionMan").value = addRoute.collectionManId || "";
    }

    const allCusts = await window.vendorDB.getAll("customers") || [];
    const routeCusts = allCusts.filter(c => c.routeId === activeRouteId);
    const maxSeq = routeCusts.reduce((max, c) => Math.max(max, Number(c.sequenceNo) || 0), 0);
    const nextSeq = maxSeq + 1;

    document.getElementById("custFormSeq").value = nextSeq;
    if (document.getElementById("custFormCollSeq")) document.getElementById("custFormCollSeq").value = nextSeq;
    if (document.getElementById("custSeqHelpText")) document.getElementById("custSeqHelpText").textContent = `લાઇનનો છેલ્લો ક્રમ ${nextSeq} અપાશે`;

    if (document.getElementById("custFormStatus")) document.getElementById("custFormStatus").value = "active";
    if (document.getElementById("custFormInactiveDate")) document.getElementById("custFormInactiveDate").value = "";
    toggleCustomerInactiveDateInput();
    toggleCustomerFixedBillInput();
    document.getElementById("customerModalTitle").textContent = t("addCustomer");
  }

  openModal("customerModal");
}

async function populateInsertAfterDropdown(routeId, currentCustId = null) {
  const insertAfterSelect = document.getElementById("custFormInsertAfter");
  if (!insertAfterSelect) return;
  insertAfterSelect.innerHTML = `<option value="">-- લાઇનના અંતે ઉમેરો (Add to End) --</option>`;

  const allCusts = await window.vendorDB.getAll("customers") || [];
  const routeCusts = allCusts
    .filter(c => c.routeId === parseInt(routeId) && c.id !== currentCustId)
    .sort((a, b) => (Number(a.sequenceNo) || 0) - (Number(b.sequenceNo) || 0));

  routeCusts.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.sequenceNo || 0;
    const soc = c.societyShort ? `[${c.societyShort}] ` : "";
    const addr = c.address ? ` - ${c.address.slice(0, 25)}` : "";
    opt.textContent = `[ક્રમ ${c.sequenceNo || 0}] #${c.custNo || c.id} ${soc}${c.name}${addr}`;
    insertAfterSelect.appendChild(opt);
  });
}
window.populateInsertAfterDropdown = populateInsertAfterDropdown;

async function onCustomerRouteChangedInForm() {
  const routeSelect = document.getElementById("custFormRoute");
  const activeRouteId = parseInt(routeSelect?.value) || 1;
  const currentCustId = document.getElementById("custFormId")?.value ? parseInt(document.getElementById("custFormId").value) : null;
  await populateInsertAfterDropdown(activeRouteId, currentCustId);

  // Auto-fill Salesman & Collection Man from route
  const route = await window.vendorDB.get("routes", activeRouteId);
  if (route) {
    const smSelect = document.getElementById("custFormSalesman");
    const cmSelect = document.getElementById("custFormCollectionMan");
    if (smSelect) smSelect.value = route.salesmanId || "";
    if (cmSelect) cmSelect.value = route.collectionManId || "";
  }

  // If adding new, auto-set sequence to end of route
  if (!currentCustId) {
    const allCusts = await window.vendorDB.getAll("customers") || [];
    const routeCusts = allCusts.filter(c => c.routeId === activeRouteId);
    const maxSeq = routeCusts.reduce((max, c) => Math.max(max, Number(c.sequenceNo) || 0), 0);
    const nextSeq = maxSeq + 1;
    document.getElementById("custFormSeq").value = nextSeq;
    if (document.getElementById("custFormSyncCollSeq")?.checked) {
      document.getElementById("custFormCollSeq").value = nextSeq;
    }
    if (document.getElementById("custSeqHelpText")) {
      document.getElementById("custSeqHelpText").textContent = `લાઇનનો છેલ્લો ક્રમ ${nextSeq} અપાશે`;
    }
  }
}
window.onCustomerRouteChangedInForm = onCustomerRouteChangedInForm;

function onInsertAfterCustomerChanged() {
  const sel = document.getElementById("custFormInsertAfter");
  const help = document.getElementById("custSeqHelpText");
  const syncColl = document.getElementById("custFormSyncCollSeq")?.checked !== false;
  const val = sel?.value;
  if (val && parseInt(val) > 0) {
    const nextSeq = parseInt(val) + 1;
    document.getElementById("custFormSeq").value = nextSeq;
    if (syncColl && document.getElementById("custFormCollSeq")) {
      document.getElementById("custFormCollSeq").value = nextSeq;
    }
    if (help) help.textContent = `નવો ગ્રાહક ક્રમ ${nextSeq} પર મુકાશે (પાછળના બધા ગ્રાહકો આપોઆપ +1 ખસી જશે)`;
  } else {
    // End of line
    const routeId = parseInt(document.getElementById("custFormRoute")?.value) || 1;
    window.vendorDB.getAll("customers").then(custs => {
      const routeCusts = custs.filter(c => c.routeId === routeId);
      const maxSeq = routeCusts.reduce((max, c) => Math.max(max, Number(c.sequenceNo) || 0), 0);
      const nextSeq = maxSeq + 1;
      document.getElementById("custFormSeq").value = nextSeq;
      if (syncColl && document.getElementById("custFormCollSeq")) {
        document.getElementById("custFormCollSeq").value = nextSeq;
      }
      if (help) help.textContent = `લાઇનનો છેલ્લો ક્રમ ${nextSeq} અપાશે`;
    });
  }
}
window.onInsertAfterCustomerChanged = onInsertAfterCustomerChanged;

function toggleCustomerFixedBillInput() {
  const bType = document.getElementById("custFormBillingType")?.value;
  const hint = document.getElementById("custBillingTypeHint");
  if (hint) {
    hint.style.display = (bType === "fixed") ? "block" : "none";
  }
}
window.toggleCustomerFixedBillInput = toggleCustomerFixedBillInput;

function toggleCustomerInactiveDateInput() {
  const status = document.getElementById("custFormStatus")?.value;
  const group = document.getElementById("custInactiveDateGroup");
  const dateInput = document.getElementById("custFormInactiveDate");
  const statusEl = document.getElementById("custFormStatus");

  // Update status dropdown color
  if (statusEl) {
    if (status === "active") {
      statusEl.style.color = "#34d399";
      statusEl.style.borderColor = "rgba(52,211,153,0.4)";
    } else {
      statusEl.style.color = "#fb7185";
      statusEl.style.borderColor = "rgba(251,113,133,0.4)";
    }
  }

  if (group) {
    if (status === "inactive") {
      group.style.display = "block";
      if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split("T")[0];
      }
    } else {
      group.style.display = "none";
    }
  }
}
window.toggleCustomerInactiveDateInput = toggleCustomerInactiveDateInput;

async function editCustomer(id) {
  await openCustomerModal(id);
}

async function saveCustomerData(e) {
  e.preventDefault();
  const idVal = document.getElementById("custFormId").value;
  const subscriptions = {};
  const existingSubs = currentCustomerEditingData?.subscriptions || {};

  document.querySelectorAll(".cust-paper-checkbox:checked").forEach(cb => {
    const id = parseInt(cb.value);
    const checkedDays = Array.from(document.querySelectorAll(`.day-cb-${id}:checked`)).map(d => d.value);
    const oldConfig = existingSubs[id] ?? existingSubs[String(id)];
    if (oldConfig && typeof oldConfig === "object" && !Array.isArray(oldConfig)) {
      subscriptions[id] = {
        days: checkedDays,
        startDate: oldConfig.startDate || null,
        endDate: oldConfig.endDate || null
      };
    } else {
      subscriptions[id] = checkedDays;
    }
  });

  const custNo = parseInt(document.getElementById("custFormCustNo")?.value) || null;
  const societyShort = (document.getElementById("custFormSocietyShort")?.value || "").trim().toUpperCase();
  const routeIdForSave = parseInt(document.getElementById("custFormRoute").value);
  const saveRoute = await window.vendorDB.get("routes", routeIdForSave);
  const salesmanId = saveRoute?.salesmanId || null;
  const delChargeEnabled = document.getElementById("custFormDelChargeEnabled")?.value || "no";
  const delChargeAmt = parseFloat(document.getElementById("custFormDelChargeAmt")?.value) || 0;
  const printBill = document.getElementById("custFormPrintBill")?.value || "yes";

  const seqNo = parseInt(document.getElementById("custFormSeq").value) || 1;
  const collSeq = parseInt(document.getElementById("custFormCollSeq")?.value) || seqNo;
  const collectionManId = saveRoute?.collectionManId || null;
  const status = document.getElementById("custFormStatus")?.value || "active";
  const inactiveDate = (status === "inactive")
    ? (document.getElementById("custFormInactiveDate")?.value || new Date().toISOString().split("T")[0])
    : null;

  const custData = {
    name: document.getElementById("custFormName").value.trim(),
    custNo: custNo,
    societyShort: societyShort,
    salesmanId: salesmanId,
    delChargeEnabled: delChargeEnabled,
    delChargeAmt: delChargeAmt,
    deliveryCharge: (delChargeEnabled === "yes" ? delChargeAmt : 0),
    printBill: printBill,
    routeId: routeIdForSave,
    sequenceNo: seqNo,
    collectionSequence: collSeq,
    collectionManId: collectionManId,
    status: status,
    inactiveDate: inactiveDate,
    mobile: document.getElementById("custFormMobile").value.trim(),
    whatsapp: document.getElementById("custFormWhatsApp").value.trim() || document.getElementById("custFormMobile").value.trim(),
    currentBalance: parseFloat(document.getElementById("custFormBalance").value) || 0,
    address: document.getElementById("custFormAddress").value.trim(),
    billingType: document.getElementById("custFormBillingType")?.value || "daily",
    fixedMonthlyAmount: parseFloat(document.getElementById("custFormFixedAmt")?.value) || 0,
    subscriptions
  };

  const syncColl = document.getElementById("custFormSyncCollSeq")?.checked !== false;

  if (idVal) {
    custData.id = parseInt(idVal);
    await window.vendorDB.put("customers", custData);
  } else {
    custData.id = custNo || Date.now();
    custData.code = `C-${custNo || Date.now().toString().slice(-4)}`;
    custData.openingBalance = custData.currentBalance;
    custData.createdAt = new Date().toISOString();
    custData.isNew = true;

    // Use smart insert if targetSeq specified
    await window.vendorDB.insertCustomerAtSequence(custData, seqNo, custData.routeId, syncColl);
  }

  closeModal("customerModal");
  showToast(t("saveSuccess"));
  await refreshAllViews();
}

async function deleteCustomer(id) {
  if (confirm("શું તમે આ ગ્રાહકને હટાવવા માંગો છો? (Delete customer?)")) {
    await window.vendorDB.delete("customers", id);
    showToast(t("deleteSuccess"));
    await refreshAllViews();
  }
}
window.openCustomerModal = openCustomerModal;
window.editCustomer = editCustomer;
window.saveCustomerData = saveCustomerData;
window.deleteCustomer = deleteCustomer;

// -------------------------------------------------------------
// 5. VACATIONS CONTROLLER
// -------------------------------------------------------------
async function renderVacationsView() {
  const vacations = await window.vendorDB.getAll("vacations") || [];
  const customers = await window.vendorDB.getAll("customers") || [];
  const custMap = new Map(customers.map(c => [c.id, c.name]));

  const tbody = document.getElementById("vacationsTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const monthFilter = document.getElementById("vacationMonthFilter")?.value;
  let filtered = [...vacations];

  if (monthFilter) {
    filtered = filtered.filter(v => {
      const sM = (v.startDate || "").slice(0, 7);
      const eM = (v.endDate || "").slice(0, 7);
      return sM === monthFilter || eM === monthFilter || (v.startDate <= `${monthFilter}-31` && v.endDate >= `${monthFilter}-01`);
    });
  }

  if (filtered.length === 0) {
    const hint = monthFilter ? `પસંદ કરેલ માસ (${monthFilter}) માં કોઈ રજા નોંધાયેલ નથી.` : `કોઈ રજા નિર્ધારિત નથી (No scheduled vacations)`;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:2rem;">${hint}</td></tr>`;
    return;
  }

  filtered.sort((a, b) => (b.startDate || "").localeCompare(a.startDate || "") || (b.id - a.id));

  filtered.forEach(v => {
    const s = new Date(v.startDate);
    const e = new Date(v.endDate);
    const diffDays = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:600;">${custMap.get(v.customerId) || "Unknown"}</td>
      <td><span class="badge badge-amber">${formatDisplayDate(v.startDate)}</span></td>
      <td><span class="badge badge-amber">${formatDisplayDate(v.endDate)}</span></td>
      <td style="font-weight:700; color:var(--accent-rose);">${diffDays} દિવસ</td>
      <td style="color:var(--text-muted);">${v.reason || "-"}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteVacation(${v.id})">🗑️ રદ</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function clearVacationMonthFilter() {
  const el = document.getElementById("vacationMonthFilter");
  if (el) el.value = "";
  renderVacationsView();
}
window.clearVacationMonthFilter = clearVacationMonthFilter;

let cachedVacationCustomers = [];
let cachedVacationSalesmen = [];

async function openVacationModal(customerId = null) {
  cachedVacationCustomers = await window.vendorDB.getAll("customers") || [];
  cachedVacationSalesmen = await window.vendorDB.getAll("salesmen") || [];

  // Populate Salesman Filter dropdown
  const smFilter = document.getElementById("vacSalesmanFilter");
  if (smFilter) {
    smFilter.innerHTML = `<option value="all">-- બધા સેલ્સમેન (All) --</option>`;
    cachedVacationSalesmen.forEach(sm => {
      const opt = document.createElement("option");
      opt.value = sm.id;
      opt.textContent = `${sm.name} (${sm.mobile || '-'})`;
      smFilter.appendChild(opt);
    });
    smFilter.value = "all";
  }

  const searchInput = document.getElementById("vacCustomerSearch");
  if (searchInput) searchInput.value = "";

  const today = new Date();
  const tmr = new Date(today);
  tmr.setDate(tmr.getDate() + 1);
  const tmrStr = tmr.toISOString().split("T")[0];
  if (document.getElementById("vacFormStart")) document.getElementById("vacFormStart").value = tmrStr;
  if (document.getElementById("vacFormEnd")) document.getElementById("vacFormEnd").value = tmrStr;
  if (document.getElementById("vacFormReason")) document.getElementById("vacFormReason").value = "";

  filterVacationCustomerList(customerId);
  openModal("vacationModal");
}

function filterVacationCustomerList(preselectId = null) {
  const smFilter = document.getElementById("vacSalesmanFilter")?.value || "all";
  const search = (document.getElementById("vacCustomerSearch")?.value || "").trim().toLowerCase();
  const custSelect = document.getElementById("vacFormCustomer");
  if (!custSelect) return;

  custSelect.innerHTML = "";

  let filtered = cachedVacationCustomers.filter(c => {
    if (c.status === "inactive") return false;
    if (smFilter !== "all" && String(c.salesmanId) !== String(smFilter)) return false;
    if (search) {
      const matchName = (c.name || "").toLowerCase().includes(search);
      const matchCode = (c.code || "").toLowerCase().includes(search);
      const matchCustNo = String(c.custNo || c.id || "").includes(search);
      const matchAddr = (c.address || "").toLowerCase().includes(search);
      const matchSoc = (c.societyShort || "").toLowerCase().includes(search);
      const matchMobile = (c.mobile || "").includes(search);
      return matchName || matchCode || matchCustNo || matchAddr || matchSoc || matchMobile;
    }
    return true;
  });

  filtered.sort((a, b) => (Number(a.sequenceNo) || 0) - (Number(b.sequenceNo) || 0));

  const countBadge = document.getElementById("vacCustomerCount");
  if (countBadge) countBadge.textContent = filtered.length;

  if (filtered.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "-- કોઈ ગ્રાહક મળ્યા નથી --";
    custSelect.appendChild(opt);
    return;
  }

  filtered.forEach((c, idx) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    const no = c.custNo || c.id;
    const soc = c.societyShort ? `[${c.societyShort}] ` : "";
    const addr = c.address ? ` (${c.address.slice(0, 30)})` : "";
    opt.textContent = `#${no} - ${c.name} ${soc}${addr}`;
    if (preselectId && (c.id === preselectId || c.custNo === preselectId)) {
      opt.selected = true;
    } else if (idx === 0 && !preselectId) {
      opt.selected = true;
    }
    custSelect.appendChild(opt);
  });
}
window.filterVacationCustomerList = filterVacationCustomerList;

function openVacationModalForCustomer(customerId) {
  openVacationModal(customerId);
}

async function saveVacationData(e) {
  e.preventDefault();
  const customerIdVal = document.getElementById("vacFormCustomer").value;
  if (!customerIdVal) {
    alert("કૃપા કરીને ગ્રાહક પસંદ કરો!");
    return;
  }
  const customerId = parseInt(customerIdVal);
  const startDate = document.getElementById("vacFormStart").value;
  const endDate = document.getElementById("vacFormEnd").value;
  const reason = document.getElementById("vacFormReason").value.trim();

  if (endDate < startDate) {
    alert("અંત તારીખ શરૂઆત તારીખ પછીની હોવી જોઈએ! (End date must be after start date)");
    return;
  }

  await window.vendorDB.put("vacations", {
    customerId,
    startDate,
    endDate,
    reason
  });

  closeModal("vacationModal");
  showToast(t("saveSuccess"));
  await refreshAllViews();
}

async function deleteVacation(id) {
  if (confirm("શું તમે આ રજા રદ કરવા માંગો છો?")) {
    await window.vendorDB.delete("vacations", id);
    showToast(t("deleteSuccess"));
    await refreshAllViews();
  }
}
window.openVacationModal = openVacationModal;
window.openVacationModalForCustomer = openVacationModalForCustomer;
window.saveVacationData = saveVacationData;
window.deleteVacation = deleteVacation;

// -------------------------------------------------------------
// 5.5 PAPER HOLIDAYS CONTROLLER
// -------------------------------------------------------------
async function renderPaperHolidaysView() {
  const holidays = await window.vendorDB.getAll("paperHolidays");
  const items = await window.vendorDB.getAll("items");
  const itemMap = new Map(items.map(i => [i.id, i.name]));

  const tbody = document.getElementById("paperHolidaysTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!holidays || holidays.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-dim); padding:1rem;">કોઈ પેપરની રજા નોંધાયેલ નથી (No paper holidays)</td></tr>`;
    return;
  }

  holidays.forEach(h => {
    const s = new Date(h.startDate);
    const e = new Date(h.endDate);
    const diffDays = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:600; color:var(--accent-cyan);">${itemMap.get(h.itemId) || "Unknown Paper"}</td>
      <td><span class="badge badge-amber">${formatDisplayDate(h.startDate)}</span></td>
      <td><span class="badge badge-amber">${formatDisplayDate(h.endDate)}</span></td>
      <td style="font-weight:700; color:var(--accent-rose);">${diffDays} દિવસ</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deletePaperHoliday(${h.id})" title="રદ કરો">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function openPaperHolidayModal() {
  const items = await window.vendorDB.getAll("items");
  const checkContainer = document.getElementById("holPaperCheckboxList");
  if (checkContainer) {
    checkContainer.innerHTML = "";
    items.forEach(i => {
      const label = document.createElement("label");
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.gap = "8px";
      label.style.cursor = "pointer";
      label.style.padding = "6px 8px";
      label.style.background = "rgba(255,255,255,0.04)";
      label.style.borderRadius = "6px";
      label.innerHTML = `
        <input type="checkbox" value="${i.id}" class="holiday-paper-cb" checked>
        <span style="font-weight:600; font-size:0.88rem; color:#f8fafc;">${i.name} <small style="color:var(--text-muted);">(${i.code})</small></span>
      `;
      checkContainer.appendChild(label);
    });
  }

  const today = new Date().toISOString().split("T")[0];
  if (document.getElementById("holFormStart")) document.getElementById("holFormStart").value = today;
  if (document.getElementById("holFormEnd")) document.getElementById("holFormEnd").value = today;

  openModal("paperHolidayModal");
}

function toggleAllHolidayPapers(selectAll) {
  document.querySelectorAll(".holiday-paper-cb").forEach(cb => {
    cb.checked = selectAll;
  });
}
window.toggleAllHolidayPapers = toggleAllHolidayPapers;

async function savePaperHolidayData(e) {
  e.preventDefault();
  const checkedBoxes = Array.from(document.querySelectorAll(".holiday-paper-cb:checked"));
  if (checkedBoxes.length === 0) {
    alert("કૃપા કરીને ઓછામાં ઓછું એક પેપર પસંદ કરો! (Please select at least one paper)");
    return;
  }

  const startDate = document.getElementById("holFormStart").value;
  const endDate = document.getElementById("holFormEnd").value;

  if (endDate < startDate) {
    alert("અંત તારીખ શરૂઆત તારીખ પછીની હોવી જોઈએ! (End date must be after start date)");
    return;
  }

  for (const cb of checkedBoxes) {
    const itemId = parseInt(cb.value);
    await window.vendorDB.put("paperHolidays", {
      itemId,
      startDate,
      endDate
    });
  }

  closeModal("paperHolidayModal");
  showToast(`${checkedBoxes.length} પેપર્સની રજા સફળતાપૂર્વક સાચવવામાં આવી!`);
  await refreshAllViews();
}

async function deletePaperHoliday(id) {
  if (confirm("શું તમે આ પેપરની રજા રદ કરવા માંગો છો? (Delete paper holiday?)")) {
    await window.vendorDB.delete("paperHolidays", id);
    showToast(t("deleteSuccess"));
    await refreshAllViews();
  }
}
window.openPaperHolidayModal = openPaperHolidayModal;
window.savePaperHolidayData = savePaperHolidayData;
window.deletePaperHoliday = deletePaperHoliday;

// -------------------------------------------------------------
// 5.6 MASS ISSUES CONTROLLER
// -------------------------------------------------------------
const dayNamesGuList = ["રવિવાર", "સોમવાર", "મંગળવાર", "બુધવાર", "ગુરુવાર", "શુક્રવાર", "શનિવાર"];

async function renderMassIssuesView() {
  const issues = await window.vendorDB.getAll("massIssues");
  const items = await window.vendorDB.getAll("items");
  const itemMap = new Map(items.map(i => [i.id, i]));

  const tbody = document.getElementById("massIssuesTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!issues || issues.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-dim); padding:1rem;">કોઈ બોનસ પેપર નોંધાયેલ નથી</td></tr>`;
    return;
  }

  issues.forEach(m => {
    const tr = document.createElement("tr");
    const isHolidayOthers = m.holidayForOthers !== false;
    const holidayBadge = isHolidayOthers
      ? `<span class="badge badge-rose" title="આ દિવસે અન્ય તમામ પેપરોની રજા રહેશે">🌴 અન્ય પેપર રજા</span>`
      : `<span class="badge badge-blue" title="રેગ્યુલર પેપર પણ ચાલુ રહેશે">📰 રેગ્યુલર પેપર ચાલુ</span>`;

    const dObj = new Date(m.date + "T12:00:00");
    const dName = dayNamesGuList[dObj.getDay()] || "";
    const targetBadge = m.targetType === "day_wise"
      ? `<span class="badge badge-amber" title="${dName}ના રોજ પેપર લેતા ગ્રાહકો">📅 ${dName}ના ગ્રાહકો</span>`
      : `<span class="badge badge-emerald" title="તમામ સક્રિય ગ્રાહકો">🌐 બધા ગ્રાહકો</span>`;

    const itemObj = itemMap.get(m.itemId);
    const itemDayRates = itemObj ? getItemDayRates(itemObj, dObj.getDay(), m.date) : { sale: 5.0, purchase: 3.32 };
    const saleRate = Number(m.rate !== undefined && m.rate !== null ? m.rate : itemDayRates.sale);
    const purRate = Number(m.purchaseRate !== undefined && m.purchaseRate !== null && m.purchaseRate !== "" ? m.purchaseRate : itemDayRates.purchase);

    tr.innerHTML = `
      <td><span class="badge badge-amber">${m.date} (${dName})</span></td>
      <td style="font-weight:600; color:var(--accent-cyan);">${itemObj?.name || "Unknown Paper"}</td>
      <td style="font-weight:700; color:var(--accent-cyan);">₹${saleRate.toFixed(2)}</td>
      <td style="font-weight:700; color:#fb7185;">₹${purRate.toFixed(2)}</td>
      <td>${targetBadge}</td>
      <td>${holidayBadge}</td>
      <td style="color:var(--text-muted);">${m.reason || "-"}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteMassIssue(${m.id})" title="રદ કરો">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function onMassPaperOrDateChange() {
  const paperSelect = document.getElementById("massFormPaper");
  const dateInput = document.getElementById("massFormDate");
  if (!paperSelect || !dateInput) return;

  const itemId = parseInt(paperSelect.value);
  const dateStr = dateInput.value;
  if (!dateStr) return;

  const targetDate = new Date(dateStr + "T12:00:00");
  const dayOfWeek = targetDate.getDay();
  const dayName = dayNamesGuList[dayOfWeek] || "વાર";

  // Update dynamic labels in modal
  const dayLabel = document.getElementById("massTargetDayNameText");
  const daySubLabel = document.getElementById("massTargetDaySubText");
  if (dayLabel) dayLabel.textContent = dayName;
  if (daySubLabel) daySubLabel.textContent = dayName;

  if (itemId) {
    const item = await window.vendorDB.get("items", itemId);
    if (item) {
      const rates = getItemDayRates(item, dayOfWeek, dateStr);
      const saleInput = document.getElementById("massFormRate");
      const purInput = document.getElementById("massFormPurchaseRate");
      if (saleInput) saleInput.value = rates.sale;
      if (purInput) purInput.value = rates.purchase;
    }
  }
}
window.onMassPaperOrDateChange = onMassPaperOrDateChange;

async function openMassIssueModal() {
  const items = await window.vendorDB.getAll("items");
  const itemSelect = document.getElementById("massFormPaper");
  itemSelect.innerHTML = "";

  items.forEach(i => {
    const opt = document.createElement("option");
    opt.value = i.id;
    opt.textContent = `${i.name} (${i.code})`;
    itemSelect.appendChild(opt);
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  document.getElementById("massFormDate").value = tomorrowStr;
  
  const radAll = document.getElementById("massTargetAll");
  if (radAll) radAll.checked = true;

  document.getElementById("massFormReason").value = "";
  const chkHoliday = document.getElementById("massFormHolidayOthers");
  if (chkHoliday) chkHoliday.checked = true;

  await onMassPaperOrDateChange();
  openModal("massIssueModal");
}

async function saveMassIssueData(e) {
  e.preventDefault();
  const itemId = parseInt(document.getElementById("massFormPaper").value);
  const date = document.getElementById("massFormDate").value;
  const rate = parseFloat(document.getElementById("massFormRate").value) || 0;
  const purchaseRate = parseFloat(document.getElementById("massFormPurchaseRate").value) || 0;
  const reason = document.getElementById("massFormReason").value.trim();
  const holidayForOthers = document.getElementById("massFormHolidayOthers") ? document.getElementById("massFormHolidayOthers").checked : true;
  const targetType = document.querySelector('input[name="massFormTargetType"]:checked')?.value || "all";

  await window.vendorDB.put("massIssues", {
    itemId,
    date,
    rate,
    purchaseRate,
    targetType,
    holidayForOthers,
    reason
  });

  closeModal("massIssueModal");
  showToast("બોનસ પેપર સફળતાપૂર્વક સાચવવામાં આવ્યું");
  await refreshAllViews();
}

async function deleteMassIssue(id) {
  if (confirm("શું તમે આ બોનસ પેપર રદ કરવા માંગો છો?")) {
    await window.vendorDB.delete("massIssues", id);
    showToast("બોનસ પેપર રદ થયું");
    await refreshAllViews();
  }
}

window.renderMassIssuesView = renderMassIssuesView;
window.openMassIssueModal = openMassIssueModal;
window.saveMassIssueData = saveMassIssueData;
window.deleteMassIssue = deleteMassIssue;

// -------------------------------------------------------------
// 6. MONTHLY BILLING CONTROLLER
// -------------------------------------------------------------
async function renderBillingView() {
  const monthSelect = document.getElementById("billingMonthSelect");
  const yearSelect = document.getElementById("billingYearSelect");
  const month = parseInt(monthSelect?.value || 9);
  const year = parseInt(yearSelect?.value || 2026);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const allBills = await window.vendorDB.getAll("bills");
  const customers = await window.vendorDB.getAll("customers");
  const custMap = new Map(customers.map(c => [c.id, c]));

  let bills = allBills.filter(b => b.monthYear === monthKey);
  const tbody = document.getElementById("billingTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (bills.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-dim); padding:2rem;">આ મહિનાના બિલ હજુ ગણાયા નથી. ઉપર આપેલ "બિલ ગણો" બટન દબાવો. (Click 'Calculate Monthly Bills' above)</td></tr>`;
    return;
  }

  // Filter by Route
  const routeFilter = document.getElementById("billingRouteFilter")?.value || "all";
  if (routeFilter !== "all") {
    bills = bills.filter(b => String(b.routeId) === String(routeFilter));
  }

  // Filter by Salesman
  const smFilter = document.getElementById("billingSalesmanFilter")?.value || "all";
  if (smFilter !== "all") {
    bills = bills.filter(b => String(b.salesmanId) === String(smFilter));
  }

  const searchQuery = (document.getElementById("billingSearchInput")?.value || "").toLowerCase().trim();
  if (searchQuery) {
    bills = bills.filter(b => {
      const cust = custMap.get(b.customerId) || {};
      const name = (cust.name || b.customerName || "").toLowerCase();
      const code = (cust.code || "").toLowerCase();
      const seq = String(b.deliverySequence || cust.sequenceNo || "");
      const collSeq = String(b.collectionSequence || cust.collectionSequence || "");
      const billNo = (b.billNo || "").toLowerCase();
      return name.includes(searchQuery) || code.includes(searchQuery) || seq.includes(searchQuery) || collSeq.includes(searchQuery) || billNo.includes(searchQuery);
    });
  }

  const sortMode = document.getElementById("billingSortSelect")?.value || "delivery";
  if (sortMode === "collection") {
    bills.sort((a, b) => {
      const custA = custMap.get(a.customerId) || {};
      const custB = custMap.get(b.customerId) || {};
      const seqA = a.collectionSequence || custA.collectionSequence || custA.sequenceNo || 999999;
      const seqB = b.collectionSequence || custB.collectionSequence || custB.sequenceNo || 999999;
      return seqA - seqB;
    });
  } else if (sortMode === "name") {
    bills.sort((a, b) => {
      const custA = custMap.get(a.customerId) || {};
      const custB = custMap.get(b.customerId) || {};
      const nameA = custA.name || a.customerName || "";
      const nameB = custB.name || b.customerName || "";
      return nameA.localeCompare(nameB, "gu");
    });
  } else {
    // Default delivery sequence
    bills.sort((a, b) => {
      const custA = custMap.get(a.customerId) || {};
      const custB = custMap.get(b.customerId) || {};
      const seqA = a.deliverySequence || custA.sequenceNo || 999999;
      const seqB = b.deliverySequence || custB.sequenceNo || 999999;
      return seqA - seqB;
    });
  }

  bills.forEach(bill => {
    const cust = custMap.get(bill.customerId) || {};
    const displaySeq = (sortMode === "collection")
      ? (bill.collectionSequence || cust.collectionSequence || cust.sequenceNo || "-")
      : (bill.deliverySequence || cust.sequenceNo || "-");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b style="color:var(--accent-cyan); font-size:1rem;">#${displaySeq}</b></td>
      <td>
        <span class="badge badge-blue">${bill.billNo}</span>
        ${bill.isManuallyEdited ? `<span class="badge" style="background:#854d0e; color:#fef08a; font-size:0.65rem; margin-left:4px;" title="આ બિલમાં સુધારો કરવામાં આવેલ છે">સુધારેલ</span>` : ""}
      </td>
      <td style="font-weight:600;">
        ${cust.societyShort ? `<span class="badge" style="background:#2563eb; color:#fff; font-size:0.65rem; margin-right:4px;">${cust.societyShort}</span>` : ""}
        ${cust.name || bill.customerName}
        <div style="font-size:0.75rem; color:var(--text-dim);">ID: #${bill.customerNo || cust.custNo || cust.id || "-"} • 📞 ${cust.whatsapp || cust.mobile || "-"}</div>
      </td>
      <td>
        <span class="badge ${bill.daysDelivered === 0 ? 'badge-amber' : 'badge-emerald'}">${bill.daysDelivered}</span>
      </td>
      <td style="color:#fb7185;">-₹${bill.vacationDeduction || 0} (${bill.vacationDays || 0}d)</td>
      <td style="font-weight:600;">₹${bill.currentAmount}</td>
      <td style="color:var(--text-dim);">₹${bill.pastArrears || 0}</td>
      <td style="font-size:1.1rem; font-weight:700; color:var(--accent-cyan);">₹${bill.totalPayable}</td>
      <td>
        <div style="display:flex; gap:6px; flex-wrap:nowrap;">
          <button class="btn btn-warning btn-sm" onclick="openEditBillModal('${bill.id}')" title="બિલ સુધારો (Edit Bill - દિવસો કે રકમ બદલો)" style="background:rgba(245, 158, 11, 0.15); border:1px solid #f59e0b; color:#fbbf24; font-weight:600; padding:4px 9px; cursor:pointer;">
            ✏️ સુધારો
          </button>
          <button class="btn btn-whatsapp btn-sm" onclick="sendWhatsAppBill('${bill.id}')" title="WhatsApp મેસેજ">
            💬 WhatsApp
          </button>
          <button class="btn btn-primary btn-sm" onclick="openColorBillModal('${bill.id}')" title="કલર બિલ ઈમેજ (નમૂના ૧ મુજબ)">
            📸 કલર બિલ
          </button>
          <button class="btn btn-secondary btn-icon" onclick="openSingleSlipModal('${bill.id}')" title="પ્રિન્ટ સ્લિપ (A6/B/W)">
            🖨️
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// EDIT BILL MODAL LOGIC (બિલ સુધારો)
// -------------------------------------------------------------
async function openEditBillModal(billId) {
  try {
    const allBills = await window.vendorDB.getAll("bills");
    let bill = allBills.find(b => String(b.id) === String(billId) || String(b.billNo) === String(billId));
    if (!bill && (typeof billId === "number" || !isNaN(Number(billId)))) {
      bill = await window.vendorDB.get("bills", Number(billId));
    }
    if (!bill) {
      showToast("બિલ રેકોર્ડ મળ્યો નથી! (Bill not found)");
      return;
    }

    const cust = (await window.vendorDB.get("customers", bill.customerId)) || {};
    const routes = await window.vendorDB.getAll("routes");
    const route = routes.find(r => r.id === (cust.routeId || bill.routeId));

    const idInput = document.getElementById("editBillId");
    if (idInput) idInput.value = bill.id;

    const nameDisp = document.getElementById("editBillCustomerNameDisplay");
    if (nameDisp) nameDisp.textContent = cust.name || bill.customerName || "-";

    const infoDisp = document.getElementById("editBillCustomerInfoDisplay");
    if (infoDisp) infoDisp.textContent = `ID: #${cust.custNo || cust.code || cust.id || bill.customerNo || "-"} • લાઇન: ${route ? route.name : "સામાન્ય"}`;

    const billNoDisp = document.getElementById("editBillBillNoDisplay");
    if (billNoDisp) billNoDisp.textContent = bill.billNo || "-";

    const monthDisp = document.getElementById("editBillMonthDisplay");
    if (monthDisp) monthDisp.textContent = bill.monthYear || "-";

    const daysInput = document.getElementById("editBillDaysDelivered");
    if (daysInput) daysInput.value = bill.daysDelivered ?? 0;

    const vacDaysInput = document.getElementById("editBillVacationDays");
    if (vacDaysInput) vacDaysInput.value = bill.vacationDays ?? 0;

    const curAmtInput = document.getElementById("editBillCurrentAmount");
    if (curAmtInput) curAmtInput.value = bill.currentAmount ?? 0;

    const vacDedInput = document.getElementById("editBillVacationDeduction");
    if (vacDedInput) vacDedInput.value = bill.vacationDeduction ?? 0;

    const delChargeInput = document.getElementById("editBillDelCharge");
    if (delChargeInput) delChargeInput.value = bill.delCharge ?? 0;

    const arrearsInput = document.getElementById("editBillPastArrears");
    if (arrearsInput) arrearsInput.value = bill.pastArrears ?? 0;

    const totalInput = document.getElementById("editBillTotalPayable");
    if (totalInput) totalInput.value = bill.totalPayable ?? 0;

    const notesInput = document.getElementById("editBillNotes");
    if (notesInput) notesInput.value = bill.editNotes || "";

    openModal("editBillModal");
  } catch (err) {
    console.error("Error opening edit bill modal:", err);
    showToast("બિલ ખોલવામાં ભૂલ આવી: " + err.message);
  }
}
window.openEditBillModal = openEditBillModal;

function calculateEditBillTotals() {
  const current = parseFloat(document.getElementById("editBillCurrentAmount")?.value) || 0;
  const arrears = parseFloat(document.getElementById("editBillPastArrears")?.value) || 0;
  const total = Math.round(current + arrears);
  const totalEl = document.getElementById("editBillTotalPayable");
  if (totalEl) totalEl.value = total;
}
window.calculateEditBillTotals = calculateEditBillTotals;

async function saveEditedBill() {
  try {
    const rawId = document.getElementById("editBillId")?.value;
    if (!rawId) return;

    const allBills = await window.vendorDB.getAll("bills");
    let bill = allBills.find(b => String(b.id) === String(rawId) || String(b.billNo) === String(rawId));
    if (!bill && !isNaN(Number(rawId))) {
      bill = await window.vendorDB.get("bills", Number(rawId));
    }
    if (!bill) {
      showToast("બિલ રેકોર્ડ મળ્યો નથી!");
      return;
    }

    const daysDelivered = parseInt(document.getElementById("editBillDaysDelivered")?.value) || 0;
    const vacationDays = parseInt(document.getElementById("editBillVacationDays")?.value) || 0;
    const currentAmount = parseFloat(document.getElementById("editBillCurrentAmount")?.value) || 0;
    const vacationDeduction = parseFloat(document.getElementById("editBillVacationDeduction")?.value) || 0;
    const delCharge = parseFloat(document.getElementById("editBillDelCharge")?.value) || 0;
    const pastArrears = parseFloat(document.getElementById("editBillPastArrears")?.value) || 0;
    const totalPayable = parseFloat(document.getElementById("editBillTotalPayable")?.value) || 0;
    const notes = document.getElementById("editBillNotes")?.value || "";

    // Update bill record
    bill.daysDelivered = daysDelivered;
    bill.vacationDays = vacationDays;
    bill.currentAmount = currentAmount;
    bill.vacationDeduction = vacationDeduction;
    bill.delCharge = delCharge;
    bill.pastArrears = pastArrears;
    bill.totalPayable = totalPayable;
    bill.editNotes = notes;
    bill.isManuallyEdited = true;
    bill.editedAt = new Date().toISOString();

    await window.vendorDB.put("bills", bill);

    // Synchronize Customer's current balance
    const cust = await window.vendorDB.get("customers", bill.customerId);
    if (cust) {
      cust.currentBalance = totalPayable;
      await window.vendorDB.put("customers", cust);
    }

    closeModal("editBillModal");
    showToast(`🎉 સફળતા! બિલ નં. ${bill.billNo} (${cust ? cust.name : ""}) સફળતાપૂર્વક સુધારી લેવાયું છે!`);
    await renderBillingView();
  } catch (err) {
    console.error("Error saving edited bill:", err);
    showToast("બિલ સાચવવામાં ભૂલ: " + err.message);
  }
}
window.saveEditedBill = saveEditedBill;

// Global active bill references for modals
let currentViewingBillData = null;
let currentViewingBillCustomer = null;

function updateBillNoPreview(context = "modal") {
  const isModal = context === "modal";
  const fmt = document.getElementById(isModal ? "calcModalBillNoFormat" : "settingAgencyBillNoFormat")?.value || "sequential";
  const prefix = document.getElementById(isModal ? "calcModalBillNoPrefix" : "settingAgencyBillNoPrefix")?.value || "";
  const startNum = parseInt(document.getElementById(isModal ? "calcModalBillNoStartNum" : "settingAgencyBillNoStartNum")?.value) || 1001;
  const padding = parseInt(document.getElementById(isModal ? "calcModalBillNoPadding" : "settingAgencyBillNoPadding")?.value) || 0;

  const monthSelect = document.getElementById("billingMonthSelect");
  const yearSelect = document.getElementById("billingYearSelect");
  const month = parseInt(monthSelect?.value || 8);
  const year = parseInt(yearSelect?.value || 2026);

  const mShort = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][month - 1] || "BILL";
  const yShort = String(year).slice(-2);

  function formatNum(val) {
    return padding > 0 ? String(val).padStart(padding, "0") : String(val);
  }

  function getSingleSample(val, custId = 208) {
    if (fmt === "sequential") {
      return `${prefix}${formatNum(val)}`;
    } else if (fmt === "prefix_seq") {
      return `${prefix || "INV-"}${formatNum(val)}`;
    } else if (fmt === "month_seq") {
      return `${prefix || (mShort + yShort + "-")}${formatNum(val)}`;
    } else if (fmt === "cust_based") {
      return `${prefix || "B-"}${String(month).padStart(2, "0")}-${String(custId).padStart(3, "0")}`;
    }
    return `${prefix}${formatNum(val)}`;
  }

  if (isModal) {
    const p1 = document.getElementById("modalBillNoPreview1");
    const p2 = document.getElementById("modalBillNoPreview2");
    const p3 = document.getElementById("modalBillNoPreview3");
    if (p1) p1.textContent = getSingleSample(startNum, 208);
    if (p2) p2.textContent = getSingleSample(startNum + 1, 294);
    if (p3) p3.textContent = getSingleSample(startNum + 2, 2002);
  } else {
    const sp = document.getElementById("settingsBillNoPreview");
    if (sp) sp.textContent = `${getSingleSample(startNum, 208)}, ${getSingleSample(startNum + 1, 294)}, ${getSingleSample(startNum + 2, 2002)}...`;
  }
}
window.updateBillNoPreview = updateBillNoPreview;

async function openCalculateBillsModal() {
  const monthSelect = document.getElementById("billingMonthSelect");
  const yearSelect = document.getElementById("billingYearSelect");
  const month = parseInt(monthSelect?.value || 8);
  const year = parseInt(yearSelect?.value || 2026);

  const monthNames = ["જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઓગસ્ટ", "સપ્ટેમ્બર", "ઓક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"];
  const mName = monthNames[month - 1] || "ઓગસ્ટ";

  const monthYearLabel = document.getElementById("calcModalMonthYearText");
  if (monthYearLabel) {
    monthYearLabel.textContent = `${mName} - ${year}`;
  }

  const firm = cachedAgency || await window.vendorDB.get("firms", "primary") || {};
  if (firm) {
    const fmtSelect = document.getElementById("calcModalBillNoFormat");
    if (fmtSelect && firm.billNoFormat) fmtSelect.value = firm.billNoFormat;

    const prefixInput = document.getElementById("calcModalBillNoPrefix");
    if (prefixInput && firm.billNoPrefix !== undefined) prefixInput.value = firm.billNoPrefix;

    const startNumInput = document.getElementById("calcModalBillNoStartNum");
    if (startNumInput && firm.billNoStartNum !== undefined) startNumInput.value = firm.billNoStartNum;

    const padSelect = document.getElementById("calcModalBillNoPadding");
    if (padSelect && firm.billNoPadding !== undefined) padSelect.value = firm.billNoPadding;
  }

  updateBillNoPreview("modal");
  openModal("calculateBillsModal");
}
window.openCalculateBillsModal = openCalculateBillsModal;

async function confirmGenerateMonthlyBills() {
  const month = parseInt(document.getElementById("billingMonthSelect").value);
  const year = parseInt(document.getElementById("billingYearSelect").value);

  const options = {
    billNoFormat: document.getElementById("calcModalBillNoFormat")?.value || "sequential",
    prefix: document.getElementById("calcModalBillNoPrefix")?.value || "",
    startNumber: parseInt(document.getElementById("calcModalBillNoStartNum")?.value) || 1001,
    padding: parseInt(document.getElementById("calcModalBillNoPadding")?.value) || 0
  };

  closeModal("calculateBillsModal");
  showToast("માસિક બિલ ગણાઈ રહ્યા છે...");

  const bills = await window.vendorDB.calculateMonthlyBills(year, month, options);
  showToast(`🎉 સફળતા! ${bills.length} બિલ પોતાની મરજી મુજબના નંબર સાથે બની ગયા!`);
  await refreshAllViews();
}
window.confirmGenerateMonthlyBills = confirmGenerateMonthlyBills;

async function triggerMonthlyBillCalculation() {
  await openCalculateBillsModal();
}
window.triggerMonthlyBillCalculation = triggerMonthlyBillCalculation;

// -------------------------------------------------------------
// BILL HTML GENERATORS (Multi-Template Engine)
// -------------------------------------------------------------

// 1. Color WhatsApp Bill (Matching Image 1)
function generateColorBillHTML(bill, cust, firm, items, salesmen, collectionMen) {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const smObj = cust.salesmanId ? salesmen.find(s => s.id === cust.salesmanId) : null;
  const smName = smObj ? smObj.name : (cust.salesmanName || "REHAAN");

  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mName = monthNames[parseInt(m) - 1] || "Aug";
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const dateRangeStr = `01-${mName}-${y} To ${lastDay}-${mName}-${y}`;

  const upiPayee = (firm.name || "PERFECT NEWSPAPER SUPPLIERS").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "9825778607@okaxis")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 95) : "";

  const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
  let itemRowsHtml = "";
  if (bill.paperBreakdown && bill.paperBreakdown.length > 0) {
    itemRowsHtml = bill.paperBreakdown.map((pb, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 7px 8px; text-align: center; border-right: 1px solid #e2e8f0; font-weight: 700;">${idx + 1}</td>
        <td style="padding: 7px 8px; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0;">${pb.name || "GUJARAT SAMACHAR"}</td>
        <td style="padding: 7px 8px; text-align: center; border-right: 1px solid #e2e8f0; font-weight: 600;">${pb.daysCount || bill.daysDelivered || 30}</td>
        <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: #0f172a;">${Number(pb.totalCost).toFixed(2)}</td>
      </tr>
    `).join("");
  } else {
    const pNames = rawSubs.map(id => itemMap.get(id)?.name).filter(Boolean).join(", ") || "GUJARAT SAMACHAR";
    itemRowsHtml = `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 7px 8px; text-align: center; border-right: 1px solid #e2e8f0; font-weight: 700;">1</td>
        <td style="padding: 7px 8px; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0;">${pNames}</td>
        <td style="padding: 7px 8px; text-align: center; border-right: 1px solid #e2e8f0; font-weight: 600;">${bill.daysDelivered || 30}</td>
        <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: #0f172a;">${Number(bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2)}</td>
      </tr>
    `;
  }

  const paperAmt = (bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const delCharge = (bill.deliveryCharge || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  return `
    <div id="colorBillCard" class="color-bill-card" style="background:#ffffff; color:#0f172a; border: 2.5px solid #0f3b7d; border-radius: 12px; padding: 14px; font-family: 'Outfit', 'Noto Sans Gujarati', sans-serif; width: 490px; box-sizing: border-box; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
      
      <!-- Top Pill: Credit Memo -->
      <div style="text-align: center; margin-top: -24px; margin-bottom: 8px;">
        <span style="background: #0f3b7d; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 18px; border-radius: 12px; letter-spacing: 0.5px; text-transform: uppercase;">Credit Memo</span>
      </div>

      <!-- Agency Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f3b7d; padding-bottom: 8px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 44px; height: 44px; border: 2px solid #0f3b7d; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; color: #0f3b7d; line-height: 1;">
            <span style="font-size: 20px; color: #0f3b7d;">P<span style="color: #ef4444; font-size: 14px;">■</span></span>
            <span style="font-size: 6px; text-align: center; color: #0f3b7d; letter-spacing: -0.2px;">PERFECT</span>
          </div>
          <div>
            <div style="font-size: 17px; font-weight: 900; color: #0f3b7d; letter-spacing: 0.2px; text-transform: uppercase;">${firm.name || 'PERFECT NEWSPAPER SUPPLIERS'}</div>
            <div style="font-size: 11px; color: #334155; font-weight: 600;">📍 ${firm.address || 'E-392, SANKALITNAGAR-JUHAPURA-Ahmedabad'}</div>
          </div>
        </div>
      </div>

      <!-- Vendor Info & Billing Period Box -->
      <div style="display: flex; justify-content: space-between; align-items: center; border: 1.5px solid #0f3b7d; border-radius: 8px; padding: 6px 12px; margin-bottom: 8px; background: #f8fafc;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 32px; height: 32px; background: #e0f2fe; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px;">👤</div>
          <div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${firm.ownerName || 'NIZAM TAI'}</div>
            <div style="font-size: 12px; font-weight: 700; color: #0369a1;">${firm.phone || '9825778607'}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; text-align: right;">
          <div style="font-size: 20px;">📅</div>
          <div>
            <div style="font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Billing Period</div>
            <div style="font-size: 12px; font-weight: 800; color: #0f172a;">${dateRangeStr}</div>
          </div>
        </div>
      </div>

      <!-- Customer Details -->
      <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 8px; font-size: 12px; margin-bottom: 8px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; background: #fff;">
        <div>
          <div><span style="color: #64748b;">Name:</span> <b style="color: #0f3b7d; font-size: 13px;">${cust.name || bill.customerName} ${cust.societyShort ? `(${cust.societyShort})` : ''}</b></div>
          ${cust.address ? `<div><span style="color: #64748b;">Address:</span> <b>${cust.address}</b></div>` : ''}
          <div style="margin-top: 2px;"><span style="color: #64748b;">Mobile No:</span> <b style="color: #0f172a;">${cust.mobile || '-'}</b></div>
          <div><span style="color: #64748b;">Salesman:</span> <b style="color: #0369a1;">${smName}</b></div>
        </div>
        <div style="text-align: right;">
          <div><span style="color: #64748b;">Bill No :</span> <b style="font-size: 14px; color: #0f172a;">${bill.billNo || '3152'}</b></div>
          <div style="margin-top: 4px;"><span style="color: #64748b;">Month :</span> <b style="color: #0f172a;">${mName} · ${y}</b></div>
          <div style="margin-top: 4px; font-size: 11px; color: #64748b;">ID: #${cust.custNo || cust.id || '-'}</div>
        </div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #0f3b7d; margin-bottom: 6px;">
        <thead>
          <tr style="background: #0f3b7d; color: #ffffff; font-size: 12px;">
            <th style="padding: 6px 8px; width: 40px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2);">No.</th>
            <th style="padding: 6px 8px; text-align: left; border-right: 1px solid rgba(255,255,255,0.2);">Newspaper</th>
            <th style="padding: 6px 8px; width: 65px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2);">Days</th>
            <th style="padding: 6px 8px; width: 90px; text-align: right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>

      <!-- Arrears Strip -->
      <div style="background: #dbeafe; color: #991b1b; padding: 4px 10px; font-size: 12px; font-weight: 700; border-radius: 4px; margin-bottom: 8px;">
        ગયા મહીના સુધીની બાકી રકમ : ₹ ${prevBal}
      </div>

      <!-- Payment & Amount Due Box -->
      <div style="display: grid; grid-template-columns: 175px 1fr; gap: 10px; margin-bottom: 8px; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px; background: #f8fafc;">
        <!-- Left: Scan & Pay -->
        <div style="text-align: center; border-right: 1px solid #e2e8f0; padding-right: 8px;">
          <div style="background: #0f3b7d; color: #fff; font-size: 10.5px; font-weight: 700; padding: 2px 10px; border-radius: 10px; display: inline-block; margin-bottom: 4px;">Scan & Pay</div>
          <div style="width: 95px; height: 95px; margin: 0 auto;">${qrSvg}</div>
          <div style="display: flex; justify-content: center; gap: 4px; margin-top: 4px; font-size: 9px; font-weight: 700;">
            <span style="color: #4285f4;">GPay</span> • <span style="color: #5f259f;">PhonePe</span> • <span style="color: #00b9f1;">Paytm</span>
          </div>
        </div>

        <!-- Right: Totals -->
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 12px;">
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span style="color: #475569;">Newspaper Amount:</span>
              <b style="color: #0f172a;">${paperAmt}</b>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span style="color: #475569;">Previous Balance:</span>
              <b style="color: ${prevBal > 0 ? '#b91c1c' : '#0f172a'};">${prevBal}</b>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #475569;">Home Delivery Charge:</span>
              <b style="color: #0f172a;">${delCharge}</b>
            </div>
          </div>

          <div style="background: #0f3b7d; color: #ffffff; padding: 6px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase;">Net Amount Payable :</span>
            <span style="font-size: 16px; font-weight: 900;">₹ ${totalNet}</span>
          </div>
        </div>
      </div>

      <!-- Notice Panel (Light Yellow with 4 Icons) -->
      <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 6px; padding: 6px; margin-bottom: 6px; font-size: 10px; color: #713f12;">
        <div style="text-align: center; font-weight: 800; font-size: 11px; margin-bottom: 4px; text-decoration: underline;">સૂચના</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1.2fr 1fr; gap: 4px; text-align: center; line-height: 1.25;">
          <div>
            <div style="font-size: 13px;">📅</div>
            <b>તા. ૧ થી ૧૦ માં બિલ ચૂકવી દેવું.</b>
          </div>
          <div>
            <div style="font-size: 13px;">🕌</div>
            <b>ઈસ્લામિક તહેવારે રજા રહેશે.</b>
          </div>
          <div>
            <div style="font-size: 13px;">📢</div>
            <b>પેપર બંધ કરાવવું હોય તો કૃપા કરી અગાઉથી જાણ કરવી.</b>
          </div>
          <div>
            <div style="font-size: 13px;">🪙</div>
            <b>દર મહિને સર્વિસ ચાર્જ પેટે ₹૧૦ વસૂલવામાં આવશે.</b>
          </div>
        </div>
      </div>

      <!-- Bottom WhatsApp Screenshot Banner -->
      <div style="background: #f1f5f9; border: 1px dashed #0f3b7d; border-radius: 5px; padding: 4px 8px; text-align: center; font-size: 10px; font-weight: 700; color: #0f3b7d;">
        ✈️ ONLINE PAYMENT પછી SCREEN SHOT 💬 WhatsApp પર અવશ્ય મોકલવો. 💵
      </div>

      <div style="text-align: right; font-size: 8.5px; color: #94a3b8; margin-top: 4px;">
        Devlop by :- Imtiyaz Khanusia 94276 98665
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// CUSTOM AGENCY LOGO & VECTOR GRAPHICS HELPERS
// -------------------------------------------------------------
let currentAgencyLogoData = "";

function handleAgencyLogoUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2.5 * 1024 * 1024) {
    showToast("કૃપા કરીને ૨.૫ MB કરતા નાની ઈમેજ ફાઈલ પસંદ કરો", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = function(evt) {
    currentAgencyLogoData = evt.target.result;
    updateAgencyLogoPreview(currentAgencyLogoData);
    showToast("લોગો પસંદ કર્યો! સેવ કરવા માટે 'પ્રોફાઇલ સેવ કરો' પર ક્લિક કરો.");
  };
  reader.readAsDataURL(file);
}
window.handleAgencyLogoUpload = handleAgencyLogoUpload;

function removeAgencyLogo() {
  currentAgencyLogoData = "";
  updateAgencyLogoPreview("");
  const input = document.getElementById("settingAgencyLogoInput");
  if (input) input.value = "";
  showToast("લોગો હટાવ્યો! સેવ કરવા માટે 'પ્રોફાઇલ સેવ કરો' પર ક્લિક કરો.");
}
window.removeAgencyLogo = removeAgencyLogo;

function updateAgencyLogoPreview(dataUrl) {
  const img = document.getElementById("agencyLogoPreviewImg");
  const placeholder = document.getElementById("agencyLogoEmptyPlaceholder");
  const removeBtn = document.getElementById("removeAgencyLogoBtn");
  if (dataUrl) {
    if (img) { img.src = dataUrl; img.style.display = "block"; }
    if (placeholder) placeholder.style.display = "none";
    if (removeBtn) removeBtn.style.display = "inline-flex";
  } else {
    if (img) { img.src = ""; img.style.display = "none"; }
    if (placeholder) placeholder.style.display = "block";
    if (removeBtn) removeBtn.style.display = "none";
  }
}
window.updateAgencyLogoPreview = updateAgencyLogoPreview;

function renderAgencyLogoOrGraphic(firm, fallbackHtml, maxH = 40, maxW = 90) {
  if (firm && firm.logo) {
    return `<img src="${firm.logo}" class="bill-logo-img" style="max-height:${maxH}px; max-width:${maxW}px; object-fit:contain;" alt="Agency Logo">`;
  }
  return fallbackHtml;
}
window.renderAgencyLogoOrGraphic = renderAgencyLogoOrGraphic;

function getNewspaperSVG(color = "#1e40af") {
  return `<svg width="40" height="30" viewBox="0 0 64 52" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="8" width="46" height="40" rx="3" fill="#ffffff" stroke="${color}" stroke-width="3"/>
    <rect x="12" y="4" width="46" height="40" rx="3" fill="#ffffff" stroke="${color}" stroke-width="2.5"/>
    <rect x="18" y="10" width="16" height="12" rx="1.5" fill="${color}" opacity="0.85"/>
    <line x1="38" y1="12" x2="52" y2="12" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="38" y1="17" x2="52" y2="17" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <line x1="38" y1="21" x2="48" y2="21" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <line x1="18" y1="28" x2="52" y2="28" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <line x1="18" y1="33" x2="52" y2="33" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <line x1="18" y1="38" x2="42" y2="38" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function getCoffeeNewsSVG() {
  return `<svg width="42" height="30" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 14 L30 6 L34 38 L8 44 Z" fill="#ffffff" stroke="#5d4037" stroke-width="2.5"/>
    <line x1="12" y1="16" x2="26" y2="12" stroke="#5d4037" stroke-width="2"/>
    <line x1="12" y1="22" x2="28" y2="18" stroke="#5d4037" stroke-width="1.8"/>
    <rect x="36" y="16" width="18" height="20" rx="4" fill="#8d6e63" stroke="#3e2723" stroke-width="2"/>
    <path d="M54 21 C58 21, 60 25, 54 29" stroke="#3e2723" stroke-width="2" fill="none"/>
    <path d="M33 38 L57 38" stroke="#3e2723" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M41 12 Q43 8, 41 4" stroke="#a1887f" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M47 12 Q49 8, 47 4" stroke="#a1887f" stroke-width="1.5" stroke-linecap="round" fill="none"/>
  </svg>`;
}

function getGreenLeafNewsSVG() {
  return `<svg width="40" height="30" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="38" height="34" rx="2" fill="#ffffff" stroke="#166534" stroke-width="2.5"/>
    <line x1="14" y1="15" x2="28" y2="15" stroke="#166534" stroke-width="2"/>
    <line x1="14" y1="21" x2="40" y2="21" stroke="#166534" stroke-width="1.8"/>
    <line x1="14" y1="27" x2="38" y2="27" stroke="#166534" stroke-width="1.8"/>
    <path d="M32 10 C46 2, 58 14, 52 30 C42 28, 38 18, 32 10 Z" fill="#22c55e" stroke="#15803d" stroke-width="2"/>
    <path d="M34 14 Q44 20, 50 28" stroke="#15803d" stroke-width="1.5" fill="none"/>
  </svg>`;
}

function getMagentaBadgeNewsSVG() {
  return `<svg width="40" height="30" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="8" width="48" height="36" rx="3" fill="#ffffff" stroke="#be185d" stroke-width="2.5"/>
    <rect x="12" y="14" width="36" height="12" rx="2" fill="#be185d"/>
    <text x="30" y="23" fill="#ffffff" font-size="8.5" font-weight="900" font-family="sans-serif" text-anchor="middle">NEWS</text>
    <line x1="12" y1="30" x2="48" y2="30" stroke="#be185d" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="35" x2="40" y2="35" stroke="#be185d" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function getUpiBadgesHTML() {
  return `<div style="display:flex; align-items:center; justify-content:center; gap:3px; margin-top:2px;">
    <span style="background:#002e6e; color:#fff; font-size:6.5px; font-weight:800; padding:1px 3px; border-radius:2px;">GPay</span>
    <span style="background:#5f259f; color:#fff; font-size:6.5px; font-weight:800; padding:1px 3px; border-radius:2px;">PhonePe</span>
    <span style="background:#00b9f5; color:#fff; font-size:6.5px; font-weight:800; padding:1px 3px; border-radius:2px;">Paytm</span>
  </div>`;
}

// Extract standard 5-row item lines for card formats
function getCard5RowsData(bill, cust, items) {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
  let list = [];

  if (bill.paperBreakdown && bill.paperBreakdown.length > 0) {
    const onlyPapers = bill.paperBreakdown.filter(pb => !pb.isDeliveryCharge && !pb.name?.includes("ડિલિવરી") && !pb.name?.includes("Delivery"));
    list = onlyPapers.map(pb => {
      const days = pb.daysCount || bill.daysDelivered || 30;
      return {
        name: pb.name,
        days: days,
        amount: Number(pb.totalCost).toFixed(2)
      };
    });
  } else {
    // Each newspaper gets its own separate row
    const subs = rawSubs.map(id => itemMap.get(id)).filter(Boolean);
    if (subs.length > 0) {
      const totalPaperAmt = bill.newspaperAmount || (bill.currentAmount - (bill.deliveryCharge || 0));
      const perPaperAmt = subs.length > 0 ? (totalPaperAmt / subs.length) : totalPaperAmt;
      list = subs.map(it => {
        const days = bill.daysDelivered || 30;
        return { name: it.name, days: days, amount: perPaperAmt.toFixed(2) };
      });
    } else {
      list = [
        { name: "ગુજરાત સમાચાર", days: bill.daysDelivered || 30, amount: (bill.newspaperAmount || (bill.currentAmount - (bill.deliveryCharge || 0))).toFixed(2) }
      ];
    }
  }

  // Pad up to 8 rows so the card size is perfectly aligned without empty blank spaces
  while (list.length < 8) {
    list.push({ name: "", days: "", amount: "" });
  }
  return list;
}

// -------------------------------------------------------------
// 1. FORMAT 4A: PERFECT CREDIT MEMO (Matching User Image 1)
// -------------------------------------------------------------
function generatePerfectCreditMemo4in1HTML(bill, cust, firm, items, salesmen, collectionMen) {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const smObj = cust.salesmanId ? salesmen.find(s => s.id === cust.salesmanId) : null;
  const smName = smObj ? smObj.name : (cust.salesmanName || "REHAN");

  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mNameFull = monthNames[parseInt(m) - 1] || "August";
  const mNameShort = mNameFull.slice(0, 3);
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const dateRangeStr = `01-${mNameShort}-${y} To ${lastDay}-${mNameShort}-${y}`;

  const upiPayee = (firm.name || "PERFECT NEWSPAPER SUPPLIERS").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "9825778607@okaxis")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 72) : "";

  const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
  let tableRows = [];
  if (bill.paperBreakdown && bill.paperBreakdown.length > 0) {
    tableRows = bill.paperBreakdown.map((pb, idx) => ({
      no: idx + 1,
      name: pb.name,
      day: pb.daysCount || bill.daysDelivered || 30,
      amount: Number(pb.totalCost).toFixed(2)
    }));
  } else {
    // Each newspaper gets its own separate row
    const subs = rawSubs.map(id => itemMap.get(id)).filter(Boolean);
    if (subs.length > 0) {
      const totalPaperAmt = bill.currentAmount - (bill.deliveryCharge || 0);
      const perPaperAmt = subs.length > 0 ? (totalPaperAmt / subs.length) : totalPaperAmt;
      tableRows = subs.map((it, idx) => ({
        no: idx + 1,
        name: it.name,
        day: bill.daysDelivered || 30,
        amount: perPaperAmt.toFixed(2)
      }));
    } else {
      tableRows = [
        { no: 1, name: "GUJARAT SAMACHAR", day: bill.daysDelivered || 30, amount: (bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2) }
      ];
    }
  }

  // Keep at least 8 rows for full newspaper list and balanced appearance without blank gap
  while (tableRows.length < 8) {
    tableRows.push({ no: "", name: "", day: "", amount: "" });
  }

  const paperAmt = (bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const delCharge = (bill.deliveryCharge || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  // Logo rendering if available
  const logoHtml = firm.logo ? `<img src="${firm.logo}" class="bill-logo-img" style="max-height:34px; max-width:75px; margin-right:6px;" alt="Logo">` : '';

  return `
    <div class="perfect-memo-4in1">
      <div>
        <!-- Top: Credit Memo -->
        <div style="text-align: center; font-family: serif, 'Times New Roman'; font-style: italic; font-weight: bold; text-decoration: underline; font-size: 11px;">Credit Memo</div>
        
        <!-- Agency Name & Address -->
        <div style="text-align: center; margin-top: 1px; display: flex; justify-content: center; align-items: center;">
          ${logoHtml}
          <div>
            <div style="font-size: 12.5px; font-weight: 900; letter-spacing: 0.3px; text-transform: uppercase;">${firm.name || 'PERFECT NEWSPAPER SUPPLIERS'}</div>
            <div style="font-size: 8.5px; color: #111;">${firm.address || 'E-392, SANKALITNAGAR, JUHAPURA, Ahmedabad'}</div>
          </div>
        </div>

        <!-- Vendor & Period Pill Box (Red Border matching Image 1) -->
        <div style="background: #f8fafc; border: 1.5px solid #dc2626; border-radius: 20px; padding: 2px 8px; margin: 3px auto; width: 92%; text-align: center; box-shadow: 0 1px 2px rgba(220,38,38,0.15);">
          <div style="font-weight: 900; font-size: 10.5px; letter-spacing: 0.5px; color: #000;">
            ${firm.ownerName || 'NIZAM TAI'} &nbsp;&nbsp;-&nbsp;&nbsp; ${firm.phone || '9825776607'}
          </div>
        </div>
        <div style="text-align: center; font-weight: bold; font-size: 9.5px; margin-bottom: 2px;">
          ${dateRangeStr}
        </div>

        <!-- Customer & Bill Info Box (Bordered Box) -->
        <div style="border: 1px solid #000; padding: 3px 5px; margin-bottom: 3px; font-size: 9px; display: flex; justify-content: space-between; line-height: 1.25;">
          <div style="width: 58%;">
            <div>Name:- <b>${cust.name || bill.customerName}</b></div>
            ${cust.societyShort ? `<div><b>${cust.societyShort}</b></div>` : (cust.address ? `<div>${cust.address}</div>` : '')}
            <div>${cust.mobile || ''}</div>
            <div>Salesman: <b>${smName}</b></div>
          </div>
          <div style="width: 40%; text-align: right;">
            <div>Bill No : <b>${bill.billNo || '3641'}</b></div>
            <div>Month : <b>${mNameFull}</b></div>
            <div>Seq: <b>#${bill.deliverySequence || cust.sequenceNo || '-'}</b></div>
          </div>
        </div>

        <!-- Paper Breakdown Table (4 columns, 8 roomy rows) -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 3px; font-size: 9.5px;">
          <thead>
            <tr style="border-bottom: 1px solid #000; font-weight: bold; background: #f8fafc; height: 21px;">
              <th style="padding: 2px; width: 24px; text-align: center; border-right: 1px solid #000;">No.</th>
              <th style="padding: 2px 5px; text-align: left; border-right: 1px solid #000;">Name of Paper</th>
              <th style="padding: 2px; width: 34px; text-align: center; border-right: 1px solid #000;">Day</th>
              <th style="padding: 2px 5px; width: 52px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows.map((r, idx) => `
              <tr style="border-bottom: 1px solid #000; height: 20px;">
                <td style="padding: 2px 3px; text-align: center; border-right: 1px solid #000;">${r.name ? (r.no || (idx + 1)) : '&nbsp;'}</td>
                <td style="padding: 2px 5px; font-weight: bold; border-right: 1px solid #000;">${r.name || '&nbsp;'}</td>
                <td style="padding: 2px 3px; text-align: center; border-right: 1px solid #000;">${r.day || '&nbsp;'}</td>
                <td style="padding: 2px 5px; text-align: right; font-weight: bold;">${r.amount || '&nbsp;'}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <!-- Payment Details & Calculations Box (Moved Up Directly Below Table) -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 2px 0; margin-top: 3px; margin-bottom: 3px;">
          <div style="width: 48%; text-align: center;">
            <div style="font-weight: bold; font-size: 8.5px;">Gpay: ${firm.phone || '9825776607'}</div>
            <div style="font-weight: bold; font-size: 8.5px;">${firm.ownerName || 'NIZAM TAI'}</div>
            <div style="width: 66px; height: 66px; margin: 1px auto;">${qrSvg}</div>
            <div style="font-size: 8px; font-weight: bold;">Scan & Pay</div>
          </div>

          <div style="width: 50%; font-size: 9px; border-left: 1px solid #000; padding-left: 5px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 0.5px solid #ccc; padding: 1px 0;">
              <span>Total Rs.</span>
              <b>${paperAmt}</b>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 0.5px solid #ccc; padding: 1px 0;">
              <span>Cr./Dr.</span>
              <b>${prevBal}</b>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 0.5px solid #ccc; padding: 1px 0;">
              <span>H.Charge</span>
              <b>${delCharge}</b>
            </div>
            <div style="border: 1px solid #000; background: #e2e8f0; padding: 2px 4px; display: flex; justify-content: space-between; margin-top: 2px; font-weight: 900; font-size: 10px;">
              <span>Net Amt.</span>
              <span>${totalNet}</span>
            </div>
          </div>
        </div>

        <!-- Gujarati Terms & Conditions (Matching Image 1) -->
        <div style="font-size: 7.8px; line-height: 1.25; margin-bottom: 2px;">
          <div>• કાગળ ની દર માં તફાવત મુજબ ફેરફાર થઈ શકે.</div>
          <div>• બાકી રકમ આગળના બિલ મા સમાવી લેવામાં આવશે.</div>
          <div>• કોઈપણ પ્રશ્ન હોય તો અમારો સંપર્ક કરો.</div>
          <div style="color: #dc2626; font-weight: 800; font-size: 8px; margin-top: 1px;">
            ONLINE PAYMENT માટે ઉપર આપેલ QR CODE નો ઉપયોગ કરો.
          </div>
        </div>

        <!-- Footer credit -->
        <div style="border-top: 1px solid #000; padding-top: 1px; display: flex; justify-content: space-between; font-size: 7.2px; color: #333;">
          <span>Devlop by :- Imtiyaz Khanusia 94276 98665</span>
          <span>${firm.phone || '9825776607'}</span>
        </div>
      </div>
    </div>
  `;
}
window.generatePerfectCreditMemo4in1HTML = generatePerfectCreditMemo4in1HTML;

// -------------------------------------------------------------
// 2. FORMAT 4B: OCEAN BLUE MODERN AGENCY (Matching User Image 2 Top-Left)
// -------------------------------------------------------------
function generateOceanBlue4in1HTML(bill, cust, firm, items, salesmen, collectionMen) {
  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const billDateStr = bill.createdAt ? new Date(bill.createdAt).toLocaleDateString("en-GB") : `${lastDay}-${m}-${y}`;

  const upiPayee = (firm.name || "Shree News Agency").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "shreenews@oksbi")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 62) : "";

  const rows = getCard5RowsData(bill, cust, items);
  const paperAmt = (bill.newspaperAmount || (bill.currentAmount - (bill.deliveryCharge || 0))).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const delCharge = (bill.deliveryCharge || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  const leftGraphic = renderAgencyLogoOrGraphic(
    firm,
    `<div style="display:flex; flex-direction:column; align-items:center;">
      ${getNewspaperSVG('#1e40af')}
      <div style="font-size:6.8px; font-style:italic; font-weight:700; color:#1e40af; margin-top:1px; text-align:center; line-height:1.1;">"Good Reading"<br>Brighter Tomorrow</div>
    </div>`,
    38, 75
  );

  return `
    <div class="ocean-blue-4in1">
      <div>
        <!-- Top Header Grid -->
        <div style="display:grid; grid-template-columns: 80px 1fr 90px; gap:4px; align-items:center; border-bottom:1.5px solid #2563eb; padding-bottom:3px; margin-bottom:4px;">
          <!-- Left: Logo / Graphic -->
          <div style="display:flex; justify-content:center; align-items:center;">
            ${leftGraphic}
          </div>
          <!-- Center: Agency Info -->
          <div style="text-align:center;">
            <div style="font-size:14px; font-weight:900; color:#1e3a8a; text-transform:uppercase; letter-spacing:0.2px;">${firm.name || 'Shree News Agency'}</div>
            <div style="font-size:9px; font-weight:700; color:#0f172a;">All Newspapers & Magazines</div>
            <div style="font-size:7.8px; color:#475569;">📍 ${firm.address || '123, Main Road, City - 380001'}</div>
            <div style="font-size:7.8px; color:#1e40af; font-weight:700;">📞 ${firm.phone || '98765 43210'}</div>
          </div>
          <!-- Right: QR Code Box -->
          <div style="border:1px solid #93c5fd; border-radius:4px; padding:2px; text-align:center; background:#f0f7ff;">
            <div style="font-size:6.5px; font-weight:800; color:#1e40af; text-transform:uppercase;">PAY WITH ANY UPI APP</div>
            <div style="width:52px; height:52px; margin:1px auto;">${qrSvg}</div>
            ${getUpiBadgesHTML()}
            <div style="font-size:6.2px; color:#1e3a8a; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:1px;">
              UPI ID: ${firm.upiId || 'shreenews@oksbi'}
            </div>
          </div>
        </div>

        <!-- Bill Meta Row -->
        <div style="display:flex; justify-content:space-between; font-size:9px; margin-bottom:2px; border-bottom:0.5px solid #e2e8f0; padding-bottom:2px;">
          <div>Bill No. : <b style="color:#dc2626;">${bill.billNo || '0001'}</b></div>
          <div>Date : <b>${billDateStr}</b></div>
        </div>
        <div style="font-size:8.8px; line-height:1.25; margin-bottom:3px;">
          <div>Name : <b>${cust.name || bill.customerName}</b> ${cust.societyShort ? `(${cust.societyShort})` : ''}</div>
          <div>Address : <span>${cust.address || cust.societyShort || '-'}</span> ${cust.mobile ? `• 📞 ${cust.mobile}` : ''}</div>
        </div>

        <!-- 4-Column Table with Full Calculation Box (Matching Image 2) -->
        <table style="width:100%; border-collapse:collapse; border:1px solid #1e40af; font-size:8.8px; margin-bottom:2px;">
          <thead>
            <tr style="background:#1e40af; color:#ffffff; font-weight:bold; text-align:center;">
              <th style="padding:2px 3px; width:22px; border-right:1px solid #3b82f6;">Sr.</th>
              <th style="padding:2px 5px; text-align:left; border-right:1px solid #3b82f6;">Publication Name</th>
              <th style="padding:2px 3px; width:34px; border-right:1px solid #3b82f6;">Days</th>
              <th style="padding:2px 5px; width:60px; text-align:right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr style="border-bottom:1px solid #cbd5e1; height:20px;">
                <td style="text-align:center; border-right:1px solid #e2e8f0;">${r.name ? (i + 1) : '&nbsp;'}</td>
                <td style="padding:2px 5px; font-weight:bold; border-right:1px solid #e2e8f0;">${r.name || '&nbsp;'}</td>
                <td style="text-align:center; border-right:1px solid #e2e8f0;">${r.days || '&nbsp;'}</td>
                <td style="text-align:right; padding:2px 5px; font-weight:bold;">${r.amount || '&nbsp;'}</td>
              </tr>
            `).join("")}
            <!-- Calculation Breakdown -->
            <tr style="border-top:1px solid #1e40af; background:#f8fafc;">
              <td colspan="3" style="text-align:right; padding:1px 5px; color:#475569; border-right:1px solid #e2e8f0;">Total Rs.</td>
              <td style="text-align:right; padding:1px 5px; font-weight:bold; color:#1e3a8a;">${paperAmt}</td>
            </tr>
            ${Number(prevBal) !== 0 ? `
            <tr style="background:#f8fafc;">
              <td colspan="3" style="text-align:right; padding:1px 5px; color:#475569; border-right:1px solid #e2e8f0;">Cr./Dr. (બાકી)</td>
              <td style="text-align:right; padding:1px 5px; font-weight:bold; color:#b91c1c;">${prevBal}</td>
            </tr>` : ''}
            ${Number(delCharge) !== 0 ? `
            <tr style="background:#f8fafc;">
              <td colspan="3" style="text-align:right; padding:1px 5px; color:#475569; border-right:1px solid #e2e8f0;">H.Charge</td>
              <td style="text-align:right; padding:1px 5px; font-weight:bold; color:#475569;">${delCharge}</td>
            </tr>` : ''}
            <tr style="background:#eff6ff; font-weight:900;">
              <td colspan="3" style="text-align:right; padding:2px 6px; border-right:1px solid #bfdbfe; color:#1e40af;">Net Amt. ₹</td>
              <td style="text-align:right; padding:2px 5px; color:#1e3a8a; font-size:10px;">${totalNet}</td>
            </tr>
          </tbody>
        </table>

        <!-- Footer Row (Directly below table) -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; padding-top:3px; margin-top:2px; border-top:1px solid #e2e8f0;">
          <div style="font-family:'Brush Script MT', cursive, sans-serif; font-size:17px; font-weight:bold; color:#1e40af;">Thank You!</div>
          <div style="font-size:7.5px; font-style:italic; color:#64748b;">For your continuous support...</div>
          <div style="font-size:8px; font-weight:700; color:#0f172a;">For, ${firm.name || 'Shree News Agency'}</div>
        </div>
        <div style="text-align:right; font-size:6.8px; color:#94a3b8; margin-top:2px;">
          Devlop by :- Imtiyaz Khanusia 94276 98665
        </div>
      </div>
    </div>
  `;
}
window.generateOceanBlue4in1HTML = generateOceanBlue4in1HTML;

// -------------------------------------------------------------
// 3. FORMAT 4C: VINTAGE PARCHMENT / BROWN (Matching User Image 2 Top-Right)
// -------------------------------------------------------------
function generateVintageParchment4in1HTML(bill, cust, firm, items, salesmen, collectionMen) {
  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const billDateStr = bill.createdAt ? new Date(bill.createdAt).toLocaleDateString("en-GB") : `${lastDay}-${m}-${y}`;

  const upiPayee = (firm.name || "Shree News Agency").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "shreenews@oksbi")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 64) : "";

  const rows = getCard5RowsData(bill, cust, items);
  const paperAmt = (bill.newspaperAmount || (bill.currentAmount - (bill.deliveryCharge || 0))).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const delCharge = (bill.deliveryCharge || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  const rightGraphic = renderAgencyLogoOrGraphic(
    firm,
    `<div style="display:flex; flex-direction:column; align-items:center;">
      ${getCoffeeNewsSVG()}
      <div style="font-size:6.8px; font-style:italic; color:#5d4037; margin-top:1px; text-align:center; line-height:1.1;">"Newspapers Connect<br>People & Ideas"</div>
    </div>`,
    38, 75
  );

  return `
    <div class="vintage-parchment-4in1">
      <div>
        <!-- Top Header Grid -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #6d4c41; padding-bottom:3px; margin-bottom:4px;">
          <!-- Left: Agency Details -->
          <div>
            <div style="font-size:14.5px; font-weight:900; color:#3e2723; font-family:'Georgia', serif;">${firm.name || 'Shree News Agency'}</div>
            <div style="font-size:9px; font-weight:700; color:#5d4037;">All Newspapers & Magazines</div>
            <div style="font-size:7.8px; color:#6d4c41;">📍 ${firm.address || '123, Main Road, City - 380001'} &nbsp;|&nbsp; 📞 ${firm.phone || '98765 43210'}</div>
          </div>
          <!-- Right: Vintage Coffee & News Graphic -->
          <div style="text-align:right;">
            ${rightGraphic}
          </div>
        </div>

        <!-- Bill Meta Row -->
        <div style="display:flex; justify-content:space-between; font-size:9px; margin-bottom:2px; border-bottom:0.5px solid #d7ccc8; padding-bottom:2px;">
          <div>Bill No. : <b style="color:#b91c1c;">${bill.billNo || '0001'}</b></div>
          <div>Date : <b>${billDateStr}</b></div>
        </div>
        <div style="font-size:8.8px; line-height:1.25; margin-bottom:4px;">
          <div>Name : <b>${cust.name || bill.customerName}</b></div>
          <div>Address : <span>${cust.address || cust.societyShort || '-'}</span> ${cust.mobile ? `• 📞 ${cust.mobile}` : ''}</div>
        </div>

        <!-- Split Layout: Table on Left + QR Code on Right (Matching Image 2 TR) -->
        <div style="display:flex; gap:6px; align-items:flex-start;">
          <!-- Table (68%) -->
          <div style="flex:1;">
            <table style="width:100%; border-collapse:collapse; border:1px solid #5d4037; font-size:8.5px;">
              <thead>
                <tr style="background:#5d4037; color:#ffffff; font-weight:bold; text-align:center;">
                  <th style="padding:2px; width:20px; border-right:1px solid #8d6e63;">Sr.</th>
                  <th style="padding:2px 4px; text-align:left; border-right:1px solid #8d6e63;">Publication Name</th>
                  <th style="padding:2px; width:30px; border-right:1px solid #8d6e63;">Days</th>
                  <th style="padding:2px 4px; width:52px; text-align:right;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((r, i) => `
                  <tr style="border-bottom:1px solid #d7ccc8; height:20px;">
                    <td style="text-align:center; border-right:1px solid #d7ccc8;">${r.name ? (i + 1) : '&nbsp;'}</td>
                    <td style="padding:2px 4px; font-weight:bold; border-right:1px solid #d7ccc8;">${r.name || '&nbsp;'}</td>
                    <td style="text-align:center; border-right:1px solid #d7ccc8;">${r.days || '&nbsp;'}</td>
                    <td style="text-align:right; padding:2px 4px; font-weight:bold;">${r.amount || '&nbsp;'}</td>
                  </tr>
                `).join("")}
                <tr style="background:#fdfbf7; border-top:1px solid #8d6e63;">
                  <td colspan="3" style="text-align:right; padding:1px 4px; border-right:1px solid #d7ccc8; color:#5d4037;">Total Rs.</td>
                  <td style="text-align:right; padding:1px 4px; font-weight:bold; color:#3e2723;">${paperAmt}</td>
                </tr>
                ${Number(prevBal) !== 0 ? `
                <tr style="background:#fdfbf7;">
                  <td colspan="3" style="text-align:right; padding:1px 4px; border-right:1px solid #d7ccc8; color:#5d4037;">Cr./Dr.</td>
                  <td style="text-align:right; padding:1px 4px; font-weight:bold; color:#b91c1c;">${prevBal}</td>
                </tr>` : ''}
                ${Number(delCharge) !== 0 ? `
                <tr style="background:#fdfbf7;">
                  <td colspan="3" style="text-align:right; padding:1px 4px; border-right:1px solid #d7ccc8; color:#5d4037;">H.Charge</td>
                  <td style="text-align:right; padding:1px 4px; font-weight:bold; color:#5d4037;">${delCharge}</td>
                </tr>` : ''}
                <tr style="background:#efebe9; font-weight:900;">
                  <td colspan="3" style="text-align:right; padding:2px 5px; border-right:1px solid #d7ccc8; color:#3e2723;">Net Amt. ₹</td>
                  <td style="text-align:right; padding:2px 4px; color:#3e2723; font-size:9.5px;">${totalNet}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- QR Card on Right (32%) -->
          <div style="width:96px; border:1px solid #a1887f; border-radius:5px; padding:3px; background:#f5efe6; text-align:center; box-sizing:border-box;">
            <div style="font-size:7.5px; font-weight:900; color:#3e2723; margin-bottom:1px;">Scan & Pay</div>
            <div style="width:56px; height:56px; margin:0 auto;">${qrSvg}</div>
            ${getUpiBadgesHTML()}
            <div style="font-size:6px; color:#5d4037; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">
              UPI ID: ${firm.upiId || 'shreenews@oksbi'}
            </div>
            <div style="font-size:6.5px; font-weight:800; color:#3e2723; margin-top:2px; border-top:0.5px solid #d7ccc8; padding-top:1px;">
              For, ${firm.name || 'Shree News Agency'}
            </div>
          </div>
        </div>

        <!-- Bottom Vintage Bar (Moved up directly under content) -->
        <div style="background:#3e2723; color:#ffffff; border-radius:3px; padding:3px 6px; display:flex; justify-content:space-between; align-items:center; font-size:7.2px; margin-top:3px;">
          <div>📖 <i>"Read Today... A Better Tomorrow..."</i></div>
          <div style="display:flex; gap:6px;">
            <span>📰 Newspapers</span>
            <span>📚 Magazines</span>
            <span>🏠 Home Delivery</span>
          </div>
        </div>
        <div style="text-align:right; font-size:6.8px; color:#8d6e63; margin-top:2px;">
          Devlop by :- Imtiyaz Khanusia 94276 98665
        </div>
      </div>
    </div>
  `;
}
window.generateVintageParchment4in1HTML = generateVintageParchment4in1HTML;

// -------------------------------------------------------------
// 4. FORMAT 4D: VIBRANT MAGENTA WAVE (Matching User Image 2 Bottom-Left)
// -------------------------------------------------------------
function generateMagentaWave4in1HTML(bill, cust, firm, items, salesmen, collectionMen) {
  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const billDateStr = bill.createdAt ? new Date(bill.createdAt).toLocaleDateString("en-GB") : `${lastDay}-${m}-${y}`;

  const upiPayee = (firm.name || "Shree News Agency").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "shreenews@oksbi")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 62) : "";

  const rows = getCard5RowsData(bill, cust, items);
  const paperAmt = (bill.newspaperAmount || (bill.currentAmount - (bill.deliveryCharge || 0))).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const delCharge = (bill.deliveryCharge || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  const leftGraphic = renderAgencyLogoOrGraphic(firm, getMagentaBadgeNewsSVG(), 38, 75);

  return `
    <div class="magenta-wave-4in1">
      <div>
        <!-- Top Wave Ribbon Header -->
        <div style="display:grid; grid-template-columns: 75px 1fr 90px; gap:4px; align-items:center; border-bottom:2px solid #db2777; padding-bottom:3px; margin-bottom:4px;">
          <!-- Left Logo / 3D News Icon -->
          <div style="display:flex; justify-content:center; align-items:center;">
            ${leftGraphic}
          </div>
          <!-- Center Firm Info -->
          <div style="text-align:center;">
            <div style="font-size:14px; font-weight:900; color:#be185d; text-transform:uppercase; letter-spacing:0.2px;">${firm.name || 'Shree News Agency'}</div>
            <div style="font-size:9px; font-weight:800; color:#0f172a;">All Newspapers & Magazines</div>
            <div style="font-size:7.8px; font-style:italic; color:#db2777; font-weight:600;">— Your Daily News Partner —</div>
            <div style="font-size:7.5px; color:#475569;">📍 ${firm.address || '123, Main Road, City - 380001'} &nbsp;•&nbsp; 📞 ${firm.phone || '98765 43210'}</div>
          </div>
          <!-- Right QR Code Box -->
          <div style="border:1.5px solid #f472b6; border-radius:6px; padding:2px; text-align:center; background:#fdf2f8;">
            <div style="background:#be185d; color:#fff; font-size:6.5px; font-weight:800; border-radius:3px; padding:1px;">Scan & Pay</div>
            <div style="width:50px; height:50px; margin:2px auto 1px auto;">${qrSvg}</div>
            ${getUpiBadgesHTML()}
            <div style="font-size:6px; color:#9d174d; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${firm.upiId || 'shreenews@oksbi'}
            </div>
          </div>
        </div>

        <!-- Bill Meta Row -->
        <div style="display:flex; justify-content:space-between; font-size:9px; margin-bottom:2px; border-bottom:0.5px solid #fbcfe8; padding-bottom:2px;">
          <div>Bill No. : <b style="color:#e11d48;">${bill.billNo || '0001'}</b></div>
          <div>Date : <b>${billDateStr}</b></div>
        </div>
        <div style="font-size:8.8px; line-height:1.25; margin-bottom:3px;">
          <div>Name : <b>${cust.name || bill.customerName}</b></div>
          <div>Address : <span>${cust.address || cust.societyShort || '-'}</span> ${cust.mobile ? `• 📞 ${cust.mobile}` : ''}</div>
        </div>

        <!-- 4-Column Table with Soft Pink Header -->
        <table style="width:100%; border-collapse:collapse; border:1px solid #db2777; font-size:8.8px; margin-bottom:2px;">
          <thead>
            <tr style="background:#fce7f3; color:#831843; font-weight:bold; text-align:center; border-bottom:1px solid #db2777;">
              <th style="padding:2px 3px; width:22px; border-right:1px solid #fbcfe8;">Sr.</th>
              <th style="padding:2px 5px; text-align:left; border-right:1px solid #fbcfe8;">Publication Name</th>
              <th style="padding:2px 3px; width:34px; border-right:1px solid #fbcfe8;">Days</th>
              <th style="padding:2px 5px; width:60px; text-align:right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr style="border-bottom:1px solid #fce7f3; height:20px;">
                <td style="text-align:center; border-right:1px solid #fdf2f8;">${r.name ? (i + 1) : '&nbsp;'}</td>
                <td style="padding:2px 5px; font-weight:bold; border-right:1px solid #fdf2f8;">${r.name || '&nbsp;'}</td>
                <td style="text-align:center; border-right:1px solid #fdf2f8;">${r.days || '&nbsp;'}</td>
                <td style="text-align:right; padding:2px 5px; font-weight:bold;">${r.amount || '&nbsp;'}</td>
              </tr>
            `).join("")}
            <tr style="border-top:1px solid #db2777; background:#fff5f7;">
              <td colspan="3" style="text-align:right; padding:1px 5px; color:#be185d; border-right:1px solid #fbcfe8;">Total Rs.</td>
              <td style="text-align:right; padding:1px 5px; font-weight:bold; color:#831843;">${paperAmt}</td>
            </tr>
            ${Number(prevBal) !== 0 ? `
            <tr style="background:#fff5f7;">
              <td colspan="3" style="text-align:right; padding:1px 5px; color:#be185d; border-right:1px solid #fbcfe8;">Cr./Dr. (બાકી)</td>
              <td style="text-align:right; padding:1px 5px; font-weight:bold; color:#b91c1c;">${prevBal}</td>
            </tr>` : ''}
            ${Number(delCharge) !== 0 ? `
            <tr style="background:#fff5f7;">
              <td colspan="3" style="text-align:right; padding:1px 5px; color:#be185d; border-right:1px solid #fbcfe8;">H.Charge</td>
              <td style="text-align:right; padding:1px 5px; font-weight:bold; color:#be185d;">${delCharge}</td>
            </tr>` : ''}
            <tr style="background:#fdf2f8; font-weight:900;">
              <td colspan="3" style="text-align:right; padding:2px 6px; border-right:1px solid #fbcfe8; color:#be185d;">Net Amt. ₹</td>
              <td style="text-align:right; padding:2px 5px; color:#be185d; font-size:10px;">${totalNet}</td>
            </tr>
          </tbody>
        </table>

        <!-- Footer Section (Moved up directly under table) -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; padding-top:3px; margin-top:2px; margin-bottom:2px;">
          <div style="font-family:'Brush Script MT', cursive, sans-serif; font-size:17px; font-weight:bold; color:#be185d;">Thank You!</div>
          <div style="font-size:7.5px; font-style:italic; color:#64748b;">"News Today... Opportunities Tomorrow..."</div>
          <div style="font-size:7.8px; font-weight:700; color:#0f172a;">For, ${firm.name || 'Shree News Agency'}</div>
        </div>
        <!-- Bottom Service Badges Ribbon -->
        <div style="background:#fdf2f8; border:1px solid #fbcfe8; border-radius:3px; padding:2px 4px; display:flex; justify-content:space-between; font-size:7px; color:#831843;">
          <span>🚚 Home Delivery</span>
          <span>⏱️ On Time</span>
          <span>🛡️ Reliable Service</span>
          <span>👥 Our Community, Our Strength</span>
        </div>
        <div style="text-align:right; font-size:6.8px; color:#9d174d; margin-top:2px;">
          Devlop by :- Imtiyaz Khanusia 94276 98665
        </div>
      </div>
    </div>
  `;
}
window.generateMagentaWave4in1HTML = generateMagentaWave4in1HTML;

// -------------------------------------------------------------
// 5. FORMAT 4E: ECO FRESH GREEN (Matching User Image 2 Bottom-Right)
// -------------------------------------------------------------
function generateEcoGreen4in1HTML(bill, cust, firm, items, salesmen, collectionMen) {
  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const billDateStr = bill.createdAt ? new Date(bill.createdAt).toLocaleDateString("en-GB") : `${lastDay}-${m}-${y}`;

  const upiPayee = (firm.name || "Shree News Agency").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "shreenews@oksbi")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 62) : "";

  const rows = getCard5RowsData(bill, cust, items);
  const paperAmt = (bill.newspaperAmount || (bill.currentAmount - (bill.deliveryCharge || 0))).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const delCharge = (bill.deliveryCharge || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  const leftGraphic = renderAgencyLogoOrGraphic(firm, getGreenLeafNewsSVG(), 38, 75);

  return `
    <div class="eco-green-4in1">
      <div>
        <!-- Top Green Botanical Header -->
        <div style="display:grid; grid-template-columns: 75px 1fr 90px; gap:4px; align-items:center; border-bottom:2px solid #16a34a; padding-bottom:3px; margin-bottom:4px;">
          <!-- Left Logo / Foliage Graphic -->
          <div style="display:flex; justify-content:center; align-items:center;">
            ${leftGraphic}
          </div>
          <!-- Center Firm Info -->
          <div style="text-align:center;">
            <div style="font-size:14px; font-weight:900; color:#14532d; text-transform:uppercase; letter-spacing:0.2px;">${firm.name || 'Shree News Agency'}</div>
            <div style="font-size:9px; font-weight:800; color:#166534;">All Newspapers & Magazines</div>
            <div style="font-size:7.8px; font-style:italic; color:#15803d; font-weight:600;">Read More | Learn More | Grow More</div>
            <div style="font-size:7.5px; color:#374151;">📍 ${firm.address || '123, Main Road, City - 380001'} &nbsp;•&nbsp; 📞 ${firm.phone || '98765 43210'}</div>
          </div>
          <!-- Right QR Code Box -->
          <div style="border:1.5px solid #86efac; border-radius:6px; padding:2px; text-align:center; background:#f0fdf4;">
            <div style="background:#166534; color:#fff; font-size:6.5px; font-weight:800; border-radius:3px; padding:1px;">Scan & Pay</div>
            <div style="width:50px; height:50px; margin:2px auto 1px auto;">${qrSvg}</div>
            ${getUpiBadgesHTML()}
            <div style="font-size:6px; color:#14532d; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${firm.upiId || 'shreenews@oksbi'}
            </div>
          </div>
        </div>

        <!-- Bill Meta Row -->
        <div style="display:flex; justify-content:space-between; font-size:9px; margin-bottom:2px; border-bottom:0.5px solid #bbf7d0; padding-bottom:2px;">
          <div>Bill No. : <b style="color:#dc2626;">${bill.billNo || '0001'}</b></div>
          <div>Date : <b>${billDateStr}</b></div>
        </div>
        <div style="font-size:8.8px; line-height:1.25; margin-bottom:3px;">
          <div>Name : <b>${cust.name || bill.customerName}</b></div>
          <div>Address : <span>${cust.address || cust.societyShort || '-'}</span> ${cust.mobile ? `• 📞 ${cust.mobile}` : ''}</div>
        </div>

        <!-- 4-Column Table with Fresh Green Header -->
        <table style="width:100%; border-collapse:collapse; border:1px solid #16a34a; font-size:8.8px; margin-bottom:2px;">
          <thead>
            <tr style="background:#dcfce7; color:#14532d; font-weight:bold; text-align:center; border-bottom:1px solid #16a34a;">
              <th style="padding:2px 3px; width:22px; border-right:1px solid #bbf7d0;">Sr.</th>
              <th style="padding:2px 5px; text-align:left; border-right:1px solid #bbf7d0;">Publication Name</th>
              <th style="padding:2px 3px; width:34px; border-right:1px solid #bbf7d0;">Days</th>
              <th style="padding:2px 5px; width:60px; text-align:right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr style="border-bottom:1px solid #dcfce7; height:20px;">
                <td style="text-align:center; border-right:1px solid #f0fdf4;">${r.name ? (i + 1) : '&nbsp;'}</td>
                <td style="padding:2px 5px; font-weight:bold; border-right:1px solid #f0fdf4;">${r.name || '&nbsp;'}</td>
                <td style="text-align:center; border-right:1px solid #f0fdf4;">${r.days || '&nbsp;'}</td>
                <td style="text-align:right; padding:2px 5px; font-weight:bold;">${r.amount || '&nbsp;'}</td>
              </tr>
            `).join("")}
            <tr style="border-top:1px solid #16a34a; background:#f0fdf4;">
              <td colspan="3" style="text-align:right; padding:1px 5px; color:#166534; border-right:1px solid #bbf7d0;">Total Rs.</td>
              <td style="text-align:right; padding:1px 5px; font-weight:bold; color:#14532d;">${paperAmt}</td>
            </tr>
            ${Number(prevBal) !== 0 ? `
            <tr style="background:#f0fdf4;">
              <td colspan="3" style="text-align:right; padding:1px 5px; color:#166534; border-right:1px solid #bbf7d0;">Cr./Dr. (બાકી)</td>
              <td style="text-align:right; padding:1px 5px; font-weight:bold; color:#b91c1c;">${prevBal}</td>
            </tr>` : ''}
            ${Number(delCharge) !== 0 ? `
            <tr style="background:#f0fdf4;">
              <td colspan="3" style="text-align:right; padding:1px 5px; color:#166534; border-right:1px solid #bbf7d0;">H.Charge</td>
              <td style="text-align:right; padding:1px 5px; font-weight:bold; color:#166534;">${delCharge}</td>
            </tr>` : ''}
            <tr style="background:#f0fdf4; font-weight:900;">
              <td colspan="3" style="text-align:right; padding:2px 6px; border-right:1px solid #bbf7d0; color:#14532d;">Net Amt. ₹</td>
              <td style="text-align:right; padding:2px 5px; color:#14532d; font-size:10px;">${totalNet}</td>
            </tr>
          </tbody>
        </table>

        <!-- Footer Section with Corner Leaf Motif (Moved up directly under table) -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; padding-top:4px; margin-top:2px;">
          <div>
            <div style="font-family:'Brush Script MT', cursive, sans-serif; font-size:17px; font-weight:bold; color:#15803d;">Thank You!</div>
            <div style="font-size:7.5px; font-style:italic; color:#166534;">Every morning brings a new story...</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:8px; font-weight:700; color:#14532d;">For, ${firm.name || 'Shree News Agency'}</div>
            <div style="font-size:6.5px; color:#6b7280;">Go Green • Save Paper</div>
          </div>
        </div>
        <div style="text-align:right; font-size:6.8px; color:#166534; margin-top:2px;">
          Devlop by :- Imtiyaz Khanusia 94276 98665
        </div>
      </div>
    </div>
  `;
}
window.generateEcoGreen4in1HTML = generateEcoGreen4in1HTML;

// -------------------------------------------------------------
// 6. FORMAT 4F: MONOCHROME CLEAN B&W NEWSPAPER (Matching User Image 3)
// -------------------------------------------------------------
function generateCleanBWNewspaper4in1HTML(bill, cust, firm, items, salesmen, collectionMen) {
  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const billDateStr = bill.createdAt ? new Date(bill.createdAt).toLocaleDateString("en-GB") : `${lastDay}-${m}-${y}`;

  const upiPayee = (firm.name || "Shree News Agency").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "shreenews@oksbi")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 52) : "";

  const rows = getCard5RowsData(bill, cust, items);
  const paperAmt = (bill.newspaperAmount || (bill.currentAmount - (bill.deliveryCharge || 0))).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const delCharge = (bill.deliveryCharge || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  const leftGraphic = renderAgencyLogoOrGraphic(
    firm,
    `<div style="display:flex; flex-direction:column; align-items:center;">
      <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
        <rect x="8" y="12" width="48" height="40" rx="3" fill="#ffffff" stroke="#000000" stroke-width="2.5"/>
        <line x1="16" y1="20" x2="32" y2="20" stroke="#000000" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="16" y1="26" x2="48" y2="26" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="16" y1="32" x2="48" y2="32" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="16" y1="38" x2="48" y2="38" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="16" y1="44" x2="36" y2="44" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </div>`,
    40, 75
  );

  return `
    <div class="clean-bw-4in1">
      <div>
        <!-- Top Black & White Newspaper Header -->
        <div style="display:grid; grid-template-columns: 75px 1fr 90px; gap:4px; align-items:center; border-bottom:2px solid #000; padding-bottom:3px; margin-bottom:4px;">
          <!-- Left Logo / Icon -->
          <div style="display:flex; justify-content:center; align-items:center;">
            ${leftGraphic}
          </div>
          <!-- Center Firm Info -->
          <div style="text-align:center;">
            <div style="font-size:14.5px; font-weight:900; color:#000; text-transform:uppercase; letter-spacing:0.3px; font-family:'Georgia', serif;">${firm.name || 'Shree News Agency'}</div>
            <div style="font-size:9px; font-weight:800; color:#000; letter-spacing:0.2px;">All Newspapers & Magazines</div>
            <div style="font-size:7.8px; font-style:italic; color:#333;">Fast & Reliable Morning Delivery</div>
            <div style="font-size:7.5px; color:#222;">📍 ${firm.address || '123, Main Road, City - 380001'} &nbsp;•&nbsp; 📞 ${firm.phone || '98765 43210'}</div>
          </div>
          <!-- Right QR Code Box -->
          <div style="border:1.5px solid #000; border-radius:4px; padding:2px; text-align:center; background:#fff;">
            <div style="background:#000; color:#fff; font-size:6.5px; font-weight:800; padding:1px; border-radius:2px;">Scan & Pay</div>
            <div style="width:50px; height:50px; margin:2px auto 1px auto;">${qrSvg}</div>
            <div style="font-size:6px; color:#000; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${firm.upiId || 'shreenews@oksbi'}
            </div>
          </div>
        </div>

        <!-- Bill Meta Row -->
        <div style="display:flex; justify-content:space-between; font-size:9px; margin-bottom:2px; border-bottom:1px solid #000; padding-bottom:2px;">
          <div>Bill No. : <b style="color:#000;">${bill.billNo || '0001'}</b></div>
          <div>Date : <b>${billDateStr}</b></div>
        </div>
        <div style="font-size:8.8px; line-height:1.25; margin-bottom:3px;">
          <div>Name : <b>${cust.name || bill.customerName}</b></div>
          <div>Address : <span>${cust.address || cust.societyShort || '-'}</span> ${cust.mobile ? `• 📞 ${cust.mobile}` : ''}</div>
        </div>

        <!-- 4-Column Clean Table (Rate removed, 8 roomy rows) -->
        <table style="width:100%; border-collapse:collapse; border:1px solid #000; font-size:8.8px; margin-bottom:2px;">
          <thead>
            <tr style="background:#f1f5f9; color:#000; font-weight:bold; text-align:center; border-bottom:1px solid #000; height:21px;">
              <th style="padding:2px 3px; width:22px; border-right:1px solid #000;">Sr.</th>
              <th style="padding:2px 5px; text-align:left; border-right:1px solid #000;">Publication Name</th>
              <th style="padding:2px 3px; width:34px; border-right:1px solid #000;">Days</th>
              <th style="padding:2px 5px; width:60px; text-align:right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr style="border-bottom:1px solid #000; height:20px;">
                <td style="text-align:center; border-right:1px solid #000;">${r.name ? (i + 1) : '&nbsp;'}</td>
                <td style="padding:2px 5px; font-weight:bold; border-right:1px solid #000;">${r.name || '&nbsp;'}</td>
                <td style="text-align:center; border-right:1px solid #000;">${r.days || '&nbsp;'}</td>
                <td style="text-align:right; padding:2px 5px; font-weight:bold;">${r.amount || '&nbsp;'}</td>
              </tr>
            `).join("")}
            <tr style="border-top:1px solid #000; background:#f8fafc;">
              <td colspan="3" style="text-align:right; padding:1px 5px; color:#333; border-right:1px solid #000;">Total Rs.</td>
              <td style="text-align:right; padding:1px 5px; font-weight:bold; color:#000;">${paperAmt}</td>
            </tr>
            ${Number(prevBal) !== 0 ? `
            <tr style="background:#f8fafc;">
              <td colspan="3" style="text-align:right; padding:1px 5px; color:#333; border-right:1px solid #000;">Cr./Dr. (બાકી)</td>
              <td style="text-align:right; padding:1px 5px; font-weight:bold; color:#000;">${prevBal}</td>
            </tr>` : ''}
            ${Number(delCharge) !== 0 ? `
            <tr style="background:#f8fafc;">
              <td colspan="3" style="text-align:right; padding:1px 5px; color:#333; border-right:1px solid #000;">H.Charge</td>
              <td style="text-align:right; padding:1px 5px; font-weight:bold; color:#000;">${delCharge}</td>
            </tr>` : ''}
            <tr style="background:#f1f5f9; font-weight:900;">
              <td colspan="3" style="text-align:right; padding:2px 6px; border-right:1px solid #000; color:#000;">Net Amt. ₹</td>
              <td style="text-align:right; padding:2px 5px; color:#000; font-size:10px;">${totalNet}</td>
            </tr>
          </tbody>
        </table>

        <!-- Footer Section (Moved up directly under table) -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; padding-top:3px; margin-top:2px; border-top:1px solid #000;">
          <div style="font-family:'Brush Script MT', cursive, sans-serif; font-size:17px; font-weight:bold; color:#000;">Thank You!</div>
          <div style="font-size:7.5px; font-style:italic; color:#333;">Read Today... A Better Tomorrow...</div>
          <div style="font-size:8px; font-weight:700; color:#000;">For, ${firm.name || 'Shree News Agency'}</div>
        </div>
        <div style="text-align:right; font-size:6.8px; color:#475569; margin-top:2px;">
          Devlop by :- Imtiyaz Khanusia 94276 98665
        </div>
      </div>
    </div>
  `;
}
window.generateCleanBWNewspaper4in1HTML = generateCleanBWNewspaper4in1HTML;

// 2. Black & White 4-in-1 Slip (Classic)
function generateBWSlipHTML(bill, cust, firm, items, salesmen, collectionMen) {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const smObj = cust.salesmanId ? salesmen.find(s => s.id === cust.salesmanId) : null;
  const smName = smObj ? smObj.name : (cust.salesmanName || "REHAAN");

  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mNameFull = monthNames[parseInt(m) - 1] || "August";
  const mNameShort = mNameFull.slice(0, 3);
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const dateRangeStr = `01-${mNameShort}-${y} To ${lastDay}-${mNameShort}-${y}`;

  const upiPayee = (firm.name || "PERFECT NEWSPAPER SUPPLIERS").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "9825778607@okaxis")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 72) : "";

  const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
  let tableRows = [];
  if (bill.paperBreakdown && bill.paperBreakdown.length > 0) {
    tableRows = bill.paperBreakdown.map((pb, idx) => ({
      no: idx + 1,
      name: pb.name,
      day: pb.daysCount || bill.daysDelivered || 30,
      amount: Number(pb.totalCost).toFixed(2)
    }));
  } else {
    // Each newspaper gets its own separate row
    const subs = rawSubs.map(id => itemMap.get(id)).filter(Boolean);
    if (subs.length > 0) {
      const totalPaperAmt = bill.currentAmount - (bill.deliveryCharge || 0);
      const perPaperAmt = subs.length > 0 ? (totalPaperAmt / subs.length) : totalPaperAmt;
      tableRows = subs.map((it, idx) => ({
        no: idx + 1,
        name: it.name,
        day: bill.daysDelivered || 30,
        amount: perPaperAmt.toFixed(2)
      }));
    } else {
      tableRows = [
        { no: 1, name: "GUJARAT SAMACHAR", day: bill.daysDelivered || 30, amount: (bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2) }
      ];
    }
  }

  // Pad to 8 rows so table lines look complete and space is filled
  while (tableRows.length < 8) {
    tableRows.push({ no: "", name: "", day: "", amount: "" });
  }

  const itemRowsHtml = tableRows.map((r, idx) => `
    <tr style="border-bottom: 1px solid #000; font-size: 9.5px; height: 20px;">
      <td style="padding: 2px 3px; text-align: center; border-right: 1px solid #000;">${r.name ? (r.no || (idx + 1)) : '&nbsp;'}</td>
      <td style="padding: 2px 5px; font-weight: bold; border-right: 1px solid #000;">${r.name || '&nbsp;'}</td>
      <td style="padding: 2px 3px; text-align: center; border-right: 1px solid #000;">${r.day || '&nbsp;'}</td>
      <td style="padding: 2px 5px; text-align: right; font-weight: bold;">${r.amount || '&nbsp;'}</td>
    </tr>
  `).join("");

  const paperAmt = (bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const delCharge = (bill.deliveryCharge || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  return `
    <div class="bw-slip-card">
      <div>
        <!-- Top: Credit Memo -->
        <div style="text-align: center; font-style: italic; font-weight: bold; text-decoration: underline; font-size: 11px;">Credit Memo</div>
        
        <!-- Agency Name & Address -->
        <div style="text-align: center; margin-top: 1px;">
          <div style="font-size: 13px; font-weight: 900; letter-spacing: 0.2px; text-transform: uppercase;">${firm.name || 'PERFECT NEWSPAPER SUPPLIERS'}</div>
          <div style="font-size: 9px;">${firm.address || 'E-392, SANKALITNAGAR-JUHAPURA-Ahmedabad'}</div>
        </div>

        <!-- Vendor & Period Rounded Box -->
        <div style="border: 1px solid #000; border-radius: 12px; padding: 2px 6px; margin: 3px 0; text-align: center; font-size: 10px;">
          <div style="font-weight: 900; letter-spacing: 0.5px;">${dateRangeStr}</div>
        </div>

        <!-- Customer & Bill Info -->
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 3px; font-size: 9.5px;">
          <div style="width: 58%;">
            <div>Name:- <b>${cust.name || bill.customerName}</b></div>
            ${cust.societyShort ? `<div><b>${cust.societyShort}</b></div>` : ''}
            <div>${cust.mobile || '-'}</div>
            <div>Salesman: <b>${smName}</b></div>
          </div>
          <div style="width: 40%; text-align: right;">
            <div>Bill No : <b>${bill.billNo || '3541'}</b></div>
            <div>Month : <b>${mNameFull}</b></div>
            <div>Seq: <b>#${bill.deliverySequence || cust.sequenceNo || '-'}</b></div>
          </div>
        </div>

        <!-- Paper Table -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 3px;">
          <thead>
            <tr style="border-bottom: 1px solid #000; font-size: 9.5px; font-weight: bold;">
              <th style="padding: 2px; width: 25px; text-align: center; border-right: 1px solid #000;">No.</th>
              <th style="padding: 2px 4px; text-align: left; border-right: 1px solid #000;">Name of Paper</th>
              <th style="padding: 2px; width: 35px; text-align: center; border-right: 1px solid #000;">Day</th>
              <th style="padding: 2px 4px; width: 55px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
          </tbody>
        </table>

        <!-- Arrears line -->
        <div style="font-size: 9px; font-weight: bold; margin-bottom: 3px;">
          ગયા મહીના સુધીની બાકી રકમ ${prevBal}
        </div>

        <!-- Payment QR & Calculation Grid -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin-bottom: 3px;">
          <div style="width: 48%; text-align: center;">
            <div style="font-weight: bold; font-size: 8.5px;">Gpay-${firm.phone || '9825778607'}</div>
            <div style="font-weight: bold; font-size: 8.5px;">${firm.ownerName || 'NIZAM TAI'}</div>
            <div style="width: 70px; height: 70px; margin: 2px auto;">${qrSvg}</div>
          </div>

          <div style="width: 50%; font-size: 9.5px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 0.5px solid #ccc; padding: 1px 0;">
              <span>Total Rs.</span>
              <b>${paperAmt}</b>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 0.5px solid #ccc; padding: 1px 0;">
              <span>Cr./Dr.</span>
              <b>${prevBal}</b>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 0.5px solid #ccc; padding: 1px 0;">
              <span>H.Charge</span>
              <b>${delCharge}</b>
            </div>
            <div style="border: 1px solid #000; background: #e2e8f0; padding: 2px 4px; display: flex; justify-content: space-between; margin-top: 2px; font-weight: 900;">
              <span>Net Amt.</span>
              <span>${totalNet}</span>
            </div>
          </div>
        </div>

        <!-- Terms & Conditions (4 bullets) -->
        <div style="font-size: 8px; line-height: 1.25; margin-bottom: 2px;">
          <div>• તા. ૧ થી ૧૦ માં બિલ ચૂકવી દેવું. • ઈસ્લામિક તહેવારે રજા રહેશે.</div>
          <div>• પેપર બંધ કરાવવું હોય તો અગાઉથી જણાવવું.</div>
          <div>• દર મહિને સર્વિસ ચાર્જ પેટે રૂ. ૧૦ વસૂલવામાં આવશે.</div>
        </div>

        <!-- Screenshot Notice Box -->
        <div style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-weight: bold; font-size: 8px;">
          ONLINE PAYMENT કર્યા પછી SCREENSHOT અવશ્ય મોકલવો.
        </div>

        <div style="text-align: center; font-size: 7.2px; color: #333; margin-top: 2px; font-weight: 500;">
          Devlop by :- Imtiyaz Khanusia 94276 98665
        </div>
      </div>
    </div>
  `;
}
window.generateBWSlipHTML = generateBWSlipHTML;

// 2B. Format 4B: Modern Clean Card (4-in-1 A4)
function generateModern4in1HTML(bill, cust, firm, items, salesmen, collectionMen) {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const smObj = cust.salesmanId ? salesmen.find(s => s.id === cust.salesmanId) : null;
  const smName = smObj ? smObj.name : (cust.salesmanName || "REHAAN");

  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const monthNames = ["જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઓગસ્ટ", "સપ્ટેમ્બર", "ઓક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"];
  const mName = monthNames[parseInt(m) - 1] || "ઓગસ્ટ";

  const upiPayee = (firm.name || "VendorSoft").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "vendorsoft@okaxis")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 72) : "";

  const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
  let paperSummary = "";
  if (bill.paperBreakdown && bill.paperBreakdown.length > 0) {
    paperSummary = bill.paperBreakdown.map(pb => pb.name).join("<br>");
  } else {
    const subs = rawSubs.map(id => itemMap.get(id)).filter(Boolean);
    paperSummary = subs.length > 0 ? subs.map(it => it.name).join("<br>") : "નિયમિત ન્યૂઝપેપર્સ";
  }

  const paperAmt = (bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const delCharge = (bill.deliveryCharge || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  return `
    <div class="modern-card-4in1">
      <div>
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1.5px solid #1e293b; padding-bottom:4px; margin-bottom:5px;">
          <div>
            <div style="font-size:13px; font-weight:800; color:#0f172a; text-transform:uppercase;">${firm.name || 'PERFECT NEWSPAPER SUPPLIERS'}</div>
            <div style="font-size:9px; color:#475569;">${firm.address || ''} • 📞 ${firm.phone || ''}</div>
          </div>
          <div style="text-align:right;">
            <span style="background:#0f172a; color:#fff; font-size:8.5px; padding:2px 6px; border-radius:3px; font-weight:700;">બિલ સ્લિપ</span>
            <div style="font-size:9.5px; font-weight:700; color:#0369a1; margin-top:2px;">${mName}-${y}</div>
          </div>
        </div>

        <!-- Customer Card -->
        <div style="background:#f1f5f9; border-radius:4px; padding:4px 6px; margin-bottom:5px; font-size:9.5px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b style="font-size:11px; color:#0f172a;">#${cust.custNo || cust.id} - ${cust.name || bill.customerName}</b>
            <span style="background:#e0f2fe; color:#0369a1; font-weight:800; padding:1px 5px; border-radius:3px; font-size:9px;">ક્રમ: #${bill.deliverySequence || cust.sequenceNo || '-'}</span>
          </div>
          <div style="color:#475569; margin-top:1px; display:flex; justify-content:space-between;">
            <span>${cust.societyShort || cust.address || ''} ${cust.mobile ? '• 📞 ' + cust.mobile : ''}</span>
            <span>હોકર: <b>${smName}</b></span>
          </div>
        </div>

        <!-- Paper Details -->
        <div style="border:1px solid #cbd5e1; border-radius:4px; padding:4px 6px; margin-bottom:5px; font-size:9.5px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span style="color:#475569;">પેપર્સ:</span>
            <b style="color:#0f172a; max-width:70%; text-align:right;">${paperSummary}</b>
          </div>
          <div style="display:flex; justify-content:space-between; border-top:1px dashed #e2e8f0; padding-top:2px;">
            <span>દિવસો: <b>${bill.daysDelivered || 30}d</b> ${bill.vacationDays > 0 ? `<span style="color:#e11d48;">(-${bill.vacationDays}d રજા)</span>` : ''}</span>
            <span>બિલ નં: <b>#${bill.billNo || '-'}</b></span>
          </div>
        </div>

        <!-- Calc Summary -->
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:4px 6px; font-size:9.5px;">
          <div style="display:flex; justify-content:space-between;">
            <span>ચાલુ માસ રકમ:</span>
            <b>₹${paperAmt}</b>
          </div>
          ${Number(prevBal) !== 0 ? `
          <div style="display:flex; justify-content:space-between; color:#b45309;">
            <span>ગત માસની બાકી:</span>
            <b>+ ₹${prevBal}</b>
          </div>` : ''}
          ${Number(delCharge) > 0 ? `
          <div style="display:flex; justify-content:space-between; color:#475569;">
            <span>સર્વિસ / ડિલિવરી:</span>
            <b>+ ₹${delCharge}</b>
          </div>` : ''}
        </div>
      </div>

      <!-- Payment & QR Footer -->
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:5px; padding:5px 8px; margin-bottom:4px;">
          <div>
            <div style="font-size:8.5px; font-weight:700; color:#1e40af; text-transform:uppercase;">કુલ ભરવાપાત્ર (Net Due)</div>
            <div style="font-size:17px; font-weight:900; color:#b91c1c; line-height:1.1;">₹${totalNet}</div>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:64px; height:64px;">${qrSvg}</div>
            <div style="font-size:8px; color:#334155; line-height:1.25;">
              <b style="color:#0f172a;">GPay / PhonePe</b><br>
              સ્કેન કરી પે કરો<br>
              <span style="font-size:7.5px; color:#0284c7; font-weight:700;">${firm.upiId || ''}</span>
            </div>
          </div>
        </div>
        <div style="text-align:center; font-size:8px; color:#64748b;">
          નિયમિત બિલ ચૂકવી સહકાર આપવા વિનંતી • આભાર!
        </div>
        <div style="text-align:center; font-size:7.2px; color:#94a3b8; margin-top:2px;">
          Devlop by :- Imtiyaz Khanusia 94276 98665
        </div>
      </div>
    </div>
  `;
}
window.generateModern4in1HTML = generateModern4in1HTML;

// 2C. Format 4C: 4-in-1 Slip with Tear-off Counterfoil Stub
function generateStub4in1HTML(bill, cust, firm, items, salesmen, collectionMen) {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const smObj = cust.salesmanId ? salesmen.find(s => s.id === cust.salesmanId) : null;
  const smName = smObj ? smObj.name : (cust.salesmanName || "REHAAN");

  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const monthNames = ["જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઓગસ્ટ", "સપ્ટેમ્બર", "ઓક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"];
  const mName = monthNames[parseInt(m) - 1] || "ઓગસ્ટ";

  const upiPayee = (firm.name || "VendorSoft").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "vendorsoft@okaxis")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 60) : "";

  const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
  let paperSummary = "";
  if (bill.paperBreakdown && bill.paperBreakdown.length > 0) {
    paperSummary = bill.paperBreakdown.map(pb => pb.name).join(", ");
  } else {
    const subs = rawSubs.map(id => itemMap.get(id)).filter(Boolean);
    paperSummary = subs.length > 0 ? subs.map(it => it.name).join(", ") : "નિયમિત પેપર";
  }

  const paperAmt = (bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  return `
    <div class="stub-card-4in1">
      <!-- Upper Main Bill (approx 74%) -->
      <div style="padding:6px 8px; flex:1; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <!-- Header -->
          <div style="text-align:center; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:4px;">
            <div style="font-size:12.5px; font-weight:900; text-transform:uppercase;">${firm.name || 'PERFECT NEWSPAPER SUPPLIERS'}</div>
            <div style="font-size:8.5px;">${firm.address || ''} • મો: <b>${firm.phone || ''}</b></div>
          </div>

          <!-- Cust row -->
          <div style="display:flex; justify-content:space-between; font-size:9.5px; margin-bottom:3px;">
            <div>
              <b>#${cust.custNo || cust.id} - ${cust.name || bill.customerName}</b>
              <div style="font-size:8.5px; color:#475569;">${cust.societyShort || cust.address || ''} ${cust.mobile ? '• ' + cust.mobile : ''}</div>
            </div>
            <div style="text-align:right;">
              <div>ક્રમ: <b>#${bill.deliverySequence || cust.sequenceNo || '-'}</b></div>
              <div style="font-size:8.5px;">હોકર: <b>${smName}</b></div>
            </div>
          </div>

          <!-- Paper & Bill Info -->
          <div style="border:1px solid #000; padding:3px 5px; font-size:9px; margin-bottom:4px;">
            <div style="display:flex; justify-content:space-between;">
              <span>પેપર: <b>${paperSummary}</b></span>
              <span>માસ: <b>${mName}-${y}</b></span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:2px;">
              <span>દિવસ: <b>${bill.daysDelivered || 30}d</b></span>
              <span>ચાલુ: <b>₹${paperAmt}</b> ${Number(prevBal) !== 0 ? `| બાકી: <b>₹${prevBal}</b>` : ''}</span>
            </div>
          </div>
        </div>

        <!-- Net Amount & QR Box -->
        <div style="display:flex; justify-content:space-between; align-items:center; border:1px solid #000; background:#f8fafc; padding:4px 6px;">
          <div style="width:58px; height:58px;">${qrSvg}</div>
          <div style="text-align:right;">
            <div style="font-size:8.5px; font-weight:700;">ભરવાપાત્ર નેટ રકમ:</div>
            <div style="font-size:18px; font-weight:900; color:#000;">₹${totalNet}</div>
            <div style="font-size:8px; color:#475569;">UPI: ${firm.upiId || ''}</div>
          </div>
        </div>
      </div>

      <!-- Lower Tear-Off Stub (approx 26%) -->
      <div style="border-top:1.5px dashed #000; background:#fafafa; padding:4px 8px; font-size:8.5px; line-height:1.25;">
        <div style="display:flex; justify-content:space-between; font-weight:bold; border-bottom:0.5px solid #ccc; padding-bottom:1px; margin-bottom:2px;">
          <span>✂️ ઉઘરાણી પાવતી (Receipt Stub)</span>
          <span>બિલ નં: #${bill.billNo || '-'}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>ગ્રાહક: <b>#${cust.custNo || cust.id} - ${(cust.name || bill.customerName).slice(0, 18)}</b></span>
          <span>ક્રમ: <b>#${bill.deliverySequence || cust.sequenceNo || '-'}</b></span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:2px;">
          <span>માસ: <b>${mName}-${y}</b> | રકમ: <b>₹${totalNet}</b></span>
          <span>મળેલ રકમ: ₹_________</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:2px;">
          <span>તારીખ: ____/____/૨૦૨૬</span>
          <span>સહી: __________________</span>
        </div>
        <div style="text-align:right; font-size:6.8px; color:#64748b; margin-top:2px;">
          Devlop by :- Imtiyaz Khanusia 94276 98665
        </div>
      </div>
    </div>
  `;
}
window.generateStub4in1HTML = generateStub4in1HTML;

// 2D. Format 3A: Wide Horizontal Strip Slip (A4 3-in-1)
function generateStrip3in1HTML(bill, cust, firm, items, salesmen, collectionMen) {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const smObj = cust.salesmanId ? salesmen.find(s => s.id === cust.salesmanId) : null;
  const smName = smObj ? smObj.name : (cust.salesmanName || "REHAAN");

  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const monthNames = ["જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઓગસ્ટ", "સપ્ટેમ્બર", "ઓક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"];
  const mName = monthNames[parseInt(m) - 1] || "ઓગસ્ટ";

  const upiPayee = (firm.name || "VendorSoft").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "vendorsoft@okaxis")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 74) : "";

  const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
  let paperSummary = "";
  if (bill.paperBreakdown && bill.paperBreakdown.length > 0) {
    paperSummary = bill.paperBreakdown.map(pb => `${pb.name} (${pb.daysCount || bill.daysDelivered || 30}d)`).join(", ");
  } else {
    const subs = rawSubs.map(id => itemMap.get(id)).filter(Boolean);
    paperSummary = subs.length > 0 ? subs.map(it => `${it.name} (${bill.daysDelivered || 30}d)`).join(", ") : "નિયમિત ન્યૂઝપેપર્સ";
  }

  const paperAmt = (bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const delCharge = (bill.deliveryCharge || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  return `
    <div class="strip-card-3in1">
      <!-- Top header strip -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #000; padding-bottom:3px; margin-bottom:5px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <b style="font-size:13.5px; text-transform:uppercase;">${firm.name || 'PERFECT NEWSPAPER SUPPLIERS'}</b>
          <span style="font-size:9.5px; color:#475569;">${firm.address || ''} • 📞 ${firm.phone || ''}</span>
        </div>
        <div style="text-align:right; font-size:10.5px;">
          <b>${mName}-${y}</b> | બિલ નં: <b>#${bill.billNo || '-'}</b>
        </div>
      </div>

      <!-- 3-Column horizontal body -->
      <div style="display:grid; grid-template-columns: 1.1fr 1.3fr 0.9fr; gap:12px; align-items:center; flex:1;">
        <!-- Col 1: Customer Details -->
        <div style="border-right:1px solid #e2e8f0; padding-right:8px; font-size:10px; line-height:1.35;">
          <div style="font-size:11.5px; font-weight:800; color:#0f172a;">#${cust.custNo || cust.id} - ${cust.name || bill.customerName}</div>
          <div style="color:#475569;">${cust.societyShort || cust.address || ''}</div>
          <div>મોબાઈલ: <b>${cust.mobile || '-'}</b></div>
          <div style="margin-top:2px; display:flex; justify-content:space-between;">
            <span>ક્રમ: <b style="color:#0369a1;">#${bill.deliverySequence || cust.sequenceNo || '-'}</b></span>
            <span>હોકર: <b>${smName}</b></span>
          </div>
        </div>

        <!-- Col 2: Paper breakdown & calculations -->
        <div style="border-right:1px solid #e2e8f0; padding-right:8px; font-size:10px; line-height:1.35;">
          <div>પેપર્સ: <b>${paperSummary}</b></div>
          <div style="font-size:9px; color:#475569; margin-top:2px;">
            આવેલા દિવસો: <b>${bill.daysDelivered || 30}</b> ${bill.vacationDays > 0 ? `<span style="color:#e11d48;">(રજા: -${bill.vacationDays}d)</span>` : ''}
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:3px 6px; margin-top:3px; font-size:9.5px;">
            <div style="display:flex; justify-content:space-between;">
              <span>ચાલુ બિલ: ₹${paperAmt}</span>
              ${Number(prevBal) !== 0 ? `<span style="color:#b45309;">જૂની બાકી: ₹${prevBal}</span>` : ''}
              ${Number(delCharge) > 0 ? `<span>ચાર્જ: ₹${delCharge}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Col 3: QR Code & Total -->
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
          <div style="width:70px; height:70px;">${qrSvg}</div>
          <div style="text-align:right;">
            <div style="font-size:8.5px; color:#475569; font-weight:bold;">કુલ ભરવાપાત્ર</div>
            <div style="font-size:19px; font-weight:900; color:#b91c1c; line-height:1.1;">₹${totalNet}</div>
            <div style="font-size:8px; color:#0284c7; font-weight:bold; margin-top:2px;">UPI: ${firm.upiId || ''}</div>
          </div>
        </div>
      </div>

      <!-- Bottom footer notice -->
      <div style="border-top:1px dashed #cbd5e1; padding-top:2px; margin-top:3px; display:flex; justify-content:space-between; font-size:8px; color:#64748b;">
        <span>• તા. ૧ થી ૧૦ માં બિલ ચૂકવી સહકાર આપવો.</span>
        <span>ONLINE PAYMENT પછી SCREENSHOT અવશ્ય મોકલવો.</span>
        <span>Devlop by :- Imtiyaz Khanusia 94276 98665</span>
      </div>
    </div>
  `;
}
window.generateStrip3in1HTML = generateStrip3in1HTML;

// 2E. Format 3B: Horizontal Strip with Side Stub (A4 3-in-1)
function generateStripWithStub3in1HTML(bill, cust, firm, items, salesmen, collectionMen) {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const smObj = cust.salesmanId ? salesmen.find(s => s.id === cust.salesmanId) : null;
  const smName = smObj ? smObj.name : (cust.salesmanName || "REHAAN");

  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const monthNames = ["જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઓગસ્ટ", "સપ્ટેમ્બર", "ઓક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"];
  const mName = monthNames[parseInt(m) - 1] || "ઓગસ્ટ";

  const upiPayee = (firm.name || "VendorSoft").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "vendorsoft@okaxis")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 64) : "";

  const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
  let paperSummary = "";
  if (bill.paperBreakdown && bill.paperBreakdown.length > 0) {
    paperSummary = bill.paperBreakdown.map(pb => pb.name).join(", ");
  } else {
    const subs = rawSubs.map(id => itemMap.get(id)).filter(Boolean);
    paperSummary = subs.length > 0 ? subs.map(it => it.name).join(", ") : "નિયમિત પેપર";
  }

  const paperAmt = (bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  return `
    <div class="strip-stub-card-3in1">
      <!-- Left 75%: Customer Bill -->
      <div style="flex:1; padding:8px 10px; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:4px;">
            <div>
              <b style="font-size:12.5px; text-transform:uppercase;">${firm.name || 'PERFECT NEWSPAPER SUPPLIERS'}</b>
              <span style="font-size:8.5px; color:#475569;"> • 📞 ${firm.phone || ''}</span>
            </div>
            <div style="font-size:9.5px; font-weight:bold;">${mName}-${y}</div>
          </div>

          <div style="display:grid; grid-template-columns: 1.3fr 1fr; gap:8px; font-size:9.5px;">
            <div>
              <b style="font-size:11px;">#${cust.custNo || cust.id} - ${cust.name || bill.customerName}</b>
              <div style="color:#475569;">${cust.societyShort || cust.address || ''} • 📞 ${cust.mobile || '-'}</div>
              <div>પેપર: <b>${paperSummary}</b> (${bill.daysDelivered || 30} દિવસ)</div>
            </div>
            <div style="text-align:right;">
              <div>ડિલિવરી ક્રમ: <b style="color:#0369a1;">#${bill.deliverySequence || cust.sequenceNo || '-'}</b></div>
              <div>હોકર: <b>${smName}</b> | બિલ: <b>#${bill.billNo || '-'}</b></div>
              <div>ચાલુ: ₹${paperAmt} ${Number(prevBal) !== 0 ? `| બાકી: <b style="color:#b45309;">₹${prevBal}</b>` : ''}</div>
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:3px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:60px; height:60px;">${qrSvg}</div>
            <div style="font-size:8px; color:#475569;">
              <b>UPI સ્કેન કરી પે કરો</b><br>
              ${firm.upiId || ''}
            </div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:9px; color:#475569;">કુલ ભરવાપાત્ર:</span>
            <div style="font-size:19px; font-weight:900; color:#b91c1c;">₹${totalNet}</div>
          </div>
        </div>
      </div>

      <!-- Right 25%: Side Tear-Off Stub -->
      <div style="width:175px; border-left:1.5px dashed #000; background:#f8fafc; padding:6px 8px; font-size:8.5px; line-height:1.25; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="font-weight:900; font-size:9px; border-bottom:1px solid #cbd5e1; padding-bottom:2px; margin-bottom:3px;">
            ✂️ ઉઘરાણી પહોંચ (Stub)
          </div>
          <div>ગ્રાહક: <b>#${cust.custNo || cust.id}</b></div>
          <div style="font-weight:bold; font-size:9.5px;">${(cust.name || bill.customerName).slice(0, 16)}</div>
          <div>ક્રમ: <b>#${bill.deliverySequence || cust.sequenceNo || '-'}</b></div>
          <div>માસ: <b>${mName}-${y}</b></div>
          <div style="font-size:10.5px; font-weight:900; color:#0f172a; margin:2px 0;">રકમ: ₹${totalNet}</div>
        </div>
        <div>
          <div style="border-top:1px dotted #94a3b8; padding-top:2px;">
            <div>મળેલ રકમ: ₹________</div>
            <div>તારીખ: ___/___/૨૬</div>
            <div style="margin-top:1px;">સહી: _____________</div>
          </div>
          <div style="font-size:6.8px; color:#64748b; margin-top:2px; text-align:right;">
            Devlop by :- Imtiyaz Khanusia 94276 98665
          </div>
        </div>
      </div>
    </div>
  `;
}
window.generateStripWithStub3in1HTML = generateStripWithStub3in1HTML;

// 3. Format 2: 2-in-1 Half Page Detailed
function generateFormat2HTML(bill, cust, firm, items, salesmen, collectionMen) {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const smObj = cust.salesmanId ? salesmen.find(s => s.id === cust.salesmanId) : null;
  const smName = smObj ? smObj.name : (cust.salesmanName || "REHAAN");

  const upiPayee = (firm.name || "VendorSoft").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "vendorsoft@okaxis")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 85) : "";

  return `
    <div style="border: 2px solid #0f172a; border-radius: 8px; padding: 14px 18px; background: #fff; color: #0f172a; font-family: 'Outfit', 'Noto Sans Gujarati', sans-serif; box-sizing: border-box; height: 530px; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0;">${firm.name || 'PERFECT NEWSPAPER SUPPLIERS'}</h2>
            <div style="font-size: 11px; color: #475569;">${firm.address}</div>
            <div style="font-size: 11px; color: #0284c7; font-weight: 600;">હેલ્પલાઇન: ${firm.phone} | UPI ID: ${firm.upiId}</div>
          </div>
          <div style="text-align: right;">
            <span style="background: #0284c7; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 700;">ગ્રાહક બિલ સ્લિપ</span>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">બિલ નં: #${bill.billNo} • ${bill.monthYear}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; background: #f8fafc; padding: 8px; border-radius: 6px; margin-bottom: 8px; font-size: 12px;">
          <div>
            <div style="font-weight: 700; color: #0f172a; font-size: 13px;">#${cust.custNo || cust.id} - ${cust.name || bill.customerName} ${cust.societyShort ? `(${cust.societyShort})` : ''}</div>
            <div style="color: #475569;">${cust.address || ''} • મો: ${cust.mobile || '-'}</div>
          </div>
          <div style="text-align: right;">
            <div>ડિલિવરી ક્રમ: <b style="color: #0284c7;">#${bill.deliverySequence || cust.sequenceNo || '-'}</b></div>
            <div>વિતરક: <b>${smName}</b></div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 8px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
              <th style="padding: 5px; text-align: left;">પેપર / વસ્તુ</th>
              <th style="padding: 5px; text-align: center;">આવેલા દિવસ</th>
              <th style="padding: 5px; text-align: center;">રજા કપાત</th>
              <th style="padding: 5px; text-align: right;">ચાલુ રકમ</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const itemMap2 = new Map(items.map(i => [i.id, i]));
              const rawSubs2 = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
              if (bill.paperBreakdown && bill.paperBreakdown.length > 0) {
                return bill.paperBreakdown.map(pb => `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 5px;"><b>${pb.name}</b></td>
                    <td style="padding: 5px; text-align: center;">${pb.daysCount || bill.daysDelivered}d</td>
                    <td style="padding: 5px; text-align: center; color: #e11d48;">-</td>
                    <td style="padding: 5px; text-align: right; font-weight: 700;">₹${Number(pb.totalCost).toFixed(2)}</td>
                  </tr>
                `).join("");
              } else {
                const subs = rawSubs2.map(id => itemMap2.get(id)).filter(Boolean);
                if (subs.length > 0) {
                  const totalPaperAmt = bill.currentAmount - (bill.deliveryCharge || 0);
                  const perPaperAmt = subs.length > 0 ? (totalPaperAmt / subs.length) : totalPaperAmt;
                  return subs.map(it => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 5px;"><b>${it.name}</b></td>
                      <td style="padding: 5px; text-align: center;">${bill.daysDelivered || 30}d</td>
                      <td style="padding: 5px; text-align: center; color: #e11d48;">${bill.vacationDays > 0 ? `-${bill.vacationDays}d` : '-'}</td>
                      <td style="padding: 5px; text-align: right; font-weight: 700;">₹${perPaperAmt.toFixed(2)}</td>
                    </tr>
                  `).join("");
                } else {
                  return `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 5px;"><b>નિયમિત પેપર</b></td>
                      <td style="padding: 5px; text-align: center;">${bill.daysDelivered}d</td>
                      <td style="padding: 5px; text-align: center; color: #e11d48;">-</td>
                      <td style="padding: 5px; text-align: right; font-weight: 700;">₹${bill.currentAmount}</td>
                    </tr>
                  `;
                }
              }
            })()}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1.5px solid #0f172a; padding-top: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 80px; height: 80px;">${qrSvg}</div>
          <div style="font-size: 10.5px; color: #475569;">
            <b style="color: #0f172a;">GPay / PhonePe / Paytm</b><br>
            સ્કેન કરી પેમેન્ટ કરો<br>
            UPI ID: <b style="color: #0284c7;">${firm.upiId}</b>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; color: #64748b;">ચાલુ બિલ: ₹${bill.currentAmount} | જૂની બાકી: ₹${bill.pastArrears}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">કુલ ભરવાપાત્ર રકમ (Net Due):</div>
          <div style="font-size: 22px; font-weight: 800; color: #b91c1c;">₹${bill.totalPayable}</div>
        </div>
      </div>
      <div style="text-align: right; font-size: 8px; color: #94a3b8; margin-top: 4px;">
        Devlop by :- Imtiyaz Khanusia 94276 98665
      </div>
    </div>
  `;
}

// 3B. Format 2B: Modern Commercial Half-Page Invoice (2-in-1 A4)
function generateModern2in1HTML(bill, cust, firm, items, salesmen, collectionMen) {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const smObj = cust.salesmanId ? salesmen.find(s => s.id === cust.salesmanId) : null;
  const smName = smObj ? smObj.name : (cust.salesmanName || "REHAAN");

  let periodStr = bill.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const monthNames = ["જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઓગસ્ટ", "સપ્ટેમ્બર", "ઓક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"];
  const mName = monthNames[parseInt(m) - 1] || "ઓગસ્ટ";

  const upiPayee = (firm.name || "VendorSoft").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "vendorsoft@okaxis")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;
  const qrSvg = window.createQRCodeSVG ? window.createQRCodeSVG(upiUrl, 85) : "";

  const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
  let itemRowsHtml = "";
  if (bill.paperBreakdown && bill.paperBreakdown.length > 0) {
    itemRowsHtml = bill.paperBreakdown.map((pb, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 5px 8px; text-align: center;">${idx + 1}</td>
        <td style="padding: 5px 8px; font-weight: bold;">${pb.name}</td>
        <td style="padding: 5px 8px; text-align: center;">${pb.daysCount || bill.daysDelivered || 30}</td>
        <td style="padding: 5px 8px; text-align: right; font-weight: bold;">₹${Number(pb.totalCost).toFixed(2)}</td>
      </tr>
    `).join("");
  } else {
    // Each newspaper gets its own separate row
    const subs = rawSubs.map(id => itemMap.get(id)).filter(Boolean);
    if (subs.length > 0) {
      const totalPaperAmt = bill.currentAmount - (bill.deliveryCharge || 0);
      const perPaperAmt = subs.length > 0 ? (totalPaperAmt / subs.length) : totalPaperAmt;
      itemRowsHtml = subs.map((it, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 5px 8px; text-align: center;">${idx + 1}</td>
          <td style="padding: 5px 8px; font-weight: bold;">${it.name}</td>
          <td style="padding: 5px 8px; text-align: center;">${bill.daysDelivered || 30}</td>
          <td style="padding: 5px 8px; text-align: right; font-weight: bold;">₹${perPaperAmt.toFixed(2)}</td>
        </tr>
      `).join("");
    } else {
      itemRowsHtml = `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 5px 8px; text-align: center;">1</td>
          <td style="padding: 5px 8px; font-weight: bold;">નિયમિત પેપર્સ</td>
          <td style="padding: 5px 8px; text-align: center;">${bill.daysDelivered || 30}</td>
          <td style="padding: 5px 8px; text-align: right; font-weight: bold;">₹${Number(bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2)}</td>
        </tr>
      `;
    }
  }

  const paperAmt = (bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2);
  const prevBal = (bill.pastArrears || 0).toFixed(2);
  const delCharge = (bill.deliveryCharge || 0).toFixed(2);
  const totalNet = Number(bill.totalPayable).toFixed(2);

  return `
    <div class="half-bill-2in1">
      <div>
        <!-- Top header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2.5px solid #0f172a; padding-bottom:8px; margin-bottom:10px;">
          <div>
            <h2 style="font-size:20px; font-weight:900; color:#0f172a; margin:0; letter-spacing:0.2px;">${firm.name || 'PERFECT NEWSPAPER SUPPLIERS'}</h2>
            <div style="font-size:11.5px; color:#475569; margin-top:2px;">${firm.address || ''} • 📞 હેલ્પલાઇન: <b>${firm.phone || ''}</b></div>
            ${firm.gstNo ? `<div style="font-size:10.5px; color:#64748b;">GSTIN: <b>${firm.gstNo}</b></div>` : ''}
          </div>
          <div style="text-align:right;">
            <span style="background:#0f172a; color:#fff; font-size:11px; padding:3px 10px; border-radius:4px; font-weight:700;">ટેક્સ / સર્વિસ ઇન્વોઇસ</span>
            <div style="font-size:12px; font-weight:700; color:#0284c7; margin-top:4px;">માસ: ${mName}-${y}</div>
            <div style="font-size:11px; color:#64748b;">બિલ નં: #${bill.billNo || '-'}</div>
          </div>
        </div>

        <!-- Customer & Delivery Box -->
        <div style="display:grid; grid-template-columns: 2fr 1.1fr; gap:12px; background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px; border-radius:6px; margin-bottom:10px; font-size:12px;">
          <div>
            <div style="font-size:14px; font-weight:800; color:#0f172a;">#${cust.custNo || cust.id} - ${cust.name || bill.customerName}</div>
            <div style="color:#475569; margin-top:2px;">સરનામું: ${cust.societyShort || cust.address || '-'} • મો: <b>${cust.mobile || '-'}</b></div>
          </div>
          <div style="text-align:right;">
            <div>ડિલિવરી ક્રમ: <b style="font-size:14px; color:#0284c7;">#${bill.deliverySequence || cust.sequenceNo || '-'}</b></div>
            <div>વિતરક સ્ટાફ: <b>${smName}</b></div>
          </div>
        </div>

        <!-- Itemized Table -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
          <thead>
            <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1; font-size:11.5px;">
              <th style="padding:6px 8px; width:35px; text-align:center;">ક્રમ</th>
              <th style="padding:6px 8px; text-align:left;">ન્યૂઝપેપર / સામયિકનું નામ</th>
              <th style="padding:6px 8px; width:65px; text-align:center;">દિવસો</th>
              <th style="padding:6px 8px; width:95px; text-align:right;">ચાલુ રકમ</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Financials & QR Bar -->
      <div style="border-top:2px solid #0f172a; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:85px; height:85px;">${qrSvg}</div>
          <div style="font-size:11px; color:#475569; line-height:1.4;">
            <b style="color:#0f172a; font-size:12px;">GPay / PhonePe / Paytm</b><br>
            કોઈપણ UPI એપથી સ્કેન કરી પેમેન્ટ કરો<br>
            UPI ID: <b style="color:#0284c7;">${firm.upiId || ''}</b>
          </div>
        </div>

        <div style="text-align:right;">
          <div style="font-size:11.5px; color:#64748b;">ચાલુ બિલ: ₹${paperAmt} ${Number(prevBal) !== 0 ? `| જૂની બાકી: <b style="color:#b45309;">₹${prevBal}</b>` : ''} ${Number(delCharge) > 0 ? `| સર્વિસ: ₹${delCharge}` : ''}</div>
          <div style="font-size:12.5px; color:#475569; margin-top:3px; font-weight:600;">કુલ ભરવાપાત્ર નેટ રકમ (Net Due):</div>
          <div style="font-size:25px; font-weight:900; color:#b91c1c; line-height:1.1;">₹${totalNet}</div>
        </div>
      </div>
      <div style="text-align: right; font-size: 8.5px; color: #94a3b8; margin-top: 4px;">
        Devlop by :- Imtiyaz Khanusia 94276 98665
      </div>
    </div>
  `;
}
window.generateModern2in1HTML = generateModern2in1HTML;

// 4. Format 3: Counterfoil Stub
function generateFormat3HTML(bill, cust, firm, items, salesmen, collectionMen) {
  const f2 = generateFormat2HTML(bill, cust, firm, items, salesmen, collectionMen);
  return `
    <div style="border: 2px solid #0f172a; border-radius: 8px; background: #fff; overflow: hidden; height: 530px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
      <div style="padding: 12px 16px; flex: 1;">
        ${f2}
      </div>
      <div style="border-top: 2px dashed #64748b; background: #f8fafc; padding: 8px 16px; font-size: 11px;">
        <span style="font-size: 9px; color: #64748b;">✂️ અહીંથી ફાડીને ગ્રાહકને પાવતી આપો / ઓફિસ રેકોર્ડ રાખો</span>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
          <div>
            <b>ઉઘરાણી પહોંચ (Receipt)</b>: #${cust.custNo || cust.id} - ${cust.name || bill.customerName}<br>
            <span style="color: #64748b;">બિલ માસ: ${bill.monthYear} • મળેલ રકમ: ₹___________ • તારીખ: ___/___/૨૦૨૬</span>
          </div>
          <div style="text-align: right; font-size: 10px; color: #475569;">
            ઉઘરાણી સ્ટાફ સહી: __________________
          </div>
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// MODAL CONTROLLERS & ACTIONS
// -------------------------------------------------------------

// Open Single Print Slip Modal
async function openSingleSlipModal(billId) {
  let bill = await window.vendorDB.get("bills", billId);
  if (!bill && !isNaN(Number(billId))) {
    bill = await window.vendorDB.get("bills", Number(billId));
  }
  if (!bill) {
    const allBills = await window.vendorDB.getAll("bills");
    bill = allBills.find(b => String(b.id) === String(billId) || String(b.billNo) === String(billId));
  }
  if (!bill) {
    showToast("બિલ મળ્યું નથી!");
    return;
  }
  const cust = (await window.vendorDB.get("customers", bill.customerId)) || {};
  currentViewingBillData = bill;
  currentViewingBillCustomer = cust;

  const firm = cachedAgency || await window.vendorDB.get("firms", "primary");
  if (firm && firm.defaultPrintFormat) {
    const fmtSelect = document.getElementById("singlePrintFormatSelect");
    if (fmtSelect && fmtSelect.querySelector(`option[value="${firm.defaultPrintFormat}"]`)) {
      fmtSelect.value = firm.defaultPrintFormat;
    }
  }

  await changeSingleSlipFormat();
  openModal("slipModal");
}
window.openSingleSlipModal = openSingleSlipModal;

async function changeSingleSlipFormat() {
  if (!currentViewingBillData || !currentViewingBillCustomer) return;
  const bill = currentViewingBillData;
  const cust = currentViewingBillCustomer;
  const firm = cachedAgency || await window.vendorDB.get("firms", "primary");
  const items = await window.vendorDB.getAll("items");
  const salesmen = await window.vendorDB.getAll("salesmen") || [];
  const collectionMen = await window.vendorDB.getAll("collectionMen") || [];

  const fmt = document.getElementById("singlePrintFormatSelect")?.value || "4in1_classic";
  const container = document.getElementById("slipContentContainer");
  if (!container) return;

  if (fmt === "4in1_perfect_memo") {
    container.innerHTML = `<div style="display:flex; justify-content:center;">${generatePerfectCreditMemo4in1HTML(bill, cust, firm, items, salesmen, collectionMen)}</div>`;
  } else if (fmt === "4in1_ocean_blue") {
    container.innerHTML = `<div style="display:flex; justify-content:center;">${generateOceanBlue4in1HTML(bill, cust, firm, items, salesmen, collectionMen)}</div>`;
  } else if (fmt === "4in1_vintage_parchment") {
    container.innerHTML = `<div style="display:flex; justify-content:center;">${generateVintageParchment4in1HTML(bill, cust, firm, items, salesmen, collectionMen)}</div>`;
  } else if (fmt === "4in1_magenta_wave") {
    container.innerHTML = `<div style="display:flex; justify-content:center;">${generateMagentaWave4in1HTML(bill, cust, firm, items, salesmen, collectionMen)}</div>`;
  } else if (fmt === "4in1_eco_green") {
    container.innerHTML = `<div style="display:flex; justify-content:center;">${generateEcoGreen4in1HTML(bill, cust, firm, items, salesmen, collectionMen)}</div>`;
  } else if (fmt === "4in1_clean_bw") {
    container.innerHTML = `<div style="display:flex; justify-content:center;">${generateCleanBWNewspaper4in1HTML(bill, cust, firm, items, salesmen, collectionMen)}</div>`;
  } else if (fmt === "4in1_classic" || fmt === "format1") {
    container.innerHTML = `<div style="display:flex; justify-content:center;">${generateBWSlipHTML(bill, cust, firm, items, salesmen, collectionMen)}</div>`;
  } else if (fmt === "4in1_modern") {
    container.innerHTML = `<div style="display:flex; justify-content:center;">${generateModern4in1HTML(bill, cust, firm, items, salesmen, collectionMen)}</div>`;
  } else if (fmt === "4in1_stub") {
    container.innerHTML = `<div style="display:flex; justify-content:center;">${generateStub4in1HTML(bill, cust, firm, items, salesmen, collectionMen)}</div>`;
  } else if (fmt === "3in1_wide") {
    container.innerHTML = `<div style="display:flex; justify-content:center;">${generateStrip3in1HTML(bill, cust, firm, items, salesmen, collectionMen)}</div>`;
  } else if (fmt === "3in1_stub") {
    container.innerHTML = `<div style="display:flex; justify-content:center;">${generateStripWithStub3in1HTML(bill, cust, firm, items, salesmen, collectionMen)}</div>`;
  } else if (fmt === "2in1_detailed" || fmt === "format2") {
    container.innerHTML = generateFormat2HTML(bill, cust, firm, items, salesmen, collectionMen);
  } else if (fmt === "2in1_modern") {
    container.innerHTML = generateModern2in1HTML(bill, cust, firm, items, salesmen, collectionMen);
  } else if (fmt === "2in1_counterfoil" || fmt === "format3") {
    container.innerHTML = generateFormat3HTML(bill, cust, firm, items, salesmen, collectionMen);
  } else {
    // Thermal format
    container.innerHTML = `<div style="font-family:monospace; padding:0.5rem; font-size:0.88rem; line-height:1.5;">${generateBWSlipHTML(bill, cust, firm, items, salesmen, collectionMen)}</div>`;
  }
}
window.changeSingleSlipFormat = changeSingleSlipFormat;

function triggerSingleSlipPrint() {
  const modal = document.getElementById("slipModal");
  if (modal) modal.classList.add("print-active-modal");
  window.print();
  setTimeout(() => {
    if (modal) modal.classList.remove("print-active-modal");
  }, 1000);
}
window.triggerSingleSlipPrint = triggerSingleSlipPrint;

// Open Color Bill Modal (Image 1 replica for WhatsApp)
async function openColorBillModal(billId) {
  let bill = await window.vendorDB.get("bills", billId);
  if (!bill && !isNaN(Number(billId))) {
    bill = await window.vendorDB.get("bills", Number(billId));
  }
  if (!bill) {
    const allBills = await window.vendorDB.getAll("bills");
    bill = allBills.find(b => String(b.id) === String(billId) || String(b.billNo) === String(billId));
  }
  if (!bill) {
    showToast("બિલ મળ્યું નથી!");
    return;
  }
  const cust = (await window.vendorDB.get("customers", bill.customerId)) || {};
  const firm = cachedAgency || await window.vendorDB.get("firms", "primary") || {};
  const items = await window.vendorDB.getAll("items");
  const salesmen = await window.vendorDB.getAll("salesmen") || [];
  const collectionMen = await window.vendorDB.getAll("collectionMen") || [];

  currentViewingBillData = bill;
  currentViewingBillCustomer = cust;

  const html = generateColorBillHTML(bill, cust, firm, items, salesmen, collectionMen);
  document.getElementById("colorBillContainer").innerHTML = html;
  openModal("colorBillModal");
}
window.openColorBillModal = openColorBillModal;

// Create High-Res Native Canvas for Bill Image (100% Offline, Retina 2x)
function createColorBillCanvas(bill, cust, firm, items, salesmen, collectionMen) {
  cust = cust || {};
  firm = firm || {};
  items = items || [];
  salesmen = salesmen || [];
  collectionMen = collectionMen || [];

  const itemMap = new Map(items.map(i => [i.id, i]));
  const smObj = cust.salesmanId ? salesmen.find(s => s.id === cust.salesmanId) : null;
  const smName = smObj ? smObj.name : (cust.salesmanName || "REHAAN");

  let periodStr = bill?.monthYear || "Aug-2026";
  const [y, m] = periodStr.split("-");
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mNameFull = monthNames[parseInt(m) - 1] || "August";
  const mNameShort = mNameFull.slice(0, 3);
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const dateRangeStr = `01-${mNameShort}-${y} To ${lastDay}-${mNameShort}-${y}`;

  const upiPayee = (firm.name || "PERFECT NEWSPAPER SUPPLIERS").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId || "9825778607@okaxis")}&pn=${encodeURIComponent(upiPayee)}&am=${bill?.totalPayable || 0}&cu=INR&tn=Bill-${bill?.billNo || '0000'}`;

  // Parse bill rows
  let paperRows = [];
  if (bill?.paperBreakdown && bill.paperBreakdown.length > 0) {
    paperRows = bill.paperBreakdown.map((pb, idx) => ({
      no: idx + 1,
      name: pb.name,
      days: pb.daysCount || bill.daysDelivered || 30,
      amount: Number(pb.totalCost).toFixed(2)
    }));
  } else {
    const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
    const pNames = rawSubs.map(id => itemMap.get(id)?.name).filter(Boolean).join(", ") || "GUJARAT SAMACHAR";
    paperRows = [{
      no: 1,
      name: pNames,
      days: bill?.daysDelivered || 30,
      amount: Number((bill?.currentAmount || 0) - (bill?.deliveryCharge || 0)).toFixed(2)
    }];
  }

  const paperAmt = ((bill?.currentAmount || 0) - (bill?.deliveryCharge || 0)).toFixed(2);
  const prevBal = (bill?.pastArrears || 0).toFixed(2);
  const delCharge = (bill?.deliveryCharge || 0).toFixed(2);
  const totalNet = Number(bill?.totalPayable || 0).toFixed(2);

  const W = 520;
  const tableRowH = 24;
  const H = 760 + Math.max(0, paperRows.length - 1) * tableRowH;
  const scale = 2; // High-res retina 2x

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Outer Border
  ctx.strokeStyle = "#0f3b7d";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  // Inner subtle border
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(12, 12, W - 24, H - 24);

  // 1. Credit Memo Header
  ctx.fillStyle = "#0f3b7d";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(W / 2 - 60, 4, 120, 20, 10) : ctx.rect(W / 2 - 60, 4, 120, 20);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "italic bold 11px 'Outfit', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Credit Memo", W / 2, 18);

  // 2. Agency Name
  ctx.font = "900 20px 'Outfit', sans-serif";
  ctx.fillStyle = "#0f3b7d";
  ctx.fillText((firm.name || "PERFECT NEWSPAPER SUPPLIERS").toUpperCase(), W / 2, 48);

  // 3. Address & Phone
  ctx.font = "normal 10.5px 'Outfit', sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText(firm.address || "E-392, SANKALITNAGAR-JUHAPURA-Ahmedabad", W / 2, 65);
  ctx.fillText(`Reg. No: ${firm.regNo || '45455/87'}  •  Phone: ${firm.phone || '9825778607'}`, W / 2, 80);

  // 4. Vendor & Period Bar
  const barY = 92;
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(16, barY, W - 32, 28, 6) : ctx.rect(16, barY, W - 32, 28);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = "bold 11px 'Outfit', sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(`👤 ${firm.ownerName || 'NIZAM TAI'}  (${firm.phone || '9825778607'})`, 26, barY + 18);

  ctx.textAlign = "right";
  ctx.font = "bold 11px 'Outfit', sans-serif";
  ctx.fillStyle = "#0369a1";
  ctx.fillText(`📅 Period: ${dateRangeStr}`, W - 26, barY + 18);

  // 5. Customer Details Card
  const custY = 126;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(16, custY, W - 32, 74, 6) : ctx.rect(16, custY, W - 32, 74);
  ctx.fill();
  ctx.stroke();

  // Left Details
  ctx.textAlign = "left";
  ctx.font = "normal 11px 'Outfit', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Name:", 26, custY + 20);
  ctx.font = "bold 12.5px 'Outfit', sans-serif";
  ctx.fillStyle = "#0f3b7d";
  const cNameStr = `${cust.name || bill?.customerName || "Customer"} ${cust.societyShort ? `(${cust.societyShort})` : ''}`;
  ctx.fillText(cNameStr.slice(0, 34), 68, custY + 20);

  ctx.font = "normal 11px 'Outfit', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Mobile:", 26, custY + 38);
  ctx.font = "bold 11.5px 'Outfit', sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(cust.mobile || cust.whatsapp || "-", 72, custY + 38);

  ctx.font = "normal 11px 'Outfit', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Salesman:", 26, custY + 56);
  ctx.font = "bold 11.5px 'Outfit', sans-serif";
  ctx.fillStyle = "#0369a1";
  ctx.fillText(smName, 84, custY + 56);

  // Right Details
  ctx.textAlign = "right";
  ctx.font = "normal 11px 'Outfit', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Bill No:", W - 80, custY + 20);
  ctx.font = "bold 13px 'Outfit', sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(bill?.billNo || "3152", W - 26, custY + 20);

  ctx.font = "normal 11px 'Outfit', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Month:", W - 80, custY + 38);
  ctx.font = "bold 12px 'Outfit', sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(`${mNameShort}-${y}`, W - 26, custY + 38);

  ctx.font = "normal 10.5px 'Outfit', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(`Seq: #${bill?.deliverySequence || cust.sequenceNo || '-'}`, W - 26, custY + 56);

  // 6. Newspaper Table
  const tableY = 208;
  const colX = [16, 52, 330, 410, W - 16];

  // Header Row
  ctx.fillStyle = "#0f3b7d";
  ctx.fillRect(16, tableY, W - 32, 26);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px 'Outfit', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("No.", (colX[0] + colX[1]) / 2, tableY + 17);
  ctx.textAlign = "left";
  ctx.fillText("Newspaper", colX[1] + 10, tableY + 17);
  ctx.textAlign = "center";
  ctx.fillText("Days", (colX[2] + colX[3]) / 2, tableY + 17);
  ctx.textAlign = "right";
  ctx.fillText("Amount (₹)", colX[4] - 10, tableY + 17);

  // Table Rows
  let curY = tableY + 26;
  ctx.font = "normal 11px 'Outfit', sans-serif";
  ctx.fillStyle = "#0f172a";
  paperRows.forEach((row, i) => {
    ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#f8fafc";
    ctx.fillRect(16, curY, W - 32, tableRowH);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(16, curY, W - 32, tableRowH);

    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center";
    ctx.fillText(String(row.no), (colX[0] + colX[1]) / 2, curY + 16);
    ctx.textAlign = "left";
    ctx.font = "bold 11px 'Outfit', sans-serif";
    ctx.fillText(row.name.slice(0, 36), colX[1] + 10, curY + 16);
    ctx.font = "normal 11px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(row.days), (colX[2] + colX[3]) / 2, curY + 16);
    ctx.textAlign = "right";
    ctx.font = "bold 11px 'Outfit', sans-serif";
    ctx.fillText(row.amount, colX[4] - 10, curY + 16);

    curY += tableRowH;
  });

  // Table Outer border
  ctx.strokeStyle = "#0f3b7d";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(16, tableY, W - 32, curY - tableY);

  // 7. Arrears Strip
  curY += 8;
  ctx.fillStyle = "#dbeafe";
  ctx.fillRect(16, curY, W - 32, 24);
  ctx.font = "bold 11px 'Outfit', 'Noto Sans Gujarati', sans-serif";
  ctx.fillStyle = "#991b1b";
  ctx.textAlign = "left";
  ctx.fillText(`ગયા મહીના સુધીની બાકી રકમ : ₹ ${prevBal}`, 26, curY + 16);
  curY += 24 + 10;

  // 8. Payment QR & Calculation Grid
  const gridH = 150;
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(16, curY, W - 32, gridH, 8) : ctx.rect(16, curY, W - 32, gridH);
  ctx.fill();
  ctx.stroke();

  // Left QR Area
  const qrBoxW = 160;
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(16 + qrBoxW, curY);
  ctx.lineTo(16 + qrBoxW, curY + gridH);
  ctx.stroke();

  // "Scan & Pay" Badge
  ctx.fillStyle = "#0f3b7d";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(46, curY + 8, 100, 18, 9) : ctx.rect(46, curY + 8, 100, 18);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 10px 'Outfit', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Scan & Pay", 96, curY + 21);

  // Draw pure canvas QR Code
  if (window.drawQRCodeToCanvas) {
    window.drawQRCodeToCanvas(ctx, upiUrl, 48, curY + 30, 96);
  }

  // Payment app tags
  ctx.font = "bold 9px 'Outfit', sans-serif";
  ctx.fillStyle = "#4285f4";
  ctx.fillText("GPay", 60, curY + 138);
  ctx.fillStyle = "#64748b";
  ctx.fillText("•", 82, curY + 138);
  ctx.fillStyle = "#5f259f";
  ctx.fillText("PhonePe", 104, curY + 138);
  ctx.fillStyle = "#64748b";
  ctx.fillText("•", 126, curY + 138);
  ctx.fillStyle = "#00b9f1";
  ctx.fillText("Paytm", 144, curY + 138);

  // Right Calculation Area
  const rightX = 16 + qrBoxW + 16;
  const rightEnd = W - 28;
  let lineY = curY + 24;

  function drawCalcLine(label, value, isBold, color) {
    ctx.textAlign = "left";
    ctx.font = (isBold ? "bold " : "normal ") + "11.5px 'Outfit', sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText(label, rightX, lineY);
    ctx.textAlign = "right";
    ctx.font = "bold 12px 'Outfit', sans-serif";
    ctx.fillStyle = color || "#0f172a";
    ctx.fillText(value, rightEnd, lineY);
    lineY += 22;
  }

  drawCalcLine("Newspaper Amount:", `₹ ${paperAmt}`, false);
  drawCalcLine("Previous Balance:", `₹ ${prevBal}`, true, Number(prevBal) > 0 ? "#b91c1c" : "#0f172a");
  drawCalcLine("Home Delivery Charge:", `₹ ${delCharge}`, false);

  // Net Amount Payable Bar
  ctx.fillStyle = "#0f3b7d";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(rightX - 4, lineY + 2, rightEnd - rightX + 8, 36, 6) : ctx.rect(rightX - 4, lineY + 2, rightEnd - rightX + 8, 36);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.font = "bold 11px 'Outfit', sans-serif";
  ctx.fillText("NET AMOUNT PAYABLE:", rightX + 6, lineY + 24);
  ctx.textAlign = "right";
  ctx.font = "900 16px 'Outfit', sans-serif";
  ctx.fillText(`₹ ${totalNet}`, rightEnd - 6, lineY + 25);

  curY += gridH + 10;

  // 9. Notice Panel
  const noticeH = 68;
  ctx.fillStyle = "#fef9c3";
  ctx.strokeStyle = "#fde047";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(16, curY, W - 32, noticeH, 6) : ctx.rect(16, curY, W - 32, noticeH);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = "bold 11px 'Outfit', 'Noto Sans Gujarati', sans-serif";
  ctx.fillStyle = "#713f12";
  ctx.fillText("સૂચના", W / 2, curY + 16);

  const colW = (W - 32) / 4;
  ctx.font = "bold 9.5px 'Outfit', 'Noto Sans Gujarati', sans-serif";
  ctx.fillStyle = "#713f12";
  ctx.fillText("📅 ૧ થી ૧૦ માં", 16 + colW * 0.5, curY + 34);
  ctx.fillText("બિલ ચૂકવવું", 16 + colW * 0.5, curY + 48);
  ctx.fillText("🕌 ઈસ્લામિક તહેવારે", 16 + colW * 1.5, curY + 34);
  ctx.fillText("રજા રહેશે", 16 + colW * 1.5, curY + 48);
  ctx.fillText("📢 પેપર બંધ કરવું", 16 + colW * 2.5, curY + 34);
  ctx.fillText("હોય તો જાણ કરવી", 16 + colW * 2.5, curY + 48);
  ctx.fillText("🪙 દર મહિને ₹૧૦", 16 + colW * 3.5, curY + 34);
  ctx.fillText("સર્વિસ ચાર્જ", 16 + colW * 3.5, curY + 48);

  curY += noticeH + 8;

  // 10. WhatsApp Banner
  ctx.fillStyle = "#eff6ff";
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(16, curY, W - 32, 26, 5) : ctx.rect(16, curY, W - 32, 26);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = "center";
  ctx.font = "bold 10px 'Outfit', 'Noto Sans Gujarati', sans-serif";
  ctx.fillStyle = "#1e40af";
  ctx.fillText("✈️ ONLINE PAYMENT પછી SCREEN SHOT 💬 WhatsApp પર અવશ્ય મોકલવો. 💵", W / 2, curY + 17);

  curY += 34;

  // Footer Branding
  ctx.textAlign = "right";
  ctx.font = "normal 8.5px 'Outfit', sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Devlop by :- Imtiyaz Khanusia 94276 98665", W - 20, curY);

  return canvas;
}
window.createColorBillCanvas = createColorBillCanvas;

// Download Color Bill as High-Res PNG Image (100% Offline Native Canvas Drawing)
async function downloadColorBillPNG() {
  const bill = currentViewingBillData;
  const cust = currentViewingBillCustomer;
  if (!bill || !cust) {
    showToast("બિલ ડેટા મળ્યો નથી!");
    return;
  }

  const firm = cachedAgency || await window.vendorDB.get("firms", "primary") || {};
  const items = await window.vendorDB.getAll("items") || [];
  const salesmen = await window.vendorDB.getAll("salesmen") || [];
  const collectionMen = await window.vendorDB.getAll("collectionMen") || [];

  const canvas = createColorBillCanvas(bill, cust, firm, items, salesmen, collectionMen);

  // Instant export without tainted canvas!
  canvas.toBlob(blob => {
    if (!blob) {
      showToast("ઈમેજ બનાવવામાં આવી રહી છે...");
      return;
    }
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const custName = (cust?.name || "Customer").replace(/[^a-zA-Z0-9]/g, "_");
    a.download = `Bill_${bill?.billNo || "3152"}_${custName}.png`;
    a.href = downloadUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 8000);
    showToast("📸 કલર બિલ ઈમેજ (PNG) સફળતાપૂર્વક ડાઉનલોડ થઈ ગઈ!");
  }, "image/png");
}
window.downloadColorBillPNG = downloadColorBillPNG;

function sendColorBillWhatsApp() {
  if (currentViewingBillData) {
    sendWhatsAppBill(currentViewingBillData.id);
  }
}
window.sendColorBillWhatsApp = sendColorBillWhatsApp;

// -------------------------------------------------------------
// BULK A4 PRINTING CONTROLLER (4-in-1 B/W A4 Sheets)
// -------------------------------------------------------------
async function openBulkPrintModal() {
  const routes = await window.vendorDB.getAll("routes") || [];
  const salesmen = await window.vendorDB.getAll("salesmen") || [];

  // Populate routes filter
  const rSelect = document.getElementById("bulkPrintRouteSelect");
  if (rSelect) {
    rSelect.innerHTML = `<option value="all">બધી લાઇન</option>`;
    routes.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.code} - ${r.name}`;
      rSelect.appendChild(opt);
    });
  }

  // Populate salesmen filter
  const smSelect = document.getElementById("bulkPrintSalesmanSelect");
  if (smSelect) {
    smSelect.innerHTML = `<option value="all">બધા વિતરક</option>`;
    salesmen.forEach(sm => {
      const opt = document.createElement("option");
      opt.value = sm.id;
      opt.textContent = sm.name;
      smSelect.appendChild(opt);
    });
  }

  const firm = cachedAgency || await window.vendorDB.get("firms", "primary");
  if (firm && firm.defaultPrintFormat) {
    const fmtSelect = document.getElementById("bulkPrintFormatSelect");
    if (fmtSelect && fmtSelect.querySelector(`option[value="${firm.defaultPrintFormat}"]`)) {
      fmtSelect.value = firm.defaultPrintFormat;
    }
  }

  await renderBulkPrintSheets();
  openModal("bulkPrintModal");
}
window.openBulkPrintModal = openBulkPrintModal;

async function renderBulkPrintSheets() {
  const monthSelect = document.getElementById("billingMonthSelect");
  const yearSelect = document.getElementById("billingYearSelect");
  const month = parseInt(monthSelect?.value || 8);
  const year = parseInt(yearSelect?.value || 2026);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const allBills = await window.vendorDB.getAll("bills");
  const customers = await window.vendorDB.getAll("customers");
  const routes = await window.vendorDB.getAll("routes") || [];
  const items = await window.vendorDB.getAll("items");
  const salesmen = await window.vendorDB.getAll("salesmen") || [];
  const collectionMen = await window.vendorDB.getAll("collectionMen") || [];

  const custMap = new Map(customers.map(c => [c.id, c]));
  const routeObjMap = new Map(routes.map(r => [r.id, r]));

  let bills = allBills.filter(b => b.monthYear === monthKey);

  // Filters
  const routeVal = document.getElementById("bulkPrintRouteSelect")?.value || "all";
  const smVal = document.getElementById("bulkPrintSalesmanSelect")?.value || "all";
  const fmt = document.getElementById("bulkPrintFormatSelect")?.value || "4in1_classic";

  if (routeVal !== "all") {
    bills = bills.filter(b => {
      const cust = custMap.get(b.customerId);
      return cust && String(cust.routeId) === String(routeVal);
    });
  }

  if (smVal !== "all") {
    bills = bills.filter(b => {
      const cust = custMap.get(b.customerId);
      const smId = cust?.salesmanId || routeObjMap.get(cust?.routeId)?.salesmanId;
      return String(smId) === String(smVal);
    });
  }

  // Sort bills in delivery sequence
  bills.sort((a, b) => {
    const custA = custMap.get(a.customerId) || {};
    const custB = custMap.get(b.customerId) || {};
    const seqA = a.deliverySequence || custA.sequenceNo || 999999;
    const seqB = b.deliverySequence || custB.sequenceNo || 999999;
    return seqA - seqB;
  });

  let genFunc = generatePerfectCreditMemo4in1HTML;
  let chunkSize = 4;
  let gridClass = "a4-grid-4in1 a4-cut-guides";
  let pagePrintClass = "a4-print-page-4in1";

  if (fmt === "4in1_perfect_memo") {
    genFunc = generatePerfectCreditMemo4in1HTML;
    chunkSize = 4;
    gridClass = "a4-grid-4in1 a4-cut-guides";
    pagePrintClass = "a4-print-page-4in1";
  } else if (fmt === "4in1_ocean_blue") {
    genFunc = generateOceanBlue4in1HTML;
    chunkSize = 4;
    gridClass = "a4-grid-4in1 a4-cut-guides";
    pagePrintClass = "a4-print-page-4in1";
  } else if (fmt === "4in1_vintage_parchment") {
    genFunc = generateVintageParchment4in1HTML;
    chunkSize = 4;
    gridClass = "a4-grid-4in1 a4-cut-guides";
    pagePrintClass = "a4-print-page-4in1";
  } else if (fmt === "4in1_magenta_wave") {
    genFunc = generateMagentaWave4in1HTML;
    chunkSize = 4;
    gridClass = "a4-grid-4in1 a4-cut-guides";
    pagePrintClass = "a4-print-page-4in1";
  } else if (fmt === "4in1_eco_green") {
    genFunc = generateEcoGreen4in1HTML;
    chunkSize = 4;
    gridClass = "a4-grid-4in1 a4-cut-guides";
    pagePrintClass = "a4-print-page-4in1";
  } else if (fmt === "4in1_clean_bw") {
    genFunc = generateCleanBWNewspaper4in1HTML;
    chunkSize = 4;
    gridClass = "a4-grid-4in1 a4-cut-guides";
    pagePrintClass = "a4-print-page-4in1";
  } else if (fmt === "4in1_classic" || fmt === "format1") {
    genFunc = generateBWSlipHTML;
    chunkSize = 4;
    gridClass = "a4-grid-4in1 a4-cut-guides";
    pagePrintClass = "a4-print-page-4in1";
  } else if (fmt === "4in1_modern") {
    genFunc = generateModern4in1HTML;
    chunkSize = 4;
    gridClass = "a4-grid-4in1 a4-cut-guides";
    pagePrintClass = "a4-print-page-4in1";
  } else if (fmt === "4in1_stub") {
    genFunc = generateStub4in1HTML;
    chunkSize = 4;
    gridClass = "a4-grid-4in1 a4-cut-guides";
    pagePrintClass = "a4-print-page-4in1";
  } else if (fmt === "3in1_wide") {
    genFunc = generateStrip3in1HTML;
    chunkSize = 3;
    gridClass = "a4-grid-3in1";
    pagePrintClass = "a4-print-page-3in1";
  } else if (fmt === "3in1_stub") {
    genFunc = generateStripWithStub3in1HTML;
    chunkSize = 3;
    gridClass = "a4-grid-3in1";
    pagePrintClass = "a4-print-page-3in1";
  } else if (fmt === "2in1_detailed" || fmt === "format2") {
    genFunc = generateFormat2HTML;
    chunkSize = 2;
    gridClass = "a4-grid-2in1";
    pagePrintClass = "a4-print-page-2in1";
  } else if (fmt === "2in1_modern") {
    genFunc = generateModern2in1HTML;
    chunkSize = 2;
    gridClass = "a4-grid-2in1";
    pagePrintClass = "a4-print-page-2in1";
  } else if (fmt === "2in1_counterfoil" || fmt === "format3") {
    genFunc = generateFormat3HTML;
    chunkSize = 2;
    gridClass = "a4-grid-2in1";
    pagePrintClass = "a4-print-page-2in1";
  }

  const totalPages = Math.ceil(bills.length / chunkSize);

  const countBadge = document.getElementById("bulkPrintCountBadge");
  if (countBadge) {
    countBadge.textContent = `${bills.length} બિલ (${totalPages} A4 પેજ)`;
  }

  const container = document.getElementById("bulkPrintSheetsContainer");
  if (!container) return;

  if (bills.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-muted);">પ્રિન્ટ માટે કોઈ બિલ મળ્યા નથી.</div>`;
    return;
  }

  const firm = cachedAgency || await window.vendorDB.get("firms", "primary");

  // Build Pages
  let sheetsHtml = "";
  for (let p = 0; p < totalPages; p++) {
    const pageBills = bills.slice(p * chunkSize, (p + 1) * chunkSize);
    const cutIcon = gridClass.includes("a4-cut-guides") ? `<div class="a4-cut-center-icon">✂</div>` : "";
    const billsHtml = `
      <div class="${gridClass}">
        ${pageBills.map((b) => {
          const cust = custMap.get(b.customerId) || {};
          return genFunc(b, cust, firm, items, salesmen, collectionMen);
        }).join("")}
        ${cutIcon}
      </div>
    `;

    sheetsHtml += `
      <div class="a4-screen-sheet a4-print-page ${pagePrintClass}">
        <div style="position:absolute; top:2px; right:8px; font-size:9px; color:#64748b;" class="no-print">
          A4 પેજ #${p + 1} / ${totalPages}
        </div>
        ${billsHtml}
      </div>
    `;
  }

  container.innerHTML = sheetsHtml;
}
window.renderBulkPrintSheets = renderBulkPrintSheets;

function triggerA4Print() {
  const modal = document.getElementById("bulkPrintModal");
  if (modal) modal.classList.add("print-active-modal");
  window.print();
  setTimeout(() => {
    if (modal) modal.classList.remove("print-active-modal");
  }, 1000);
}
window.triggerA4Print = triggerA4Print;

// WhatsApp Bill Generator
async function sendWhatsAppBill(billId) {
  let bill = await window.vendorDB.get("bills", billId);
  if (!bill && !isNaN(Number(billId))) {
    bill = await window.vendorDB.get("bills", Number(billId));
  }
  if (!bill) {
    const allBills = await window.vendorDB.getAll("bills");
    bill = allBills.find(b => String(b.id) === String(billId) || String(b.billNo) === String(billId));
  }
  if (!bill) {
    showToast("બિલ મળ્યું નથી!");
    return;
  }
  const cust = (await window.vendorDB.get("customers", bill.customerId)) || {};
  const firm = cachedAgency || await window.vendorDB.get("firms", "primary") || {};
  const items = await window.vendorDB.getAll("items");
  const itemMap = new Map(items.map(i => [i.id, i.name]));

  const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
  const papers = rawSubs.map(id => itemMap.get(id)).filter(Boolean).join(", ");
  const mobile = (cust.whatsapp || cust.mobile || "").replace(/[^0-9]/g, "");

  const upiPayee = (firm.name || "PERFECT NEWSPAPER SUPPLIERS").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiLink = `upi://pay?pa=${encodeURIComponent(firm.upiId || "9825778607@okaxis")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;

  let msg = `*${firm.name || 'PERFECT NEWSPAPER SUPPLIERS'}*\n`;
  msg += `----------------------------\n`;
  msg += `📰 *ગ્રાહક માસિક બિલ (Credit Memo)*\n`;
  msg += `👤 *ગ્રાહક (Customer):* ${cust.name || bill.customerName || '-'}\n`;
  msg += `📅 *બિલ માસ (Period):* ${bill.monthYear}\n`;
  msg += `🗞️ *પેપર્સ (Papers):* ${papers}\n`;
  msg += `📦 *આવેલા દિવસો (Delivered):* ${bill.daysDelivered} દિવસ\n`;
  if (bill.vacationDays > 0) {
    msg += `🌴 *રજાના દિવસો બાદ:* ${bill.vacationDays} દિવસ (-₹${bill.vacationDeduction})\n`;
  }
  msg += `💵 *આ મહિનાનું બિલ:* ₹${bill.currentAmount}\n`;
  if (bill.pastArrears > 0) {
    msg += `⏳ *જૂની બાકી રકમ:* ₹${bill.pastArrears}\n`;
  }
  msg += `----------------------------\n`;
  msg += `💰 *કુલ ભરવાપાત્ર રકમ: ₹${bill.totalPayable}*\n`;
  msg += `----------------------------\n`;
  const origin = window.location.origin || "http://localhost:5055";
  const paperAmtVal = (bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2);
  const digitalBillUrl = `${origin}/view_bill.html?billNo=${encodeURIComponent(bill.billNo || '')}&m=${encodeURIComponent(bill.monthYear || '')}&cust=${encodeURIComponent(cust.name || bill.customerName || '')}&caddr=${encodeURIComponent(cust.address || cust.societyShort || '')}&mob=${encodeURIComponent(mobile || '')}&total=${encodeURIComponent(bill.totalPayable || 0)}&paper=${encodeURIComponent(paperAmtVal)}&arrears=${encodeURIComponent(bill.pastArrears || 0)}&del=${encodeURIComponent(bill.deliveryCharge || 0)}&days=${encodeURIComponent(bill.daysDelivered || 30)}&papers=${encodeURIComponent(papers || 'ગુજરાત સમાચાર')}&upi=${encodeURIComponent(firm.upiId || '9825778607@okaxis')}&firm=${encodeURIComponent(firm.name || 'PERFECT NEWSPAPER SUPPLIERS')}&phone=${encodeURIComponent(firm.phone || '9825778607')}&owner=${encodeURIComponent(firm.ownerName || 'NIZAM TAI')}&seq=${encodeURIComponent(bill.deliverySequence || cust.sequenceNo || '')}`;

  msg += `📸 *તમારું કલર બિલ જોવા & ઓનલાઈન ભરવા અહીં ટચ કરો:*\n`;
  msg += `${digitalBillUrl}\n\n`;
  msg += `📲 *GPay / PhonePe / Paytm થી ચૂકવવા લિંક ટચ કરો:*\n`;
  msg += `${upiLink}\n\n`;
  msg += `UPI ID: *${firm.upiId || '9825778607@okaxis'}*\n`;
  msg += `_સમયસર બિલ ચૂકવી સહકાર આપવા વિનંતી • આભાર!_\n`;
  msg += `📞 હેલ્પલાઇન: ${firm.phone || '9825778607'}`;

  const encoded = encodeURIComponent(msg);
  const cleanMobile = mobile.slice(-10);
  const waUrl = cleanMobile ? `https://web.whatsapp.com/send?phone=91${cleanMobile}&text=${encoded}` : `https://web.whatsapp.com/send?text=${encoded}`;
  window.open(waUrl, "whatsapp_web_window");
}
window.sendWhatsAppBill = sendWhatsAppBill;

// -------------------------------------------------------------
// 6.5 MID-MONTH PAPER SWITCH CONTROLLER
// -------------------------------------------------------------
async function openSwitchPaperModal(customerId) {
  const cust = await window.vendorDB.get("customers", customerId);
  if (!cust) return;

  const items = await window.vendorDB.getAll("items");
  const itemMap = new Map(items.map(i => [i.id, i]));

  document.getElementById("switchCustId").value = cust.id;
  document.getElementById("switchCustNameDisplay").textContent = `${cust.name} (સિક્વન્સ: ${cust.sequenceNo || '-'})`;

  // Default effective date to today or next day
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  document.getElementById("switchEffectiveDate").value = todayStr;

  // Populate Old Paper dropdown with customer's active papers
  const oldSelect = document.getElementById("switchOldPaper");
  oldSelect.innerHTML = `<option value="">-- જૂનું પેપર પસંદ કરો --</option>`;
  
  const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : [];
  rawSubs.forEach(id => {
    const item = itemMap.get(id);
    if (item) {
      oldSelect.innerHTML += `<option value="${item.id}">🔴 ${item.name} (${item.code})</option>`;
    }
  });
  oldSelect.innerHTML += `<option value="none">➕ (કોઈ પેપર બંધ નથી કરવું - માત્ર નવું ઉમેરવું છે)</option>`;

  if (rawSubs.length > 0) {
    oldSelect.value = rawSubs[0];
  }

  // Populate New Paper dropdown with all active items
  const newSelect = document.getElementById("switchNewPaper");
  newSelect.innerHTML = `<option value="">-- નવું પેપર પસંદ કરો --</option>`;
  items.filter(i => i.status !== "inactive").forEach(item => {
    newSelect.innerHTML += `<option value="${item.id}">🟢 ${item.name} (${item.code})</option>`;
  });
  newSelect.innerHTML += `<option value="none">🛑 (કોઈ નવું પેપર નથી લેવું - માત્ર જૂનું પેપર બંધ કરવું છે)</option>`;

  // Reset day checkboxes
  ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].forEach(d => {
    const cb = document.getElementById(`sw_day_${d}`);
    if (cb) cb.checked = true;
  });

  await updateSwitchSummary();
  openModal("switchPaperModal");
}
window.openSwitchPaperModal = openSwitchPaperModal;

function openSwitchPaperFromCustomerModal() {
  const custId = document.getElementById("custFormId")?.value;
  if (!custId) return;
  closeModal("customerModal");
  openSwitchPaperModal(parseInt(custId));
}
window.openSwitchPaperFromCustomerModal = openSwitchPaperFromCustomerModal;

async function updateSwitchSummary() {
  const effDate = document.getElementById("switchEffectiveDate")?.value;
  const oldPaperId = document.getElementById("switchOldPaper")?.value;
  const newPaperId = document.getElementById("switchNewPaper")?.value;
  const summaryEl = document.getElementById("switchLiveSummary");
  if (!summaryEl) return;

  if (!effDate) {
    summaryEl.innerHTML = `⚠️ કૃપા કરીને તારીખ પસંદ કરો.`;
    return;
  }

  const effObj = new Date(effDate + "T12:00:00");
  effObj.setDate(effObj.getDate() - 1);
  const prevDateStr = effObj.toISOString().split("T")[0];

  const items = await window.vendorDB.getAll("items");
  const itemMap = new Map(items.map(i => [String(i.id), i.name]));

  let text = "";
  if (oldPaperId && oldPaperId !== "none") {
    const oldName = itemMap.get(String(oldPaperId)) || "જૂનું પેપર";
    text += `<div>• <b>${oldName}</b> તારીખ <b>${prevDateStr}</b> સુધી જ ગણાશે (તેના પછી બંધ થશે).</div>`;
  }
  if (newPaperId && newPaperId !== "none") {
    const newName = itemMap.get(String(newPaperId)) || "નવું પેપર";
    text += `<div>• <b>${newName}</b> તારીખ <b>${effDate}</b> થી શરૂ થશે.</div>`;
  }
  if (!text) {
    text = `પેપર પસંદ કરો જેથી વિગત દેખાય.`;
  } else {
    text += `<div style="margin-top:4px; color:var(--accent-cyan);">💡 માસિક બિલિંગ અને રોજીંદી સવારની હોકર શીટ આ તારીખ મુજબ આપમેળે વિભાજિત થશે.</div>`;
  }
  summaryEl.innerHTML = text;
}
window.updateSwitchSummary = updateSwitchSummary;

async function saveSwitchPaper(e) {
  e.preventDefault();
  const custId = parseInt(document.getElementById("switchCustId").value);
  const effDate = document.getElementById("switchEffectiveDate").value;
  const oldPaperId = document.getElementById("switchOldPaper").value;
  const newPaperId = document.getElementById("switchNewPaper").value;

  if (!oldPaperId && !newPaperId) {
    alert("કૃપા કરીને જૂનું અથવા નવું પેપર પસંદ કરો.");
    return;
  }

  if (oldPaperId === "none" && newPaperId === "none") {
    alert("કૃપા કરીને માન્ય ફેરફાર પસંદ કરો.");
    return;
  }

  const cust = await window.vendorDB.get("customers", custId);
  if (!cust) return;

  const effObj = new Date(effDate + "T12:00:00");
  effObj.setDate(effObj.getDate() - 1);
  const prevDateStr = effObj.toISOString().split("T")[0];

  if (!cust.subscriptions || typeof cust.subscriptions !== "object" || Array.isArray(cust.subscriptions)) {
    const newObj = {};
    const oldArr = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : [];
    oldArr.forEach(id => {
      newObj[id] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    });
    cust.subscriptions = newObj;
  }

  // 1. Handle Old Paper (Set end date to previous day)
  if (oldPaperId && oldPaperId !== "none") {
    const existing = cust.subscriptions[oldPaperId] ?? cust.subscriptions[String(oldPaperId)];
    const existingDays = Array.isArray(existing) ? existing : (existing?.days || ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
    cust.subscriptions[oldPaperId] = {
      days: existingDays,
      startDate: (existing && existing.startDate) || null,
      endDate: prevDateStr
    };
  }

  // 2. Handle New Paper (Set start date to effective date)
  if (newPaperId && newPaperId !== "none") {
    const selectedDays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].filter(d => {
      return document.getElementById(`sw_day_${d}`)?.checked;
    });
    cust.subscriptions[newPaperId] = {
      days: selectedDays.length > 0 ? selectedDays : ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
      startDate: effDate,
      endDate: null
    };
  }

  await window.vendorDB.put("customers", cust);
  closeModal("switchPaperModal");
  showToast("સફળતાપૂર્વક પેપર બદલાઈ ગયું!");
  await refreshAllViews();
}
window.saveSwitchPaper = saveSwitchPaper;

// -------------------------------------------------------------
// 7. PAYMENTS CONTROLLER
// -------------------------------------------------------------
async function renderPaymentsView() {
  const payments = await window.vendorDB.getAll("payments");
  const customers = await window.vendorDB.getAll("customers");
  const custMap = new Map(customers.map(c => [c.id, c.name]));

  const tbody = document.getElementById("paymentsTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-dim); padding:2rem;">કોઈ પાવતી નોંધાયેલ નથી (No payment receipts yet)</td></tr>`;
    return;
  }

  payments.sort((a, b) => (b.id || 0) - (a.id || 0));

  payments.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge badge-emerald">${p.receiptNo}</span></td>
      <td>${p.date}</td>
      <td style="font-weight:600;">${custMap.get(p.customerId) || "Customer"}</td>
      <td style="font-weight:700; color:var(--accent-emerald);">₹${p.amount}</td>
      <td><span class="badge badge-blue">${p.mode.toUpperCase()}</span></td>
      <td style="color:var(--text-dim);">${p.referenceNo || "-"}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="alert('Receipt: ' + '${p.receiptNo}')">🖨️ પાવતી</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

let cachedPaymentCustomers = [];
let cachedPaymentBills = [];

async function openPaymentModal(customerId = null) {
  cachedPaymentCustomers = await window.vendorDB.getAll("customers") || [];
  cachedPaymentBills = await window.vendorDB.getAll("bills") || [];

  const searchInput = document.getElementById("payFormCustSearch");
  if (searchInput) searchInput.value = "";
  const dropdown = document.getElementById("payFormSearchDropdown");
  if (dropdown) {
    dropdown.innerHTML = "";
    dropdown.style.display = "none";
  }
  const clearBtn = document.getElementById("payFormSearchClear");
  if (clearBtn) clearBtn.style.display = "none";

  const dateEl = document.getElementById("payFormDate");
  if (dateEl && !dateEl.value) {
    dateEl.value = new Date().toISOString().split("T")[0];
  }

  populatePaymentCustomerSelect(customerId);
  openModal("paymentModal");
}

function populatePaymentCustomerSelect(selectedId = null) {
  const custSelect = document.getElementById("payFormCustomer");
  if (!custSelect) return;
  custSelect.innerHTML = "";

  if (cachedPaymentCustomers.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "-- કોઈ ગ્રાહક મળ્યા નથી --";
    custSelect.appendChild(opt);
    return;
  }

  const sorted = [...cachedPaymentCustomers].sort((a, b) => (Number(b.currentBalance) || 0) - (Number(a.currentBalance) || 0));

  sorted.forEach((c, idx) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    const soc = c.societyShort ? ` [${c.societyShort}]` : '';
    opt.textContent = `${c.name}${soc} (બાકી: ₹${c.currentBalance || 0})`;
    if (selectedId && (c.id === selectedId || c.custNo === selectedId)) {
      opt.selected = true;
    } else if (!selectedId && idx === 0) {
      opt.selected = true;
    }
    custSelect.appendChild(opt);
  });

  onPaymentCustomerChanged();
}

function onPaymentSearchInput(query) {
  const q = (query || "").trim().toLowerCase();
  const dropdown = document.getElementById("payFormSearchDropdown");
  const clearBtn = document.getElementById("payFormSearchClear");
  if (clearBtn) clearBtn.style.display = q ? "block" : "none";

  if (!dropdown) return;

  if (!q) {
    dropdown.innerHTML = "";
    dropdown.style.display = "none";
    return;
  }

  const qDigits = q.replace(/\D/g, "");

  const custBillsMap = new Map();
  cachedPaymentBills.forEach(b => {
    if (!custBillsMap.has(b.customerId)) custBillsMap.set(b.customerId, []);
    custBillsMap.get(b.customerId).push(b);
  });

  const matches = [];

  cachedPaymentCustomers.forEach(c => {
    let matchedReason = "";
    let matchedBillNo = "";
    let billAmount = null;

    // 1. Check bills belonging to customer (Tolerance for typing digits only without prefix e.g. 1001 for PNS-1001)
    const cBills = custBillsMap.get(c.id) || [];
    for (const b of cBills) {
      const bNo = String(b.billNo || "").toLowerCase();
      const bDigits = bNo.replace(/\D/g, "");

      if (bNo.includes(q) || (qDigits && bDigits.includes(qDigits))) {
        matchedReason = `બિલ નં. #${b.billNo}`;
        matchedBillNo = b.billNo;
        billAmount = b.totalPayable || b.currentAmount;
        break;
      }
    }

    // 2. Check customer code / customerNo / id
    if (!matchedReason) {
      const cCode = String(c.code || c.custNo || c.id || "").toLowerCase();
      const cDigits = cCode.replace(/\D/g, "");
      if (cCode.includes(q) || (qDigits && cDigits.includes(qDigits))) {
        matchedReason = `ગ્રાહક નં. #${c.code || c.custNo || c.id}`;
      }
    }

    // 3. Check customer name
    if (!matchedReason && (c.name || "").toLowerCase().includes(q)) {
      matchedReason = `નામ`;
    }

    // 4. Check mobile number
    if (!matchedReason && (c.mobile || "").includes(q)) {
      matchedReason = `મોબાઈલ: ${c.mobile}`;
    }

    // 5. Check address / society
    if (!matchedReason && ((c.societyShort || "").toLowerCase().includes(q) || (c.address || "").toLowerCase().includes(q))) {
      matchedReason = `વિસ્તાર: ${c.societyShort || c.address}`;
    }

    if (matchedReason) {
      matches.push({
        customer: c,
        matchedReason,
        matchedBillNo,
        billAmount: billAmount !== null ? billAmount : (c.currentBalance || 0)
      });
    }
  });

  if (matches.length === 0) {
    dropdown.innerHTML = `<div style="padding:10px 14px; color:var(--text-dim); font-size:0.85rem; text-align:center;">કોઈ પરિણામ મળ્યું નથી (No match for "${query}")</div>`;
    dropdown.style.display = "block";
    return;
  }

  dropdown.innerHTML = "";
  matches.slice(0, 10).forEach(m => {
    const c = m.customer;
    const itemEl = document.createElement("div");
    itemEl.style.cssText = "padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--border-color, #334155); display:flex; justify-content:space-between; align-items:center; transition:background 0.15s ease;";
    itemEl.onmouseover = () => itemEl.style.background = "rgba(14, 165, 233, 0.18)";
    itemEl.onmouseout = () => itemEl.style.background = "transparent";

    itemEl.innerHTML = `
      <div>
        <div style="font-weight:700; font-size:0.9rem; color:#f8fafc;">
          ${c.name} <span style="font-weight:normal; font-size:0.78rem; color:var(--accent-cyan);">(${m.matchedReason})</span>
        </div>
        <div style="font-size:0.78rem; color:var(--text-dim);">
          ${c.societyShort ? `📍 ${c.societyShort} • ` : ''}${c.mobile ? `📞 ${c.mobile}` : ''} ${m.matchedBillNo ? `• 📄 બિલ: ${m.matchedBillNo}` : ''}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:800; font-size:0.95rem; color:#34d399;">₹${c.currentBalance || 0}</div>
        <div style="font-size:0.72rem; color:var(--text-dim);">બાકી રકમ</div>
      </div>
    `;

    itemEl.onclick = () => {
      selectPaymentCustomer(c.id, m.billAmount);
    };

    dropdown.appendChild(itemEl);
  });

  dropdown.style.display = "block";

  if (matches.length === 1) {
    const custSelect = document.getElementById("payFormCustomer");
    if (custSelect) {
      custSelect.value = matches[0].customer.id;
      const amt = matches[0].billAmount || matches[0].customer.currentBalance || 0;
      document.getElementById("payFormAmount").value = amt;
    }
  }
}

function selectPaymentCustomer(customerId, billAmount = null) {
  const cust = cachedPaymentCustomers.find(c => c.id === customerId);
  const custSelect = document.getElementById("payFormCustomer");
  if (custSelect && cust) {
    custSelect.value = cust.id;
    const amountEl = document.getElementById("payFormAmount");
    if (amountEl) {
      amountEl.value = (billAmount !== null && billAmount > 0) ? billAmount : (cust.currentBalance || 0);
    }
  }

  const searchInput = document.getElementById("payFormCustSearch");
  if (searchInput && cust) {
    searchInput.value = `${cust.name} (#${cust.code || cust.id})`;
  }

  const dropdown = document.getElementById("payFormSearchDropdown");
  if (dropdown) {
    dropdown.innerHTML = "";
    dropdown.style.display = "none";
  }

  const clearBtn = document.getElementById("payFormSearchClear");
  if (clearBtn) clearBtn.style.display = "block";
}

function clearPaymentSearch() {
  const searchInput = document.getElementById("payFormCustSearch");
  if (searchInput) searchInput.value = "";
  const dropdown = document.getElementById("payFormSearchDropdown");
  if (dropdown) {
    dropdown.innerHTML = "";
    dropdown.style.display = "none";
  }
  const clearBtn = document.getElementById("payFormSearchClear");
  if (clearBtn) clearBtn.style.display = "none";
}

function openPaymentModalForCustomer(customerId) {
  openPaymentModal(customerId);
}

async function onPaymentCustomerChanged() {
  const custId = parseInt(document.getElementById("payFormCustomer")?.value);
  if (custId) {
    const cust = await window.vendorDB.get("customers", custId);
    if (cust) {
      document.getElementById("payFormAmount").value = cust.currentBalance || 0;
    }
  }
}

async function submitPaymentForm(action = 'save') {
  const custIdVal = document.getElementById("payFormCustomer")?.value;
  if (!custIdVal) {
    alert("કૃપા કરીને ગ્રાહક પસંદ કરો.");
    return;
  }
  const customerId = parseInt(custIdVal);
  const amount = parseFloat(document.getElementById("payFormAmount")?.value);
  if (isNaN(amount) || amount <= 0) {
    alert("કૃપા કરીને માન્ય મળેલ રકમ દાખલ કરો.");
    return;
  }
  const mode = document.getElementById("payFormMode")?.value || "cash";
  const date = document.getElementById("payFormDate")?.value || new Date().toISOString().split("T")[0];
  const referenceNo = (document.getElementById("payFormRef")?.value || "").trim();

  const cust = await window.vendorDB.get("customers", customerId);
  const firm = cachedAgency || await window.vendorDB.get("firms", "primary") || {};

  const rec = await window.vendorDB.recordPayment({
    customerId,
    amount,
    mode,
    date,
    referenceNo
  });

  const updatedCust = await window.vendorDB.get("customers", customerId);
  const newBalance = updatedCust ? (updatedCust.currentBalance || 0) : 0;

  closeModal("paymentModal");
  showToast(t("paymentSuccess") || "નાણાં સફળતાપૂર્વક જમા થયા!");
  await refreshAllViews();

  if (action === 'save_and_whatsapp') {
    if (cust && cust.mobile) {
      const modeTexts = {
        cash: "💵 રોકડ (Cash)",
        upi: "📱 UPI / ઓનલાઇન",
        cheque: "📝 ચેક (Cheque)"
      };
      const modeText = modeTexts[mode] || mode;
      const refText = referenceNo ? `🔖 *રેફરન્સ:* ${referenceNo}\n` : '';
      const recNo = rec?.receiptNo || 'REC-' + Date.now().toString().slice(-4);

      const msg = `*💐 ${firm.name || 'ન્યૂઝપેપર એજન્સી'} 💐*\n` +
        `*નાણાં મળ્યાની પાવતી (Payment Receipt)*\n` +
        `-----------------------------------------\n` +
        `📄 *પાવતી નં:* ${recNo}\n` +
        `👤 *ગ્રાહક:* ${cust.name} ${cust.code ? `(#${cust.code})` : ''}\n` +
        `📅 *તારીખ:* ${formatDisplayDate(date)}\n` +
        `💵 *જમા મળેલ રકમ:* ₹${amount}\n` +
        `💳 *ચુકવણી પ્રકાર:* ${modeText}\n` +
        refText +
        `📊 *હવે કુલ બાકી રકમ:* ₹${newBalance}\n` +
        `-----------------------------------------\n` +
        `🙏 *સમયસર બિલ ચૂકવણી બદલ આપનો ખૂબ ખૂબ આભાર!*\n` +
        (firm.phone ? `📞 સંપર્ક: ${firm.phone}` : '');

      const cleanMobile = cust.mobile.replace(/\D/g, '').slice(-10);
      const waUrl = `https://wa.me/91${cleanMobile}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
    } else {
      alert("ગ્રાહકનો મોબાઈલ નંબર ઉપલબ્ધ નથી, તેથી WhatsApp મોકલી શકાયું નથી.");
    }
  }
}

async function savePaymentData(e) {
  if (e && e.preventDefault) e.preventDefault();
  await submitPaymentForm('save');
}

window.openPaymentModal = openPaymentModal;
window.populatePaymentCustomerSelect = populatePaymentCustomerSelect;
window.onPaymentSearchInput = onPaymentSearchInput;
window.selectPaymentCustomer = selectPaymentCustomer;
window.clearPaymentSearch = clearPaymentSearch;
window.openPaymentModalForCustomer = openPaymentModalForCustomer;
window.onPaymentCustomerChanged = onPaymentCustomerChanged;
window.submitPaymentForm = submitPaymentForm;
window.savePaymentData = savePaymentData;

// -------------------------------------------------------------
// 8. ITEM MASTER CONTROLLER (DAY-WISE RATES & EDIT)
// -------------------------------------------------------------
async function renderItemsView() {
  const items = await window.vendorDB.getAll("items");
  const tbody = document.getElementById("itemsTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  items.forEach(i => {
    const tr = document.createElement("tr");
    const dRates = i.dayRates || {};
    const monSale = dRates.mon?.sale || i.defaultRate || 5.0;
    const monPur = dRates.mon?.purchase || Number((monSale * 0.7).toFixed(2));
    const sunSale = dRates.sun?.sale || i.sundayRate || monSale;
    const sunPur = dRates.sun?.purchase || Number((sunSale * 0.7).toFixed(2));

    const tueSale = dRates.tue?.sale || monSale;
    const tuePur = dRates.tue?.purchase || monPur;
    const wedSale = dRates.wed?.sale || monSale;
    const wedPur = dRates.wed?.purchase || monPur;
    const thuSale = dRates.thu?.sale || monSale;
    const thuPur = dRates.thu?.purchase || monPur;
    const friSale = dRates.fri?.sale || monSale;
    const friPur = dRates.fri?.purchase || monPur;
    const satSale = dRates.sat?.sale || monSale;
    const satPur = dRates.sat?.purchase || monPur;

    const weeklyRates = `
      <div style="font-size:0.75rem; line-height:1.6;">
        <div style="color:var(--text-muted); margin-bottom:2px; font-weight:600;">વેચાણ (ખરીદ)</div>
        <div>
          સોમ: <span style="color:#38bdf8;">${monSale}</span> <span style="color:#fb7185;">(${monPur})</span> | 
          મંગળ: <span style="color:#38bdf8;">${tueSale}</span> <span style="color:#fb7185;">(${tuePur})</span> | 
          બુધ: <span style="color:#38bdf8;">${wedSale}</span> <span style="color:#fb7185;">(${wedPur})</span> | 
          ગુરુ: <span style="color:#38bdf8;">${thuSale}</span> <span style="color:#fb7185;">(${thuPur})</span>
        </div>
        <div style="margin-top:2px;">
          શુક્ર: <span style="color:#38bdf8;">${friSale}</span> <span style="color:#fb7185;">(${friPur})</span> | 
          શનિ: <span style="color:#38bdf8;">${satSale}</span> <span style="color:#fb7185;">(${satPur})</span> | 
          રવિ: <span style="color:#38bdf8; font-weight:700;">${sunSale}</span> <span style="color:#fb7185;">(${sunPur})</span>
        </div>
      </div>
    `;

    const isItemActive = (i.status !== "inactive");
    const statusBadge = isItemActive
      ? `<span class="badge badge-emerald" style="cursor:pointer;" onclick="toggleItemStatus(${i.id})" title="ક્લિક કરી બંધ કરો">🟢 ચાલુ</span>`
      : `<span class="badge badge-rose" style="cursor:pointer;" onclick="toggleItemStatus(${i.id})" title="ક્લિક કરી ચાલુ કરો">🔴 બંધ</span>`;

    const hasRateHistory = (i.rateHistory && i.rateHistory.length > 0);
    const historyBadge = hasRateHistory
      ? `<div style="margin-top:3px;"><span class="badge badge-cyan" style="font-size:0.68rem;" title="મહિનાની અધવચ્ચેથી ભાવ સુધારા">🔄 ${i.rateHistory.length} ભાવ સુધારા (${i.rateHistory[i.rateHistory.length - 1].effectiveDate} થી)</span></div>`
      : "";

    tr.innerHTML = `
      <td><span class="badge badge-blue">${i.code}</span></td>
      <td style="font-weight:600;">${i.name} ${historyBadge}</td>
      <td><span class="badge badge-amber">${i.type}</span></td>
      <td>${weeklyRates}</td>
      <td>₹${i.monthlyRate || 0}</td>
      <td>${statusBadge}</td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-secondary btn-icon" onclick="editItem(${i.id})" title="ભાવ બદલો (Edit Rates)">✏️</button>
          <button class="btn btn-danger btn-icon" onclick="deleteItem(${i.id})">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function toggleItemStatus(id) {
  const item = await window.vendorDB.get("items", id);
  if (!item) return;
  const isNowActive = item.status === "inactive";
  item.status = isNowActive ? "active" : "inactive";
  await window.vendorDB.put("items", item);
  showToast(`પેપર "${item.name}" હવે ${isNowActive ? 'સક્રિય (Active)' : 'બંધ (Inactive)'} છે`);
  await refreshAllViews();
}
window.toggleItemStatus = toggleItemStatus;

async function openItemModal(id = null) {
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  if (document.getElementById("itemFormEffectiveDate")) {
    document.getElementById("itemFormEffectiveDate").value = "";
  }
  if (id) {
    const item = await window.vendorDB.get("items", id);
    if (item) {
      document.getElementById("itemFormId").value = item.id;
      document.getElementById("itemFormCode").value = item.code;
      document.getElementById("itemFormName").value = item.name;
      document.getElementById("itemFormType").value = item.type;
      document.getElementById("itemFormMonthlyRate").value = item.monthlyRate || 0;
      if (document.getElementById("itemFormStatus")) {
        document.getElementById("itemFormStatus").value = item.status || "active";
      }

      const dRates = item.dayRates || {};
      days.forEach(d => {
        const saleEl = document.getElementById(`rate_sale_${d}`);
        const purEl = document.getElementById(`rate_pur_${d}`);
        const defSale = (d === "sun" ? (item.sundayRate || item.defaultRate || 6.0) : (item.defaultRate || 5.0));
        const defPur = Number((defSale * 0.7).toFixed(2));
        if (saleEl) saleEl.value = (dRates[d]?.sale !== undefined && dRates[d]?.sale !== null) ? dRates[d].sale : defSale;
        if (purEl) purEl.value = (dRates[d]?.purchase !== undefined && dRates[d]?.purchase !== null) ? dRates[d].purchase : defPur;
      });
      document.getElementById("itemModalTitle").textContent = t("editItem");
    }
  } else {
    document.getElementById("itemFormId").value = "";
    document.getElementById("itemForm").reset();
    if (document.getElementById("itemFormStatus")) {
      document.getElementById("itemFormStatus").value = "active";
    }
    days.forEach(d => {
      const saleEl = document.getElementById(`rate_sale_${d}`);
      const purEl = document.getElementById(`rate_pur_${d}`);
      const defSale = (d === "sun" ? 6.0 : 5.0);
      const defPur = (d === "sun" ? 3.99 : 3.32);
      if (saleEl) saleEl.value = defSale;
      if (purEl) purEl.value = defPur;
    });
    document.getElementById("itemFormMonthlyRate").value = 0;
    document.getElementById("itemModalTitle").textContent = t("addItem");
  }
  openModal("itemModal");
}

function copyMondayRatesToAllDays() {
  const monSale = parseFloat(document.getElementById("rate_sale_mon")?.value) || 5.0;
  const monPur = parseFloat(document.getElementById("rate_pur_mon")?.value) || 3.35;
  const days = ["tue", "wed", "thu", "fri", "sat"];
  days.forEach(d => {
    const saleEl = document.getElementById(`rate_sale_${d}`);
    const purEl = document.getElementById(`rate_pur_${d}`);
    if (saleEl) saleEl.value = monSale;
    if (purEl) purEl.value = monPur;
  });
  showToast("સોમવારના ભાવ શનિવાર સુધી કોપી થઈ ગયા!");
}
window.copyMondayRatesToAllDays = copyMondayRatesToAllDays;

function editItem(id) {
  openItemModal(id);
}

async function saveItemData(e) {
  e.preventDefault();
  const idVal = document.getElementById("itemFormId").value;
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const dayRates = {};
  days.forEach(d => {
    const sVal = parseFloat(document.getElementById(`rate_sale_${d}`)?.value) || 5.0;
    const pVal = parseFloat(document.getElementById(`rate_pur_${d}`)?.value) || Number((sVal * 0.7).toFixed(2));
    dayRates[d] = { sale: sVal, purchase: pVal };
  });

  let rateHistory = [];
  if (idVal) {
    const existing = await window.vendorDB.get("items", parseInt(idVal));
    if (existing && Array.isArray(existing.rateHistory)) {
      rateHistory = [...existing.rateHistory];
    }
    const effDate = document.getElementById("itemFormEffectiveDate")?.value;
    if (effDate) {
      rateHistory = rateHistory.filter(h => h.effectiveDate !== effDate);
      rateHistory.push({
        effectiveDate: effDate,
        dayRates: dayRates,
        defaultRate: dayRates.mon.sale,
        sundayRate: dayRates.sun.sale,
        monthlyRate: parseFloat(document.getElementById("itemFormMonthlyRate").value) || 0
      });
      rateHistory.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    }
  }

  const itemData = {
    code: document.getElementById("itemFormCode").value.trim().toUpperCase(),
    name: document.getElementById("itemFormName").value.trim(),
    type: document.getElementById("itemFormType").value,
    defaultRate: dayRates.mon.sale,
    sundayRate: dayRates.sun.sale,
    monthlyRate: parseFloat(document.getElementById("itemFormMonthlyRate").value) || 0,
    status: document.getElementById("itemFormStatus")?.value || "active",
    dayRates,
    rateHistory
  };

  if (idVal) itemData.id = parseInt(idVal);

  await window.vendorDB.put("items", itemData);
  closeModal("itemModal");
  showToast(t("saveSuccess"));
  await refreshAllViews();
}

async function deleteItem(id) {
  if (confirm(t("confirmDelete"))) {
    await window.vendorDB.delete("items", id);
    showToast(t("deleteSuccess"));
    await refreshAllViews();
  }
}
window.openItemModal = openItemModal;
window.saveItemData = saveItemData;
window.editItem = editItem;
window.deleteItem = deleteItem;

// -------------------------------------------------------------
// 9. ROUTES & STAFF (SALESMEN & COLLECTION MEN) CONTROLLER
// -------------------------------------------------------------
let currentRouteStaffSubTab = "routes";

function switchRouteStaffSubTab(tab) {
  currentRouteStaffSubTab = tab;

  // Toggle Sub-tab buttons
  const btnRoutes = document.getElementById("subtabBtnRoutes");
  const btnSalesmen = document.getElementById("subtabBtnSalesmen");
  const btnColl = document.getElementById("subtabBtnCollectionMen");

  if (btnRoutes) btnRoutes.className = (tab === 'routes') ? "btn btn-sm btn-primary" : "btn btn-sm btn-secondary";
  if (btnSalesmen) btnSalesmen.className = (tab === 'salesmen') ? "btn btn-sm btn-primary" : "btn btn-sm btn-secondary";
  if (btnColl) btnColl.className = (tab === 'collectionMen') ? "btn btn-sm btn-primary" : "btn btn-sm btn-secondary";

  // Toggle Containers
  const contentRoutes = document.getElementById("subtabContentRoutes");
  const contentSalesmen = document.getElementById("subtabContentSalesmen");
  const contentColl = document.getElementById("subtabContentCollectionMen");

  if (contentRoutes) contentRoutes.style.display = (tab === 'routes') ? "block" : "none";
  if (contentSalesmen) contentSalesmen.style.display = (tab === 'salesmen') ? "block" : "none";
  if (contentColl) contentColl.style.display = (tab === 'collectionMen') ? "block" : "none";

  // Toggle Header Action Buttons
  const btnAddRoute = document.getElementById("btnAddNewRoute");
  const btnAddSalesman = document.getElementById("btnAddNewSalesman");
  const btnAddColl = document.getElementById("btnAddNewCollMan");

  if (btnAddRoute) btnAddRoute.style.display = (tab === 'routes') ? "inline-flex" : "none";
  if (btnAddSalesman) btnAddSalesman.style.display = (tab === 'salesmen') ? "inline-flex" : "none";
  if (btnAddColl) btnAddColl.style.display = (tab === 'collectionMen') ? "inline-flex" : "none";
}
window.switchRouteStaffSubTab = switchRouteStaffSubTab;

async function renderRoutesView() {
  const routes = await window.vendorDB.getAll("routes");
  const salesmen = await window.vendorDB.getAll("salesmen");
  const collectionMen = await window.vendorDB.getAll("collectionMen");
  const customers = await window.vendorDB.getAll("customers");

  const smMap = new Map(salesmen.map(s => [s.id, s]));
  const cmMap = new Map(collectionMen.map(c => [c.id, c]));

  const custCountMap = {};
  customers.forEach(c => {
    custCountMap[c.routeId] = (custCountMap[c.routeId] || 0) + 1;
  });

  // 1. Populate Routes Table
  const routesTbody = document.getElementById("routesTbody");
  if (routesTbody) {
    routesTbody.innerHTML = "";
    if (routes.length === 0) {
      routesTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:2rem;">કોઈ ડિલિવરી લાઇન ઉમેરેલ નથી.</td></tr>`;
    } else {
      routes.forEach(r => {
        const sm = smMap.get(r.salesmanId);
        const cm = cmMap.get(r.collectionManId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><span class="badge badge-amber">${r.code}</span></td>
          <td style="font-weight:600;">${r.name}</td>
          <td>${sm ? `🛵 <b>${sm.name}</b> <span style="font-size:0.8rem; color:var(--text-dim);">(📞 ${sm.mobile || "-"})</span>` : `<span style="color:var(--text-dim);">નિયુક્ત નથી</span>`}</td>
          <td>${cm ? `💼 <b>${cm.name}</b> <span style="font-size:0.8rem; color:var(--text-dim);">(📞 ${cm.mobile || "-"})</span>` : `<span style="color:var(--text-dim);">નિયુક્ત નથી</span>`}</td>
          <td><span class="badge badge-blue">${custCountMap[r.id] || 0} ગ્રાહકો</span></td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary btn-icon" onclick="openRouteModal(${r.id})" title="ફેરફાર કરો (Edit)">✏️</button>
              <button class="btn btn-danger btn-icon" onclick="deleteRoute(${r.id})" title="હટાવો (Delete)">🗑️</button>
            </div>
          </td>
        `;
        routesTbody.appendChild(tr);
      });
    }
  }

  // 2. Populate Salesmen Table
  const salesmenTbody = document.getElementById("salesmenTbody");
  if (salesmenTbody) {
    salesmenTbody.innerHTML = "";
    if (salesmen.length === 0) {
      salesmenTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:2rem;">કોઈ વિતરક (Salesman) ઉમેરેલ નથી.</td></tr>`;
    } else {
      salesmen.forEach(s => {
        const assignedRoutes = routes.filter(r => r.salesmanId === s.id).map(r => r.name).join(", ") || "-";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-weight:600; color:var(--accent-cyan);">🛵 ${s.name}</td>
          <td>${s.mobile ? `📞 ${s.mobile}` : "-"}</td>
          <td><span class="badge badge-blue">${assignedRoutes}</span></td>
          <td>${s.commission ? `₹${s.commission}` : "-"}</td>
          <td style="font-size:0.85rem; color:var(--text-dim);">${s.notes || "-"}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary btn-icon" onclick="openSalesmanModal(${s.id})" title="ફેરફાર કરો">✏️</button>
              <button class="btn btn-danger btn-icon" onclick="deleteSalesman(${s.id})" title="હટાવો">🗑️</button>
            </div>
          </td>
        `;
        salesmenTbody.appendChild(tr);
      });
    }
  }

  // 3. Populate Collection Men Table
  const collectionMenTbody = document.getElementById("collectionMenTbody");
  if (collectionMenTbody) {
    collectionMenTbody.innerHTML = "";
    if (collectionMen.length === 0) {
      collectionMenTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:2rem;">કોઈ ઉઘરાણી સ્ટાફ ઉમેરેલ નથી.</td></tr>`;
    } else {
      collectionMen.forEach(cm => {
        const assignedRoutes = routes.filter(r => r.collectionManId === cm.id).map(r => r.name).join(", ") || "-";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-weight:600; color:var(--accent-emerald);">💼 ${cm.name}</td>
          <td>${cm.mobile ? `📞 ${cm.mobile}` : "-"}</td>
          <td><span class="badge badge-emerald">${assignedRoutes}</span></td>
          <td>${cm.commission ? `${cm.commission}%` : "-"}</td>
          <td style="font-size:0.85rem; color:var(--text-dim);">${cm.notes || "-"}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary btn-icon" onclick="openCollectionManModal(${cm.id})" title="ફેરફાર કરો">✏️</button>
              <button class="btn btn-danger btn-icon" onclick="deleteCollectionMan(${cm.id})" title="હટાવો">🗑️</button>
            </div>
          </td>
        `;
        collectionMenTbody.appendChild(tr);
      });
    }
  }
}

// --- ROUTE MODAL CRUD ---
async function openRouteModal(id = null) {
  try {
    const salesmen = (await window.vendorDB.getAll("salesmen")) || [];
    const collectionMen = (await window.vendorDB.getAll("collectionMen")) || [];

    // Populate Salesman Select
    const smSelect = document.getElementById("routeFormSalesman");
    if (smSelect) {
      smSelect.innerHTML = `<option value="">-- વિતરક પસંદ કરો --</option>`;
      salesmen.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.mobile || '-'})`;
        smSelect.appendChild(opt);
      });
    }

    // Populate Collection Man Select
    const cmSelect = document.getElementById("routeFormCollectionMan");
    if (cmSelect) {
      cmSelect.innerHTML = `<option value="">-- કલેક્શન મેન પસંદ કરો --</option>`;
      collectionMen.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.mobile || '-'})`;
        cmSelect.appendChild(opt);
      });
    }

    if (id !== null && id !== undefined && id !== "") {
      const routeId = parseInt(id, 10) || id;
      const route = await window.vendorDB.get("routes", routeId);
      if (route) {
        document.getElementById("routeFormId").value = route.id;
        document.getElementById("routeFormCode").value = route.code || "";
        document.getElementById("routeFormName").value = route.name || "";
        if (smSelect) smSelect.value = route.salesmanId || "";
        if (cmSelect) cmSelect.value = route.collectionManId || "";
        document.getElementById("routeModalTitle").textContent = "લાઇનમાં સુધારો કરો (Edit Line)";
      }
    } else {
      document.getElementById("routeFormId").value = "";
      const form = document.getElementById("routeForm");
      if (form) form.reset();
      document.getElementById("routeModalTitle").textContent = "નવી ડિલિવરી લાઇન ઉમેરો";
    }

    openModal("routeModal");
  } catch (err) {
    console.error("Error in openRouteModal:", err);
    alert("ડિલિવરી લાઇન વિગત ખોલવામાં સમસ્યા: " + err.message);
  }
}
window.openRouteModal = openRouteModal;

async function saveRouteData(e) {
  e.preventDefault();
  try {
    const idVal = document.getElementById("routeFormId").value;
    const smVal = document.getElementById("routeFormSalesman")?.value;
    const cmVal = document.getElementById("routeFormCollectionMan")?.value;

    const routeData = {
      code: document.getElementById("routeFormCode").value.trim().toUpperCase(),
      name: document.getElementById("routeFormName").value.trim(),
      salesmanId: smVal ? parseInt(smVal, 10) : null,
      collectionManId: cmVal ? parseInt(cmVal, 10) : null
    };

    if (idVal) {
      routeData.id = parseInt(idVal, 10);
    }

    await window.vendorDB.put("routes", routeData);
    closeModal("routeModal");
    showToast(t("saveSuccess") || "ડિલિવરી લાઇન સાચવી લીધી છે!");
    await refreshAllViews();
  } catch (err) {
    console.error("Error in saveRouteData:", err);
    alert("લાઇન સાચવવામાં સમસ્યા: " + err.message);
  }
}
window.saveRouteData = saveRouteData;

async function deleteRoute(id) {
  try {
    const routeId = parseInt(id, 10) || id;
    const customers = (await window.vendorDB.getAll("customers")) || [];
    const hasCust = customers.some(c => c.routeId === routeId);
    if (hasCust) {
      if (!confirm("આ લાઇનમાં ગ્રાહકો જોડાયેલા છે! શું તમે ખરેખર આ લાઇન કાઢી નાખવા માંગો છો?")) {
        return;
      }
    } else {
      if (!confirm("શું તમે આ લાઇન કાઢી નાખવા માંગો છો?")) {
        return;
      }
    }

    await window.vendorDB.delete("routes", routeId);
    showToast(t("deleteSuccess") || "લાઇન હટાવી દીધી છે!");
    await refreshAllViews();
  } catch (err) {
    console.error("Error in deleteRoute:", err);
    alert("લાઇન હટાવવામાં ભૂલ: " + err.message);
  }
}
window.deleteRoute = deleteRoute;

// --- SALESMAN MODAL CRUD ---
async function openSalesmanModal(id = null) {
  try {
    if (id !== null && id !== undefined && id !== "") {
      const smId = parseInt(id, 10) || id;
      const sm = await window.vendorDB.get("salesmen", smId);
      if (sm) {
        document.getElementById("salesmanFormId").value = sm.id;
        document.getElementById("salesmanFormName").value = sm.name || "";
        document.getElementById("salesmanFormMobile").value = sm.mobile || "";
        document.getElementById("salesmanFormComm").value = sm.commission || "";
        document.getElementById("salesmanFormNotes").value = sm.notes || "";
        document.getElementById("salesmanModalTitle").textContent = "વિતરક વિગતમાં સુધારો (Edit Salesman)";
      }
    } else {
      document.getElementById("salesmanFormId").value = "";
      const form = document.getElementById("salesmanForm");
      if (form) form.reset();
      document.getElementById("salesmanModalTitle").textContent = "નવો વિતરક (Salesman) ઉમેરો";
    }
    openModal("salesmanModal");
  } catch (err) {
    console.error("Error in openSalesmanModal:", err);
    alert("વિતરક વિગત ખોલવામાં સમસ્યા: " + err.message);
  }
}
window.openSalesmanModal = openSalesmanModal;

async function saveSalesmanData(e) {
  e.preventDefault();
  try {
    const idVal = document.getElementById("salesmanFormId").value;
    const smData = {
      name: document.getElementById("salesmanFormName").value.trim(),
      mobile: document.getElementById("salesmanFormMobile").value.trim(),
      commission: document.getElementById("salesmanFormComm").value.trim(),
      notes: document.getElementById("salesmanFormNotes").value.trim()
    };

    if (idVal) smData.id = parseInt(idVal, 10);

    await window.vendorDB.put("salesmen", smData);
    closeModal("salesmanModal");
    showToast(t("saveSuccess") || "વિતરકની વિગત સાચવી લીધી છે!");
    await refreshAllViews();
  } catch (err) {
    console.error("Error in saveSalesmanData:", err);
    alert("વિતરક સાચવવામાં સમસ્યા: " + err.message);
  }
}
window.saveSalesmanData = saveSalesmanData;

async function deleteSalesman(id) {
  try {
    const smId = parseInt(id, 10) || id;
    if (confirm("શું તમે આ વિતરક (Salesman) ને હટાવવા માંગો છો?")) {
      await window.vendorDB.delete("salesmen", smId);
      showToast(t("deleteSuccess") || "વિતરક હટાવી દીધો છે!");
      await refreshAllViews();
    }
  } catch (err) {
    console.error("Error in deleteSalesman:", err);
    alert("વિતરક હટાવવામાં સમસ્યા: " + err.message);
  }
}
window.deleteSalesman = deleteSalesman;

// --- COLLECTION MAN MODAL CRUD ---
async function openCollectionManModal(id = null) {
  try {
    if (id !== null && id !== undefined && id !== "") {
      const cmId = parseInt(id, 10) || id;
      const cm = await window.vendorDB.get("collectionMen", cmId);
      if (cm) {
        document.getElementById("collectionManFormId").value = cm.id;
        document.getElementById("collManFormName").value = cm.name || "";
        document.getElementById("collManFormMobile").value = cm.mobile || "";
        document.getElementById("collManFormComm").value = cm.commission || "";
        document.getElementById("collManFormNotes").value = cm.notes || "";
        document.getElementById("collectionManModalTitle").textContent = "કલેક્શન મેનમાં સુધારો (Edit Staff)";
      }
    } else {
      document.getElementById("collectionManFormId").value = "";
      const form = document.getElementById("collectionManForm");
      if (form) form.reset();
      document.getElementById("collectionManModalTitle").textContent = "નવા ઉઘરાણી સ્ટાફની નોંધણી (Add Staff)";
    }
    openModal("collectionManModal");
  } catch (err) {
    console.error("Error in openCollectionManModal:", err);
    alert("કલેક્શન મેન વિગત ખોલવામાં સમસ્યા: " + err.message);
  }
}
window.openCollectionManModal = openCollectionManModal;

async function saveCollectionManData(e) {
  e.preventDefault();
  try {
    const idVal = document.getElementById("collectionManFormId").value;
    const cmData = {
      name: document.getElementById("collManFormName").value.trim(),
      mobile: document.getElementById("collManFormMobile").value.trim(),
      commission: document.getElementById("collManFormComm").value.trim(),
      notes: document.getElementById("collManFormNotes").value.trim()
    };

    if (idVal) cmData.id = parseInt(idVal, 10);

    await window.vendorDB.put("collectionMen", cmData);
    closeModal("collectionManModal");
    showToast(t("saveSuccess") || "કલેક્શન સ્ટાફની વિગત સાચવી લીધી છે!");
    await refreshAllViews();
  } catch (err) {
    console.error("Error in saveCollectionManData:", err);
    alert("કલેક્શન સ્ટાફ સાચવવામાં સમસ્યા: " + err.message);
  }
}
window.saveCollectionManData = saveCollectionManData;

async function deleteCollectionMan(id) {
  try {
    const cmId = parseInt(id, 10) || id;
    if (confirm("શું તમે આ ઉઘરાણી સ્ટાફ (Collection Man) ને હટાવવા માંગો છો?")) {
      await window.vendorDB.delete("collectionMen", cmId);
      showToast(t("deleteSuccess") || "ઉઘરાણી સ્ટાફ હટાવી દીધો છે!");
      await refreshAllViews();
    }
  } catch (err) {
    console.error("Error in deleteCollectionMan:", err);
    alert("ઉઘરાણી સ્ટાફ હટાવવામાં સમસ્યા: " + err.message);
  }
}
window.deleteCollectionMan = deleteCollectionMan;

// -------------------------------------------------------------
// 10. REPORTS & OUTSTANDING CONTROLLER
// -------------------------------------------------------------
async function renderReportsView() {
  const customers = await window.vendorDB.getAll("customers");
  const routes = await window.vendorDB.getAll("routes");
  const collectionMen = await window.vendorDB.getAll("collectionMen");
  const firm = cachedAgency || await window.vendorDB.get("firms", "primary");
  const routeMap = new Map(routes.map(r => [r.id, r]));
  const cmMap = new Map(collectionMen.map(c => [c.id, c]));

  // 1. Populate Route Filter Dropdown
  const routeSelect = document.getElementById("reportRouteFilter");
  if (routeSelect && routeSelect.options.length <= 1) {
    routes.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.code} - ${r.name}`;
      routeSelect.appendChild(opt);
    });
  }

  // 2. Populate Staff Filter Dropdown
  const staffSelect = document.getElementById("reportStaffFilter");
  if (staffSelect && staffSelect.options.length <= 1) {
    collectionMen.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.mobile || '-'})`;
      staffSelect.appendChild(opt);
    });
  }

  // 3. Filter Outstanding Customers
  const selectedRoute = routeSelect ? routeSelect.value : "all";
  const selectedStaff = staffSelect ? staffSelect.value : "all";
  const searchQuery = (document.getElementById("reportSearchInput")?.value || "").toLowerCase().trim();
  const sortMode = document.getElementById("reportSortSelect")?.value || "collSeq";

  let outstanding = customers.filter(c => (Number(c.currentBalance) || 0) > 0);

  if (selectedRoute !== "all") {
    outstanding = outstanding.filter(c => c.routeId === parseInt(selectedRoute));
  }
  if (selectedStaff !== "all") {
    outstanding = outstanding.filter(c => c.collectionManId === parseInt(selectedStaff));
  }
  if (searchQuery) {
    outstanding = outstanding.filter(c => {
      const name = (c.name || "").toLowerCase();
      const code = (c.code || "").toLowerCase();
      const addr = (c.address || "").toLowerCase();
      const mob = (c.mobile || "").toLowerCase();
      return name.includes(searchQuery) || code.includes(searchQuery) || addr.includes(searchQuery) || mob.includes(searchQuery);
    });
  }

  // 4. Sort Outstanding Customers
  if (sortMode === "delSeq") {
    outstanding.sort((a, b) => (Number(a.sequenceNo) || 0) - (Number(b.sequenceNo) || 0));
  } else if (sortMode === "amountDesc") {
    outstanding.sort((a, b) => (Number(b.currentBalance) || 0) - (Number(a.currentBalance) || 0));
  } else if (sortMode === "name") {
    outstanding.sort((a, b) => (a.name || "").localeCompare(b.name || "", "gu"));
  } else {
    // Default: collection sequence
    outstanding.sort((a, b) => (Number(a.collectionSequence || a.sequenceNo) || 0) - (Number(b.collectionSequence || b.sequenceNo) || 0));
  }

  // 5. Update KPI Summary
  const totalAmt = outstanding.reduce((sum, c) => sum + (Number(c.currentBalance) || 0), 0);
  const totalAmtEl = document.getElementById("reportTotalPendingAmt");
  if (totalAmtEl) totalAmtEl.textContent = `₹${Math.round(totalAmt).toLocaleString("gu-IN")}`;

  const countEl = document.getElementById("reportTotalCustCount");
  if (countEl) countEl.textContent = `${outstanding.length}`;

  const badgeEl = document.getElementById("reportCountBadge");
  if (badgeEl) badgeEl.textContent = `${outstanding.length} ગ્રાહકો`;

  const lineInfoEl = document.getElementById("reportSelectedLineInfo");
  if (lineInfoEl) {
    if (selectedRoute !== "all") {
      const rObj = routeMap.get(parseInt(selectedRoute));
      lineInfoEl.textContent = rObj ? `${rObj.code} (${rObj.name})` : selectedRoute;
    } else {
      lineInfoEl.textContent = "બધી લાઇન્સ (All Lines)";
    }
  }

  // 6. Render Table
  const tbody = document.getElementById("outstandingTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (outstanding.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-dim); padding:2rem;">પસંદ કરેલ ફિલ્ટરમાં કોઈ બાકી ઉઘરાણી નથી! (No outstanding records found)</td></tr>`;
    return;
  }

  outstanding.forEach(c => {
    const tr = document.createElement("tr");
    const rObj = routeMap.get(c.routeId);
    const lineLabel = rObj ? rObj.code : "-";
    const seq = (sortMode === "delSeq") ? (c.sequenceNo || "-") : (c.collectionSequence || c.sequenceNo || "-");

    tr.innerHTML = `
      <td style="font-weight:700; color:var(--accent-cyan); text-align:center;">#${seq}</td>
      <td><span class="badge badge-amber">${lineLabel}</span></td>
      <td style="font-weight:600;">
        ${c.name}
        <div style="font-size:0.75rem; color:var(--text-dim);">${c.code || ""}</div>
      </td>
      <td style="font-size:0.85rem; color:var(--text-muted);">${c.address || "-"}</td>
      <td>${c.mobile ? `📞 ${c.mobile}` : "-"}</td>
      <td style="font-weight:700; color:#fb7185; font-size:1.05rem;">₹${c.currentBalance}</td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="openDirectUPIForCustomer(${c.id})" title="UPI QR">
            📲 QR
          </button>
          <button class="btn btn-whatsapp btn-sm" onclick="sendWhatsAppReminder(${c.id})" title="Send WhatsApp">
            💬 WA
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function sendWhatsAppReminder(customerId) {
  const cust = await window.vendorDB.get("customers", customerId);
  const firm = cachedAgency || await window.vendorDB.get("firms", "primary");
  if (!cust) return;

  const mobile = (cust.whatsapp || cust.mobile || "").replace(/[^0-9]/g, "");
  const amount = cust.currentBalance || 0;

  let msg = `*${firm.name}*\n`;
  msg += `----------------------------\n`;
  msg += `📢 *નમસ્તે ${cust.name}જી,*\n`;
  msg += `તમારા વર્તમાનપત્ર (Newspaper) બિલ પેટે કુલ બાકી રકમ: *₹${amount}* છે.\n`;
  msg += `કૃપા કરી નીચે આપેલ UPI ID પર જમા કરવા વિનંતી:\n\n`;
  msg += `📲 *UPI ID:* ${firm.upiId}\n`;
  msg += `(Google Pay, PhonePe, Paytm, BHIM દ્વારા ચૂકવી શકાય છે)\n`;
  msg += `----------------------------\n`;
  if (firm.phone) msg += `કોઈ પ્રશ્ન હોય તો સંપર્ક કરો: ${firm.phone}\n`;
  msg += `આભાર! 🙏`;

  const encoded = encodeURIComponent(msg);
  const waUrl = mobile ? `https://wa.me/91${mobile.slice(-10)}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(waUrl, "_blank");
}
window.sendWhatsAppReminder = sendWhatsAppReminder;

async function printCollectionSheet() {
  const customers = await window.vendorDB.getAll("customers") || [];
  const routes = await window.vendorDB.getAll("routes") || [];
  const collectionMen = await window.vendorDB.getAll("collectionMen") || [];
  const bills = await window.vendorDB.getAll("bills") || [];
  const firm = cachedAgency || await window.vendorDB.get("firms", "primary") || {};
  const routeMap = new Map(routes.map(r => [r.id, r]));

  const latestCustBillMap = new Map();
  bills.forEach(b => {
    if (!latestCustBillMap.has(b.customerId) || (b.id > latestCustBillMap.get(b.customerId).id)) {
      latestCustBillMap.set(b.customerId, b);
    }
  });

  const routeVal = document.getElementById("reportRouteFilter")?.value || "all";
  const staffVal = document.getElementById("reportStaffFilter")?.value || "all";
  const sortMode = document.getElementById("reportSortSelect")?.value || "collSeq";
  const searchQuery = (document.getElementById("reportSearchInput")?.value || "").toLowerCase().trim();

  let list = customers.filter(c => (Number(c.currentBalance) || 0) > 0);

  if (routeVal !== "all") {
    list = list.filter(c => c.routeId === parseInt(routeVal));
  }
  if (staffVal !== "all") {
    list = list.filter(c => c.collectionManId === parseInt(staffVal));
  }
  if (searchQuery) {
    list = list.filter(c => {
      const name = (c.name || "").toLowerCase();
      const code = (c.code || "").toLowerCase();
      const addr = (c.address || "").toLowerCase();
      const mob = (c.mobile || "").toLowerCase();
      return name.includes(searchQuery) || code.includes(searchQuery) || addr.includes(searchQuery) || mob.includes(searchQuery);
    });
  }

  // Sort
  if (sortMode === "delSeq") {
    list.sort((a, b) => (Number(a.sequenceNo) || 0) - (Number(b.sequenceNo) || 0));
  } else if (sortMode === "amountDesc") {
    list.sort((a, b) => (Number(b.currentBalance) || 0) - (Number(a.currentBalance) || 0));
  } else if (sortMode === "name") {
    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "gu"));
  } else {
    list.sort((a, b) => (Number(a.collectionSequence || a.sequenceNo) || 0) - (Number(b.collectionSequence || b.sequenceNo) || 0));
  }

  const staffObj = staffVal !== "all" ? collectionMen.find(cm => cm.id === parseInt(staffVal)) : null;
  const selectedRouteObj = routeVal !== "all" ? routeMap.get(parseInt(routeVal)) : null;
  const collManDisplay = staffObj ? `${staffObj.name} (${staffObj.mobile || ''})` : (selectedRouteObj ? `${selectedRouteObj.name} (${selectedRouteObj.code})` : "All Staff / All Lines");

  const totalAmt = list.reduce((sum, c) => sum + (Number(c.currentBalance) || 0), 0);

  const now = new Date();
  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNamesGu = ["જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઓગસ્ટ", "સપ્ટેમ્બર", "ઓક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"];
  const curMonthEn = monthNamesEn[now.getMonth()];
  const curMonthGu = monthNamesGu[now.getMonth()];
  const curYear = now.getFullYear();
  const subHeaderMonthStr = `Month - ${curMonthEn}-${curYear} (માસ: ${curMonthGu}-${curYear})`;

  let rowsHtml = "";
  list.forEach((c, idx) => {
    const accNo = c.code || c.custNo || c.id || (idx + 1);
    const bObj = latestCustBillMap.get(c.id);
    const billNo = bObj ? bObj.billNo : (c.code ? `B-${c.code}` : "-");
    const balFormatted = Number(c.currentBalance).toFixed(2);

    rowsHtml += `
      <tr style="border-bottom: 1px solid #000; height: 26px; font-size: 11px;">
        <td style="text-align:center; padding:3px 4px; border-right:1px solid #000; font-weight:bold;">${accNo}</td>
        <td style="padding:3px 6px; border-right:1px solid #000;">
          <b>${c.name}</b> ${c.societyShort ? `<span style="font-size:10px; color:#333;">(${c.societyShort})</span>` : ''}
          ${c.address ? `<div style="font-size:9.5px; color:#555;">${c.address}</div>` : ''}
        </td>
        <td style="text-align:right; padding:3px 6px; border-right:1px solid #000; font-weight:bold;">${balFormatted}</td>
        <td style="text-align:center; padding:3px 4px; border-right:1px solid #000; font-weight:600;">${billNo}</td>
        <td style="text-align:center; padding:3px 4px; border-right:1px solid #000;">${c.mobile || '-'}</td>
        <td style="padding:3px 4px; border-right:1px solid #000; width:75px; text-align:center;"></td>
        <td style="padding:3px 4px; width:75px; text-align:center;"></td>
      </tr>
    `;
  });

  const printHtml = `
    <div style="font-family: Arial, 'Noto Sans Gujarati', sans-serif; color: #000; padding: 6px;">
      <!-- Main Agency Header (Matching Image 4) -->
      <div style="text-align: center; border-bottom: 1.5px solid #000; padding-bottom: 4px; margin-bottom: 6px;">
        <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
          ${firm.name || 'PERFECT NEWSPAPER SUPPLIERS'}
        </div>
        <div style="font-size: 10.5px; color: #222; margin-top: 2px;">
          ${firm.address || 'E-392, SANKALITNAGAR, JUHAPURA, AHMEDABAD - 380055'} &nbsp;|&nbsp; 📞 ${firm.phone || '9825776607'}
        </div>
      </div>

      <!-- Subheader: Month, Account Balance - Customers, Page No -->
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 4px;">
        <div style="width: 40%; text-align: left;">
          ${subHeaderMonthStr}
        </div>
        <div style="width: 35%; text-align: center; font-size: 12px; text-decoration: underline;">
          Account Balance - Customers
        </div>
        <div style="width: 25%; text-align: right;">
          Page : 1
        </div>
      </div>

      <!-- Collection Man Row (Matching Image 4) -->
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: bold; margin-bottom: 6px; padding: 2px 0;">
        <div>Collection Man : <u>${collManDisplay}</u></div>
        <div>Total Accounts: <b>${list.length}</b></div>
      </div>

      <!-- 7-Column Table (Acc. No, Name of Account, Cl.Balance, Bill No, Mobile No, Paid Amt, Paid Date) -->
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1.5px solid #000; text-align: center; font-weight: bold; height: 26px;">
            <th style="padding: 4px; width: 45px; border-right: 1px solid #000;">Acc. No</th>
            <th style="padding: 4px 6px; text-align: left; border-right: 1px solid #000;">Name of Account</th>
            <th style="padding: 4px 6px; width: 75px; text-align: right; border-right: 1px solid #000;">Cl.Balance</th>
            <th style="padding: 4px; width: 65px; border-right: 1px solid #000;">Bill No</th>
            <th style="padding: 4px; width: 85px; border-right: 1px solid #000;">Mobile No</th>
            <th style="padding: 4px; width: 75px; border-right: 1px solid #000;">Paid Amt</th>
            <th style="padding: 4px; width: 75px;">Paid Date</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="border-top: 1.5px solid #000; font-weight: 900; background: #f8fafc; height: 28px; font-size: 12px;">
            <td colspan="2" style="text-align: right; padding: 4px 8px; border-right: 1px solid #000;">Total Cl.Balance:</td>
            <td style="text-align: right; padding: 4px 6px; border-right: 1px solid #000; color: #b91c1c;">₹${totalAmt.toFixed(2)}</td>
            <td colspan="4" style="text-align: left; padding-left: 10px; font-size: 10px; color: #444;">* બાકી વસૂલાત નોંધણી માટે ખાલી ખાનાનો ઉપયોગ કરવો.</td>
          </tr>
        </tfoot>
      </table>

      <!-- Footer Signature Line -->
      <div style="display: flex; justify-content: space-between; margin-top: 20px; font-size: 10.5px; border-top: 1px dashed #666; padding-top: 8px;">
        <div>કલેક્શન સ્ટાફ સહી: ____________________</div>
        <div>તપાસનાર (Verified By): ____________________</div>
        <div>એજન્સી સહી / સિક્કો: ____________________</div>
      </div>
    </div>
  `;

  document.getElementById("slipContentContainer").innerHTML = printHtml;
  openModal("slipModal");
}
window.printCollectionSheet = printCollectionSheet;

async function openDirectUPIForCustomer(customerId) {
  const cust = await window.vendorDB.get("customers", customerId);
  const firm = cachedAgency || await window.vendorDB.get("firms", "primary");
  const amount = cust.currentBalance;

  const cleanPayee = encodeURIComponent((firm.name || "VendorSoft").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft");
  const upiUrl = `upi://pay?pa=${encodeURIComponent(firm.upiId)}&pn=${cleanPayee}&am=${amount}&cu=INR&tn=Due`;

  document.getElementById("upiModalAgency").textContent = firm.name;
  document.getElementById("upiModalCustName").textContent = `ગ્રાહક: ${cust.name}`;
  document.getElementById("upiModalAmount").textContent = `₹${amount}`;
  document.getElementById("upiModalVPA").textContent = firm.upiId;

  try {
    const qrSvg = window.createQRCodeSVG(upiUrl, 200);
    document.getElementById("upiModalQRContainer").innerHTML = qrSvg;
  } catch (err) {
    console.error("QR render error:", err);
  }
  document.getElementById("upiDirectPayLink").href = upiUrl;

  openModal("upiModal");
}

async function exportReportsCSV() {
  const customers = await window.vendorDB.getAll("customers");
  const routes = await window.vendorDB.getAll("routes");
  const routeMap = new Map(routes.map(r => [r.id, r.code]));

  let csv = "Sequence,Line,Customer Code,Customer Name,Mobile,Address,Balance\n";
  customers.forEach(c => {
    csv += `"${c.collectionSequence || c.sequenceNo || ''}","${routeMap.get(c.routeId) || ''}","${c.code || c.id}","${(c.name || '').replace(/"/g, '""')}","${c.mobile || ''}","${(c.address || '').replace(/"/g, '""')}",${c.currentBalance || 0}\n`;
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `VendorSoft_Outstanding_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV ફાઇલ સફળતાપૂર્વક એક્સપોર્ટ થઈ!");
}

// -------------------------------------------------------------
// DEPOT PURCHASE & EVENING SALES CONTROLLER
// -------------------------------------------------------------
let customDepotExtraCopies = {};

function getTomorrowDateStr() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

function setDepotDate(type) {
  const dateInput = document.getElementById("depotSheetDate");
  if (!dateInput) return;
  if (type === "tomorrow") {
    dateInput.value = getTomorrowDateStr();
  } else if (type === "today") {
    dateInput.value = new Date().toISOString().split("T")[0];
  }
  renderDepotPurchaseView();
}
window.setDepotDate = setDepotDate;

async function renderDepotPurchaseView() {
  let dateInput = document.getElementById("depotSheetDate");
  if (dateInput && !dateInput.value) {
    dateInput.value = getTomorrowDateStr();
  }
  const selectedDate = dateInput ? dateInput.value : getTomorrowDateStr();
  const dayNamesGu = ["રવિવાર", "સોમવાર", "મંગળવાર", "બુધવાર", "ગુરુવાર", "શુક્રવાર", "શનિવાર"];
  const targetDate = new Date(selectedDate + "T12:00:00");
  const dayOfWeek = targetDate.getDay();

  const dayEl = document.getElementById("depotDayNameDisplay");
  if (dayEl) {
    const formattedDate = formatDisplayDate(selectedDate);
    dayEl.textContent = `${dayNamesGu[dayOfWeek]} (${formattedDate})`;
  }

  const sheet = await window.vendorDB.getDepotPurchaseSheet(selectedDate, customDepotExtraCopies);

  // Update KPI Cards
  document.getElementById("depotTotalCopiesVal").textContent = sheet.summary.totalCopies.toLocaleString("gu-IN");
  document.getElementById("depotCopiesBreakdown").textContent = `ગ્રાહક: ${sheet.summary.totalCustomerCopies} + કાઉન્ટર: ${sheet.summary.totalExtraCopies}`;
  document.getElementById("depotTotalPurchaseVal").textContent = `₹${sheet.summary.totalPurchaseAmount.toLocaleString("gu-IN")}`;
  document.getElementById("depotTotalSaleVal").textContent = `₹${sheet.summary.totalSalesValue.toLocaleString("gu-IN")}`;
  document.getElementById("depotTotalProfitVal").textContent = `₹${sheet.summary.totalProfit.toLocaleString("gu-IN")}`;

  // Populate Table
  const tbody = document.getElementById("depotPurchaseTbody");
  const tfoot = document.getElementById("depotPurchaseTfoot");
  if (!tbody) return;
  tbody.innerHTML = "";

  sheet.items.forEach(r => {
    if (r.totalCopies === 0 && r.customerCopies === 0) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge badge-blue">${r.code}</span></td>
      <td style="font-weight:600;">${r.name}</td>
      <td style="font-weight:700; color:var(--accent-cyan);">${r.customerCopies}</td>
      <td>
        <input type="number" min="0" value="${r.extraCopies}" class="form-control form-control-sm" style="width:75px; text-align:center; padding:2px 6px;"
          onchange="onDepotExtraCopiesChanged(${r.id}, this.value)" onkeydown="if(event.key==='Enter') this.blur();">
      </td>
      <td style="font-weight:800; font-size:1.05rem;">${r.totalCopies}</td>
      <td style="color:#fb7185;">₹${r.purchaseRate.toFixed(2)}</td>
      <td style="font-weight:800; color:#fb7185; font-size:1.05rem;">₹${r.purchaseAmount.toLocaleString("gu-IN")}</td>
      <td>₹${r.saleRate.toFixed(2)}</td>
      <td style="font-weight:600;">₹${r.salesValue.toLocaleString("gu-IN")}</td>
      <td style="font-weight:800; color:#34d399;">₹${r.profit.toLocaleString("gu-IN")}</td>
    `;
    tbody.appendChild(tr);
  });

  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <td colspan="2" style="font-size:1rem; text-align:right;">કુલ સરવાળો (TOTAL):</td>
        <td style="color:var(--accent-cyan); font-size:1.05rem;">${sheet.summary.totalCustomerCopies}</td>
        <td style="text-align:center;">${sheet.summary.totalExtraCopies}</td>
        <td style="font-size:1.15rem; color:#fff;">${sheet.summary.totalCopies} નકલ</td>
        <td>-</td>
        <td style="color:#fb7185; font-size:1.2rem;">₹${sheet.summary.totalPurchaseAmount.toLocaleString("gu-IN")}</td>
        <td>-</td>
        <td style="font-size:1.1rem;">₹${sheet.summary.totalSalesValue.toLocaleString("gu-IN")}</td>
        <td style="color:#34d399; font-size:1.2rem;">₹${sheet.summary.totalProfit.toLocaleString("gu-IN")}</td>
      </tr>
    `;
  }
}
window.renderDepotPurchaseView = renderDepotPurchaseView;

function onDepotExtraCopiesChanged(itemId, val) {
  customDepotExtraCopies[itemId] = parseInt(val, 10) || 0;
  renderDepotPurchaseView();
  showToast("કાઉન્ટર નકલ અપડેટ થઈ!");
}
window.onDepotExtraCopiesChanged = onDepotExtraCopiesChanged;

// Print Depot Purchase Slip
async function printDepotSlip() {
  const dateInput = document.getElementById("depotSheetDate");
  const selectedDate = dateInput ? dateInput.value : getTomorrowDateStr();
  const dayNamesGu = ["રવિવાર", "સોમવાર", "મંગળવાર", "બુધવાર", "ગુરુવાર", "શુક્રવાર", "શનિવાર"];
  const targetDate = new Date(selectedDate + "T12:00:00");
  const dayOfWeek = targetDate.getDay();
  const firm = cachedAgency || await window.vendorDB.get("firms", "primary");
  const sheet = await window.vendorDB.getDepotPurchaseSheet(selectedDate, customDepotExtraCopies);

  let itemsHtml = "";
  sheet.items.forEach(r => {
    if (r.totalCopies === 0) return;
    itemsHtml += `
      <tr style="border-bottom:1px dashed #ccc;">
        <td style="padding:6px 2px;"><b>${r.name}</b> (${r.code})</td>
        <td style="text-align:center; padding:6px 2px; font-weight:bold; font-size:1.05rem;">${r.totalCopies}</td>
        <td style="text-align:right; padding:6px 2px;">₹${r.purchaseRate.toFixed(2)}</td>
        <td style="text-align:right; padding:6px 2px; font-weight:bold; color:#b91c1c;">₹${r.purchaseAmount.toFixed(2)}</td>
      </tr>
    `;
  });

  const slipHtml = `
    <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:6px; margin-bottom:8px;">
      <h3 style="margin:0; font-size:1.15rem;">${firm.name}</h3>
      <div style="font-size:0.88rem; font-weight:600;">ડેપો ખરીદી સ્લિપ / ઇન્ડેન્ટ (Depot Purchase Slip)</div>
      <div style="font-size:0.85rem;">તારીખ: <b>${formatDisplayDate(selectedDate)} (${dayNamesGu[dayOfWeek]})</b></div>
      <div style="font-size:0.75rem;">સંપર્ક: ${firm.phone || ""}</div>
    </div>
    <table style="width:100%; font-size:0.88rem; border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid #000; text-align:left;">
          <th>પેપરનું નામ</th>
          <th style="text-align:center;">કુલ નકલ</th>
          <th style="text-align:right;">ખરીદ ભાવ</th>
          <th style="text-align:right;">રકમ (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr style="border-top:2px solid #000; font-weight:bold; font-size:0.95rem;">
          <td style="padding-top:6px;">કુલ ખરીદી (TOTAL):</td>
          <td style="text-align:center; padding-top:6px;">${sheet.summary.totalCopies} નકલ</td>
          <td style="text-align:right; padding-top:6px;">ચૂકવવાપાત્ર:</td>
          <td style="text-align:right; padding-top:6px; color:#b91c1c;">₹${sheet.summary.totalPurchaseAmount.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    <div style="margin-top:12px; border-top:1px dashed #666; padding-top:6px; font-size:0.78rem; text-align:center;">
      અપેક્ષિત વેચાણ રકમ: ₹${sheet.summary.totalSalesValue} | અંદાજિત કમિશન/નફો: ₹${sheet.summary.totalProfit}
    </div>
  `;

  document.getElementById("slipContentContainer").innerHTML = slipHtml;
  openModal("slipModal");
}
window.printDepotSlip = printDepotSlip;

// -------------------------------------------------------------
// 11. SETTINGS & BACKUP CONTROLLER
// -------------------------------------------------------------
async function renderSettingsView() {
  const firm = cachedAgency || await window.vendorDB.get("firms", "primary");
  if (firm) {
    document.getElementById("settingAgencyName").value = firm.name || "";
    document.getElementById("settingAgencyPhone").value = firm.phone || "";
    document.getElementById("settingAgencyUPI").value = firm.upiId || "";
    document.getElementById("settingAgencyGST").value = firm.gstNo || "";
    document.getElementById("settingAgencyAddress").value = firm.address || "";
    const defFmt = document.getElementById("settingAgencyDefaultFormat");
    if (defFmt) defFmt.value = firm.defaultPrintFormat || "4in1_classic";

    const bFmt = document.getElementById("settingAgencyBillNoFormat");
    if (bFmt) bFmt.value = firm.billNoFormat || "sequential";

    const bPfx = document.getElementById("settingAgencyBillNoPrefix");
    if (bPfx) bPfx.value = firm.billNoPrefix !== undefined ? firm.billNoPrefix : "";

    const bStart = document.getElementById("settingAgencyBillNoStartNum");
    if (bStart) bStart.value = firm.billNoStartNum !== undefined ? firm.billNoStartNum : 1001;

    const bPad = document.getElementById("settingAgencyBillNoPadding");
    if (bPad) bPad.value = firm.billNoPadding !== undefined ? firm.billNoPadding : 4;

    currentAgencyLogoData = firm.logo || "";
    updateAgencyLogoPreview(firm.logo || "");

    updateBillNoPreview("settings");
  }
}

async function saveAgencySettings(e) {
  e.preventDefault();
  const defFmt = document.getElementById("settingAgencyDefaultFormat")?.value || "4in1_classic";
  const bFmt = document.getElementById("settingAgencyBillNoFormat")?.value || "sequential";
  const bPfx = document.getElementById("settingAgencyBillNoPrefix")?.value || "";
  const bStart = parseInt(document.getElementById("settingAgencyBillNoStartNum")?.value) || 1001;
  const bPad = parseInt(document.getElementById("settingAgencyBillNoPadding")?.value) || 0;

  const profile = {
    id: "primary",
    name: document.getElementById("settingAgencyName").value.trim(),
    phone: document.getElementById("settingAgencyPhone").value.trim(),
    upiId: document.getElementById("settingAgencyUPI").value.trim(),
    gstNo: document.getElementById("settingAgencyGST").value.trim(),
    address: document.getElementById("settingAgencyAddress").value.trim(),
    logo: currentAgencyLogoData || "",
    defaultPrintFormat: defFmt,
    billNoFormat: bFmt,
    billNoPrefix: bPfx,
    billNoStartNum: bStart,
    billNoPadding: bPad
  };

  await window.vendorDB.put("firms", profile);
  cachedAgency = profile;
  showToast(t("saveSuccess"));
  await loadAgencySettings();
}

async function downloadBackupFile() {
  const jsonStr = await window.vendorDB.exportFullBackupJSON();
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `VendorSoft_Backup_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(t("backupSuccess"));
}

async function restoreBackupFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      await window.vendorDB.importFullBackupJSON(evt.target.result);
      showToast(t("restoreSuccess"));
      await refreshAllViews();
    } catch (err) {
      alert("બેકઅપ ફાઈલ અમાન્ય છે! (Invalid backup file)");
    }
  };
  reader.readAsText(file);
}

async function resetDemoData() {
  if (confirm("શું તમે ખરેખર બધો ડેટા ડિલીટ કરીને નમૂનાનો (ડેમો) ડેટા ફરીથી લાવવા માંગો છો?")) {
    await window.vendorDB.resetToDemo();
    showToast("ડેમો ડેટા ફરીથી લોડ થઈ ગયો!");
    await refreshAllViews();
  }
}

async function importAccessDataDirect() {
  const btn = document.getElementById("btnDirectAccessImport");
  const statusEl = document.getElementById("accessImportStatus");
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = "⏳ Access ડેટાબેઝમાંથી ૭૭૨ સક્રિય ગ્રાહકો આવી રહ્યા છે... (Importing...)";

  try {
    const resp = await fetch("vendorsoft_imported_data.json?t=" + Date.now());
    if (!resp.ok) throw new Error("Could not load vendorsoft_imported_data.json");
    const jsonStr = await resp.text();
    await window.vendorDB.importFullBackupJSON(jsonStr);

    if (statusEl) statusEl.textContent = "✓ ૭૭૨ સક્રિય ગ્રાહકો, ૨૦ પેપર્સ, ૧૧ હોકર અને ૧૨ કલેક્શન મેન આવી ગયા!";
    showToast("🎉 ૭૭૨ સક્રિય ગ્રાહકો અને સ્ટાફ માસ્ટર સફળતાપૂર્વક ઈમ્પોર્ટ થઈ ગયા!");
    await loadAgencySettings();
    await refreshAllViews();
  } catch (err) {
    console.warn("Direct JSON load failed, trying server API:", err);
    try {
      const resp2 = await fetch("/api/import-access", { method: "POST" });
      if (!resp2.ok) throw new Error("Server extraction failed");
      const jsonStr2 = await resp2.text();
      await window.vendorDB.importFullBackupJSON(jsonStr2);
      if (statusEl) statusEl.textContent = "✓ ૭૭૨ સક્રિય ગ્રાહકો, ૨૦ પેપર્સ, ૧૧ હોકર અને ૧૨ કલેક્શન મેન આવી ગયા!";
      showToast("🎉 ૭૭૨ સક્રિય ગ્રાહકો અને સ્ટાફ માસ્ટર સફળતાપૂર્વક ઈમ્પોર્ટ થઈ ગયા!");
      await loadAgencySettings();
      await refreshAllViews();
    } catch (e2) {
      alert("ડેટા ઈમ્પોર્ટ કરવામાં ભૂલ આવી: " + e2.message);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.importAccessDataDirect = importAccessDataDirect;

// -------------------------------------------------------------
// 12. EXPENSES & BANK MANAGEMENT CONTROLLER
// -------------------------------------------------------------
let currentExpensesSubTab = "register";

function switchExpensesSubTab(tab) {
  currentExpensesSubTab = tab;

  // Toggle Sub-tab buttons
  const btnReg = document.getElementById("expTabRegisterBtn");
  const btnSal = document.getElementById("expTabSalaryBtn");
  const btnBnk = document.getElementById("expTabBankBtn");

  if (btnReg) btnReg.classList.toggle("active", tab === "register");
  if (btnSal) btnSal.classList.toggle("active", tab === "salary");
  if (btnBnk) btnBnk.classList.toggle("active", tab === "bank");

  // Toggle Containers
  const cReg = document.getElementById("expSubTabRegister");
  const cSal = document.getElementById("expSubTabSalary");
  const cBnk = document.getElementById("expSubTabBank");

  if (cReg) cReg.style.display = (tab === "register") ? "block" : "none";
  if (cSal) cSal.style.display = (tab === "salary") ? "block" : "none";
  if (cBnk) cBnk.style.display = (tab === "bank") ? "block" : "none";
}
window.switchExpensesSubTab = switchExpensesSubTab;

async function renderExpensesView() {
  await window.vendorDB.ensureDefaultBankAccountsAndExpenses();

  const expenses = (await window.vendorDB.getAll("expenses")) || [];
  const bankAccounts = (await window.vendorDB.getAll("bank_accounts")) || [];
  const bankTransactions = (await window.vendorDB.getAll("bank_transactions")) || [];
  const salesmen = (await window.vendorDB.getAll("salesmen")) || [];
  const collectionMen = (await window.vendorDB.getAll("collectionMen")) || [];
  const routes = (await window.vendorDB.getAll("routes")) || [];
  const customers = (await window.vendorDB.getAll("customers")) || [];

  const bankMap = new Map(bankAccounts.map(b => [b.id, b]));

  // 1. Current Month Filter Default
  const filterMonthInput = document.getElementById("expFilterMonth");
  if (filterMonthInput && !filterMonthInput.value) {
    const today = new Date();
    filterMonthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  }
  const currentFilterMonth = filterMonthInput ? filterMonthInput.value : new Date().toISOString().slice(0, 7);

  // 2. Compute KPI Metrics
  const curMonthExpenses = expenses.filter(e => {
    const m = (e.monthYear || e.date || "").slice(0, 7);
    return m === currentFilterMonth;
  });

  const totalMonthExp = curMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalSalaryExp = curMonthExpenses.filter(e => e.category === "salary").reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalGeneralExp = totalMonthExp - totalSalaryExp;

  const cashAccounts = bankAccounts.filter(b => b.type === "cash");
  const actualBankAccounts = bankAccounts.filter(b => b.type !== "cash");
  const totalCashBal = cashAccounts.reduce((sum, b) => sum + (Number(b.currentBalance) || 0), 0);
  const totalBankBal = actualBankAccounts.reduce((sum, b) => sum + (Number(b.currentBalance) || 0), 0);

  const elTotalMonth = document.getElementById("expMetricTotalMonth");
  if (elTotalMonth) elTotalMonth.textContent = `₹${Math.round(totalMonthExp).toLocaleString("gu-IN")}`;

  const elTotalSal = document.getElementById("expMetricTotalSalary");
  if (elTotalSal) elTotalSal.textContent = `₹${Math.round(totalSalaryExp).toLocaleString("gu-IN")}`;

  const elTotalGen = document.getElementById("expMetricTotalGeneral");
  if (elTotalGen) elTotalGen.textContent = `₹${Math.round(totalGeneralExp).toLocaleString("gu-IN")}`;

  const elCashBal = document.getElementById("expMetricCashBalance");
  if (elCashBal) elCashBal.textContent = `₹${Math.round(totalCashBal).toLocaleString("gu-IN")}`;

  const elBankBal = document.getElementById("expMetricBankBalance");
  if (elBankBal) elBankBal.textContent = `₹${Math.round(totalBankBal).toLocaleString("gu-IN")}`;

  // 3. Render Sub Tab 1: Expense Register Table
  const filterCategory = document.getElementById("expFilterCategory")?.value || "all";
  const searchTxt = (document.getElementById("expSearchInput")?.value || "").toLowerCase().trim();

  let filteredExpenses = [...expenses];
  if (filterCategory !== "all") {
    filteredExpenses = filteredExpenses.filter(e => e.category === filterCategory);
  }
  if (currentFilterMonth) {
    filteredExpenses = filteredExpenses.filter(e => (e.monthYear || e.date || "").slice(0, 7) === currentFilterMonth);
  }
  if (searchTxt) {
    filteredExpenses = filteredExpenses.filter(e => {
      const p = (e.payeeName || "").toLowerCase();
      const n = (e.notes || "").toLowerCase();
      const c = (e.category || "").toLowerCase();
      return p.includes(searchTxt) || n.includes(searchTxt) || c.includes(searchTxt);
    });
  }

  // Sort by date descending
  filteredExpenses.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id - a.id));

  const expTbody = document.getElementById("expensesTbody");
  const expFootTotal = document.getElementById("expTableTotalFoot");
  let filteredTotal = 0;

  if (expTbody) {
    expTbody.innerHTML = "";
    if (filteredExpenses.length === 0) {
      expTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:2rem;">પસંદ કરેલ ફિલ્ટરમાં કોઈ ખર્ચની નોંધ નથી. (No expenses found)</td></tr>`;
    } else {
      const categoryLabels = {
        petrol: { label: "🛵 પેટ્રોલ / ટ્રાન્સપોર્ટ", color: "badge-amber" },
        salary: { label: "💼 સ્ટાફ પગાર", color: "badge-cyan" },
        rent: { label: "🏢 ઓફિસ / દુકાન ભાડું", color: "badge-blue" },
        stationery: { label: "✏️ સ્ટેશનરી & પ્રિન્ટિંગ", color: "badge-purple" },
        tea_snacks: { label: "☕ ચા-નાસ્તો & રિફ્રેશમેન્ટ", color: "badge-emerald" },
        bank_charges: { label: "🏦 બેંક ચાર્જિસ / ફી", color: "badge-rose" },
        other: { label: "📦 અન્ય પરચુરણ ખર્ચ", color: "badge-amber" }
      };

      const payModeLabels = {
        cash: "💵 રોકડ (Cash)",
        bank: "🏦 બેંક / UPI",
        cheque: "📝 ચેક"
      };

      filteredExpenses.forEach(exp => {
        const amt = Number(exp.amount) || 0;
        filteredTotal += amt;
        const catInfo = categoryLabels[exp.category] || { label: exp.category || "સામાન્ય", color: "badge-blue" };
        const modeLabel = payModeLabels[exp.paymentMode] || "💵 રોકડ";
        const bankObj = exp.bankAccountId ? bankMap.get(parseInt(exp.bankAccountId, 10)) : null;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-family:monospace; font-weight:600;">${formatDisplayDate(exp.date)}</td>
          <td><span class="badge ${catInfo.color}">${catInfo.label}</span></td>
          <td>
            <div style="font-weight:600; color:#f8fafc;">${exp.payeeName || "-"}</div>
            ${exp.notes ? `<div style="font-size:0.75rem; color:var(--text-dim);">${exp.notes}</div>` : ""}
          </td>
          <td>
            <span style="font-size:0.85rem;">${modeLabel}</span>
            ${bankObj ? `<div style="font-size:0.72rem; color:var(--accent-cyan);">${bankObj.name}</div>` : ""}
          </td>
          <td style="text-align:right; font-weight:700; color:#fb7185; font-size:1rem;">₹${amt.toLocaleString("gu-IN")}</td>
          <td style="text-align:center;">
            <div style="display:flex; justify-content:center; gap:6px;">
              <button class="btn btn-secondary btn-icon" onclick="openAddExpenseModal(${exp.id})" title="સુધારો (Edit)">✏️</button>
              <button class="btn btn-danger btn-icon" onclick="deleteExpense(${exp.id})" title="હટાવો (Delete)">🗑️</button>
            </div>
          </td>
        `;
        expTbody.appendChild(tr);
      });
    }
  }

  if (expFootTotal) {
    expFootTotal.textContent = `₹${filteredTotal.toLocaleString("gu-IN")}`;
  }

  // 4. Render Sub Tab 2: Staff Salary Table
  const salaryTbody = document.getElementById("staffSalaryTbody");
  if (salaryTbody) {
    salaryTbody.innerHTML = "";
    const allStaff = [
      ...salesmen.map(s => ({ ...s, role: "salesman", roleLabel: "🛵 વિતરક (Salesman)" })),
      ...collectionMen.map(c => ({ ...c, role: "collectionMan", roleLabel: "💼 ઉઘરાણી સ્ટાફ (Collection)" }))
    ];

    if (allStaff.length === 0) {
      salaryTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:2rem;">કોઈ સ્ટાફ સભ્ય ઉપલબ્ધ નથી.</td></tr>`;
    } else {
      allStaff.forEach(staff => {
        // Find assigned routes
        let assignedLines = "-";
        let custCount = 0;
        if (staff.role === "salesman") {
          const matchingRoutes = routes.filter(r => r.salesmanId === staff.id);
          assignedLines = matchingRoutes.map(r => r.name).join(", ") || "કોઈ લાઇન નથી";
          const rIds = matchingRoutes.map(r => r.id);
          custCount = customers.filter(c => rIds.includes(c.routeId)).length;
        } else {
          const matchingRoutes = routes.filter(r => r.collectionManId === staff.id);
          assignedLines = matchingRoutes.map(r => r.name).join(", ") || "કોઈ લાઇન નથી";
          const rIds = matchingRoutes.map(r => r.id);
          custCount = customers.filter(c => rIds.includes(c.routeId) && (Number(c.currentBalance) || 0) > 0).length;
        }

        // Find last paid salary
        const staffSalaryHistory = expenses
          .filter(e => e.category === "salary" && (e.staffId === staff.id || (e.payeeName && e.payeeName.includes(staff.name))))
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        const lastPaid = staffSalaryHistory.length > 0 ? staffSalaryHistory[0] : null;
        const lastPaidText = lastPaid
          ? `<span style="color:#34d399; font-weight:600;">₹${Number(lastPaid.amount).toLocaleString("gu-IN")}</span> <small style="color:var(--text-dim);">(${formatDisplayDate(lastPaid.date)})</small>`
          : `<span style="color:var(--text-dim);">કોઈ ચુકવણી નથી</span>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>
            <div style="font-weight:700; color:#38bdf8;">${staff.name}</div>
            ${staff.commission ? `<div style="font-size:0.75rem; color:var(--accent-amber);">દર / કમિશન: ₹${staff.commission}</div>` : ""}
          </td>
          <td><span class="badge ${staff.role === 'salesman' ? 'badge-blue' : 'badge-emerald'}">${staff.roleLabel}</span></td>
          <td>${staff.mobile ? `📞 ${staff.mobile}` : "-"}</td>
          <td>
            <div style="font-size:0.85rem; font-weight:600;">${assignedLines}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${custCount} ગ્રાહકો</div>
          </td>
          <td>${lastPaidText}</td>
          <td style="text-align:center;">
            <button class="btn btn-primary btn-sm" onclick="openStaffSalaryModal(${staff.id}, '${staff.role}')" style="font-weight:600; padding:5px 12px;">
              💼 પગાર ચુકવો
            </button>
          </td>
        `;
        salaryTbody.appendChild(tr);
      });
    }
  }

  // 5. Render Sub Tab 3: Bank Accounts Cards & Passbook
  const bankCardsContainer = document.getElementById("bankAccountsContainer");
  if (bankCardsContainer) {
    bankCardsContainer.innerHTML = "";
    if (bankAccounts.length === 0) {
      bankCardsContainer.innerHTML = `<div style="color:var(--text-dim); padding:1rem;">કોઈ બેંક ખાતું ઉમેરેલ નથી. ઉપરના બટન પરથી ખાતું ઉમેરો.</div>`;
    } else {
      bankAccounts.forEach(acc => {
        const bal = Number(acc.currentBalance) || 0;
        const card = document.createElement("div");
        card.style.cssText = "background:rgba(30, 41, 59, 0.7); border:1px solid rgba(56, 189, 248, 0.25); border-radius:10px; padding:1rem; position:relative;";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
            <div>
              <div style="font-size:1.05rem; font-weight:700; color:#38bdf8;">${acc.name}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${acc.accountNo ? `A/C: ${acc.accountNo}` : ''} ${acc.branch ? `• ${acc.branch}` : ''}</div>
              ${acc.ifsc && acc.ifsc !== '-' ? `<div style="font-size:0.75rem; color:var(--text-dim);">IFSC: ${acc.ifsc}</div>` : ''}
            </div>
            <div style="display:flex; gap:4px;">
              <button class="btn btn-secondary btn-icon" style="padding:2px 6px; font-size:0.75rem;" onclick="openAddBankModal(${acc.id})" title="એડિટ">✏️</button>
              <button class="btn btn-danger btn-icon" style="padding:2px 6px; font-size:0.75rem;" onclick="deleteBankAccount(${acc.id})" title="હટાવો">🗑️</button>
            </div>
          </div>
          <div style="margin:0.8rem 0; padding:0.6rem; background:rgba(15, 23, 42, 0.6); border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.82rem; color:var(--text-muted);">ઉપલબ્ધ બેલેન્સ (Balance):</span>
            <b style="font-size:1.3rem; color:${bal >= 0 ? '#34d399' : '#fb7185'};">₹${Math.round(bal).toLocaleString("gu-IN")}</b>
          </div>
          <div style="display:flex; gap:8px; margin-top:0.6rem;">
            <button class="btn btn-sm btn-success" style="flex:1; padding:5px 8px; font-size:0.82rem;" onclick="openBankTxModal(${acc.id}, 'deposit')">
              📥 + જમા (Deposit)
            </button>
            <button class="btn btn-sm btn-danger" style="flex:1; padding:5px 8px; font-size:0.82rem;" onclick="openBankTxModal(${acc.id}, 'withdrawal')">
              📤 - ઉપાડ (Withdraw)
            </button>
          </div>
        `;
        bankCardsContainer.appendChild(card);
      });
    }
  }

  // 6. Render Bank Transactions Passbook
  const bankTxTbody = document.getElementById("bankTxTbody");
  if (bankTxTbody) {
    bankTxTbody.innerHTML = "";
    // Sort transactions by date descending
    const sortedTx = [...bankTransactions].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id - a.id));

    if (sortedTx.length === 0) {
      bankTxTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-dim); padding:2rem;">કોઈ બેંક ટ્રાન્ઝેક્શન નોંધાયેલ નથી.</td></tr>`;
    } else {
      sortedTx.slice(0, 50).forEach(tx => {
        const amt = Number(tx.amount) || 0;
        const bankObj = bankMap.get(parseInt(tx.bankAccountId, 10));
        const bankTitle = bankObj ? bankObj.name : `ખાતું #${tx.bankAccountId}`;
        const isDep = (tx.type === "deposit");

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-family:monospace;">${formatDisplayDate(tx.date)}</td>
          <td style="font-weight:600; color:#38bdf8;">${bankTitle}</td>
          <td>
            <span class="badge ${isDep ? 'badge-emerald' : 'badge-rose'}">
              ${isDep ? '📥 જમા (Deposit)' : (tx.type === 'bank_charge' ? '🏦 ચાર્જિસ' : '📤 ઉપાડ (Withdrawal)')}
            </span>
          </td>
          <td>
            <div style="font-size:0.88rem;">${tx.description || "-"}</div>
            ${tx.source ? `<small style="color:var(--text-dim);">[સ્રોત: ${tx.source}]</small>` : ""}
          </td>
          <td style="text-align:right; font-weight:700; font-size:1.05rem; color:${isDep ? '#34d399' : '#fb7185'};">
            ${isDep ? '+' : '-'}₹${amt.toLocaleString("gu-IN")}
          </td>
        `;
        bankTxTbody.appendChild(tr);
      });
    }
  }
}
window.renderExpensesView = renderExpensesView;

// --- EXPENSE MODAL CRUD ---
async function openAddExpenseModal(id = null) {
  const bankAccounts = (await window.vendorDB.getAll("bank_accounts")) || [];
  const salesmen = (await window.vendorDB.getAll("salesmen")) || [];
  const collectionMen = (await window.vendorDB.getAll("collectionMen")) || [];

  // 1. Populate Bank Accounts Dropdown
  const bankSelect = document.getElementById("expBankAccountId");
  if (bankSelect) {
    bankSelect.innerHTML = `<option value="">-- બેંક ખાતું પસંદ કરો --</option>`;
    bankAccounts.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = `${b.name} (શિલક: ₹${Math.round(b.currentBalance)})`;
      bankSelect.appendChild(opt);
    });
  }

  // 2. Populate Staff Select Dropdown
  const staffSelect = document.getElementById("expStaffSelect");
  if (staffSelect) {
    staffSelect.innerHTML = `<option value="">-- સ્ટાફ સભ્ય પસંદ કરો --</option>`;
    salesmen.forEach(s => {
      const opt = document.createElement("option");
      opt.value = `salesman_${s.id}`;
      opt.dataset.name = s.name;
      opt.textContent = `🛵 ${s.name} (વિતરક)`;
      staffSelect.appendChild(opt);
    });
    collectionMen.forEach(c => {
      const opt = document.createElement("option");
      opt.value = `coll_${c.id}`;
      opt.dataset.name = c.name;
      opt.textContent = `💼 ${c.name} (ઉઘરાણી સ્ટાફ)`;
      staffSelect.appendChild(opt);
    });
  }

  const todayStr = new Date().toISOString().split("T")[0];

  if (id) {
    const exp = await window.vendorDB.get("expenses", parseInt(id, 10));
    if (exp) {
      document.getElementById("expenseId").value = exp.id;
      document.getElementById("expDate").value = exp.date || todayStr;
      document.getElementById("expCategory").value = exp.category || "other";
      document.getElementById("expPayeeName").value = exp.payeeName || "";
      document.getElementById("expAmount").value = exp.amount || "";
      document.getElementById("expPaymentMode").value = exp.paymentMode || "cash";
      if (bankSelect && exp.bankAccountId) bankSelect.value = exp.bankAccountId;
      document.getElementById("expNotes").value = exp.notes || "";
      document.getElementById("expenseModalTitle").textContent = "ખર્ચ સુધારો (Edit Expense)";
    }
  } else {
    document.getElementById("expenseId").value = "";
    const form = document.getElementById("expenseForm");
    if (form) form.reset();
    document.getElementById("expDate").value = todayStr;
    document.getElementById("expenseModalTitle").textContent = "નવો ખર્ચ નોંધો (Add Expense)";
  }

  onExpenseCategoryChange();
  onExpensePaymentModeChange();
  openModal("addExpenseModal");
}
window.openAddExpenseModal = openAddExpenseModal;

function onExpenseCategoryChange() {
  const cat = document.getElementById("expCategory")?.value;
  const staffGroup = document.getElementById("expStaffSelectGroup");
  if (staffGroup) {
    staffGroup.style.display = (cat === "salary") ? "block" : "none";
  }
}
window.onExpenseCategoryChange = onExpenseCategoryChange;

function onExpenseStaffSelectChange() {
  const select = document.getElementById("expStaffSelect");
  if (!select) return;
  const opt = select.selectedOptions[0];
  if (opt && opt.dataset.name) {
    document.getElementById("expPayeeName").value = opt.dataset.name;
  }
}
window.onExpenseStaffSelectChange = onExpenseStaffSelectChange;

function onExpensePaymentModeChange() {
  const mode = document.getElementById("expPaymentMode")?.value;
  const bGroup = document.getElementById("expBankAccountGroup");
  if (bGroup) {
    bGroup.style.display = (mode === "bank" || mode === "cheque") ? "block" : "none";
  }
}
window.onExpensePaymentModeChange = onExpensePaymentModeChange;

async function saveExpense(e) {
  e.preventDefault();
  try {
    const idVal = document.getElementById("expenseId").value;
    const dateVal = document.getElementById("expDate").value;
    const catVal = document.getElementById("expCategory").value;
    const payeeVal = document.getElementById("expPayeeName").value.trim();
    const amtVal = parseFloat(document.getElementById("expAmount").value) || 0;
    const modeVal = document.getElementById("expPaymentMode").value;
    const bankVal = document.getElementById("expBankAccountId")?.value;
    const notesVal = document.getElementById("expNotes").value.trim();

    if (amtVal <= 0) {
      alert("કૃપા કરીને માન્ય રકમ દાખલ કરો.");
      return;
    }

    const expData = {
      date: dateVal,
      category: catVal,
      payeeName: payeeVal,
      amount: amtVal,
      paymentMode: modeVal,
      bankAccountId: (modeVal === "bank" || modeVal === "cheque") && bankVal ? parseInt(bankVal, 10) : (modeVal === "cash" ? 1 : null),
      notes: notesVal
    };

    if (idVal) {
      expData.id = parseInt(idVal, 10);
    }

    await window.vendorDB.recordExpense(expData);
    closeModal("addExpenseModal");
    showToast("ખર્ચ સફળતાપૂર્વક સાચવી લેવાયો છે! 💸");
    await renderExpensesView();
  } catch (err) {
    console.error("Error saving expense:", err);
    alert("ખર્ચ સાચવવામાં ભૂલ આવી: " + err.message);
  }
}
window.saveExpense = saveExpense;

async function deleteExpense(id) {
  if (confirm("શું તમે આ ખર્ચની નોંધ હટાવવા માંગો છો?")) {
    await window.vendorDB.deleteExpense(id);
    showToast("ખર્ચ હટાવી દીધો છે!");
    await renderExpensesView();
  }
}
window.deleteExpense = deleteExpense;

// --- STAFF SALARY MODAL CRUD ---
async function openStaffSalaryModal(preselectStaffId = null, preselectRole = null) {
  const salesmen = (await window.vendorDB.getAll("salesmen")) || [];
  const collectionMen = (await window.vendorDB.getAll("collectionMen")) || [];

  const staffSelect = document.getElementById("salaryStaffSelect");
  if (staffSelect) {
    staffSelect.innerHTML = `<option value="">-- સ્ટાફ સભ્ય પસંદ કરો --</option>`;
    salesmen.forEach(s => {
      const opt = document.createElement("option");
      opt.value = `salesman_${s.id}`;
      opt.dataset.id = s.id;
      opt.dataset.role = "salesman";
      opt.dataset.name = s.name;
      opt.dataset.comm = s.commission || "";
      opt.textContent = `🛵 ${s.name} (વિતરક)`;
      staffSelect.appendChild(opt);
    });
    collectionMen.forEach(c => {
      const opt = document.createElement("option");
      opt.value = `coll_${c.id}`;
      opt.dataset.id = c.id;
      opt.dataset.role = "collectionMan";
      opt.dataset.name = c.name;
      opt.dataset.comm = c.commission || "";
      opt.textContent = `💼 ${c.name} (ઉઘરાણી સ્ટાફ)`;
      staffSelect.appendChild(opt);
    });

    if (preselectStaffId && preselectRole) {
      staffSelect.value = (preselectRole === "salesman") ? `salesman_${preselectStaffId}` : `coll_${preselectStaffId}`;
    }
  }

  const today = new Date();
  const curMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = today.toISOString().split("T")[0];

  document.getElementById("salaryMonth").value = curMonth;
  document.getElementById("salaryDate").value = todayStr;
  document.getElementById("salaryDeduction").value = "0";

  onSalaryStaffSelectChange();
  openModal("staffSalaryModal");
}
window.openStaffSalaryModal = openStaffSalaryModal;

function onSalaryStaffSelectChange() {
  const select = document.getElementById("salaryStaffSelect");
  if (!select) return;
  const opt = select.selectedOptions[0];
  const baseInput = document.getElementById("salaryBaseAmount");
  if (opt && opt.dataset.comm && baseInput && (!baseInput.value || baseInput.value === "0")) {
    const commVal = parseFloat(opt.dataset.comm);
    if (!isNaN(commVal)) {
      baseInput.value = commVal;
    }
  }
  calculateSalaryNet();
}
window.onSalaryStaffSelectChange = onSalaryStaffSelectChange;

function calculateSalaryNet() {
  const base = parseFloat(document.getElementById("salaryBaseAmount")?.value) || 0;
  const ded = parseFloat(document.getElementById("salaryDeduction")?.value) || 0;
  const net = Math.max(0, base - ded);

  const displayEl = document.getElementById("salaryNetDisplay");
  if (displayEl) {
    displayEl.textContent = `₹${Math.round(net).toLocaleString("gu-IN")}`;
  }
}
window.calculateSalaryNet = calculateSalaryNet;

async function saveStaffSalary(e) {
  e.preventDefault();
  try {
    const select = document.getElementById("salaryStaffSelect");
    const opt = select?.selectedOptions[0];
    if (!opt || !opt.value) {
      alert("કૃપા કરીને સ્ટાફ સભ્ય પસંદ કરો.");
      return;
    }

    const staffId = opt.dataset.id;
    const staffRole = opt.dataset.role;
    const staffName = opt.dataset.name;
    const month = document.getElementById("salaryMonth").value;
    const date = document.getElementById("salaryDate").value;
    const baseAmt = parseFloat(document.getElementById("salaryBaseAmount").value) || 0;
    const ded = parseFloat(document.getElementById("salaryDeduction").value) || 0;
    const mode = document.getElementById("salaryPayMode").value;
    const notes = document.getElementById("salaryNotes").value.trim();

    if (baseAmt <= 0) {
      alert("કૃપા કરીને મૂળ પગાર / કમિશન રકમ દાખલ કરો.");
      return;
    }

    await window.vendorDB.recordStaffSalary({
      staffId: staffId,
      staffRole: staffRole,
      staffName: staffName,
      month: month,
      date: date,
      baseAmount: baseAmt,
      deduction: ded,
      paymentMode: mode,
      notes: notes
    });

    closeModal("staffSalaryModal");
    showToast(`પગાર ચુકવણી સફળતાપૂર્વક સાચવી લીધી છે! (${staffName} - ₹${Math.round(baseAmt - ded)}) 💼`);
    await renderExpensesView();
  } catch (err) {
    console.error("Error saving salary:", err);
    alert("પગાર સાચવવામાં ભૂલ આવી: " + err.message);
  }
}
window.saveStaffSalary = saveStaffSalary;

// --- BANK ACCOUNT MODAL CRUD ---
async function openAddBankModal(id = null) {
  if (id) {
    const acc = await window.vendorDB.get("bank_accounts", parseInt(id, 10));
    if (acc) {
      document.getElementById("bankAccountId").value = acc.id;
      document.getElementById("bankType").value = acc.type || "bank";
      document.getElementById("bankName").value = acc.name || "";
      document.getElementById("bankAccountNo").value = acc.accountNo || "";
      document.getElementById("bankBranch").value = acc.branch || "";
      document.getElementById("bankIFSC").value = acc.ifsc || "";
      document.getElementById("bankOpeningBal").value = acc.openingBalance || 0;
      document.getElementById("bankModalTitle").textContent = "બેંક ખાતામાં સુધારો (Edit Account)";
    }
  } else {
    document.getElementById("bankAccountId").value = "";
    const form = document.getElementById("bankForm");
    if (form) form.reset();
    document.getElementById("bankModalTitle").textContent = "બેંક એકાઉન્ટ / કેશ કાઉન્ટર ઉમેરો";
  }
  openModal("addBankModal");
}
window.openAddBankModal = openAddBankModal;

async function saveBankAccount(e) {
  e.preventDefault();
  try {
    const idVal = document.getElementById("bankAccountId").value;
    const type = document.getElementById("bankType").value;
    const name = document.getElementById("bankName").value.trim();
    const acNo = document.getElementById("bankAccountNo").value.trim();
    const branch = document.getElementById("bankBranch").value.trim();
    const ifsc = document.getElementById("bankIFSC").value.trim();
    const openBal = parseFloat(document.getElementById("bankOpeningBal").value) || 0;

    const bankData = {
      type,
      name,
      accountNo: acNo,
      branch,
      ifsc,
      openingBalance: openBal,
      currentBalance: openBal
    };

    if (idVal) {
      bankData.id = parseInt(idVal, 10);
      const existing = await window.vendorDB.get("bank_accounts", bankData.id);
      if (existing) {
        // preserve current balance difference
        const diff = openBal - (existing.openingBalance || 0);
        bankData.currentBalance = (existing.currentBalance || 0) + diff;
      }
    }

    await window.vendorDB.put("bank_accounts", bankData);
    closeModal("addBankModal");
    showToast("બેંક ખાતું સફળતાપૂર્વક સાચવી લીધું છે! 🏦");
    await renderExpensesView();
  } catch (err) {
    console.error("Error saving bank account:", err);
    alert("બેંક ખાતું સાચવવામાં ભૂલ આવી: " + err.message);
  }
}
window.saveBankAccount = saveBankAccount;

async function deleteBankAccount(id) {
  if (confirm("શું તમે આ બેંક ખાતું હટાવવા માંગો છો?")) {
    await window.vendorDB.delete("bank_accounts", parseInt(id, 10));
    showToast("બેંક ખાતું હટાવી દીધું છે!");
    await renderExpensesView();
  }
}
window.deleteBankAccount = deleteBankAccount;

// --- BANK TRANSACTION MODAL CRUD ---
async function openBankTxModal(bankId = null, txType = "deposit") {
  const bankAccounts = (await window.vendorDB.getAll("bank_accounts")) || [];
  const bankSelect = document.getElementById("txBankId");
  if (bankSelect) {
    bankSelect.innerHTML = "";
    bankAccounts.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = `${b.name} (શિલક: ₹${Math.round(b.currentBalance)})`;
      bankSelect.appendChild(opt);
    });
    if (bankId) bankSelect.value = bankId;
  }

  document.getElementById("txType").value = txType;
  document.getElementById("txDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("txAmount").value = "";
  document.getElementById("txDescription").value = (txType === "deposit") ? "રોકડ જમા કરાવી" : "રોકડ ઉપાડી";

  openModal("bankTxModal");
}
window.openBankTxModal = openBankTxModal;

async function saveBankTransaction(e) {
  e.preventDefault();
  try {
    const bankId = document.getElementById("txBankId").value;
    const type = document.getElementById("txType").value;
    const date = document.getElementById("txDate").value;
    const amt = parseFloat(document.getElementById("txAmount").value) || 0;
    const desc = document.getElementById("txDescription").value.trim();

    if (!bankId) {
      alert("કૃપા કરીને બેંક ખાતું પસંદ કરો.");
      return;
    }
    if (amt <= 0) {
      alert("કૃપા કરીને માન્ય રકમ દાખલ કરો.");
      return;
    }

    await window.vendorDB.recordBankTransaction({
      bankAccountId: parseInt(bankId, 10),
      type: type,
      date: date,
      amount: amt,
      description: desc,
      source: "manual"
    });

    closeModal("bankTxModal");
    showToast(`ટ્રાન્ઝેક્શન સફળતાપૂર્વક સાચવી લેવાયું છે! (${type === 'deposit' ? 'જમા' : 'ઉપાડ'}: ₹${amt}) 💳`);
    await renderExpensesView();
  } catch (err) {
    console.error("Error saving bank transaction:", err);
    alert("ટ્રાન્ઝેક્શન સાચવવામાં ભૂલ આવી: " + err.message);
  }
}
window.saveBankTransaction = saveBankTransaction;

// -------------------------------------------------------------
// UI Modal & Toast Utilities
// -------------------------------------------------------------
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    // Ensure form inside modal is focused on first input
    const firstInput = modal.querySelector("input:not([type=hidden]), select, textarea");
    if (firstInput) firstInput.focus();
  }
}
window.openModal = openModal;

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
}
window.closeModal = closeModal;

function showToast(msg) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>✨</span> <span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
window.showToast = showToast;

// Global listener to close modals when clicking backdrop or pressing Escape
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.active").forEach(m => m.classList.remove("active"));
  }
});

// =============================================================
// ROUTE ORDER & SEQUENCE ORGANIZER CONTROLLER (DRAG & DROP)
// =============================================================
let currentRouteOrderList = [];
let draggedOrderRowIndex = null;

async function openRouteOrderModal(targetRouteId = null) {
  const routes = await window.vendorDB.getAll("routes");
  if (!routes || routes.length === 0) {
    alert("કોઈ ડિલિવરી લાઇન ઉપલબ્ધ નથી.");
    return;
  }

  const select = document.getElementById("routeOrderSelectRoute");
  if (select) {
    select.innerHTML = "";
    routes.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.code} - ${r.name}`;
      select.appendChild(opt);
    });

    const activeFilterVal = document.getElementById("custRouteFilter")?.value;
    if (targetRouteId) {
      select.value = targetRouteId;
    } else if (activeFilterVal && activeFilterVal !== "all") {
      select.value = activeFilterVal;
    } else {
      select.value = routes[0].id;
    }
  }

  await loadCustomersForRouteOrder();
  openModal("routeOrderModal");
}
window.openRouteOrderModal = openRouteOrderModal;

async function loadCustomersForRouteOrder() {
  const routeSelect = document.getElementById("routeOrderSelectRoute");
  const routeId = parseInt(routeSelect?.value) || 1;

  const routes = await window.vendorDB.getAll("routes") || [];
  const salesmen = await window.vendorDB.getAll("salesmen") || [];
  const collectionMen = await window.vendorDB.getAll("collectionMen") || [];
  const items = await window.vendorDB.getAll("items") || [];
  const itemMap = new Map(items.map(i => [i.id, i.name]));

  const routeObj = routes.find(r => r.id === routeId);
  const sm = routeObj?.salesmanId ? salesmen.find(s => s.id === routeObj.salesmanId) : null;
  const cm = routeObj?.collectionManId ? collectionMen.find(c => c.id === routeObj.collectionManId) : null;

  const infoEl = document.getElementById("routeOrderStaffInfo");
  if (infoEl) {
    infoEl.innerHTML = `
      🚴‍♂️ વિતરક: <b style="color:#38bdf8;">${sm ? sm.name : '-'}</b> | 
      💼 ઉઘરાણી સ્ટાફ: <b style="color:#34d399;">${cm ? cm.name : '-'}</b>
    `;
  }

  const allCusts = await window.vendorDB.getAll("customers") || [];
  currentRouteOrderList = allCusts
    .filter(c => c.routeId === routeId)
    .sort((a, b) => (Number(a.sequenceNo) || 0) - (Number(b.sequenceNo) || 0));

  renderRouteOrderList(itemMap);
}
window.loadCustomersForRouteOrder = loadCustomersForRouteOrder;

function renderRouteOrderList(itemMap = null) {
  const tbody = document.getElementById("routeOrderTbody");
  const countBadge = document.getElementById("routeOrderCountBadge");
  if (countBadge) {
    countBadge.textContent = `કુલ: ${currentRouteOrderList.length} ગ્રાહકો (આ લાઇનમાં)`;
  }
  if (!tbody) return;
  tbody.innerHTML = "";

  if (currentRouteOrderList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-dim);">આ લાઇનમાં કોઈ ગ્રાહકો મળ્યા નથી.</td></tr>`;
    return;
  }

  currentRouteOrderList.forEach((cust, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;
    tr.draggable = true;

    const subList = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
    const paperNames = itemMap ? subList.map(id => itemMap.get(id)).filter(Boolean).join(", ") : "";

    tr.innerHTML = `
      <td style="text-align:center;">
        <span class="drag-handle" title="માઉસ વડે પકડીને ઉપર-નીચે ખસેડો">⋮⋮</span>
      </td>
      <td style="text-align:center; font-weight:700; color:var(--accent-cyan); font-size:1rem;">
        ${index + 1}
      </td>
      <td style="text-align:center; font-family:monospace; color:#38bdf8; font-weight:600;">
        #${cust.custNo || cust.id}
      </td>
      <td>
        <div style="font-weight:600;">
          ${cust.societyShort ? `<span class="badge" style="background:#2563eb; color:#fff; font-size:0.68rem; margin-right:4px;">${cust.societyShort}</span>` : ''}
          ${cust.name}
        </div>
        <div style="font-size:0.75rem; color:var(--text-dim);">${cust.address || "-"}</div>
      </td>
      <td style="font-size:0.8rem; color:var(--accent-amber);">
        ${paperNames || "-"}
      </td>
      <td style="text-align:center;">
        <div style="display:flex; justify-content:center; gap:4px;">
          <button type="button" class="btn-order-move" onclick="moveRouteOrderItem(${index}, ${index - 1})" ${index === 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} title="ઉપર ખસેડો">⬆️</button>
          <button type="button" class="btn-order-move" onclick="moveRouteOrderItem(${index}, ${index + 1})" ${index === currentRouteOrderList.length - 1 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} title="નીચે ખસેડો">⬇️</button>
        </div>
      </td>
    `;

    // Drag and Drop Event Listeners
    tr.addEventListener("dragstart", (e) => {
      draggedOrderRowIndex = index;
      tr.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index);
    });

    tr.addEventListener("dragend", () => {
      tr.classList.remove("is-dragging");
      document.querySelectorAll("#routeOrderTbody tr").forEach(row => {
        row.classList.remove("drag-over-top", "drag-over-bottom");
      });
    });

    tr.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = tr.getBoundingClientRect();
      const offset = e.clientY - rect.top;
      if (offset < rect.height / 2) {
        tr.classList.add("drag-over-top");
        tr.classList.remove("drag-over-bottom");
      } else {
        tr.classList.add("drag-over-bottom");
        tr.classList.remove("drag-over-top");
      }
    });

    tr.addEventListener("dragleave", () => {
      tr.classList.remove("drag-over-top", "drag-over-bottom");
    });

    tr.addEventListener("drop", (e) => {
      e.preventDefault();
      tr.classList.remove("drag-over-top", "drag-over-bottom");
      const fromIndex = draggedOrderRowIndex;
      const rect = tr.getBoundingClientRect();
      const offset = e.clientY - rect.top;
      let toIndex = index;
      if (offset >= rect.height / 2) {
        toIndex = index + 1;
      }
      if (fromIndex !== null && fromIndex !== toIndex) {
        const item = currentRouteOrderList.splice(fromIndex, 1)[0];
        if (fromIndex < toIndex) {
          toIndex--;
        }
        currentRouteOrderList.splice(toIndex, 0, item);
        renderRouteOrderList(itemMap);
      }
    });

    tbody.appendChild(tr);
  });
}

function moveRouteOrderItem(fromIdx, toIdx) {
  if (fromIdx < 0 || fromIdx >= currentRouteOrderList.length) return;
  if (toIdx < 0 || toIdx >= currentRouteOrderList.length) return;

  const item = currentRouteOrderList.splice(fromIdx, 1)[0];
  currentRouteOrderList.splice(toIdx, 0, item);

  window.vendorDB.getAll("items").then(items => {
    const itemMap = new Map(items.map(i => [i.id, i.name]));
    renderRouteOrderList(itemMap);
  });
}
window.moveRouteOrderItem = moveRouteOrderItem;

async function saveRouteOrder() {
  const routeSelect = document.getElementById("routeOrderSelectRoute");
  const routeId = parseInt(routeSelect?.value) || 1;
  const syncColl = document.getElementById("routeOrderSyncColl")?.checked !== false;

  if (currentRouteOrderList.length === 0) {
    closeModal("routeOrderModal");
    return;
  }

  const orderedIds = currentRouteOrderList.map(c => c.id);
  await window.vendorDB.updateRouteSequence(routeId, orderedIds, syncColl);

  closeModal("routeOrderModal");
  showToast(`લાઇનનો નવો ક્રમ સફળતાપૂર્વક સાચવી લેવાયો છે! (${orderedIds.length} ગ્રાહકો)`);
  await refreshAllViews();
}
window.saveRouteOrder = saveRouteOrder;

// -------------------------------------------------------------
// 12. WHATSAPP EXPRESS BILL DISPATCHER (AUTO-QUEUE CONTROLLER)
// -------------------------------------------------------------
let waQueueState = {
  rawBills: [],
  filteredBills: [],
  currentIndex: 0,
  monthYear: "",
  customersMap: new Map(),
  firm: {},
  items: [],
  salesmen: [],
  collectionMen: [],
  isProcessing: false
};

let waExtensionActive = false;
let waAutoLoopRunning = false;
let waBroadcastChannel = null;

function initWhatsAppExtensionBridge() {
  if (waBroadcastChannel) return;
  try {
    waBroadcastChannel = new BroadcastChannel("vendorsoft_wa_channel");
    
    waBroadcastChannel.onmessage = async (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === "EXTENSION_READY") {
        waExtensionActive = true;
        updateExtensionStatusUI(true);
      } else if (msg.type === "AUTO_ADVANCE_NEXT") {
        console.log("Received AUTO_ADVANCE_NEXT for:", msg.customerName, "billId:", msg.billId);
        showToast(`✅ WhatsApp સફળ: ${msg.customerName || 'ગ્રાહક'}`);

        // Find the specific bill that was just dispatched
        const allBills = await window.vendorDB.getAll("bills");
        let targetBill = waQueueState.filteredBills.find(b => String(b.id) === String(msg.billId));
        if (!targetBill) {
          targetBill = allBills.find(b => String(b.id) === String(msg.billId));
        }

        if (targetBill) {
          targetBill.whatsappSent = true;
          targetBill.whatsappSentAt = new Date().toISOString();
          await window.vendorDB.put("bills", targetBill);
          
          const rawIdx = waQueueState.rawBills.findIndex(b => String(b.id) === String(targetBill.id));
          if (rawIdx !== -1) {
            waQueueState.rawBills[rawIdx].whatsappSent = true;
            waQueueState.rawBills[rawIdx].whatsappSentAt = targetBill.whatsappSentAt;
          }
        }

        // Re-apply filters to update queue list & counters
        applyWhatsAppQueueFilters();

        // If auto loop is on, trigger next bill after user-selected delay
        if (waAutoLoopRunning) {
          const delayMs = parseInt(document.getElementById("waQueueDelaySelect")?.value || 3500);
          showToast(`⏳ આગામી ગ્રાહક પર જઈ રહ્યું છે (${(delayMs / 1000).toFixed(1)} સે.)...`);
          setTimeout(() => {
            if (waAutoLoopRunning) {
              if (waQueueState.filteredBills.length > 0) {
                sendWhatsAppQueueNext();
              } else {
                stopWhatsAppAutoLoop();
                showToast("🎉 અભિનંદન! તમામ બિલ ઓટોમેટિક મોકલાઈ ગયા છે!");
              }
            }
          }, delayMs);
        }
      } else if (msg.type === "SEND_ERROR") {
        console.error("WhatsApp Extension error:", msg.error);
        showToast(`⚠️ WhatsApp મોકલવામાં એરર: ${msg.error}`);
        if (waAutoLoopRunning) {
          stopWhatsAppAutoLoop();
        }
      }
    };

    // Ping extension
    waBroadcastChannel.postMessage({ type: "CHECK_EXTENSION" });
  } catch (err) {
    console.warn("BroadcastChannel error:", err);
  }
}

function updateExtensionStatusUI(isConnected) {
  const dot = document.getElementById("waExtensionDot");
  const text = document.getElementById("waExtensionStatusText");
  const badge = document.getElementById("waExtensionStatusBadge");
  if (!dot || !text || !badge) return;

  if (isConnected) {
    dot.style.background = "#22c55e";
    dot.style.boxShadow = "0 0 8px #22c55e";
    text.textContent = "🟢 WhatsApp Web કનેક્ટેડ છે (સિંગલ ટેબ મોડ સક્રિય)";
    text.style.color = "#86efac";
    badge.style.borderColor = "#22c55e";
  } else {
    dot.style.background = "#f59e0b";
    dot.style.boxShadow = "none";
    text.textContent = "⚪ Extension સક્રિય કરવા web.whatsapp.com પેજ Refresh કરો";
    text.style.color = "#fde68a";
    badge.style.borderColor = "#f59e0b";
  }
}

function toggleWhatsAppAutoLoop() {
  if (waAutoLoopRunning) {
    stopWhatsAppAutoLoop();
  } else {
    startWhatsAppAutoLoop();
  }
}
window.toggleWhatsAppAutoLoop = toggleWhatsAppAutoLoop;

function startWhatsAppAutoLoop() {
  const list = waQueueState.filteredBills;
  if (!list || list.length === 0) {
    showToast("ક્યૂમાં કોઈ બિલ બાકી નથી!");
    return;
  }

  waAutoLoopRunning = true;
  const btn = document.getElementById("waQueueAutoLoopBtn");
  const btnText = document.getElementById("waQueueAutoLoopBtnText");
  if (btn) {
    btn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
    btn.style.boxShadow = "0 4px 15px rgba(239, 68, 68, 0.4)";
  }
  if (btnText) {
    btnText.textContent = "⏸️ ઓટો-લૂપ થોભાવો (Pause Auto Loop)";
  }

  showToast("⚡ ઓટો-સેન્ડ લૂપ શરૂ થયું! એક પછી એક બિલ મોકલાઈ રહ્યું છે...");
  sendWhatsAppQueueNext();
}
window.startWhatsAppAutoLoop = startWhatsAppAutoLoop;

function stopWhatsAppAutoLoop() {
  waAutoLoopRunning = false;
  const btn = document.getElementById("waQueueAutoLoopBtn");
  const btnText = document.getElementById("waQueueAutoLoopBtnText");
  if (btn) {
    btn.style.background = "linear-gradient(135deg, #0284c7, #0369a1)";
    btn.style.boxShadow = "0 4px 15px rgba(2, 132, 199, 0.4)";
  }
  if (btnText) {
    btnText.textContent = "⚡ ૮૦૦ બિલ સિંગલ ટેબમાં ઓટો-સેન્ડ શરૂ કરો (Auto Loop)";
  }
  showToast("⏸️ ઓટો-સેન્ડ થોભાવેલ છે.");
}
window.stopWhatsAppAutoLoop = stopWhatsAppAutoLoop;

async function openWhatsAppExpressModal() {
  try {
    initWhatsAppExtensionBridge();
    if (waBroadcastChannel) {
      waBroadcastChannel.postMessage({ type: "CHECK_EXTENSION" });
    }

    const monthSelect = document.getElementById("billingMonthSelect");
    const yearSelect = document.getElementById("billingYearSelect");
    const month = parseInt(monthSelect?.value || 9);
    const year = parseInt(yearSelect?.value || 2026);
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    const [allBills, customers, routes, items, salesmen, collectionMen, firm] = await Promise.all([
      window.vendorDB.getAll("bills"),
      window.vendorDB.getAll("customers"),
      window.vendorDB.getAll("routes") || [],
      window.vendorDB.getAll("items"),
      window.vendorDB.getAll("salesmen") || [],
      window.vendorDB.getAll("collectionMen") || [],
      cachedAgency || window.vendorDB.get("firms", "primary") || {}
    ]);

    waQueueState.monthYear = monthKey;
    waQueueState.rawBills = allBills.filter(b => b.monthYear === monthKey);
    waQueueState.customersMap = new Map(customers.map(c => [c.id, c]));
    waQueueState.firm = firm;
    waQueueState.items = items;
    waQueueState.salesmen = salesmen;
    waQueueState.collectionMen = collectionMen;

    // Populate route filter
    const rSelect = document.getElementById("waQueueRouteSelect");
    if (rSelect) {
      rSelect.innerHTML = `<option value="all">બધી લાઇન</option>`;
      routes.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = `${r.code} - ${r.name}`;
        rSelect.appendChild(opt);
      });
    }

    applyWhatsAppQueueFilters();
    openModal("whatsAppExpressModal");
    updateExtensionStatusUI(waExtensionActive);
  } catch (err) {
    console.error("Error opening WhatsApp Express Dispatcher:", err);
    showToast("WhatsApp ડિસ્પેચર ખોલવામાં ભૂલ આવી: " + err.message);
  }
}
window.openWhatsAppExpressModal = openWhatsAppExpressModal;

function onWhatsAppQueueFilterChange() {
  applyWhatsAppQueueFilters();
}
window.onWhatsAppQueueFilterChange = onWhatsAppQueueFilterChange;

function applyWhatsAppQueueFilters() {
  const routeVal = document.getElementById("waQueueRouteSelect")?.value || "all";
  const statusVal = document.getElementById("waQueueStatusSelect")?.value || "pending_only";
  const query = (document.getElementById("waQueueSearchInput")?.value || "").toLowerCase().trim();

  let list = [...waQueueState.rawBills];

  // Route filter
  if (routeVal !== "all") {
    list = list.filter(b => {
      const cust = waQueueState.customersMap.get(b.customerId);
      return String(b.routeId || cust?.routeId) === String(routeVal);
    });
  }

  // Search filter
  if (query) {
    list = list.filter(b => {
      const cust = waQueueState.customersMap.get(b.customerId) || {};
      const name = (cust.name || b.customerName || "").toLowerCase();
      const code = (cust.code || "").toLowerCase();
      const billNo = (b.billNo || "").toLowerCase();
      const mobile = (cust.mobile || cust.whatsapp || "").toLowerCase();
      return name.includes(query) || code.includes(query) || billNo.includes(query) || mobile.includes(query);
    });
  }

  // Sort by delivery sequence
  list.sort((a, b) => {
    const custA = waQueueState.customersMap.get(a.customerId) || {};
    const custB = waQueueState.customersMap.get(b.customerId) || {};
    const seqA = a.deliverySequence || custA.sequenceNo || 999999;
    const seqB = b.deliverySequence || custB.sequenceNo || 999999;
    return seqA - seqB;
  });

  // Calculate totals before pending-only slicing for progress indicators
  const totalCount = list.length;
  const sentCount = list.filter(b => b.whatsappSent).length;
  const pendingCount = totalCount - sentCount;

  // Status Filter
  if (statusVal === "pending_only") {
    list = list.filter(b => !b.whatsappSent);
  } else if (statusVal === "sent_only") {
    list = list.filter(b => b.whatsappSent);
  }

  waQueueState.filteredBills = list;
  if (waQueueState.currentIndex >= list.length) {
    waQueueState.currentIndex = Math.max(0, list.length - 1);
  }

  updateWhatsAppQueueCounters(totalCount, sentCount, pendingCount);
  renderWhatsAppQueueCurrentCustomer();
}
window.applyWhatsAppQueueFilters = applyWhatsAppQueueFilters;

function updateWhatsAppQueueCounters(totalCount, sentCount, pendingCount) {
  const percent = totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;
  
  const totalEl = document.getElementById("waQueueTotalCount");
  if (totalEl) totalEl.textContent = totalCount;

  const sentEl = document.getElementById("waQueueSentCount");
  if (sentEl) sentEl.textContent = sentCount;

  const pendingEl = document.getElementById("waQueuePendingCount");
  if (pendingEl) pendingEl.textContent = pendingCount;

  const pctEl = document.getElementById("waQueuePercent");
  if (pctEl) pctEl.textContent = `${percent}%`;

  const barEl = document.getElementById("waQueueProgressBar");
  if (barEl) barEl.style.width = `${percent}%`;
}

function renderWhatsAppQueueCurrentCustomer() {
  const list = waQueueState.filteredBills;
  const idx = waQueueState.currentIndex;
  const container = document.getElementById("waQueueBillPreviewContainer");

  if (list.length === 0) {
    const posDisp = document.getElementById("waQueuePosDisplay");
    if (posDisp) posDisp.textContent = "0 / 0";

    const nameEl = document.getElementById("waQueueCustName");
    if (nameEl) nameEl.textContent = "કોઈ બાકી બિલ નથી!";

    const addrEl = document.getElementById("waQueueCustAddress");
    if (addrEl) addrEl.textContent = "આ ફિલ્ટર મુજબ તમામ બિલ મોકલાઈ ગયા છે અથવા કોઈ બિલ મળ્યા નથી.";

    const mobEl = document.getElementById("waQueueCustMobile");
    if (mobEl) mobEl.textContent = "-";

    const metaEl = document.getElementById("waQueueBillMeta");
    if (metaEl) metaEl.textContent = "-";

    const totalEl = document.getElementById("waQueueBillTotal");
    if (totalEl) totalEl.textContent = "₹0.00";

    const seqBadge = document.getElementById("waQueueSeqBadge");
    if (seqBadge) seqBadge.textContent = "ક્રમ: #-";

    const sendBtn = document.getElementById("waQueueSendBtn");
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.style.opacity = "0.5";
      sendBtn.style.pointerEvents = "none";
    }

    if (container) {
      container.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: #94a3b8;">
          <div style="font-size: 3rem; margin-bottom: 10px;">🎉</div>
          <h3 style="color: #22c55e; margin: 0 0 6px 0;">અભિનંદન! તમામ બિલ મોકલાઈ ગયા છે</h3>
          <p style="font-size: 0.88rem; margin: 0;">ક્યૂમાં અન્ય કોઈ ગ્રાહક બાકી નથી.</p>
        </div>
      `;
    }
    return;
  }

  const sendBtn = document.getElementById("waQueueSendBtn");
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.style.opacity = "1";
    sendBtn.style.pointerEvents = "auto";
  }

  const bill = list[idx];
  const cust = waQueueState.customersMap.get(bill.customerId) || {};

  const posDisp = document.getElementById("waQueuePosDisplay");
  if (posDisp) posDisp.textContent = `${idx + 1} / ${list.length}`;

  const seqBadge = document.getElementById("waQueueSeqBadge");
  if (seqBadge) seqBadge.textContent = `ક્રમ: #${bill.deliverySequence || cust.sequenceNo || '-'}`;

  const nameEl = document.getElementById("waQueueCustName");
  if (nameEl) nameEl.textContent = cust.name || bill.customerName || "-";

  const addrEl = document.getElementById("waQueueCustAddress");
  if (addrEl) addrEl.textContent = `${cust.societyShort ? `[${cust.societyShort}] ` : ''}${cust.address || '-'}`;

  const mobEl = document.getElementById("waQueueCustMobile");
  if (mobEl) mobEl.textContent = `📞 ${cust.whatsapp || cust.mobile || 'મોબાઈલ નં. નથી'}`;

  const metaEl = document.getElementById("waQueueBillMeta");
  if (metaEl) metaEl.textContent = `#${bill.billNo || '-'} • ${bill.monthYear || '-'}`;

  const totalEl = document.getElementById("waQueueBillTotal");
  if (totalEl) totalEl.textContent = `₹${Number(bill.totalPayable).toFixed(2)}`;

  const markSentCb = document.getElementById("waQueueMarkSentCheckbox");
  if (markSentCb) markSentCb.checked = !!bill.whatsappSent;

  const sentBadge = document.getElementById("waQueueSentBadge");
  if (sentBadge) sentBadge.style.display = bill.whatsappSent ? "inline-block" : "none";

  // Render Visual Bill Preview
  if (container) {
    container.innerHTML = generateColorBillHTML(bill, cust, waQueueState.firm, waQueueState.items, waQueueState.salesmen, waQueueState.collectionMen);
  }
}

async function sendWhatsAppQueueNext() {
  const list = waQueueState.filteredBills;
  if (!list || list.length === 0) return;

  const bill = list[waQueueState.currentIndex];
  if (!bill) return;

  const cust = waQueueState.customersMap.get(bill.customerId) || {};
  const firm = waQueueState.firm || {};
  const items = waQueueState.items || [];
  const itemMap = new Map(items.map(i => [i.id, i.name]));

  const rawSubs = window.ensureSubscriptionsArray ? window.ensureSubscriptionsArray(cust.subscriptions) : (Array.isArray(cust.subscriptions) ? cust.subscriptions : []);
  const papers = rawSubs.map(id => itemMap.get(id)).filter(Boolean).join(", ");
  const mobile = (cust.whatsapp || cust.mobile || "").replace(/[^0-9]/g, "");

  const upiPayee = (firm.name || "PERFECT NEWSPAPER SUPPLIERS").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "VendorSoft";
  const upiLink = `upi://pay?pa=${encodeURIComponent(firm.upiId || "9825778607@okaxis")}&pn=${encodeURIComponent(upiPayee)}&am=${bill.totalPayable}&cu=INR&tn=Bill-${bill.billNo}`;

  let msg = `*${firm.name || 'PERFECT NEWSPAPER SUPPLIERS'}*\n`;
  msg += `----------------------------\n`;
  msg += `📰 *ગ્રાહક માસિક બિલ (Credit Memo)*\n`;
  msg += `👤 *ગ્રાહક (Customer):* ${cust.name || bill.customerName || '-'}\n`;
  msg += `📅 *બિલ માસ (Period):* ${bill.monthYear}\n`;
  msg += `🗞️ *પેપર્સ (Papers):* ${papers || 'નિયમિત ન્યૂઝપેપર્સ'}\n`;
  msg += `📦 *આવેલા દિવસો (Delivered):* ${bill.daysDelivered || 30} દિવસ\n`;
  if (bill.vacationDays > 0) {
    msg += `🌴 *રજાના દિવસો બાદ:* ${bill.vacationDays} દિવસ (-₹${bill.vacationDeduction})\n`;
  }
  msg += `💵 *આ મહિનાનું બિલ:* ₹${bill.currentAmount}\n`;
  if (bill.pastArrears > 0) {
    msg += `⏳ *જૂની બાકી રકમ:* ₹${bill.pastArrears}\n`;
  }
  msg += `----------------------------\n`;
  msg += `💰 *કુલ ભરવાપાત્ર રકમ: ₹${bill.totalPayable}*\n`;
  msg += `----------------------------\n`;
  const origin = window.location.origin || "http://localhost:5055";
  const paperAmtVal = (bill.currentAmount - (bill.deliveryCharge || 0)).toFixed(2);
  const digitalBillUrl = `${origin}/view_bill.html?billNo=${encodeURIComponent(bill.billNo || '')}&m=${encodeURIComponent(bill.monthYear || '')}&cust=${encodeURIComponent(cust.name || bill.customerName || '')}&caddr=${encodeURIComponent(cust.address || cust.societyShort || '')}&mob=${encodeURIComponent(mobile || '')}&total=${encodeURIComponent(bill.totalPayable || 0)}&paper=${encodeURIComponent(paperAmtVal)}&arrears=${encodeURIComponent(bill.pastArrears || 0)}&del=${encodeURIComponent(bill.deliveryCharge || 0)}&days=${encodeURIComponent(bill.daysDelivered || 30)}&papers=${encodeURIComponent(papers || 'ગુજરાત સમાચાર')}&upi=${encodeURIComponent(firm.upiId || '9825778607@okaxis')}&firm=${encodeURIComponent(firm.name || 'PERFECT NEWSPAPER SUPPLIERS')}&phone=${encodeURIComponent(firm.phone || '9825778607')}&owner=${encodeURIComponent(firm.ownerName || 'NIZAM TAI')}&seq=${encodeURIComponent(bill.deliverySequence || cust.sequenceNo || '')}`;

  const formatMode = document.getElementById("waQueueFormatSelect")?.value || "image_only";

  let finalMsg = "";
  if (formatMode === "image_only") {
    // Pure image mode: No long text body
    finalMsg = "";
  } else if (formatMode === "photo_and_text") {
    finalMsg = msg;
  } else {
    // Text + Link
    finalMsg = msg + `\n📸 *બિલ જોવા લિંક:* ${digitalBillUrl}\n`;
  }

  const encoded = encodeURIComponent(finalMsg);
  const cleanMobile = mobile.slice(-10);
  const mode = document.getElementById("waQueueModeSelect")?.value || "web_direct";

  let waUrl = "";
  let targetWindow = "whatsapp_web_window";

  if (mode === "app_direct") {
    waUrl = cleanMobile ? `whatsapp://send?phone=91${cleanMobile}${encoded ? '&text=' + encoded : ''}` : `whatsapp://send?${encoded ? 'text=' + encoded : ''}`;
  } else if (mode === "wame") {
    waUrl = cleanMobile ? `https://wa.me/91${cleanMobile}${encoded ? '?text=' + encoded : ''}` : `https://wa.me/${encoded ? '?text=' + encoded : ''}`;
    targetWindow = "whatsapp_web_window";
  } else {
    // Default: Direct WhatsApp Web / WhatsApp Business in the SAME active window
    waUrl = cleanMobile ? `https://web.whatsapp.com/send?phone=91${cleanMobile}${encoded ? '&text=' + encoded : ''}` : `https://web.whatsapp.com/send${encoded ? '?text=' + encoded : ''}`;
    targetWindow = "whatsapp_web_window";
  }
  
  // Generate HD bill image canvas
  const canvas = createColorBillCanvas(bill, cust, waQueueState.firm, waQueueState.items, waQueueState.salesmen, waQueueState.collectionMen);
  const imgData = canvas ? canvas.toDataURL("image/png") : "";

  // Prime clipboard with bill image
  try {
    if (canvas) {
      await copyCanvasToClipboard(canvas);
      console.log("✅ Clipboard primed with bill image for:", cust.name || bill.customerName);
    }
  } catch (e) {
    console.log("Auto clipboard image copy error:", e);
  }

  // If extension is active, dispatch to extension without opening extra tabs
  if (waExtensionActive) {
    showToast(`🚀 WhatsApp પર મોકલાઈ રહ્યું છે: ${cust.name || bill.customerName}`);
    try {
      const waBroadcast = waBroadcastChannel || new BroadcastChannel("vendorsoft_wa_channel");
      waBroadcast.postMessage({
        type: "DISPATCH_BILL_IMAGE",
        phone: cleanMobile,
        customerName: cust.name || bill.customerName || "Customer",
        billId: bill.id,
        imageBase64: imgData
      });
    } catch (bErr) {
      console.log("BroadcastChannel error:", bErr);
    }
  } else {
    // Fallback mode without extension
    if (mode === "app_direct") {
      window.location.href = waUrl;
    } else {
      window.open(waUrl, targetWindow);
    }

    // Mark bill as sent in Database
    bill.whatsappSent = true;
    bill.whatsappSentAt = new Date().toISOString();
    await window.vendorDB.put("bills", bill);

    // Update rawBills reference
    const rawIdx = waQueueState.rawBills.findIndex(b => b.id === bill.id);
    if (rawIdx !== -1) {
      waQueueState.rawBills[rawIdx].whatsappSent = true;
      waQueueState.rawBills[rawIdx].whatsappSentAt = bill.whatsappSentAt;
    }

    showToast(`🚀 બિલ મોકલાયું: ${cust.name || bill.customerName}`);

    // Advance queue
    const statusVal = document.getElementById("waQueueStatusSelect")?.value || "pending_only";
    if (statusVal === "pending_only") {
      applyWhatsAppQueueFilters();
    } else {
      if (waQueueState.currentIndex < waQueueState.filteredBills.length - 1) {
        waQueueState.currentIndex++;
      }
      applyWhatsAppQueueFilters();
    }
  }
}
window.sendWhatsAppQueueNext = sendWhatsAppQueueNext;

function skipWhatsAppQueue() {
  if (waQueueState.currentIndex < waQueueState.filteredBills.length - 1) {
    waQueueState.currentIndex++;
    renderWhatsAppQueueCurrentCustomer();
  } else {
    showToast("ક્યૂના અંતિમ બિલ પર પહોંચી ગયા છો.");
  }
}
window.skipWhatsAppQueue = skipWhatsAppQueue;

function prevWhatsAppQueue() {
  if (waQueueState.currentIndex > 0) {
    waQueueState.currentIndex--;
    renderWhatsAppQueueCurrentCustomer();
  } else {
    showToast("ક્યૂના પ્રથમ બિલ પર છો.");
  }
}
window.prevWhatsAppQueue = prevWhatsAppQueue;

async function toggleCurrentBillSentStatus(isSent) {
  const bill = waQueueState.filteredBills[waQueueState.currentIndex];
  if (!bill) return;

  bill.whatsappSent = isSent;
  bill.whatsappSentAt = isSent ? new Date().toISOString() : null;
  await window.vendorDB.put("bills", bill);

  const rawIdx = waQueueState.rawBills.findIndex(b => b.id === bill.id);
  if (rawIdx !== -1) {
    waQueueState.rawBills[rawIdx].whatsappSent = isSent;
    waQueueState.rawBills[rawIdx].whatsappSentAt = bill.whatsappSentAt;
  }

  showToast(isSent ? "✅ બિલ મોકલાઈ ગયેલ તરીકે નોંધાયું" : "⏳ બિલ બાકી તરીકે નોંધાયું");
  applyWhatsAppQueueFilters();
}
window.toggleCurrentBillSentStatus = toggleCurrentBillSentStatus;

async function resetWhatsAppQueueProgress() {
  if (!confirm(`શું તમે ${waQueueState.monthYear} માસના તમામ બિલ માટે WhatsApp મોકલ્યાનું સ્ટેટસ રીસેટ કરવા માંગો છો?`)) {
    return;
  }

  for (const b of waQueueState.rawBills) {
    b.whatsappSent = false;
    b.whatsappSentAt = null;
    await window.vendorDB.put("bills", b);
  }

  showToast("🔄 તમામ બિલ માટે સ્ટેટસ રીસેટ થઈ ગયું!");
  waQueueState.currentIndex = 0;
  applyWhatsAppQueueFilters();
}
window.resetWhatsAppQueueProgress = resetWhatsAppQueueProgress;

async function downloadCurrentQueueBillPNG() {
  const bill = waQueueState.filteredBills[waQueueState.currentIndex];
  if (!bill) return;
  currentViewingBillData = bill;
  currentViewingBillCustomer = waQueueState.customersMap.get(bill.customerId);
  await downloadColorBillPNG();
}
window.downloadCurrentQueueBillPNG = downloadCurrentQueueBillPNG;

// Helper: Write Canvas Image to Clipboard (Awaited while Document is focused)
async function copyCanvasToClipboard(canvas) {
  if (!canvas || !navigator.clipboard || !window.ClipboardItem) return false;
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return resolve(false);
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        console.log("✅ Clipboard write successful!");
        resolve(true);
      } catch (err) {
        console.warn("Clipboard write failed:", err);
        resolve(false);
      }
    }, "image/png");
  });
}
window.copyCanvasToClipboard = copyCanvasToClipboard;

async function copyCurrentQueueBillImage() {
  const bill = waQueueState.filteredBills[waQueueState.currentIndex];
  if (!bill) return;
  const cust = waQueueState.customersMap.get(bill.customerId) || {};

  try {
    const canvas = createColorBillCanvas(bill, cust, waQueueState.firm, waQueueState.items, waQueueState.salesmen, waQueueState.collectionMen);
    if (!canvas) return;

    const ok = await copyCanvasToClipboard(canvas);
    if (ok) {
      showToast(`📋 ${cust.name || bill.customerName || 'ગ્રાહક'} નું બિલ ઈમેજ ક્લિપબોર્ડમાં કોપી થઈ ગયું! (WhatsApp માં Ctrl+V દબાવો)`);
    } else {
      showToast("ક્લિપબોર્ડ સપોર્ટ નથી, કૃપા કરી PNG ડાઉનલોડ બટન વાપરો.");
    }
  } catch (err) {
    console.error("Error in copyCurrentQueueBillImage:", err);
  }
}
window.copyCurrentQueueBillImage = copyCurrentQueueBillImage;

// Global Keyboard Shortcuts Listener for WhatsApp Express Auto-Queue
window.addEventListener("keydown", (e) => {
  const modal = document.getElementById("whatsAppExpressModal");
  if (!modal || !modal.classList.contains("active")) return;

  // If focus is in search input, don't trigger spacebar dispatch
  const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
  if (activeTag === "input" && e.code === "Space") return;

  if (e.code === "Space" || e.key === "Enter") {
    e.preventDefault();
    sendWhatsAppQueueNext();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    skipWhatsAppQueue();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    prevWhatsAppQueue();
  }
});

// Main App Initialization Function
async function initApp() {
  try {
    if (window.vendorDB && window.vendorDB.init) {
      await window.vendorDB.init();
      await loadAgencySettings();
    }
    if (typeof applyLanguage === "function") applyLanguage();
    if (typeof initDateDefaults === "function") initDateDefaults();
    if (typeof refreshAllViews === "function") await refreshAllViews();
    if (typeof showToast === "function" && typeof t === "function") showToast(t("onlineStatus"));
  } catch (err) {
    console.error("Initialization error:", err);
  }
}
window.initApp = initApp;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

// Cache purge for old versions
if (typeof window !== "undefined" && "caches" in window) {
  caches.keys().then(keys => {
    keys.forEach(key => {
      if (key !== "vendorsoft-v43") {
        console.log("Purging stale cache:", key);
        caches.delete(key);
      }
    });
  });
}

// Service Worker Registration for PWA Offline Execution
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=43').then(reg => {
      reg.update();
    }).catch(err => {
      console.log('ServiceWorker registration info:', err);
    });
  });
}