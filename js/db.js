// Vendor Soft - Offline IndexedDB Database Engine
const DB_NAME = "VendorSoftDB_v5";
const DB_VERSION = 5;

function ensureSubscriptionsArray(subs) {
  if (Array.isArray(subs)) return subs;
  if (typeof subs === "number") return [subs];
  if (typeof subs === "string" && subs.trim()) return [parseInt(subs, 10)].filter(n => !isNaN(n));
  if (typeof subs === "object" && subs !== null) {
    return Object.keys(subs).map(k => parseInt(k, 10));
  }
  return [];
}

function isPaperSubscribedOnDay(subs, itemId, dayOfWeek, dateStr) {
  if (!subs) return false;
  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayStr = dayNames[dayOfWeek];
  
  if (Array.isArray(subs)) {
    return subs.includes(itemId) || subs.includes(Number(itemId)) || subs.includes(String(itemId));
  }
  if (typeof subs === "object" && subs !== null) {
    const itemConfig = subs[itemId] ?? subs[String(itemId)] ?? subs[Number(itemId)];
    if (!itemConfig) return false;

    // Sub-case 1: Array of day strings ["sun", "mon"] or array of range objects
    if (Array.isArray(itemConfig)) {
      if (itemConfig.length > 0 && typeof itemConfig[0] === "string") {
        return itemConfig.includes(dayStr);
      }
      return itemConfig.some(entry => {
        if (dateStr) {
          if (entry.startDate && dateStr < entry.startDate) return false;
          if (entry.endDate && dateStr > entry.endDate) return false;
        }
        const days = Array.isArray(entry.days) ? entry.days : [];
        return days.includes(dayStr);
      });
    }

    // Sub-case 2: Single object { days: [...], startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
    if (typeof itemConfig === "object") {
      if (dateStr) {
        if (itemConfig.startDate && dateStr < itemConfig.startDate) return false;
        if (itemConfig.endDate && dateStr > itemConfig.endDate) return false;
      }
      const days = Array.isArray(itemConfig.days) ? itemConfig.days : [];
      return days.includes(dayStr);
    }
  }
  return false;
}
window.isPaperSubscribedOnDay = isPaperSubscribedOnDay;
window.ensureSubscriptionsArray = ensureSubscriptionsArray;

function getItemDayRates(item, dayOfWeek, dateStr = null) {
  // dayOfWeek: 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const key = dayKeys[dayOfWeek] !== undefined ? dayKeys[dayOfWeek] : "mon";

  // Check if item has rate revisions for dateStr
  let activeDayRates = item?.dayRates;
  if (dateStr && item?.rateHistory && Array.isArray(item.rateHistory) && item.rateHistory.length > 0) {
    const sortedRevs = [...item.rateHistory].sort((a, b) => (b.effectiveDate || "").localeCompare(a.effectiveDate || ""));
    const matchingRev = sortedRevs.find(r => r.effectiveDate && dateStr >= r.effectiveDate);
    if (matchingRev && matchingRev.dayRates) {
      activeDayRates = matchingRev.dayRates;
    }
  }

  if (activeDayRates && activeDayRates[key]) {
    const d = activeDayRates[key];
    const sale = (d.sale !== undefined && d.sale !== null && Number(d.sale) > 0) ? Number(d.sale) : (dayOfWeek === 0 ? Number(item.sundayRate || 5.0) : Number(item.defaultRate || 5.0));
    const purchase = (d.purchase !== undefined && d.purchase !== null && Number(d.purchase) > 0) ? Number(d.purchase) : Number((sale * 0.7).toFixed(2));
    return { sale, purchase };
  }

  const sale = (dayOfWeek === 0 ? Number(item?.sundayRate || 5.0) : Number(item?.defaultRate || 5.0));
  const purchase = Number((sale * 0.7).toFixed(2));
  return { sale, purchase };
}
window.getItemDayRates = getItemDayRates;

