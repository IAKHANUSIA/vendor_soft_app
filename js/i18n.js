// Bilingual Localization Engine (Gujarati ગુજરાતી & English)
const translations = {
  en: {
    appTitle: "Vendor Soft",
    tagline: "Newspaper & Magazine Distribution Management",
    offlineStatus: "Offline Mode Active (100% Local)",
    onlineStatus: "Ready",
    
    // Navigation
    navDashboard: "Dashboard",
    navDailyDelivery: "Daily Delivery",
    navCustomers: "Customers",
    navVacation: "Vacations",
    navBilling: "Monthly Bills",
    navPayments: "Payments & UPI",
    navDepot: "Depot Purchase (Evening)",
    navItems: "Newspaper Master",
    navRoutes: "Lines & Hawkers",
    navReports: "Ledgers & Reports",
    navExpenses: "Expenses & Bank",
    navSettings: "Settings & Backup",

    // Depot purchase & evening sales
    actionDepotPurchase: "Tomorrow's Sales & Depot Indent",
    depotTitle: "Tomorrow's Evening Sales & Depot Purchase Sheet",
    depotTotalCopies: "Total Copies to Buy",
    depotPayableAmount: "Total Payable to Depot",
    depotExpectedSale: "Expected Sales Value",
    depotExpectedProfit: "Expected Profit / Margin",
    depotTableTitle: "Newspaper Purchase & Settlement Details",
    depotPurchaseBasis: "Payable based on purchase rate (PTR)",
    depotSaleBasis: "Calculated based on selling price (MRP)",
    depotMarginInfo: "Total Margin / Profit",
    depotDayName: "Day",
    depotCustomerDemand: "Customer Demand",
    depotCounterCopies: "Counter Copies",
    depotTotalPurchase: "Total Purchase",
    depotPurchasePrice: "Purchase Price (PTR)",
    depotPayableDepot: "Payable to Depot (₹)",
    depotSalePrice: "Sale Price (MRP)",
    depotExpectedSaleValue: "Sale Value (₹)",
    depotMargin: "Margin / Profit (₹)",
    depotSaveNotice: "Changes to counter copies are automatically saved.",
    routeOrganizerTitle: "Organize Route Delivery Sequence",
    dragDropRouteHint: "Drag and drop cards to reorder delivery sequence for this route",
    billingType: "Billing Type",
    billingDaily: "Daily (By Day Rates)",
    billingFixed: "Fixed Monthly Amount",
    fixedMonthlyAmount: "Fixed Amount (₹/Month)",
    dayRatesBreakdown: "Day-wise Rates (Sale / Purchase)",
    copyMonRate: "Copy Monday Rates to All Days",
    salePrice: "Sale Price (MRP)",
    purchasePrice: "Purchase Price (PTR)",

    // Dashboard metrics
    todayDate: "Today's Date",
    totalMorningPapers: "Morning Paper Demand",
    activeCustomersCount: "Active Customers",
    activeVacationsCount: "On Vacation Today",
    monthlyBilledAmt: "Month's Total Billed",
    monthlyCollectedAmt: "Total Collected",
    monthlyPendingAmt: "Outstanding Balance",
    quickActions: "Quick Actions",
    actionMorningSheet: "Daily Hawker Sheet",
    actionAddCustomer: "Add Customer",
    actionAddVacation: "Add Vacation",
    actionCollectPay: "Collect Payment",
    todayDemandSummary: "Depot Paper Collection Summary",
    paperName: "Paper Name",
    requiredCopies: "Total Copies",
    regularCopies: "Regular",
    extraCopies: "Extra Copies",

    // Item Master
    itemsTitle: "Newspaper & Magazine Master",
    addItem: "Add New Paper",
    editItem: "Edit Paper",
    itemName: "Paper / Item Name",
    itemCode: "Code",
    itemType: "Type",
    typeDaily: "Daily Newspaper",
    typeWeekly: "Weekly / Magazine",
    typeMonthly: "Monthly Magazine",
    weeklyRates: "Weekly Rates (MRP/PTR)",
    monthlyRate: "Fixed Monthly Rate (₹)",
    monthlyFixBill: "Monthly Fix Bill (₹)",
    commissionRate: "Hawker Comm. (%)",
    actions: "Actions",
    searchItems: "Search newspapers...",
    saveItem: "Save Paper",
    cancel: "Cancel",
    confirmDelete: "Are you sure you want to delete this item?",

    // Route & Hawker Master
    routesTitle: "Delivery Lines & Hawkers",
    addRoute: "Add Delivery Line",
    routeName: "Line / Route Name",
    routeCode: "Line Code",
    assignedSalesman: "Assigned Hawker",
    salesmanPhone: "Hawker Mobile",
    customerCount: "Total Customers",
    addSalesman: "Add New Hawker",
    salesmanName: "Hawker Name",

    // Customer Master
    customersTitle: "Customer Master",
    addCustomer: "Register New Customer",
    editCustomer: "Edit Customer",
    customerName: "Customer Name",
    customerLine: "Delivery Line",
    sequenceNo: "Delivery Sequence",
    mobileNo: "Mobile Number",
    whatsappNo: "WhatsApp Number",
    address: "Delivery Address",
    subscribedPapers: "Subscribed Papers",
    openingBalance: "Opening Balance / Arrears (₹)",
    status: "Status",
    statusActive: "Active",
    statusInactive: "Inactive",
    searchCustomers: "Search by name, line, or mobile...",
    filterByLine: "Filter by Line",
    allLines: "All Lines",
    saveCustomer: "Save Customer",

    // Daily Delivery
    dailyDeliveryTitle: "Daily Distribution Checklist",
    selectDate: "Select Date",
    printSheet: "Print Hawker Sheet",
    markAllDelivered: "Mark All Delivered",
    customer: "Customer",
    assignedPapers: "Papers",
    deliveryStatus: "Delivery Status",
    delivered: "Delivered",
    skippedVacation: "On Vacation (Skipped)",
    extraPaper: "Add Extra Copy",
    specialNotes: "Notes",

    // Vacation Calendar
    vacationTitle: "Customer Vacation / Stop Deliveries",
    addVacationEntry: "Record Vacation / Stop Date",
    selectCustomer: "Select Customer",
    startDate: "From Date",
    endDate: "To Date",
    totalDays: "Total Days",
    vacationReason: "Reason / Note",
    activeVacations: "Scheduled Vacations",
    vacationImpact: "Papers will be automatically skipped & credited in bill",
    deleteVacation: "Remove Vacation",

    // Monthly Billing
    billingTitle: "Monthly Bill Generation",
    selectBillingMonth: "Select Month & Year",
    processBills: "Calculate Monthly Bills",
    printAllBills: "Print All Bills",
    billSummary: "Billing Summary",
    totalBillsGenerated: "Total Bills",
    billedAmount: "Billed Total",
    customerBillDetails: "Customer Bills",
    billNo: "Bill #",
    billPeriod: "Billing Period",
    daysDelivered: "Days Delivered",
    vacationDeduction: "Vacation Credit (₹)",
    currentBill: "Current Bill (₹)",
    pastArrears: "Previous Balance (₹)",
    netPayable: "Net Payable (₹)",
    printBillSlip: "Print Slip",
    sendWhatsApp: "Send via WhatsApp",

    // Payments & UPI QR
    paymentTitle: "Payment Collection & Dynamic UPI QR",
    recordPayment: "Record Payment",
    amountPaid: "Amount Paid (₹)",
    paymentMode: "Payment Mode",
    modeCash: "Cash",
    modeUPI: "UPI / Online",
    modeCheque: "Cheque",
    paymentDate: "Payment Date",
    receiptNo: "Receipt #",
    referenceNo: "Reference / UTR #",
    printReceipt: "Print Receipt",
    scanToPayUPI: "Scan to Pay via UPI",
    dynamicUPIDesc: "Pre-configured with Customer Bill Amount & Agency VPA",
    agencyUPIId: "Agency UPI ID",

    // WhatsApp Message Template
    waGreeting: "Hello",
    waBillNotice: "Your newspaper bill for the month of",
    waPeriod: "Period",
    waPapers: "Papers",
    waDays: "Days",
    waVacationDays: "Vacation Days Deducted",
    waCurrentBill: "Current Month Bill",
    waPreviousDue: "Previous Balance",
    waTotalDue: "Total Payable Amount",
    waUPIPrompt: "You can pay instantly using UPI ID or scan QR code",
    waThankYou: "Thank you for your business!",

    // Ledgers & Reports
    reportsTitle: "Reports & Accounting Ledgers",
    reportCustomerLedger: "Customer Ledger",
    reportCashBook: "Daily Cash Book",
    reportOutstanding: "Line-wise Outstanding List",
    exportExcel: "Export as CSV/Excel",
    date: "Date",
    particulars: "Particulars",
    debit: "Debit / Bill (+)",
    credit: "Credit / Paid (-)",
    balance: "Balance (₹)",

    // Settings & Backup
    settingsTitle: "Agency Profile & Offline Backup",
    agencyProfile: "Agency Profile",
    agencyName: "Agency Name",
    agencyAddress: "Agency Address",
    agencyPhone: "Agency Contact",
    agencyGST: "GST / Reg Number",
    backupTitle: "Offline Data Backup & Restore",
    backupDesc: "Export all your customer, newspaper, delivery, and billing data to a single JSON file. You can restore it anytime on any device.",
    downloadBackup: "Download Offline Backup",
    restoreBackup: "Restore Data from Backup File",
    resetData: "Reset to Default Demo Data",
    saveSettings: "Save Profile",

    // Notification messages
    saveSuccess: "Saved successfully!",
    deleteSuccess: "Deleted successfully!",
    billGenSuccess: "Bills generated successfully for all active customers!",
    paymentSuccess: "Payment recorded successfully!",
    backupSuccess: "Data backup file downloaded!",
    restoreSuccess: "Data restored successfully!"
  },

  gu: {
    appTitle: "વેન્ડર સોફ્ટ (Vendor Soft)",
    tagline: "વર્તમાનપત્ર અને સામયિક વિતરણ મેનેજમેન્ટ સિસ્ટમ",
    offlineStatus: "ઓફલાઇન મોડ ચાલુ (૧૦૦% લોકલ)",
    onlineStatus: "તૈયાર છે",

    // Navigation
    navDashboard: "ડેશબોર્ડ",
    navDailyDelivery: "રોજિંદી વહેંચણી",
    navCustomers: "ગ્રાહક માસ્ટર",
    navVacation: "રજા કેલેન્ડર",
    navBilling: "મહિનાનું બિલિંગ",
    navPayments: "ઉઘરાણી અને UPI",
    navDepot: "ડેપો ખરીદી (સાંજનું સેલ)",
    navItems: "વસ્તુ માસ્ટર (પેપર)",
    navRoutes: "લાઇન અને વિતરક",
    navReports: "ખાતાવહી અને હિસાબ",
    navExpenses: "ખર્ચ અને બેંક",
    navSettings: "સેટિંગ્સ અને બેકઅપ",

    // Depot purchase & evening sales
    actionDepotPurchase: "આવતીકાલનું સેલ (ડેપો ખરીદી)",
    depotTitle: "આવતીકાલનું સેલ અને ડેપો ખરીદી હિસાબ",
    depotTotalCopies: "કુલ ખરીદવાની નકલ",
    depotPayableAmount: "ડેપોને ચૂકવવાની રકમ",
    depotExpectedSale: "અપેક્ષિત વેચાણ રકમ",
    depotExpectedProfit: "અપેક્ષિત નફો / માર્જિન",
    depotTableTitle: "પેપર મુજબ ખરીદી અને ચૂકવણી વિગત",
    depotPurchaseBasis: "ખરીદ ભાવ (PTR) મુજબ ચૂકવણી",
    depotSaleBasis: "વેચાણ ભાવ (MRP) મુજબ ગણતરી",
    depotMarginInfo: "કુલ નફો / માર્જિન",
    billingType: "બિલિંગ પ્રકાર",
    billingDaily: "રોજિંદો ભાવ (દૈનિક ગણતરી)",
    billingFixed: "ફિક્સ માસિક રકમ (Fixed Contract)",
    fixedMonthlyAmount: "ફિક્સ રકમ (₹/મહિને)",
    dayRatesBreakdown: "સોમ-રવિ વેચાણ અને ખરીદ ભાવ",
    copyMonRate: "સોમવારનો ભાવ બધા દિવસ કોપી કરો",
    salePrice: "વેચાણ ભાવ (MRP)",
    purchasePrice: "ખરીદ ભાવ (PTR)",

    // Dashboard metrics
    todayDate: "આજની તારીખ",
    totalMorningPapers: "સવારે જોઈતા કુલ પેપર્સ",
    activeCustomersCount: "કુલ સક્રિય ગ્રાહકો",
    activeVacationsCount: "આજે રજા પર ગ્રાહકો",
    monthlyBilledAmt: "આ મહિનાનું કુલ બિલિંગ",
    monthlyCollectedAmt: "કુલ જમા ઉઘરાણી",
    monthlyPendingAmt: "કુલ બાકી રકમ (ઉઘરાણી)",
    quickActions: "ઝડપી કાર્યો",
    actionMorningSheet: "સવારની હોકર શીટ",
    actionAddCustomer: "નવો ગ્રાહક ઉમેરો",
    actionAddVacation: "રજાની એન્ટ્રી કરો",
    actionCollectPay: "ઉઘરાણી જમા કરો",
    todayDemandSummary: "ડેપોમાંથી લેવાના પેપર્સની વિગત",
    paperName: "પેપરનું નામ",
    requiredCopies: "કુલ નકલ (સંખ્યા)",
    regularCopies: "નિયમિત નકલ",
    extraCopies: "વધારાની નકલ",

    // Item Master
    itemsTitle: "વસ્તુ માસ્ટર (પેપર્સ અને સામયિકો)",
    addItem: "નવું પેપર ઉમેરો",
    editItem: "પેપરમાં ફેરફાર કરો",
    itemName: "પેપર / વસ્તુનું નામ",
    itemCode: "કોડ",
    itemType: "પ્રકાર",
    typeDaily: "રોજિંદુ દૈનિક પેપર",
    typeWeekly: "સાપ્તાહિક / મેગેઝિન",
    typeMonthly: "માસિક સામયિક",
    weeklyRates: "સાપ્તાહિક ભાવ (MRP / PTR)",
    monthlyRate: "ફિક્સ માસિક ભાવ (₹)",
    monthlyFixBill: "માસિક ફિક્સ બિલ (₹)",
    commissionRate: "માસિક પગાર (₹)",
    actions: "ક્રિયાઓ",
    searchItems: "પેપર શોધો...",
    saveItem: "પેપર સાચવો",
    cancel: "રદ કરો",
    confirmDelete: "શું તમે ખરેખર આ પેપર હટાવવા માંગો છો?",

    // Route & Hawker Master
    routesTitle: "ડિલિવરી લાઇન અને વિતરક માસ્ટર",
    addRoute: "નવી લાઇન ઉમેરો",
    routeName: "લાઇન / રૂટનું નામ",
    routeCode: "લાઇન કોડ",
    assignedSalesman: "નિયુક્ત હોકર (વિતરક)",
    salesmanPhone: "વિતરક મોબાઈલ",
    customerCount: "કુલ ગ્રાહકો",
    addSalesman: "નવો વિતરક ઉમેરો",
    salesmanName: "વિતરકનું નામ",

    // Customer Master
    customersTitle: "ગ્રાહક માસ્ટર",
    addCustomer: "નવા ગ્રાહકની નોંધણી",
    editCustomer: "ગ્રાહકની વિગત બદલો",
    customerName: "ગ્રાહકનું નામ",
    customerLine: "ડિલિવરી લાઇન",
    sequenceNo: "વિતરણ ક્રમ નંબર",
    mobileNo: "મોબાઈલ નંબર",
    whatsappNo: "વૉટ્સએપ નંબર",
    address: "સરનામું",
    subscribedPapers: "ચાલુ પેપર્સ (સબ્સ્ક્રિપ્શન)",
    openingBalance: "જૂની બાકી રકમ (₹)",
    status: "સ્થિતિ",
    statusActive: "ચાલુ (Active)",
    statusInactive: "બંધ (Inactive)",
    searchCustomers: "નામ, લાઇન અથવા મોબાઈલથી શોધો...",
    filterByLine: "લાઇન મુજબ જુઓ",
    allLines: "બધી લાઇન",
    saveCustomer: "ગ્રાહક સાચવો",

    // Daily Delivery
    dailyDeliveryTitle: "રોજિંદી વિતરણ ચેકલિસ્ટ (હોકર શીટ)",
    selectDate: "તારીખ પસંદ કરો",
    printSheet: "હોકર શીટ પ્રિન્ટ કરો",
    markAllDelivered: "બધાને પહોંચાડ્યા માર્ક કરો",
    customer: "ગ્રાહક",
    assignedPapers: "પેપર્સ",
    deliveryStatus: "વિતરણ સ્થિતિ",
    delivered: "આપી દીધું",
    skippedVacation: "રજા પર (બંધ)",
    extraPaper: "વધારાની નકલ ઉમેરો",
    specialNotes: "ખાસ નોંધ",

    // Vacation Calendar
    vacationTitle: "ગ્રાહક રજા કેલેન્ડર (પેપર બંધ તારીખ)",
    addVacationEntry: "રજાની નવી નોંધણી કરો",
    selectCustomer: "ગ્રાહક પસંદ કરો",
    startDate: "આ તારીખથી શરૂ",
    endDate: "આ તારીખ સુધી",
    totalDays: "કુલ દિવસો",
    vacationReason: "કારણ / નોંધ",
    activeVacations: "ચાલુ રજાઓની યાદી",
    vacationImpact: "આ દિવસોનું પેપર આપોઆપ બંધ થશે અને બિલમાંથી રકમ બાદ થશે",
    deleteVacation: "રજા રદ કરો",

    // Monthly Billing
    billingTitle: "માસિક બિલિંગ પ્રોસેસ",
    selectBillingMonth: "મહિનો અને વર્ષ પસંદ કરો",
    processBills: "મહિનાનું બિલ ગણો (ઓટોમેટિક)",
    printAllBills: "બધા બિલ પ્રિન્ટ કરો",
    billSummary: "બિલિંગ સારાંશ",
    totalBillsGenerated: "કુલ બનેલા બિલ",
    billedAmount: "કુલ બિલ રકમ",
    customerBillDetails: "ગ્રાહકોના માસિક બિલ",
    billNo: "બિલ નં.",
    billPeriod: "સમયગાળો",
    daysDelivered: "આપેલા દિવસો",
    vacationDeduction: "રજાની કપાત (₹)",
    currentBill: "આ મહિનાનું બિલ (₹)",
    pastArrears: "જૂની બાકી રકમ (₹)",
    netPayable: "ચુકવવાપાત્ર કુલ રકમ (₹)",
    printBillSlip: "બિલ સ્લિપ છાપો",
    sendWhatsApp: "વૉટ્સએપ પર મોકલો",

    // Payments & UPI QR
    paymentTitle: "ઉઘરાણી અને ડાયનેમિક UPI QR કોડ",
    recordPayment: "પાવતી બનાવો (નાણાં જમા)",
    amountPaid: "મળેલ રકમ (₹)",
    paymentMode: "ચુકવણીનો પ્રકાર",
    modeCash: "રોકડ (Cash)",
    modeUPI: "UPI / ઓનલાઇન",
    modeCheque: "ચેક",
    paymentDate: "જમા તારીખ",
    receiptNo: "પાવતી નં.",
    referenceNo: "રેફરન્સ / UTR નં.",
    printReceipt: "પાવતી પ્રિન્ટ કરો",
    scanToPayUPI: "UPI દ્વારા સ્કેન કરીને ચૂકવો",
    dynamicUPIDesc: "ગ્રાહકના બિલની રકમ અને એજન્સીના UPI સાથે આપોઆપ જનરેટ થાય છે",
    agencyUPIId: "એજન્સી UPI ID",

    // WhatsApp Message Template
    waGreeting: "નમસ્તે",
    waBillNotice: "આપનું વર્તમાનપત્રનું માસિક બિલ નીચે મુજબ છે:",
    waPeriod: "મહિનો",
    waPapers: "પેપર્સ",
    waDays: "આવેલા દિવસો",
    waVacationDays: "રજાના દિવસો બાદ",
    waCurrentBill: "ચાલુ મહિનાનું બિલ",
    waPreviousDue: "જૂની બાકી રકમ",
    waTotalDue: "કુલ ભરવાપાત્ર રકમ",
    waUPIPrompt: "આપ નીચે આપેલ UPI ID અથવા QR કોડ સ્કેન કરીને સીધા પૈસા ચૂકવી શકો છો:",
    waThankYou: "આભાર - આપનો ન્યૂઝપેપર વિતરક",

    // Ledgers & Reports
    reportsTitle: "ખાતાવહી અને હિસાબી રિપોર્ટ્સ",
    reportCustomerLedger: "ગ્રાહક ખાતાવહી",
    reportCashBook: "રોકડ મેળ (Cash Book)",
    reportOutstanding: "લાઇન મુજબ બાકી ઉઘરાણી લિસ્ટ",
    exportExcel: "Excel/CSV માં એક્સપોર્ટ કરો",
    date: "તારીખ",
    particulars: "વિગત",
    debit: "ઉધાર / બિલ (+)",
    credit: "જમા / રોકડા (-)",
    balance: "બાકી રકમ (₹)",

    // Settings & Backup
    settingsTitle: "એજન્સી પ્રોફાઇલ અને ઓફલાઇન બેકઅપ",
    agencyProfile: "એજન્સી માહિતી",
    agencyName: "એજન્સીનું નામ",
    agencyAddress: "સરનામું",
    agencyPhone: "સંપર્ક નંબર",
    agencyGST: "જીએસટી / રજિ. નંબર",
    backupTitle: "૧૦૦% ઓફલાઇન ડેટા બેકઅપ અને રીસ્ટોર",
    backupDesc: "તમારા તમામ ગ્રાહકો, પેપર્સ, રોજિંદી એન્ટ્રીઓ અને બિલનો સુરક્ષિત બેકઅપ તમારા ફોન કે કમ્પ્યુટરમાં એક ક્લિકમાં ડાઉનલોડ કરો.",
    downloadBackup: "બેકઅપ ફાઈલ ડાઉનલોડ કરો",
    restoreBackup: "બેકઅપ ફાઈલમાંથી ડેટા રીસ્ટોર કરો",
    resetData: "નમૂનાનો (ડેમો) ડેટા ફરીથી લાવો",
    saveSettings: "પ્રોફાઇલ સાચવો",

    // Notification messages
    saveSuccess: "સફળતાપૂર્વક સાચવવામાં આવ્યું!",
    deleteSuccess: "સફળતાપૂર્વક હટાવી દેવામાં આવ્યું!",
    billGenSuccess: "બધા જ ગ્રાહકો માટે માસિક બિલ સફળતાપૂર્વક બની ગયા!",
    paymentSuccess: "ચુકવણી સફળતાપૂર્વક જમા થઈ ગઈ!",
    backupSuccess: "બેકઅપ ફાઈલ ડાઉનલોડ થઈ ગઈ છે!",
    restoreSuccess: "ડેટા સફળતાપૂર્વક રીસ્ટોર થઈ ગયો છે!"
  }
};

let currentLang = localStorage.getItem("vendorsoft_lang") || "gu";

function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem("vendorsoft_lang", lang);
    applyLanguage();
  }
}

function getLanguage() {
  return currentLang;
}

function t(key) {
  if (translations[currentLang] && translations[currentLang][key]) {
    return translations[currentLang][key];
  }
  if (translations.en && translations.en[key]) {
    return translations.en[key];
  }
  return key;
}

function applyLanguage() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key) {
      el.textContent = t(key);
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) {
      el.setAttribute("placeholder", t(key));
    }
  });

  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    if (key) {
      el.setAttribute("title", t(key));
    }
  });

  const langBtn = document.getElementById("langToggleBtn");
  if (langBtn) {
    langBtn.innerHTML = currentLang === "gu" 
      ? `<span>🌐 English</span>` 
      : `<span>🌐 ગુજરાતી</span>`;
  }
  
  // Trigger custom event for components that need dynamic refresh
  window.dispatchEvent(new CustomEvent("languageChanged", { detail: { lang: currentLang } }));
}