class VendorDB {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  async init() {
    if (this.db) return this;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Stores
        if (!db.objectStoreNames.contains("firms")) {
          db.createObjectStore("firms", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("items")) {
          const itemStore = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
          itemStore.createIndex("code", "code", { unique: false });
        }
        if (!db.objectStoreNames.contains("routes")) {
          const routeStore = db.createObjectStore("routes", { keyPath: "id", autoIncrement: true });
          routeStore.createIndex("code", "code", { unique: false });
        }
        if (!db.objectStoreNames.contains("salesmen")) {
          db.createObjectStore("salesmen", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("customers")) {
          const custStore = db.createObjectStore("customers", { keyPath: "id", autoIncrement: true });
          custStore.createIndex("routeId", "routeId", { unique: false });
          custStore.createIndex("status", "status", { unique: false });
        }
        if (!db.objectStoreNames.contains("vacations")) {
          const vacStore = db.createObjectStore("vacations", { keyPath: "id", autoIncrement: true });
          vacStore.createIndex("customerId", "customerId", { unique: false });
        }
        if (!db.objectStoreNames.contains("bills")) {
          const billStore = db.createObjectStore("bills", { keyPath: "id", autoIncrement: true });
          billStore.createIndex("customerId", "customerId", { unique: false });
          billStore.createIndex("monthYear", "monthYear", { unique: false });
        }
        if (!db.objectStoreNames.contains("payments")) {
          const payStore = db.createObjectStore("payments", { keyPath: "id", autoIncrement: true });
          payStore.createIndex("customerId", "customerId", { unique: false });
          payStore.createIndex("date", "date", { unique: false });
        }
        if (!db.objectStoreNames.contains("daily_adjustments")) {
          db.createObjectStore("daily_adjustments", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("paperHolidays")) {
          db.createObjectStore("paperHolidays", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("massIssues")) {
          db.createObjectStore("massIssues", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("collectionMen")) {
          db.createObjectStore("collectionMen", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("expenses")) {
          const expStore = db.createObjectStore("expenses", { keyPath: "id", autoIncrement: true });
          expStore.createIndex("date", "date", { unique: false });
          expStore.createIndex("category", "category", { unique: false });
          expStore.createIndex("monthYear", "monthYear", { unique: false });
        }
        if (!db.objectStoreNames.contains("bank_accounts")) {
          db.createObjectStore("bank_accounts", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("bank_transactions")) {
          const bankTxStore = db.createObjectStore("bank_transactions", { keyPath: "id", autoIncrement: true });
          bankTxStore.createIndex("bankAccountId", "bankAccountId", { unique: false });
          bankTxStore.createIndex("date", "date", { unique: false });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        try {
          await this.checkAndSeedDefaultData();
        } catch (seedErr) {
          console.warn("Seed error:", seedErr);
        }
        resolve(this);
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
        this.initPromise = null;
        reject(event.target.error);
      };
    });

    return this.initPromise;
  }

  // Generic Transaction Helpers
  async getAll(storeName) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async get(storeName, key) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result !== undefined) {
          resolve(req.result);
        } else if (typeof key === "string" && !isNaN(Number(key)) && key.trim() !== "") {
          const retryReq = store.get(Number(key));
          retryReq.onsuccess = () => resolve(retryReq.result);
          retryReq.onerror = () => reject(retryReq.error);
        } else if (typeof key === "number") {
          const retryReq = store.get(String(key));
          retryReq.onsuccess = () => resolve(retryReq.result);
          retryReq.onerror = () => reject(retryReq.error);
        } else {
          resolve(undefined);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, item) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Default Seed Data
  async checkAndSeedDefaultData() {
    const items = await this.getAll("items");
    if (items.length === 0) {
      try {
        const resp = await fetch("vendorsoft_imported_data.json?t=" + Date.now());
        if (resp.ok) {
          const jsonText = await resp.text();
          await this.importFullBackupJSON(jsonText);
          console.log("Loaded vendorsoft_imported_data.json automatically!");
          await this.ensureDefaultBankAccountsAndExpenses();
          return;
        }
      } catch (e) {
        console.warn("Could not auto-load vendorsoft_imported_data.json, seeding defaults:", e);
      }
      await this.seedDefaults();
    }
    await this.ensureDefaultBankAccountsAndExpenses();
  }

  async seedDefaults() {
    // 1. Firm Profile
    await this.put("firms", {
      id: "primary",
      name: "શ્રી ગણેશ ન્યૂઝ એજન્સી (Shree Ganesh News)",
      ownerName: "પ્રફુલભાઈ જોષી",
      address: "દુકાન નં. ૪, સ્ટેશન રોડ, રાજકોટ - ૩૬૦૦૦૧",
      phone: "98250 12345",
      upiId: "shreeganesh.news@upi",
      gstNo: "24AAACG1234F1Z5"
    });

    // 2. Newspapers / Items
    const sampleItems = [
      { id: 1, code: "GS", name: "ગુજરાત સમાચાર (Gujarat Samachar)", type: "daily", defaultRate: 5.0, sundayRate: 6.0, monthlyRate: 0, commRate: 15 },
      { id: 2, code: "SAN", name: "સંદેશ (Sandesh)", type: "daily", defaultRate: 5.0, sundayRate: 6.0, monthlyRate: 0, commRate: 15 },
      { id: 3, code: "DB", name: "દિવ્ય ભાસ્કર (Divya Bhaskar)", type: "daily", defaultRate: 5.0, sundayRate: 6.0, monthlyRate: 0, commRate: 15 },
      { id: 4, code: "TOI", name: "ધ ટાઇમ્સ ઓફ ઇન્ડિયા (Times of India)", type: "daily", defaultRate: 7.0, sundayRate: 10.0, monthlyRate: 0, commRate: 18 },
      { id: 5, code: "KM", name: "કચ્છમિત્ર (Kutchmitra)", type: "daily", defaultRate: 4.5, sundayRate: 5.0, monthlyRate: 0, commRate: 12 },
      { id: 6, code: "CL", name: "ચિત્રલેખા (Chitralekha Weekly)", type: "weekly", defaultRate: 0, sundayRate: 0, monthlyRate: 120.0, commRate: 20 }
    ];
    for (const item of sampleItems) await this.put("items", item);

    // 3. Salesmen
    const sampleSalesmen = [
      { id: 1, name: "રમેશભાઈ પરમાર", mobile: "98251 11223", commRate: 15 },
      { id: 2, name: "દિનેશભાઈ સોલંકી", mobile: "98980 44556", commRate: 15 }
    ];
    for (const sm of sampleSalesmen) await this.put("salesmen", sm);

    // 4. Routes
    const sampleRoutes = [
      { id: 1, code: "L-01", name: "લાઇન ૧ - સ્ટેશન રોડ", salesmanId: 1 },
      { id: 2, code: "L-02", name: "લાઇન ૨ - મેઇન બજાર", salesmanId: 2 },
      { id: 3, code: "L-03", name: "લાઇન ૩ - ગાંધી સોસાયટી", salesmanId: 1 }
    ];
    for (const rt of sampleRoutes) await this.put("routes", rt);

    // 5. Customers
    const sampleCustomers = [
      {
        id: 1,
        code: "C-101",
        name: "મુકેશભાઈ એમ. શાહ",
        routeId: 1,
        sequenceNo: 1,
        address: "૧૦૨, શિવમ્ રેસિડેન્સી, સ્ટેશન રોડ",
        mobile: "98240 55112",
        whatsapp: "98240 55112",
        subscriptions: [1, 4], // GS + TOI
        openingBalance: 120.0,
        currentBalance: 120.0,
        status: "active"
      },
      {
        id: 2,
        code: "C-102",
        name: "રાજેશભાઈ કે. પટેલ",
        routeId: 1,
        sequenceNo: 2,
        address: "બી/૧૨, દર્શન સોસાયટી",
        mobile: "94260 88991",
        whatsapp: "94260 88991",
        subscriptions: [1], // GS
        openingBalance: 0.0,
        currentBalance: 0.0,
        status: "active"
      },
      {
        id: 3,
        code: "C-103",
        name: "ભાવેશભાઈ આર. મહેતા",
        routeId: 1,
        sequenceNo: 3,
        address: "૪૫, સરદાર નગર મેઇન રોડ",
        mobile: "98790 33221",
        whatsapp: "98790 33221",
        subscriptions: [2, 3], // SAN + DB
        openingBalance: 45.0,
        currentBalance: 45.0,
        status: "active"
      },
      {
        id: 4,
        code: "C-201",
        name: "કિરીટભાઈ વી. ત્રિવેદી",
        routeId: 2,
        sequenceNo: 1,
        address: "દુકાન નં. ૭, મેઇન બજાર",
        mobile: "99090 12890",
        whatsapp: "99090 12890",
        subscriptions: [1, 2, 6], // GS + SAN + CL
        openingBalance: 250.0,
        currentBalance: 250.0,
        status: "active"
      },
      {
        id: 5,
        code: "C-202",
        name: "અશ્વિનભાઈ એસ. ગોહિલ",
        routeId: 2,
        sequenceNo: 2,
        address: "૨૦૪, નીલકંઠ એપાર્ટમેન્ટ, મેઇન બજાર",
        mobile: "97270 44551",
        whatsapp: "97270 44551",
        subscriptions: [3], // DB
        openingBalance: 0.0,
        currentBalance: 0.0,
        status: "active"
      }
    ];
    for (const cust of sampleCustomers) await this.put("customers", cust);

    // 6. Vacation Sample
    const today = new Date();
    const startVac = new Date(today);
    startVac.setDate(today.getDate() - 2);
    const endVac = new Date(today);
    endVac.setDate(today.getDate() + 3);

    await this.put("vacations", {
      id: 1,
      customerId: 2, // Rajeshbhai Patel
      startDate: startVac.toISOString().split("T")[0],
      endDate: endVac.toISOString().split("T")[0],
      reason: "ગામડે ગયેલ છે (Out of town)"
    });

    // 7. Initial Bills
    await this.put("bills", {
      id: 1,
      billNo: "B-2026-08-001",
      customerId: 1,
      monthYear: "2026-08",
      monthName: "ઓગસ્ટ ૨૦૨૬ (August 2026)",
      daysDelivered: 31,
      vacationDays: 0,
      currentAmount: 380.0,
      pastArrears: 0.0,
      totalPayable: 380.0,
      paidAmount: 260.0,
      pendingBalance: 120.0,
      status: "partial",
      dateGenerated: "2026-09-01"
    });

    // 8. Initial Payment
    await this.put("payments", {
      id: 1,
      receiptNo: "REC-260801",
      customerId: 1,
      amount: 260.0,
      mode: "upi",
      referenceNo: "UPI/260829103984",
      date: "2026-09-02",
      notes: "Google Pay થી જમા"
    });
  }

  // Vacation Helpers
  async isCustomerOnVacation(customerId, dateStr) {
    const vacations = await this.getAll("vacations");
    return vacations.some(v => {
      if (v.customerId !== customerId) return false;
      return dateStr >= v.startDate && dateStr <= v.endDate;
    });
  }

  // Morning Depot Demand Tally with day-specific rates & filters
  async getMorningDepotSummary(dateStr) {
    const sheet = await this.getDepotPurchaseSheet(dateStr);
    return sheet.items.map(r => ({
      ...r,
      count: r.customerCopies,
      extra: r.extraCopies
    }));
  }

  // Tomorrow's / Target Date Depot Purchase & Payment Calculation Sheet
  async getDepotPurchaseSheet(dateStr, customExtraCopies = {}) {
    if (!dateStr) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateStr = tomorrow.toISOString().split("T")[0];
    }

    const targetDate = new Date(dateStr + "T12:00:00");
    const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon...
    const customers = await this.getAll("customers");
    const items = await this.getAll("items");
    const vacations = await this.getAll("vacations");
    const paperHolidays = await this.getAll("paperHolidays");
    const massIssues = await this.getAll("massIssues");
    
    const todaysMassIssues = massIssues.filter(m => m.date === dateStr);
    const hasHolidayForOthers = todaysMassIssues.some(m => m.holidayForOthers !== false);
    const massIssueItemIds = new Set(todaysMassIssues.map(m => String(m.itemId)));

    const itemDemandMap = new Map();
    for (const item of items) {
      // Check if item is on holiday
      let isPaperHoliday = paperHolidays.some(h => 
        String(h.itemId) === String(item.id) && dateStr >= h.startDate && dateStr <= h.endDate
      );
      if (hasHolidayForOthers && !massIssueItemIds.has(String(item.id))) {
        isPaperHoliday = true;
      }

      const rates = getItemDayRates(item, dayOfWeek);
      const extra = Number(customExtraCopies[item.id]) || 0;
      const matchingMi = todaysMassIssues.find(m => String(m.itemId) === String(item.id));
      const saleRate = (matchingMi && matchingMi.rate !== undefined && matchingMi.rate !== null && Number(matchingMi.rate) >= 0)
        ? Number(matchingMi.rate)
        : rates.sale;
      const purchaseRate = (matchingMi && matchingMi.purchaseRate !== undefined && matchingMi.purchaseRate !== null && matchingMi.purchaseRate !== "" && Number(matchingMi.purchaseRate) >= 0)
        ? Number(matchingMi.purchaseRate)
        : rates.purchase;

      itemDemandMap.set(item.id, {
        id: item.id,
        code: item.code,
        name: item.name,
        type: item.type,
        saleRate: saleRate,
        purchaseRate: purchaseRate,
        customerCopies: 0,
        extraCopies: extra,
        totalCopies: 0,
        purchaseAmount: 0,
        salesValue: 0,
        profit: 0,
        isHoliday: isPaperHoliday
      });
    }

    for (const cust of customers) {
      if (cust.status !== "active") {
        if (!cust.inactiveDate || dateStr > cust.inactiveDate) continue;
      }
      const onVacation = vacations.some(v => 
        v.customerId === cust.id && dateStr >= v.startDate && dateStr <= v.endDate
      );
      if (onVacation) continue;

      const rawSubs = ensureSubscriptionsArray(cust.subscriptions);
      let customerItemsForDay = new Set();
      let hasPaperOnDay = false;
      
      for (const itemId of rawSubs) {
        if (isPaperSubscribedOnDay(cust.subscriptions, itemId, dayOfWeek, dateStr)) {
          hasPaperOnDay = true;
          if (!hasHolidayForOthers) {
            const demandItem = itemDemandMap.get(itemId) || itemDemandMap.get(Number(itemId)) || itemDemandMap.get(String(itemId));
            if (demandItem && !demandItem.isHoliday) {
              demandItem.customerCopies += 1;
              customerItemsForDay.add(String(itemId));
            }
          }
        }
      }
      
      // Inject mass issues if eligible and not already subscribed for today
      for (const mi of todaysMassIssues) {
        const isEligible = (mi.targetType === "day_wise") ? hasPaperOnDay : true;
        if (isEligible) {
          if (!customerItemsForDay.has(String(mi.itemId))) {
            const demandItem = itemDemandMap.get(mi.itemId) || itemDemandMap.get(Number(mi.itemId)) || itemDemandMap.get(String(mi.itemId));
            if (demandItem) {
               demandItem.customerCopies += 1;
               customerItemsForDay.add(String(mi.itemId));
            }
          }
        }
      }
    }

    const rows = Array.from(itemDemandMap.values()).map(r => {
      r.totalCopies = r.customerCopies + r.extraCopies;
      r.purchaseAmount = Math.round((r.totalCopies * r.purchaseRate) * 100) / 100;
      r.salesValue = Math.round((r.totalCopies * r.saleRate) * 100) / 100;
      r.profit = Math.round((r.salesValue - r.purchaseAmount) * 100) / 100;
      return r;
    });

    const summary = {
      date: dateStr,
      dayOfWeek,
      totalCustomerCopies: rows.reduce((sum, r) => sum + r.customerCopies, 0),
      totalExtraCopies: rows.reduce((sum, r) => sum + r.extraCopies, 0),
      totalCopies: rows.reduce((sum, r) => sum + r.totalCopies, 0),
      totalPurchaseAmount: Math.round(rows.reduce((sum, r) => sum + r.purchaseAmount, 0) * 100) / 100,
      totalSalesValue: Math.round(rows.reduce((sum, r) => sum + r.salesValue, 0) * 100) / 100,
      totalProfit: Math.round(rows.reduce((sum, r) => sum + r.profit, 0) * 100) / 100
    };

    return { date: dateStr, dayOfWeek, summary, items: rows };
  }

  // Hawker Delivery Route Sheet
  async getHawkerRouteSheet(routeId, dateStr) {
    const customers = await this.getAll("customers");
    const items = await this.getAll("items");
    const paperHolidays = await this.getAll("paperHolidays");
    const massIssues = await this.getAll("massIssues");
    const itemMap = new Map(items.map(i => [i.id, i]));
    
    const targetDate = new Date(dateStr + "T12:00:00");
    const dayOfWeek = targetDate.getDay();
    const todaysMassIssues = massIssues.filter(m => m.date === dateStr);
    const hasHolidayForOthers = todaysMassIssues.some(m => m.holidayForOthers !== false);

    const filtered = customers
      .filter(c => {
        if (c.routeId !== routeId) return false;
        if (c.status === "active") return true;
        if (c.status === "inactive" && c.inactiveDate && c.inactiveDate >= dateStr) return true;
        return false;
      })
      .sort((a, b) => (Number(a.sequenceNo) || 0) - (Number(b.sequenceNo) || 0));

    const result = [];
    for (const cust of filtered) {
      const onVacation = await this.isCustomerOnVacation(cust.id, dateStr);
      const rawSubs = ensureSubscriptionsArray(cust.subscriptions);
      let hasPaperOnDay = false;
      
      let subscribedPapersList = [];
      for (const id of rawSubs) {
        if (isPaperSubscribedOnDay(cust.subscriptions, id, dayOfWeek, dateStr)) {
          hasPaperOnDay = true;
          if (!hasHolidayForOthers) {
            const isHoliday = paperHolidays.some(h => String(h.itemId) === String(id) && dateStr >= h.startDate && dateStr <= h.endDate);
            if (!isHoliday) {
              subscribedPapersList.push(id);
            }
          }
        }
      }

      // Inject mass issues if eligible
      for (const mi of todaysMassIssues) {
        const isEligible = (mi.targetType === "day_wise") ? hasPaperOnDay : true;
        if (isEligible) {
          if (!subscribedPapersList.some(id => String(id) === String(mi.itemId))) {
            subscribedPapersList.push(mi.itemId);
          }
        }
      }

      const subscribedPapers = subscribedPapersList
        .map(id => itemMap.get(id)?.name || "")
        .filter(Boolean);

      let isRecentlyAdded = false;
      if (cust.createdAt) {
        const createdDate = new Date(cust.createdAt);
        const curDate = new Date(dateStr + "T23:59:59");
        const diffDays = (curDate - createdDate) / (1000 * 60 * 60 * 24);
        if (diffDays >= 0 && diffDays <= 15) {
          isRecentlyAdded = true;
        }
      } else if (cust.isNew) {
        isRecentlyAdded = true;
      }

      result.push({
        ...cust,
        subscriptions: rawSubs,
        onVacation,
        subscribedPapers,
        isRecentlyAdded
      });
    }
    return result;
  }

  // Monthly Bill Generation Engine with Customizable Bill Numbering
  async calculateMonthlyBills(year, month, options = {}) {
    const customers = await this.getAll("customers");
    const items = await this.getAll("items");
    const itemMap = new Map(items.map(i => [i.id, i]));
    const vacations = await this.getAll("vacations");
    const paperHolidays = await this.getAll("paperHolidays");
    const massIssues = await this.getAll("massIssues");
    const firm = (await this.get("firms", "primary")) || {};

    // Bill Numbering Options: Style, Prefix, Starting Number, and Padding
    const fmtStyle = options.billNoFormat || firm.billNoFormat || "sequential";
    const prefix = options.prefix !== undefined ? options.prefix : (firm.billNoPrefix !== undefined ? firm.billNoPrefix : "");
    const startNum = Number(options.startNumber !== undefined && options.startNumber !== "" ? options.startNumber : (firm.billNoStartNum || 1001));
    const padding = Number(options.padding !== undefined && options.padding !== "" ? options.padding : (firm.billNoPadding !== undefined ? firm.billNoPadding : 0));

    const daysInMonth = new Date(year, month, 0).getDate();
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const generatedBills = [];

    // Clear existing bills for this monthKey so recalculation updates cleanly without duplicates
    const existingBills = await this.getAll("bills");
    const oldForMonth = existingBills.filter(b => b.monthYear === monthKey);
    for (const ob of oldForMonth) {
      if (ob.id) await this.delete("bills", ob.id);
    }

    // Load salesmen, collectionMen, routes for hierarchical sorting
    const salesmen = await this.getAll("salesmen");
    const smMap = new Map(salesmen.map(s => [s.id, s]));
    const collectionMen = await this.getAll("collectionMen");
    const cmMap = new Map(collectionMen.map(c => [c.id, c]));
    const routes = await this.getAll("routes");
    const routeMap = new Map(routes.map(r => [r.id, r]));

    const sortBy = options.sortBy || "salesman_delivery"; // Default: Salesman + Delivery Sequence

    customers.sort((a, b) => {
      const rA = routeMap.get(a.routeId) || {};
      const rB = routeMap.get(b.routeId) || {};

      if (sortBy === "salesman_delivery") {
        // 1. Salesman first (દા.ત. ૧. રમેશભાઈ, ૨. મુકેશભાઈ...) -> then Delivery Sequence
        const smIdA = a.salesmanId || rA.salesmanId || 999999;
        const smIdB = b.salesmanId || rB.salesmanId || 999999;
        if (smIdA !== smIdB) {
          const smNameA = smMap.get(smIdA)?.name || String(smIdA);
          const smNameB = smMap.get(smIdB)?.name || String(smIdB);
          return smNameA.localeCompare(smNameB, "gu");
        }
        const seqA = Number(a.sequenceNo) || 999999;
        const seqB = Number(b.sequenceNo) || 999999;
        return seqA - seqB;
      } else if (sortBy === "collection_man_seq") {
        // 1. Collection Man first (દા.ત. ૧. રમેશ પરમાર, ૨. દિનેશ સોલંકી...) -> then Collection Sequence
        const cmIdA = a.collectionManId || rA.collectionManId || 999999;
        const cmIdB = b.collectionManId || rB.collectionManId || 999999;
        if (cmIdA !== cmIdB) {
          const cmNameA = cmMap.get(cmIdA)?.name || String(cmIdA);
          const cmNameB = cmMap.get(cmIdB)?.name || String(cmIdB);
          return cmNameA.localeCompare(cmNameB, "gu");
        }
        const seqA = Number(a.collectionSequence) || Number(a.sequenceNo) || 999999;
        const seqB = Number(b.collectionSequence) || Number(b.sequenceNo) || 999999;
        return seqA - seqB;
      } else if (sortBy === "route_delivery") {
        // 1. Route first -> then Delivery Sequence
        const rCodeA = rA.code || String(a.routeId || 999999);
        const rCodeB = rB.code || String(b.routeId || 999999);
        if (rCodeA !== rCodeB) {
          return rCodeA.localeCompare(rCodeB);
        }
        const seqA = Number(a.sequenceNo) || 999999;
        const seqB = Number(b.sequenceNo) || 999999;
        return seqA - seqB;
      } else {
        // Standard delivery sequence
        const seqA = Number(a.sequenceNo) || 999999;
        const seqB = Number(b.sequenceNo) || 999999;
        return seqA - seqB;
      }
    });

    let billIndexCounter = 0;

    for (const cust of customers) {
      if (cust.status !== "active") {
        if (!cust.inactiveDate) continue;
        if (cust.inactiveDate < `${monthKey}-01`) continue;
      }

      let billTotal = 0;
      let vacationDeductionTotal = 0;
      let vacationDaysCount = 0;
      let deliveryDaysCount = 0;
      const paperBreakdown = {};

      // Check if Customer is on Fixed Monthly Contract
      if (cust.billingType === "fixed" && Number(cust.fixedMonthlyAmount) > 0) {
        billTotal = Number(cust.fixedMonthlyAmount);
        deliveryDaysCount = daysInMonth;
        paperBreakdown["fixed"] = {
          id: "fixed",
          name: "માસિક ફિક્સ કોન્ટ્રાક્ટ (Fixed Monthly)",
          code: "FIXED",
          daysCount: daysInMonth,
          totalCost: billTotal,
          startDate: `${monthKey}-01`,
          endDate: `${monthKey}-${String(daysInMonth).padStart(2, "0")}`
        };
      } else {
        // Daily calculation based on actual days delivered and day-specific rates
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(year, month - 1, day, 12, 0, 0);
          const dateStr = currentDate.toISOString().split("T")[0];
          const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday

          if (cust.status === "inactive" && cust.inactiveDate && dateStr > cust.inactiveDate) {
            continue;
          }

          const isOnVacation = vacations.some(v => 
            v.customerId === cust.id && dateStr >= v.startDate && dateStr <= v.endDate
          );

          let dayCost = 0;
          let dayItems = [];
          const todaysMassIssues = massIssues.filter(m => m.date === dateStr);
          const hasHolidayForOthers = todaysMassIssues.some(m => m.holidayForOthers !== false);
          const rawSubs = ensureSubscriptionsArray(cust.subscriptions);
          let hasPaperOnDay = false;

          for (const itemId of rawSubs) {
            if (isPaperSubscribedOnDay(cust.subscriptions, itemId, dayOfWeek, dateStr)) {
              hasPaperOnDay = true;
              if (!hasHolidayForOthers) {
                const item = itemMap.get(itemId);
                if (!item || item.status === "inactive") continue;

                // Check if item is on holiday
                const isPaperHoliday = paperHolidays.some(h => 
                  String(h.itemId) === String(item.id) && dateStr >= h.startDate && dateStr <= h.endDate
                );
                if (isPaperHoliday) continue;

                const rates = getItemDayRates(item, dayOfWeek, dateStr);
                dayCost += rates.sale;
                dayItems.push({ id: item.id, name: item.name, code: item.code, rate: rates.sale });
              }
            }
          }
          
          // Mass issues for this date
          for (const mi of todaysMassIssues) {
            const isEligible = (mi.targetType === "day_wise") ? hasPaperOnDay : true;
            if (isEligible) {
              const mRate = Number(mi.rate || 0);
              dayCost += mRate;
              const mItem = itemMap.get(mi.itemId);
              dayItems.push({ id: mi.itemId, name: (mItem?.name || "વિશેષ આવૃત્તિ") + " (Bonus)", code: mItem?.code || "MI", rate: mRate });
            }
          }

          if (isOnVacation) {
            vacationDaysCount++;
            vacationDeductionTotal += dayCost;
          } else {
            if (dayCost > 0 || dayItems.length > 0) {
              deliveryDaysCount++;
            }
            billTotal += dayCost;

            // Record itemized paper breakdown
            for (const it of dayItems) {
              if (!paperBreakdown[it.id]) {
                paperBreakdown[it.id] = {
                  id: it.id,
                  name: it.name,
                  code: it.code,
                  daysCount: 0,
                  totalCost: 0,
                  startDate: dateStr,
                  endDate: dateStr
                };
              }
              paperBreakdown[it.id].daysCount++;
              paperBreakdown[it.id].totalCost = Math.round((paperBreakdown[it.id].totalCost + it.rate) * 100) / 100;
              paperBreakdown[it.id].endDate = dateStr;
            }
          }
        }

        // Add monthly magazines (fixed price items)
        const rawSubs = ensureSubscriptionsArray(cust.subscriptions);
        for (const itemId of rawSubs) {
          const item = itemMap.get(itemId);
          if (item && item.type === "monthly" && item.monthlyRate > 0 && item.status !== "inactive") {
            const mRate = Number(item.monthlyRate);
            billTotal += mRate;
            paperBreakdown[item.id] = {
              id: item.id,
              name: item.name,
              code: item.code,
              daysCount: 1,
              totalCost: mRate,
              isMonthly: true
            };
          }
        }
      }

      // Delivery charge if enabled (Yes/No with custom amount) - kept separate from paper breakdown
      let delCharge = 0;
      const isDelChargeActive = (cust.delChargeEnabled === "yes" || cust.delChargeEnabled === true || (cust.delChargeEnabled === undefined && Number(cust.delCharge) > 0));
      if (isDelChargeActive) {
        delCharge = Number(cust.delChargeAmt !== undefined && cust.delChargeAmt !== null && cust.delChargeAmt !== "" ? cust.delChargeAmt : (cust.delCharge || 10));
      }

      const newspaperAmount = Math.round(billTotal * 100) / 100;
      const pastArrears = Number(cust.currentBalance) || 0;
      const netPayable = Math.round(newspaperAmount + delCharge + pastArrears);

      // Generate customizable Bill Number
      billIndexCounter++;
      const currentVal = startNum + (billIndexCounter - 1);
      const numFormatted = padding > 0 ? String(currentVal).padStart(padding, "0") : String(currentVal);

      let assignedBillNo = "";
      if (fmtStyle === "sequential") {
        assignedBillNo = `${prefix}${numFormatted}`;
      } else if (fmtStyle === "month_seq") {
        const mShort = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][month - 1] || "BILL";
        const yShort = String(year).slice(-2);
        assignedBillNo = `${prefix || (mShort + yShort + "-")}${numFormatted}`;
      } else if (fmtStyle === "cust_based") {
        assignedBillNo = `${prefix || "B-"}${String(month).padStart(2, "0")}-${String(cust.custNo || cust.id).padStart(3, "0")}`;
      } else {
        assignedBillNo = `${prefix}${numFormatted}`;
      }

      const billRecord = {
        billNo: assignedBillNo,
        customerId: cust.id,
        customerNo: cust.custNo || cust.id,
        customerName: cust.name,
        routeId: cust.routeId,
        salesmanId: cust.salesmanId || null,
        deliverySequence: Number(cust.sequenceNo) || 0,
        collectionSequence: Number(cust.collectionSequence) || Number(cust.sequenceNo) || 0,
        collectionManId: cust.collectionManId || null,
        monthYear: monthKey,
        daysDelivered: deliveryDaysCount,
        vacationDays: vacationDaysCount,
        vacationDeduction: Math.round(vacationDeductionTotal),
        newspaperAmount: newspaperAmount,
        currentAmount: Math.round(newspaperAmount + delCharge),
        pastArrears: Math.round(pastArrears * 100) / 100,
        delCharge: Math.round(delCharge * 100) / 100,
        deliveryCharge: Math.round(delCharge * 100) / 100,
        totalPayable: netPayable,
        billingType: cust.billingType || "daily",
        fixedMonthlyAmount: Number(cust.fixedMonthlyAmount) || 0,
        paperBreakdown: Object.values(paperBreakdown),
        dateGenerated: new Date().toISOString().split("T")[0]
      };

      await this.put("bills", billRecord);
      
      // Update customer balance
      cust.currentBalance = netPayable;
      await this.put("customers", cust);

      generatedBills.push(billRecord);
    }

    return generatedBills;
  }

  // Payment Collection & Balance Update
  async recordPayment(data) {
    const payment = {
      ...data,
      amount: parseFloat(data.amount) || 0,
      date: data.date || new Date().toISOString().split("T")[0],
      receiptNo: data.receiptNo || `REC-${Date.now().toString().slice(-6)}`
    };
    
    await this.put("payments", payment);

    // Update customer current balance
    const customer = await this.get("customers", payment.customerId);
    if (customer) {
      customer.currentBalance = Math.max(0, (customer.currentBalance || 0) - payment.amount);
      await this.put("customers", customer);
    }

    return payment;
  }

  // -----------------------------------------------------------
  // Expense & Bank Management Engine
  // -----------------------------------------------------------
  async ensureDefaultBankAccountsAndExpenses() {
    try {
      const accounts = await this.getAll("bank_accounts");
      if (!accounts || accounts.length === 0) {
        const defaultAccounts = [
          {
            id: 1,
            name: "💵 મેઇન રોકડ કાઉન્ટર (Cash Counter / Drawer)",
            type: "cash",
            accountNo: "CASH-MAIN",
            branch: "ઓફિસ કાઉન્ટર",
            ifsc: "-",
            openingBalance: 5000,
            currentBalance: 5000
          },
          {
            id: 2,
            name: "🏦 State Bank of India (SBI Current A/C)",
            type: "bank",
            accountNo: "30284918231",
            branch: "રાજકોટ મેઇન બ્રાન્ચ",
            ifsc: "SBIN0001234",
            openingBalance: 25000,
            currentBalance: 25000
          },
          {
            id: 3,
            name: "🏦 HDFC Bank (UPI Collection A/C)",
            type: "bank",
            accountNo: "502000391827",
            branch: "કાલાવડ રોડ",
            ifsc: "HDFC0000456",
            openingBalance: 15000,
            currentBalance: 15000
          }
        ];
        for (const acc of defaultAccounts) {
          await this.put("bank_accounts", acc);
        }
      }

      const expenses = await this.getAll("expenses");
      if (!expenses || expenses.length === 0) {
        const todayStr = new Date().toISOString().split("T")[0];
        const monthYear = todayStr.slice(0, 7);
        const sampleExpenses = [
          {
            id: 1,
            date: todayStr,
            monthYear: monthYear,
            category: "petrol",
            payeeName: "ઈન્ડિયન ઓઈલ પેટ્રોલ પંપ",
            amount: 350,
            paymentMode: "cash",
            bankAccountId: 1,
            notes: "લાઇન A અને B વિતરક પેટ્રોલ ભથ્થું"
          },
          {
            id: 2,
            date: todayStr,
            monthYear: monthYear,
            category: "tea_snacks",
            payeeName: "જલારામ ટી સ્ટોલ",
            amount: 120,
            paymentMode: "cash",
            bankAccountId: 1,
            notes: "સવારનું વિતરણ સ્ટાફ રિફ્રેશમેન્ટ"
          },
          {
            id: 3,
            date: todayStr,
            monthYear: monthYear,
            category: "stationery",
            payeeName: "શ્રી રામ સ્ટેશનરી માર્ટ",
            amount: 450,
            paymentMode: "cash",
            bankAccountId: 1,
            notes: "A4 બિલ પ્રિન્ટિંગ પેપર્સ રીમ & દોરી"
          }
        ];
        for (const exp of sampleExpenses) {
          await this.put("expenses", exp);
        }
      }
    } catch (err) {
      console.warn("Could not seed default bank/expense data:", err);
    }
  }

  async recordExpense(data) {
    const dateStr = data.date || new Date().toISOString().split("T")[0];
    const monthYear = dateStr.slice(0, 7);
    const amount = parseFloat(data.amount) || 0;

    const expense = {
      ...data,
      amount,
      date: dateStr,
      monthYear: monthYear
    };

    if (data.id) {
      expense.id = parseInt(data.id, 10);
    }

    const savedExp = await this.put("expenses", expense);

    // Update bank/cash account balance if linked
    if (data.bankAccountId) {
      const bankId = parseInt(data.bankAccountId, 10);
      const bank = await this.get("bank_accounts", bankId);
      if (bank) {
        bank.currentBalance = (Number(bank.currentBalance) || 0) - amount;
        await this.put("bank_accounts", bank);

        // Record a withdrawal in bank transactions
        const tx = {
          bankAccountId: bankId,
          date: dateStr,
          type: "withdrawal",
          amount: amount,
          description: `ખર્ચ: ${data.category || 'સામાન્ય'} - ${data.payeeName || ''}`,
          source: "expense",
          expenseId: savedExp.id || savedExp
        };
        await this.put("bank_transactions", tx);
      }
    }

    return savedExp;
  }

  async deleteExpense(id) {
    const expId = parseInt(id, 10) || id;
    const exp = await this.get("expenses", expId);
    if (exp && exp.bankAccountId) {
      const bank = await this.get("bank_accounts", parseInt(exp.bankAccountId, 10));
      if (bank) {
        bank.currentBalance = (Number(bank.currentBalance) || 0) + (Number(exp.amount) || 0);
        await this.put("bank_accounts", bank);
      }
    }
    await this.delete("expenses", expId);
    return true;
  }

  async recordStaffSalary(data) {
    const dateStr = data.date || new Date().toISOString().split("T")[0];
    const monthYear = data.month || dateStr.slice(0, 7);
    const baseAmt = parseFloat(data.baseAmount) || 0;
    const deduction = parseFloat(data.deduction) || 0;
    const netAmount = Math.max(0, baseAmt - deduction);

    const expense = {
      date: dateStr,
      monthYear: monthYear,
      category: "salary",
      staffId: data.staffId ? parseInt(data.staffId, 10) : null,
      staffRole: data.staffRole || "salesman",
      payeeName: data.staffName || "સ્ટાફ સભ્ય",
      baseAmount: baseAmt,
      deduction: deduction,
      amount: netAmount,
      paymentMode: data.paymentMode || "cash",
      bankAccountId: data.bankAccountId ? parseInt(data.bankAccountId, 10) : (data.paymentMode === 'cash' ? 1 : null),
      notes: data.notes || `${monthYear} માસનો પગાર (મૂળ: ₹${baseAmt}, કપાત: ₹${deduction})`
    };

    const savedExp = await this.put("expenses", expense);

    // Update bank balance if applicable
    if (expense.bankAccountId) {
      const bank = await this.get("bank_accounts", expense.bankAccountId);
      if (bank) {
        bank.currentBalance = (Number(bank.currentBalance) || 0) - netAmount;
        await this.put("bank_accounts", bank);

        const tx = {
          bankAccountId: expense.bankAccountId,
          date: dateStr,
          type: "withdrawal",
          amount: netAmount,
          description: `પગાર ચુકવણી: ${expense.payeeName} (${monthYear})`,
          source: "salary",
          expenseId: savedExp.id || savedExp
        };
        await this.put("bank_transactions", tx);
      }
    }

    return savedExp;
  }

  async recordBankTransaction(data) {
    const bankId = parseInt(data.bankAccountId, 10);
    const amount = parseFloat(data.amount) || 0;
    const dateStr = data.date || new Date().toISOString().split("T")[0];
    const type = data.type || "deposit"; // 'deposit', 'withdrawal', 'bank_charge'

    const bank = await this.get("bank_accounts", bankId);
    if (bank) {
      if (type === "deposit") {
        bank.currentBalance = (Number(bank.currentBalance) || 0) + amount;
      } else {
        bank.currentBalance = (Number(bank.currentBalance) || 0) - amount;
      }
      await this.put("bank_accounts", bank);
    }

    const tx = {
      ...data,
      bankAccountId: bankId,
      amount: amount,
      date: dateStr,
      type: type,
      description: data.description || (type === 'deposit' ? 'રોકડ જમા' : 'રોકડ ઉપાડ')
    };

    if (data.id) {
      tx.id = parseInt(data.id, 10);
    }

    return await this.put("bank_transactions", tx);
  }

  async deleteBankTransaction(id) {
    const txId = parseInt(id, 10) || id;
    const tx = await this.get("bank_transactions", txId);
    if (tx && tx.bankAccountId) {
      const bank = await this.get("bank_accounts", parseInt(tx.bankAccountId, 10));
      if (bank) {
        // Reverse transaction
        if (tx.type === "deposit") {
          bank.currentBalance = (Number(bank.currentBalance) || 0) - (Number(tx.amount) || 0);
        } else {
          bank.currentBalance = (Number(bank.currentBalance) || 0) + (Number(tx.amount) || 0);
        }
        await this.put("bank_accounts", bank);
      }
    }
    await this.delete("bank_transactions", txId);
    return true;
  }

  // Backup & Restore
  async exportFullBackupJSON() {
    const stores = ["firms", "items", "routes", "salesmen", "collectionMen", "customers", "vacations", "bills", "payments", "expenses", "bank_accounts", "bank_transactions"];
    const backup = {
      exportDate: new Date().toISOString(),
      appName: "VendorSoft",
      version: "1.0",
      data: {}
    };

    for (const store of stores) {
      backup.data[store] = await this.getAll(store);
    }
    return JSON.stringify(backup, null, 2);
  }

  async importFullBackupJSON(jsonString) {
    const backup = JSON.parse(jsonString);
    if (!backup.data) throw new Error("Invalid backup format");

    for (const storeName of Object.keys(backup.data)) {
      if (!this.db.objectStoreNames.contains(storeName)) continue;
      await this.clear(storeName);
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        for (const item of backup.data[storeName]) {
          if (storeName === "customers") {
            if (!item.subscriptions) item.subscriptions = {};
            item.sequenceNo = Number(item.sequenceNo) || 1;
            item.collectionSequence = Number(item.collectionSequence) || item.sequenceNo || 1;
            item.collectionManId = item.collectionManId ? Number(item.collectionManId) : null;
            item.salesmanId = item.salesmanId ? Number(item.salesmanId) : null;
            item.currentBalance = Number(item.currentBalance) || 0;
            item.openingBalance = Number(item.openingBalance) || 0;
            item.billingType = item.billingType || "daily";
            item.fixedMonthlyAmount = Number(item.fixedMonthlyAmount) || 0;
            item.status = item.status || "active";
          }
          if (storeName === "items") {
            if (!item.dayRates) {
              const dRate = Number(item.defaultRate) || 5.0;
              const sRate = Number(item.sundayRate) || dRate;
              const pDef = Number((dRate * 0.7).toFixed(2));
              const pSun = Number((sRate * 0.7).toFixed(2));
              item.dayRates = {
                sun: { sale: sRate, purchase: pSun },
                mon: { sale: dRate, purchase: pDef },
                tue: { sale: dRate, purchase: pDef },
                wed: { sale: dRate, purchase: pDef },
                thu: { sale: dRate, purchase: pDef },
                fri: { sale: dRate, purchase: pDef },
                sat: { sale: dRate, purchase: pDef }
              };
            }
          }
          store.put(item);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    }
    return true;
  }

  async getNextCustomerNumber() {
    const customers = await this.getAll("customers");
    let maxId = 0;
    for (const c of customers) {
      const num = parseInt(c.custNo || c.id, 10);
      if (!isNaN(num) && num > maxId) {
        maxId = num;
      }
    }
    return maxId + 1;
  }

  async insertCustomerAtSequence(customerData, targetSeq, routeId, syncCollectionSeq = true) {
    const customers = await this.getAll("customers");
    const routeCusts = customers.filter(c => c.routeId === routeId && c.id !== customerData.id);
    
    // Shift subsequent customers if targetSeq is specified and valid
    if (targetSeq && targetSeq > 0) {
      const toShift = routeCusts
        .filter(c => (Number(c.sequenceNo) || 0) >= targetSeq)
        .sort((a, b) => (Number(b.sequenceNo) || 0) - (Number(a.sequenceNo) || 0));
      
      for (const c of toShift) {
        c.sequenceNo = (Number(c.sequenceNo) || 0) + 1;
        if (syncCollectionSeq) {
          c.collectionSequence = (Number(c.collectionSequence) || c.sequenceNo - 1) + 1;
        }
        await this.put("customers", c);
      }
      customerData.sequenceNo = targetSeq;
      if (syncCollectionSeq) {
        customerData.collectionSequence = targetSeq;
      }
    } else {
      const maxSeq = routeCusts.reduce((max, c) => Math.max(max, Number(c.sequenceNo) || 0), 0);
      customerData.sequenceNo = maxSeq + 1;
      if (syncCollectionSeq) {
        customerData.collectionSequence = customerData.sequenceNo;
      }
    }

    if (!customerData.createdAt) {
      customerData.createdAt = new Date().toISOString();
    }
    customerData.isNew = true;

    await this.put("customers", customerData);
    return customerData;
  }

  async updateRouteSequence(routeId, orderedCustomerIds, syncCollectionSeq = true) {
    for (let i = 0; i < orderedCustomerIds.length; i++) {
      const custId = orderedCustomerIds[i];
      const cust = await this.get("customers", custId);
      if (cust) {
        cust.sequenceNo = i + 1;
        if (syncCollectionSeq) {
          cust.collectionSequence = i + 1;
        }
        await this.put("customers", cust);
      }
    }
    return true;
  }

  async resetToDemo() {
    const stores = ["firms", "items", "routes", "salesmen", "collectionMen", "customers", "vacations", "bills", "payments"];
    for (const s of stores) await this.clear(s);
    await this.seedDefaults();
    return true;
  }
}

// Global DB Singleton
window.vendorDB = new VendorDB();
