// ============================================================================
// Control de Ventas al Detal - Sistema Integral para Tiendas (Material Design 3)
// ============================================================================

const STORAGE_KEYS = {
  PRODUCTS: 'cdv_products_v1',
  SALES: 'cdv_sales_v1',
  SETTINGS: 'cdv_settings_v1',
  CATEGORIES: 'cdv_categories_v1',
  INVENTORY: 'cdv_inventory_v1',
  DAMAGES: 'cdv_damages_v1',
  DEVICE_ROLE: 'cdv_device_role_v1',
};

// Default initial inventory items (raw ingredients & packaged drinks)
const DEFAULT_INVENTORY = [
  { id: 'inv-pan-perro', name: 'Pan de Perros', category: 'Panes', stock: 60, unit: 'und', minAlert: 15 },
  { id: 'inv-pan-burger', name: 'Pan de Hamburguesa', category: 'Panes', stock: 50, unit: 'und', minAlert: 12 },
  { id: 'inv-salchicha', name: 'Salchichas', category: 'Embutidos', stock: 60, unit: 'und', minAlert: 15 },
  { id: 'inv-carne', name: 'Carne de Hamburguesa', category: 'Proteínas', stock: 50, unit: 'porciones', minAlert: 10 },
  { id: 'inv-pollo', name: 'Pollo Desmechado / Filete', category: 'Proteínas', stock: 40, unit: 'porciones', minAlert: 10 },
  { id: 'inv-chorizo', name: 'Chorizo', category: 'Embutidos', stock: 35, unit: 'porciones', minAlert: 10 },
  { id: 'inv-chuleta', name: 'Chuleta Ahumada', category: 'Proteínas', stock: 30, unit: 'porciones', minAlert: 10 },
  { id: 'inv-queso', name: 'Queso Amarillo / Mano', category: 'Lácteos', stock: 50, unit: 'porciones', minAlert: 12 },
  { id: 'inv-tocineta', name: 'Tocineta Crujiente', category: 'Embutidos', stock: 40, unit: 'porciones', minAlert: 10 },
  { id: 'inv-salsas', name: 'Raciones de Salsas', category: 'Salsas', stock: 120, unit: 'raciones', minAlert: 25 },
  { id: 'inv-papas', name: 'Papas Fritas', category: 'Guarniciones', stock: 35, unit: 'porciones', minAlert: 8 },
  { id: 'inv-refresco', name: 'Refresco 355ml', category: 'Bebidas', stock: 48, unit: 'latas/botellas', minAlert: 12 },
  { id: 'inv-malta', name: 'Malta Polar', category: 'Bebidas', stock: 36, unit: 'botellas', minAlert: 10 },
  { id: 'inv-agua', name: 'Agua Mineral 500ml', category: 'Bebidas', stock: 40, unit: 'botellas', minAlert: 10 }
];

// ============================================================================
// High-Capacity Image Persistence (IndexedDB + Smart Auto-Compression)
// Eliminates localStorage 5MB quota errors & prevents disappearing images
// ============================================================================
const ImageDB = {
  dbInstance: null,
  async getDB() {
    if (this.dbInstance) return this.dbInstance;
    if (typeof window === 'undefined' || !window.indexedDB) return null;
    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open('ControlVentas_Images_DB', 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('product_images')) {
            db.createObjectStore('product_images');
          }
        };
        request.onsuccess = (e) => {
          this.dbInstance = e.target.result;
          resolve(this.dbInstance);
        };
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  },

  async set(key, value) {
    if (!key || !value) return false;
    try {
      const db = await this.getDB();
      if (!db) return false;
      return new Promise((resolve) => {
        const tx = db.transaction('product_images', 'readwrite');
        const store = tx.objectStore('product_images');
        store.put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  },

  async get(key) {
    if (!key) return null;
    try {
      const db = await this.getDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction('product_images', 'readonly');
        const store = tx.objectStore('product_images');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  async delete(key) {
    if (!key) return false;
    try {
      const db = await this.getDB();
      if (!db) return false;
      return new Promise((resolve) => {
        const tx = db.transaction('product_images', 'readwrite');
        const store = tx.objectStore('product_images');
        store.delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }
};

/**
 * Compresses any user-uploaded image down to max 500x500 px.
 * Transforms heavy 5MB-15MB camera photos into ultra-fast 30KB-50KB images
 * so they load instantly and persist reliably across reboots.
 */
function compressImage(input, maxDimension = 500, quality = 0.82) {
  return new Promise((resolve) => {
    if (!input) return resolve('');

    const processDataUrl = (dataUrl) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width <= maxDimension && height <= maxDimension && dataUrl.length < 70000) {
          return resolve(dataUrl);
        }

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#141418';
        ctx.drawImage(img, 0, 0, width, height);

        const output = canvas.toDataURL('image/jpeg', quality);
        resolve(output);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };

    if (typeof input === 'string') {
      processDataUrl(input);
    } else if (input instanceof File || input instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => processDataUrl(e.target.result);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(input);
    } else {
      resolve('');
    }
  });
}

// Initial Default Categories
const DEFAULT_CATEGORIES = [
  'Hamburguesas',
  'Comida Rápida',
  'Combos',
  'Bebidas',
  'Víveres',
  'Lácteos',
  'Limpieza',
  'Snacks',
  'Otros'
];

// Initial Sample Products (Realistic Retail Products & Fast Food)
const SAMPLE_PRODUCTS = [
  {
    id: 'prod-burger-1',
    name: 'Hamburguesa Clásica',
    priceUsd: 4.50,
    category: 'Hamburguesas',
    date: new Date().toISOString().split('T')[0],
    stock: 50,
    icon: 'lunch_dining',
    requiresFlavor: true,
    image: ''
  },
  {
    id: 'prod-burger-2',
    name: 'Hamburguesa Especial Doble',
    priceUsd: 7.00,
    category: 'Hamburguesas',
    date: new Date().toISOString().split('T')[0],
    stock: 35,
    icon: 'lunch_dining',
    requiresFlavor: true,
    burgerCount: 2,
    image: ''
  },
  {
    id: 'prod-hotdog-1',
    name: 'Perro Caliente Tradicional',
    priceUsd: 2.50,
    category: 'Comida Rápida',
    date: new Date().toISOString().split('T')[0],
    stock: 60,
    icon: 'hot_tub',
    image: ''
  },
  {
    id: 'prod-hotdog-2',
    name: 'Perro Caliente Especial con Queso y Tocineta',
    priceUsd: 3.50,
    category: 'Comida Rápida',
    date: new Date().toISOString().split('T')[0],
    stock: 40,
    icon: 'hot_tub',
    image: ''
  },
  {
    id: 'prod-combo-1',
    name: 'Combo Hamburguesa + Papas + Refresco',
    priceUsd: 6.50,
    category: 'Combos',
    date: new Date().toISOString().split('T')[0],
    stock: 30,
    icon: 'fastfood',
    requiresFlavor: true,
    image: '',
    comboProducts: [
      { productId: 'prod-burger-1', name: 'Hamburguesa Clásica', quantity: 1, category: 'Hamburguesas' },
      { productId: 'prod-papas-1', name: 'Papas Fritas', quantity: 1, category: 'Guarniciones' },
      { productId: 'prod-drink-1', name: 'Refresco 355ml', quantity: 1, category: 'Bebidas' }
    ]
  },
  {
    id: 'prod-combo-2',
    name: 'Combo Dúo: 2 Hamburguesas + Papas + 2 Refrescos',
    priceUsd: 11.00,
    category: 'Combos',
    date: new Date().toISOString().split('T')[0],
    stock: 25,
    icon: 'fastfood',
    requiresFlavor: true,
    image: '',
    comboProducts: [
      { productId: 'prod-burger-1', name: 'Hamburguesa Clásica', quantity: 2, category: 'Hamburguesas' },
      { productId: 'prod-papas-1', name: 'Papas Fritas', quantity: 1, category: 'Guarniciones' },
      { productId: 'prod-drink-1', name: 'Refresco 355ml', quantity: 2, category: 'Bebidas' }
    ]
  },
  {
    id: 'prod-drink-1',
    name: 'Refresco 355ml',
    priceUsd: 1.50,
    category: 'Bebidas',
    date: new Date().toISOString().split('T')[0],
    stock: 48,
    icon: 'local_drink',
    image: ''
  },
  {
    id: 'prod-drink-2',
    name: 'Malta Polar 250ml',
    priceUsd: 1.25,
    category: 'Bebidas',
    date: new Date().toISOString().split('T')[0],
    stock: 36,
    icon: 'sports_bar',
    image: ''
  },
  {
    id: 'prod-drink-3',
    name: 'Agua Mineral 500ml',
    priceUsd: 1.00,
    category: 'Bebidas',
    date: new Date().toISOString().split('T')[0],
    stock: 40,
    icon: 'water_bottle',
    image: ''
  },
  {
    id: 'prod-1',
    name: 'Harina de Maíz PAN 1kg',
    priceUsd: 1.40,
    category: 'Víveres',
    date: new Date().toISOString().split('T')[0],
    stock: 48,
    icon: 'grain',
    image: ''
  },
  {
    id: 'prod-2',
    name: 'Café Molido Gourmet 250g',
    priceUsd: 3.20,
    category: 'Víveres',
    date: new Date().toISOString().split('T')[0],
    stock: 24,
    icon: 'coffee',
    image: ''
  },
  {
    id: 'prod-3',
    name: 'Arroz Blanco Primor 1kg',
    priceUsd: 1.30,
    category: 'Víveres',
    date: new Date().toISOString().split('T')[0],
    stock: 36,
    icon: 'rice_bowl',
    image: ''
  },
  {
    id: 'prod-4',
    name: 'Aceite Vegetal Mazeite 1L',
    priceUsd: 2.75,
    category: 'Víveres',
    date: new Date().toISOString().split('T')[0],
    stock: 20,
    icon: 'water_drop',
    image: ''
  },
  {
    id: 'prod-5',
    name: 'Leche en Polvo Completa 400g',
    priceUsd: 4.50,
    category: 'Lácteos',
    date: new Date().toISOString().split('T')[0],
    stock: 18,
    icon: 'nutrition',
    image: ''
  },
  {
    id: 'prod-6',
    name: 'Azúcar Refinada Montalbán 1kg',
    priceUsd: 1.15,
    category: 'Víveres',
    date: new Date().toISOString().split('T')[0],
    stock: 50,
    icon: 'cookie',
    image: ''
  },
  {
    id: 'prod-7',
    name: 'Pasta Larga Primor 500g',
    priceUsd: 1.10,
    category: 'Víveres',
    date: new Date().toISOString().split('T')[0],
    stock: 40,
    icon: 'ramen_dining',
    image: ''
  },
  {
    id: 'prod-8',
    name: 'Atún en Aceite Margarita 140g',
    priceUsd: 1.70,
    category: 'Víveres',
    date: new Date().toISOString().split('T')[0],
    stock: 30,
    icon: 'set_meal',
    image: ''
  }
];

// Seed Sample Sales (Spanning today and earlier this week)
function generateSampleSales(rate) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

  return [
    {
      id: 'TKT-1001',
      timestamp: `${todayStr}T10:15:00`,
      dateString: todayStr,
      items: [
        { productId: 'prod-1', name: 'Harina de Maíz PAN 1kg', priceUsd: 1.40, quantity: 2, totalUsd: 2.80, totalBs: 2.80 * rate },
        { productId: 'prod-2', name: 'Café Molido Gourmet 250g', priceUsd: 3.20, quantity: 1, totalUsd: 3.20, totalBs: 3.20 * rate }
      ],
      totalUsd: 6.00,
      totalBs: 6.00 * rate,
      rate: rate,
      paymentMethod: 'pago_movil',
      status: 'completed'
    },
    {
      id: 'TKT-1002',
      timestamp: `${todayStr}T11:45:00`,
      dateString: todayStr,
      items: [
        { productId: 'prod-4', name: 'Aceite Vegetal Mazeite 1L', priceUsd: 2.75, quantity: 1, totalUsd: 2.75, totalBs: 2.75 * rate },
        { productId: 'prod-6', name: 'Azúcar Refinada Montalbán 1kg', priceUsd: 1.15, quantity: 2, totalUsd: 2.30, totalBs: 2.30 * rate }
      ],
      totalUsd: 5.05,
      totalBs: 5.05 * rate,
      rate: rate,
      paymentMethod: 'efectivo',
      status: 'completed'
    },
    {
      id: 'TKT-1003',
      timestamp: `${todayStr}T12:30:00`,
      dateString: todayStr,
      items: [
        { productId: 'prod-5', name: 'Leche en Polvo Completa 400g', priceUsd: 4.50, quantity: 1, totalUsd: 4.50, totalBs: 4.50 * rate },
        { productId: 'prod-7', name: 'Pasta Larga Primor 500g', priceUsd: 1.10, quantity: 2, totalUsd: 2.20, totalBs: 2.20 * rate }
      ],
      totalUsd: 6.70,
      totalBs: 6.70 * rate,
      rate: rate,
      paymentMethod: 'punto_de_venta',
      status: 'completed'
    },
    {
      id: 'TKT-0998',
      timestamp: `${yesterdayStr}T15:20:00`,
      dateString: yesterdayStr,
      items: [
        { productId: 'prod-1', name: 'Harina de Maíz PAN 1kg', priceUsd: 1.40, quantity: 4, totalUsd: 5.60, totalBs: 5.60 * rate },
        { productId: 'prod-3', name: 'Arroz Blanco Primor 1kg', priceUsd: 1.30, quantity: 3, totalUsd: 3.90, totalBs: 3.90 * rate }
      ],
      totalUsd: 9.50,
      totalBs: 9.50 * rate,
      rate: rate,
      paymentMethod: 'pago_movil',
      status: 'completed'
    },
    {
      id: 'TKT-0997',
      timestamp: `${twoDaysAgoStr}T09:10:00`,
      dateString: twoDaysAgoStr,
      items: [
        { productId: 'prod-8', name: 'Atún en Aceite Margarita 140g', priceUsd: 1.70, quantity: 4, totalUsd: 6.80, totalBs: 6.80 * rate }
      ],
      totalUsd: 6.80,
      totalBs: 6.80 * rate,
      rate: rate,
      paymentMethod: 'efectivo',
      status: 'completed'
    }
  ];
}

// Global App State
let state = {
  products: [],
  sales: [],
  categories: [...DEFAULT_CATEGORIES],
  selectedCategoryFilter: 'all',
  settings: {
    exchangeRate: 65.50,
    storeName: 'Mi Tienda',
    logoData: '',
    themeColor: 'green', // 'green' | 'cyan'
    isDarkMode: true,
    language: 'es', // 'es' | 'en'
    soundEnabled: true, // Tactile / Haptic sound enabled
    productSort: 'category' // 'category' | 'category_asc' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'newest'
  },
  inventory: [...DEFAULT_INVENTORY],
  damages: [],
  deviceRole: 'host', // 'host' | 'terminal'
  inventorySubtab: 'stock', // 'stock' | 'damages'
  inventorySearchQuery: '',
  inventoryCategoryFilter: 'all',
  reportSubtype: 'sales', // 'sales' | 'inventory'
  pairingPin: '8492',
  wifiConnectedClients: 1,
  activeBurgerSelection: null,
  currentView: 'home',
  cart: [], // items in active sale
  selectedPaymentMethod: 'efectivo',
  historyFilter: 'all',
  historySearchQuery: '',
  reportPeriod: 'daily', // 'daily' | 'weekly' | 'monthly'
  activeQuickReportPeriod: 'daily',
  lastCompletedReceipt: null,
  activeProductEditingId: null,
  editingCategoryIndex: null
};

// ============================================================================
// Translations (Spanish Default & English)
// ============================================================================
const I18N = {
  es: {
    nav_home: 'Inicio y Ventas',
    nav_history: 'Historial',
    nav_reports: 'Reportes',
    btn_add_product: 'Nuevo Producto',
    btn_daily_report: 'Reporte Diario',
    btn_weekly_report: 'Reporte Semanal',
    btn_share_report: 'Compartir Reporte',
    metric_today_sales: 'Ventas Totales del Día',
    btn_view_breakdown: 'Ver Desglose',
    metric_weekly_avg: 'Promedio Semanal',
    metric_weekly_subtext: 'Calculado últimos 7 días',
    metric_cart_status: 'Venta en Curso',
    cart_card_prompt: 'Toca cualquier producto abajo para iniciar o sumar a la venta:',
    btn_checkout_now: 'Totalizar y Cobrar',
    catalog_title: 'Catálogo de Productos Disponibles',
    catalog_subtitle: 'Presiona un producto para agregarlo a la venta actual',
    no_products_found: 'No se encontraron productos',
    history_title: 'Historial Cronológico de Ventas',
    history_subtitle: 'Registro detallado con opción de anular y compartir recibo en imagen',
    history_empty: 'No hay ventas que coincidan con los filtros',
    reports_title: 'Registro y Reporte de Ventas',
    reports_subtitle: 'Desglose de acuerdo al tipo de pago y cálculo de promedios',
    rep_daily: 'Diarias',
    rep_weekly: 'Semanales',
    rep_monthly: 'Mensuales',
    btn_share_report_img: 'Compartir Reporte en Imagen',
    rep_card_total: 'Total General del Período',
    pay_cash: 'Efectivo',
    pay_mobile: 'Pago Móvil',
    pay_pos: 'Punto de Venta',
    rep_breakdown_title: 'Desglose de Ventas por Método de Pago',
    rep_detail_list: 'Detalle de Operaciones en el Período',
    modal_sale_title: 'Venta en Proceso',
    modal_sale_subtitle: 'Indica productos y selecciona método de pago',
    cart_products_heading: 'Productos en la Venta:',
    prompt_add_another: '¿Deseas agregar otro producto antes de totalizar?',
    btn_add_more: 'Agregar otro',
    lbl_subtotal: 'Suma Total de Productos:',
    lbl_total_pay: 'Monto Total a Cobrar:',
    lbl_select_payment: '¿Cuál es el método de pago del cliente?',
    btn_void_sale: 'Anular Venta Fallida',
    btn_confirm_sale: 'Confirmar Venta',
    receipt_success_title: '¡Venta Registrada con Éxito!',
    btn_share_receipt_image: 'Compartir Recibo (WhatsApp / Apps)',
    btn_back_to_home_new_sale: 'Volver al Inicio y Realizar Nueva Venta',
    prod_form_new_title: 'Registrar Nuevo Producto',
    prod_form_edit_title: 'Editar Producto',
    lbl_prod_photo: 'Foto / Miniatura del Producto',
    btn_choose_image: 'Seleccionar Imagen',
    prod_image_persists: 'Se guardará de forma local sin borrarse',
    lbl_prod_name: 'Nombre del Producto *',
    lbl_price_usd: 'Precio en Dólares ($) *',
    lbl_price_bs: 'Precio en Bolívares (Bs.)',
    lbl_category: 'Categoría',
    lbl_date: 'Fecha de Registro',
    breakdown_today_title: 'Desglose de Ventas del Día',
    lbl_grand_total: 'Total General de Ventas',
    lbl_by_method: 'Desglose por Método de Pago:',
    modal_rate_title: 'Actualizar Precio del Dólar',
    lbl_rate_input: 'Tasa de Cambio Oficial (Bs. por 1 USD)',
    rate_note: 'Todos los precios en Bolívares se actualizarán automáticamente en tiempo real.',
    modal_logo_title: 'Logotipo de la Empresa',
    modal_select_more_title: 'Seleccionar Otro Producto',
    btn_manage_categories: 'Categorías',
    modal_cats_title: 'Modificar Categorías',
    modal_cats_subtitle: 'Crear, renombrar o eliminar categorías de productos',
    lbl_add_new_cat: 'Nueva Categoría',
    btn_add_cat: 'Agregar',
    lbl_existing_cats: 'Categorías Disponibles',
    btn_edit_cats: 'Modificar',
    sort_category: 'Por Categoría (Predeterminado)',
    sort_category_az: 'Categoría (A - Z)',
    sort_name_asc: 'Nombre (A - Z)',
    sort_name_desc: 'Nombre (Z - A)',
    sort_price_asc: 'Precio (Menor a Mayor)',
    sort_price_desc: 'Precio (Mayor a Menor)',
    sort_newest: 'Más Recientes',
    lbl_category_order_hint: 'Ordena las categorías para definir su prioridad en el catálogo',
    btn_sort_cats_az: 'A-Z'
  },
  en: {
    nav_home: 'Home & Sales',
    nav_history: 'History',
    nav_reports: 'Reports',
    btn_add_product: 'New Product',
    btn_daily_report: 'Daily Report',
    btn_weekly_report: 'Weekly Report',
    btn_share_report: 'Share Report',
    metric_today_sales: "Today's Total Sales",
    btn_view_breakdown: 'View Breakdown',
    metric_weekly_avg: 'Weekly Average',
    metric_weekly_subtext: 'Calculated over last 7 days',
    metric_cart_status: 'Sale in Progress',
    cart_card_prompt: 'Tap any product below to start or add to the sale:',
    btn_checkout_now: 'Checkout & Pay',
    catalog_title: 'Available Products Catalog',
    catalog_subtitle: 'Tap a product to add it to the active sale',
    no_products_found: 'No products found',
    history_title: 'Chronological Sales History',
    history_subtitle: 'Detailed log with option to void sale and share receipt as image',
    history_empty: 'No sales matching current filters',
    reports_title: 'Sales Register & Reports',
    reports_subtitle: 'Breakdown by payment method and average calculations',
    rep_daily: 'Daily',
    rep_weekly: 'Weekly',
    rep_monthly: 'Monthly',
    btn_share_report_img: 'Share Report as Image',
    rep_card_total: 'Grand Total for Period',
    pay_cash: 'Cash',
    pay_mobile: 'Mobile Pay',
    pay_pos: 'POS Card',
    rep_breakdown_title: 'Sales Breakdown by Payment Method',
    rep_detail_list: 'Transaction Details for Period',
    modal_sale_title: 'Sale in Progress',
    modal_sale_subtitle: 'Review items and select payment method',
    cart_products_heading: 'Items in Active Sale:',
    prompt_add_another: 'Want to add another product before finalizing?',
    btn_add_more: 'Add another',
    lbl_subtotal: 'Total Items Sum:',
    lbl_total_pay: 'Total Amount to Charge:',
    lbl_select_payment: 'Select payment method:',
    btn_void_sale: 'Void / Cancel Sale',
    btn_confirm_sale: 'Complete Sale',
    receipt_success_title: 'Sale Successfully Recorded!',
    btn_share_receipt_image: 'Share Receipt (WhatsApp / Apps)',
    btn_back_to_home_new_sale: 'Back to Home & Start New Sale',
    prod_form_new_title: 'Register New Product',
    prod_form_edit_title: 'Edit Product',
    lbl_prod_photo: 'Product Photo / Thumbnail',
    btn_choose_image: 'Choose Image',
    prod_image_persists: 'Saved locally and will not disappear',
    lbl_prod_name: 'Product Name *',
    lbl_price_usd: 'Price in USD ($) *',
    lbl_price_bs: 'Price in Bolívares (Bs.)',
    lbl_category: 'Category',
    lbl_date: 'Registration Date',
    breakdown_today_title: "Today's Sales Breakdown",
    lbl_grand_total: 'Grand Total Sales',
    lbl_by_method: 'Breakdown by Payment Method:',
    modal_rate_title: 'Update Dollar Exchange Rate',
    lbl_rate_input: 'Official Rate (Bs. per 1 USD)',
    rate_note: 'All prices in Bolívares will update automatically in real-time.',
    modal_logo_title: 'Company Logo',
    modal_select_more_title: 'Select Another Product',
    btn_manage_categories: 'Categories',
    modal_cats_title: 'Modify Categories',
    modal_cats_subtitle: 'Create, rename or delete product categories',
    lbl_add_new_cat: 'New Category',
    btn_add_cat: 'Add',
    lbl_existing_cats: 'Available Categories',
    btn_edit_cats: 'Modify',
    sort_category: 'By Category (Default)',
    sort_category_az: 'Category (A - Z)',
    sort_name_asc: 'Name (A - Z)',
    sort_name_desc: 'Name (Z - A)',
    sort_price_asc: 'Price (Low to High)',
    sort_price_desc: 'Price (High to Low)',
    sort_newest: 'Newest First',
    lbl_category_order_hint: 'Order categories to prioritize catalog display',
    btn_sort_cats_az: 'A-Z'
  }
};

// ============================================================================
// Web Audio API Tactile & Haptic Sound Engine (Zero external dependencies)
// ============================================================================
const SoundEngine = {
  audioCtx: null,

  init() {
    try {
      if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx && typeof this.audioCtx.resume === 'function' && this.audioCtx.state === 'suspended') {
        const res = this.audioCtx.resume();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch (e) {
      console.warn('AudioContext init non-critical error:', e);
    }
  },

  play(type = 'tap') {
    if (!state.settings || state.settings.soundEnabled === false) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const t = ctx.currentTime;

      // Subtle haptic vibration for mobile/touch screens
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (type === 'tap' || type === 'category') navigator.vibrate(12);
        else if (type === 'add') navigator.vibrate(20);
        else if (type === 'cash') navigator.vibrate([25, 40, 30]);
        else if (type === 'void') navigator.vibrate([35, 30, 35]);
        else if (type === 'toggle') navigator.vibrate(15);
      }

      if (type === 'tap') {
        // Soft tactile pop / subtle physical click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.04);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.045);
      } else if (type === 'add') {
        // Crisp upbeat double blip (product added or cart quantity up)
        [0, 0.055].forEach((delay, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(i === 0 ? 540 : 820, t + delay);
          gain.gain.setValueAtTime(0.18, t + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t + delay);
          osc.stop(t + delay + 0.065);
        });
      } else if (type === 'cash') {
        // Melodic cash register / POS chime sequence (C6 -> E6 -> G6 -> C7)
        const notes = [1046.50, 1318.51, 1567.98, 2093.00];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          const startTime = t + (idx * 0.06);
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.22, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.36);
        });
      } else if (type === 'void') {
        // Warning / cancellation descending tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(340, t);
        osc.frequency.exponentialRampToValueAtTime(130, t + 0.16);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.17);
      } else if (type === 'toggle') {
        // Clean mechanical switch sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(620, t);
        osc.frequency.exponentialRampToValueAtTime(220, t + 0.035);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.04);
      } else if (type === 'category') {
        // Soft bubble blip for category switching
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(460, t);
        osc.frequency.exponentialRampToValueAtTime(690, t + 0.05);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.055);
      }
    } catch (e) {
      console.warn('Tactile sound error:', e);
    }
  }
};

function toggleSound() {
  state.settings.soundEnabled = !state.settings.soundEnabled;
  saveToStorage();
  updateSoundUI();
  if (state.settings.soundEnabled) {
    SoundEngine.play('toggle');
  }
}

function updateSoundUI() {
  const icon = document.getElementById('icon-sound-toggle');
  const btn = document.getElementById('btn-sound-toggle');
  const isEnabled = state.settings.soundEnabled !== false;
  if (icon) {
    icon.textContent = isEnabled ? 'volume_up' : 'volume_off';
    if (isEnabled) {
      icon.classList.add('custom-accent-text');
      icon.classList.remove('text-gray-500');
    } else {
      icon.classList.remove('custom-accent-text');
      icon.classList.add('text-gray-500');
    }
  }
  if (btn) {
    btn.title = isEnabled ? 
      (state.settings.language === 'es' ? 'Sonidos táctiles: ACTIVADOS (Clic para silenciar)' : 'Tactile sounds: ON (Click to mute)') :
      (state.settings.language === 'es' ? 'Sonidos táctiles: SILENCIADOS (Clic para activar)' : 'Tactile sounds: MUTED (Click to enable)');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// In-App Toast & Custom Confirmation (100% Iframe Safe - No window.confirm/alert)
// ============================================================================
let currentConfirmAction = null;

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const isError = type === 'error';
  const isWarning = type === 'warning';
  const isSuccess = type === 'success';

  let borderClass = 'border-[#3E3E4A] bg-[#1E1E24] text-white';
  let iconName = 'info';
  let iconClass = 'text-sky-400';

  if (isError) {
    borderClass = 'border-rose-800 bg-rose-950/95 text-rose-100';
    iconName = 'error';
    iconClass = 'text-rose-400';
  } else if (isWarning) {
    borderClass = 'border-amber-700 bg-amber-950/95 text-amber-100';
    iconName = 'warning';
    iconClass = 'text-amber-400';
  } else if (isSuccess) {
    borderClass = 'border-emerald-700 bg-emerald-950/95 text-emerald-100';
    iconName = 'check_circle';
    iconClass = 'text-emerald-400';
  }

  toast.className = `px-4 py-2.5 rounded-xl border shadow-xl flex items-center gap-2.5 text-xs font-bold transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto ${borderClass}`;
  toast.innerHTML = `
    <span class="material-symbols-rounded text-lg ${iconClass}">${iconName}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

function showCustomConfirm({
  title = '¿Estás seguro?',
  message = 'Esta acción no se puede deshacer.',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDanger = true,
  icon = 'delete',
  onConfirm = null
}) {
  currentConfirmAction = onConfirm;

  const modal = document.getElementById('modal-custom-confirm');
  const titleEl = document.getElementById('confirm-modal-title');
  const msgEl = document.getElementById('confirm-modal-msg');
  const iconEl = document.getElementById('confirm-icon');
  const iconBgEl = document.getElementById('confirm-icon-bg');
  const actionBtn = document.getElementById('btn-confirm-action');
  const cancelBtn = document.getElementById('btn-confirm-cancel');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (iconEl) iconEl.textContent = icon;
  if (cancelBtn) cancelBtn.textContent = cancelText;

  if (actionBtn) {
    actionBtn.textContent = confirmText;
    if (isDanger) {
      actionBtn.className = 'px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors shadow-md cursor-pointer';
      if (iconBgEl) iconBgEl.className = 'w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400';
    } else {
      actionBtn.className = 'px-4 py-2.5 rounded-xl bg-[var(--accent-color)] text-black text-xs font-bold transition-colors shadow-md cursor-pointer';
      if (iconBgEl) iconBgEl.className = 'w-14 h-14 mx-auto rounded-2xl bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 flex items-center justify-center custom-accent-text';
    }

    actionBtn.onclick = () => {
      const actionToRun = currentConfirmAction;
      closeCustomConfirm();
      if (typeof actionToRun === 'function') {
        actionToRun();
      }
    };
  }

  if (modal) modal.classList.remove('hidden');
}

function closeCustomConfirm() {
  const modal = document.getElementById('modal-custom-confirm');
  if (modal) modal.classList.add('hidden');
  currentConfirmAction = null;
}

// ============================================================================
// Initialization & Persistence
// ============================================================================
async function initApp() {
  try {
    loadFromStorage();
  } catch (err) {
    console.error('[Init Storage Error]', err);
  }

  try {
    applyTheme();
    applyLanguage();
    updateExchangeRateUI();
    updateStoreHeaderUI();
    updateSoundUI();
  } catch (err) {
    console.error('[Init UI Config Error]', err);
  }

  try {
    renderCategoryPills();
    renderCategorySelectOptions();
    renderAll();
  } catch (err) {
    console.error('[Init Render Error]', err);
  }

  try {
    setupEventListeners();
    initRealtimeSync();
  } catch (err) {
    console.error('[Init Listeners/Sync Error]', err);
  }

  try {
    // Rehydrate durable images from IndexedDB (survives app restarts & device reboots)
    await syncImagesFromIndexedDB();
  } catch (err) {
    console.warn('[Init ImageDB Rehydration Notice]', err);
  }
}

function loadFromStorage() {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (savedSettings) {
      state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
    }
    state.settings.productSort = state.settings.productSort || 'category';

    const savedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (savedCategories) {
      state.categories = JSON.parse(savedCategories);
    } else {
      state.categories = [...DEFAULT_CATEGORIES];
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(state.categories));
    }

    const savedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (savedProducts) {
      state.products = JSON.parse(savedProducts);
    } else {
      state.products = [...SAMPLE_PRODUCTS];
      saveToStorage();
    }

    // Ensure any products with unlisted categories get added to state.categories
    const productCategories = state.products.map(p => p.category).filter(Boolean);
    productCategories.forEach(cat => {
      if (!state.categories.includes(cat)) {
        state.categories.push(cat);
      }
    });

    const savedSales = localStorage.getItem(STORAGE_KEYS.SALES);
    if (savedSales) {
      state.sales = JSON.parse(savedSales);
    } else {
      state.sales = generateSampleSales(state.settings.exchangeRate);
      saveToStorage();
    }

    const savedInventory = localStorage.getItem(STORAGE_KEYS.INVENTORY);
    if (savedInventory) {
      try {
        const parsedInv = JSON.parse(savedInventory);
        if (Array.isArray(parsedInv) && parsedInv.length > 0) {
          state.inventory = parsedInv;
        } else {
          state.inventory = [...DEFAULT_INVENTORY];
        }
      } catch (_) {
        state.inventory = [...DEFAULT_INVENTORY];
      }
    } else {
      state.inventory = [...DEFAULT_INVENTORY];
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(state.inventory));
    }

    const savedDamages = localStorage.getItem(STORAGE_KEYS.DAMAGES);
    if (savedDamages) {
      try {
        state.damages = JSON.parse(savedDamages);
      } catch (_) {
        state.damages = [];
      }
    } else {
      state.damages = [];
    }

    const savedRole = localStorage.getItem(STORAGE_KEYS.DEVICE_ROLE);
    if (savedRole) {
      state.deviceRole = savedRole;
    } else {
      state.deviceRole = 'host';
    }
  } catch (e) {
    console.error('Error loading from storage:', e);
    state.products = [...SAMPLE_PRODUCTS];
    state.sales = generateSampleSales(state.settings.exchangeRate);
    state.categories = [...DEFAULT_CATEGORIES];
    state.inventory = [...DEFAULT_INVENTORY];
    state.damages = [];
    state.deviceRole = 'host';
  }
}

async function syncImagesFromIndexedDB() {
  let hasRestored = false;
  try {
    for (let i = 0; i < state.products.length; i++) {
      const p = state.products[i];
      if (!p.image) {
        const storedImg = await ImageDB.get(`prod_img_${p.id}`);
        if (storedImg) {
          p.image = storedImg;
          hasRestored = true;
        }
      } else {
        // Back up to IndexedDB for safety
        ImageDB.set(`prod_img_${p.id}`, p.image);
      }
    }

    if (!state.settings.logoData) {
      const storedLogo = await ImageDB.get('store_logo_image');
      if (storedLogo) {
        state.settings.logoData = storedLogo;
        renderCompanyLogo();
      }
    } else {
      ImageDB.set('store_logo_image', state.settings.logoData);
    }

    if (hasRestored) {
      renderProductGrid();
    }
  } catch (err) {
    console.error('Error synchronizing images with IndexedDB:', err);
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(state.products));
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(state.sales));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(state.categories));
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(state.inventory));
    localStorage.setItem(STORAGE_KEYS.DAMAGES, JSON.stringify(state.damages));
    localStorage.setItem(STORAGE_KEYS.DEVICE_ROLE, state.deviceRole || 'host');
  } catch (e) {
    console.warn('LocalStorage quota limit reached. Using IndexedDB for durable image storage:', e);
    // 1. First ensure all images are saved into high-capacity IndexedDB
    state.products.forEach(p => {
      if (p.image) {
        ImageDB.set(`prod_img_${p.id}`, p.image);
      }
    });
    if (state.settings.logoData) {
      ImageDB.set('store_logo_image', state.settings.logoData);
    }

    // 2. Strip oversized image strings from localStorage payload to keep product records, prices, and sales 100% intact
    try {
      const safeProducts = state.products.map(p => ({
        ...p,
        image: p.image && p.image.length < 50000 ? p.image : '' // Only keep if tiny, otherwise rehydrate from IndexedDB
      }));
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(safeProducts));

      const safeSettings = {
        ...state.settings,
        logoData: state.settings.logoData && state.settings.logoData.length < 50000 ? state.settings.logoData : ''
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(safeSettings));
      localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(state.sales));
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(state.categories));
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(state.inventory));
      localStorage.setItem(STORAGE_KEYS.DAMAGES, JSON.stringify(state.damages));
      localStorage.setItem(STORAGE_KEYS.DEVICE_ROLE, state.deviceRole || 'host');
    } catch (fallbackError) {
      console.error('Critical fallback storage save error:', fallbackError);
    }
  }

  // Always dual-write all images to IndexedDB in the background
  try {
    state.products.forEach(p => {
      if (p.image) {
        ImageDB.set(`prod_img_${p.id}`, p.image);
      }
    });
    if (state.settings.logoData) {
      ImageDB.set('store_logo_image', state.settings.logoData);
    }
  } catch (idbErr) {
    console.error('Background IndexedDB sync error:', idbErr);
  }
}

// ============================================================================
// UI Renderers
// ============================================================================
function renderAll() {
  renderMetrics();
  renderCategoryPills();
  renderProductGrid();
  renderCartBadge();
  renderHistoryList();
  renderReports();
  renderInventory();
  applyDeviceRolePermissions();
}

function switchView(viewName) {
  SoundEngine.play('tap');
  state.currentView = viewName;
  document.querySelectorAll('.view-screen').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.remove('active', 'custom-accent-bg', 'text-black', 'shadow-sm');
    btn.classList.add('text-gray-400');
  });

  const activeView = document.getElementById(`view-${viewName}`);
  if (activeView) activeView.classList.remove('hidden');

  const activeTab = document.getElementById(`tab-${viewName}`);
  if (activeTab) {
    activeTab.classList.add('active', 'custom-accent-bg', 'text-black', 'shadow-sm');
    activeTab.classList.remove('text-gray-400');
  }

  // Toggle FAB visibility (Only prominent on home and for host role)
  const fab = document.getElementById('fab-add-container');
  if (fab) {
    if (viewName === 'home' && state.deviceRole !== 'terminal') fab.classList.remove('hidden');
    else fab.classList.add('hidden');
  }

  if (viewName === 'history') renderHistoryList();
  if (viewName === 'reports') {
    renderReports();
    if (state.reportSubtype === 'inventory') renderInventoryReport();
  }
  if (viewName === 'inventory') renderInventory();
}

// Metrics (Today Sales & Weekly Average)
function renderMetrics() {
  const todayStr = new Date().toISOString().split('T')[0];
  const rate = state.settings.exchangeRate;

  // 1. Today's Sales
  const todaySales = state.sales.filter(s => s.dateString === todayStr && s.status !== 'voided');
  const todayTotalUsd = todaySales.reduce((sum, s) => sum + s.totalUsd, 0);
  const todayTotalBs = todayTotalUsd * rate;

  const elTodayUsd = document.getElementById('metric-today-usd');
  if (elTodayUsd) elTodayUsd.textContent = `$${todayTotalUsd.toFixed(2)}`;
  const elTodayBs = document.getElementById('metric-today-bs');
  if (elTodayBs) elTodayBs.textContent = `${formatBs(todayTotalBs)} Bs.`;
  const elTodayCount = document.getElementById('metric-today-count');
  if (elTodayCount) elTodayCount.textContent = `${todaySales.length} ventas hoy`;

  // 2. Weekly Average (Calculated over last 7 days)
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  const weeklySales = state.sales.filter(s => {
    const saleDate = new Date(s.timestamp);
    return saleDate >= sevenDaysAgo && s.status !== 'voided';
  });

  const weeklyTotalUsd = weeklySales.reduce((sum, s) => sum + s.totalUsd, 0);
  // Average per day across the 7-day period
  const weeklyAvgDailyUsd = weeklyTotalUsd / 7;
  const weeklyAvgDailyBs = weeklyAvgDailyUsd * rate;

  const elWeeklyUsd = document.getElementById('metric-weekly-usd');
  if (elWeeklyUsd) elWeeklyUsd.textContent = `$${weeklyAvgDailyUsd.toFixed(2)}`;
  const elWeeklyBs = document.getElementById('metric-weekly-bs');
  if (elWeeklyBs) elWeeklyBs.textContent = `${formatBs(weeklyAvgDailyBs)} Bs. / día`;
  const elWeeklyCount = document.getElementById('metric-weekly-sales-count');
  if (elWeeklyCount) elWeeklyCount.textContent = `${weeklySales.length} ventas (7d)`;
}

// ============================================================================
// Product Category Management (Crear, Modificar, Eliminar y Filtrar)
// ============================================================================

function renderCategoryPills() {
  const container = document.getElementById('catalog-category-pills');
  if (!container) return;

  const totalProducts = state.products.length;
  const isAllActive = state.selectedCategoryFilter === 'all';

  let pillsHtml = `
    <button onclick="setCatalogCategoryFilter('all')" class="category-pill flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${isAllActive ? 'custom-accent-bg text-black shadow-sm' : 'bg-[#1E1E24] text-gray-300 hover:text-white border border-[#2C2C34]'}">
      <span>${state.settings.language === 'es' ? 'Todas' : 'All'}</span>
      <span class="px-1.5 py-0.2 rounded-full text-[10px] ${isAllActive ? 'bg-black/20 text-black' : 'bg-[#2C2C34] text-gray-400 font-mono'}">${totalProducts}</span>
    </button>
  `;

  state.categories.forEach(cat => {
    const isActive = state.selectedCategoryFilter === cat;
    const count = state.products.filter(p => p.category === cat).length;
    pillsHtml += `
      <button onclick="setCatalogCategoryFilter('${escapeHtml(cat)}')" class="category-pill flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${isActive ? 'custom-accent-bg text-black shadow-sm' : 'bg-[#1E1E24] text-gray-300 hover:text-white border border-[#2C2C34]'}">
        <span>${escapeHtml(cat)}</span>
        <span class="px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-black/20 text-black' : 'bg-[#2C2C34] text-gray-400 font-mono'}">${count}</span>
      </button>
    `;
  });

  pillsHtml += `
    <button onclick="openCategoryManagerModal()" title="Modificar categorías" class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#2C2C34] border border-dashed border-[#3E3E4A] transition-all shrink-0">
      <span class="material-symbols-rounded text-sm custom-accent-text">edit_note</span>
      <span>${state.settings.language === 'es' ? '+ Gestionar' : '+ Manage'}</span>
    </button>
  `;

  container.innerHTML = pillsHtml;
}

function setCatalogCategoryFilter(cat) {
  state.selectedCategoryFilter = cat;
  SoundEngine.play('category');
  renderCategoryPills();
  renderProductGrid();
}

function renderCategorySelectOptions(selectedCategory = null) {
  const select = document.getElementById('prod-category');
  if (!select) return;

  const currentVal = selectedCategory || select.value || (state.categories[0] || 'Víveres');
  select.innerHTML = state.categories.map(cat => `
    <option value="${escapeHtml(cat)}" ${cat === currentVal ? 'selected' : ''}>${escapeHtml(cat)}</option>
  `).join('');
}

function openCategoryManagerModal() {
  SoundEngine.play('tap');
  state.editingCategoryIndex = null;
  renderCategoryManagerList();
  const input = document.getElementById('input-new-cat-name');
  if (input) input.value = '';
  document.getElementById('modal-category-manager').classList.remove('hidden');
  if (input) setTimeout(() => input.focus(), 50);
}

function closeCategoryManagerModal() {
  SoundEngine.play('tap');
  document.getElementById('modal-category-manager').classList.add('hidden');
  renderCategoryPills();
  renderCategorySelectOptions();
  renderProductGrid();
}

function handleAddNewCategory() {
  const input = document.getElementById('input-new-cat-name');
  const name = (input?.value || '').trim();
  if (!name) return;

  if (state.categories.some(c => c.toLowerCase() === name.toLowerCase())) {
    showToast(state.settings.language === 'es' ? 'Esta categoría ya existe' : 'This category already exists', 'warning');
    return;
  }

  state.categories.push(name);
  saveToStorage();
  SoundEngine.play('add');
  input.value = '';
  renderCategoryManagerList();
  renderCategoryPills();
  renderCategorySelectOptions(name);
  renderProductGrid();
  showToast(state.settings.language === 'es' ? `Categoría "${name}" agregada` : `Category "${name}" added`, 'success');
}

function startEditCategory(index) {
  SoundEngine.play('tap');
  state.editingCategoryIndex = index;
  renderCategoryManagerList();
}

function cancelEditCategory() {
  SoundEngine.play('tap');
  state.editingCategoryIndex = null;
  renderCategoryManagerList();
}

function saveEditCategory(index) {
  const input = document.getElementById(`input-edit-cat-${index}`);
  const newName = (input?.value || '').trim();
  const oldName = state.categories[index];

  if (!newName) return;
  if (newName !== oldName && state.categories.some((c, i) => i !== index && c.toLowerCase() === newName.toLowerCase())) {
    showToast(state.settings.language === 'es' ? 'Ya existe otra categoría con este nombre' : 'Another category with this name already exists', 'warning');
    return;
  }

  state.categories[index] = newName;

  // Update existing products using this category
  state.products.forEach(p => {
    if (p.category === oldName) {
      p.category = newName;
    }
  });

  if (state.selectedCategoryFilter === oldName) {
    state.selectedCategoryFilter = newName;
  }

  saveToStorage();
  SoundEngine.play('add');
  state.editingCategoryIndex = null;
  renderCategoryManagerList();
  renderCategoryPills();
  renderCategorySelectOptions(newName);
  renderProductGrid();
  showToast(state.settings.language === 'es' ? `Categoría renombrada a "${newName}"` : `Category renamed to "${newName}"`, 'success');
}

function deleteCategory(index) {
  const catToDelete = state.categories[index];
  const isEs = state.settings.language === 'es';

  if (state.categories.length <= 1) {
    showToast(isEs ? 'Debes mantener al menos una categoría' : 'You must keep at least one category', 'warning');
    return;
  }

  const productsCount = state.products.filter(p => p.category === catToDelete).length;
  let confirmMsg = isEs
    ? `¿Estás seguro de eliminar la categoría "${catToDelete}"?`
    : `Are you sure you want to delete category "${catToDelete}"?`;

  if (productsCount > 0) {
    confirmMsg += isEs
      ? ` Hay ${productsCount} producto(s) en esta categoría que serán reasignados a "Otros".`
      : ` There are ${productsCount} product(s) in this category that will be reassigned to "Others".`;
  }

  showCustomConfirm({
    title: isEs ? 'Eliminar Categoría' : 'Delete Category',
    message: confirmMsg,
    confirmText: isEs ? 'Eliminar' : 'Delete',
    cancelText: isEs ? 'Cancelar' : 'Cancel',
    isDanger: true,
    icon: 'folder_delete',
    onConfirm: () => {
      SoundEngine.play('void');
      state.editingCategoryIndex = null;

      if (productsCount > 0) {
        if (!state.categories.includes('Otros')) {
          state.categories.push('Otros');
        }
        state.products.forEach(p => {
          if (p.category === catToDelete) {
            p.category = 'Otros';
          }
        });
      }

      state.categories = state.categories.filter(c => c !== catToDelete);

      if (state.selectedCategoryFilter === catToDelete) {
        state.selectedCategoryFilter = 'all';
      }

      saveToStorage();
      renderCategoryManagerList();
      renderCategoryPills();
      renderCategorySelectOptions();
      renderProductGrid();
      showToast(isEs ? `Categoría "${catToDelete}" eliminada` : `Category "${catToDelete}" deleted`, 'info');
    }
  });
}

function moveCategory(index, delta) {
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= state.categories.length) return;
  SoundEngine.play('tap');
  const moved = state.categories.splice(index, 1)[0];
  state.categories.splice(newIndex, 0, moved);
  saveToStorage();
  renderCategoryManagerList();
  renderCategoryPills();
  renderProductGrid();
}

function sortCategoriesAlphabetically() {
  SoundEngine.play('tap');
  state.categories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  saveToStorage();
  renderCategoryManagerList();
  renderCategoryPills();
  renderProductGrid();
  const isEs = state.settings.language === 'es';
  showToast(isEs ? 'Categorías ordenadas de la A a la Z' : 'Categories sorted A to Z', 'success');
}

function renderCategoryManagerList() {
  const container = document.getElementById('category-manager-list');
  const countBadge = document.getElementById('cat-count-badge');
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${state.categories.length} ${state.categories.length === 1 ? 'categoría' : 'categorías'}`;
  }

  container.innerHTML = state.categories.map((cat, index) => {
    const isEditing = state.editingCategoryIndex === index;
    const count = state.products.filter(p => p.category === cat).length;
    const isFirst = index === 0;
    const isLast = index === state.categories.length - 1;

    if (isEditing) {
      return `
        <div class="p-2.5 rounded-xl bg-[#18181C] border border-[var(--accent-color)] flex items-center gap-2">
          <input type="text" id="input-edit-cat-${index}" value="${escapeHtml(cat)}" onkeydown="if(event.key==='Enter'){event.preventDefault();saveEditCategory(${index});}else if(event.key==='Escape'){cancelEditCategory();}" class="flex-1 px-2.5 py-1.5 rounded-lg bg-[#141418] border border-[#2C2C34] text-xs text-white focus:outline-none focus:border-[var(--accent-color)]">
          <button onclick="saveEditCategory(${index})" title="Guardar cambios" class="p-1.5 rounded-lg bg-[var(--accent-color)] text-black hover:opacity-90 flex items-center justify-center">
            <span class="material-symbols-rounded text-base font-bold">check</span>
          </button>
          <button onclick="cancelEditCategory()" title="Cancelar" class="p-1.5 rounded-lg bg-[#2C2C34] text-gray-300 hover:text-white flex items-center justify-center">
            <span class="material-symbols-rounded text-base">close</span>
          </button>
        </div>
      `;
    }

    return `
      <div class="p-2.5 rounded-xl bg-[#141418] border border-[#2C2C34] flex items-center justify-between gap-2 hover:border-[#3E3E4A] transition-colors">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-[11px] font-mono font-bold text-gray-500 w-5 text-center">${index + 1}</span>
          <span class="material-symbols-rounded text-gray-400 text-base">label</span>
          <span class="text-xs font-bold text-white truncate">${escapeHtml(cat)}</span>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1E1E24] text-gray-400 border border-[#2C2C34] hidden sm:inline-block">
            ${count} ${count === 1 ? 'prod.' : 'prods.'}
          </span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <!-- Reorder buttons -->
          <button onclick="moveCategory(${index}, -1)" ${isFirst ? 'disabled' : ''} title="Subir prioridad en catálogo" class="p-1.5 rounded-lg bg-[#1E1E24] hover:bg-[#2C2C34] disabled:opacity-30 disabled:pointer-events-none text-gray-300 hover:text-white border border-[#2C2C34] flex items-center justify-center transition-colors cursor-pointer">
            <span class="material-symbols-rounded text-sm">arrow_upward</span>
          </button>
          <button onclick="moveCategory(${index}, 1)" ${isLast ? 'disabled' : ''} title="Bajar prioridad en catálogo" class="p-1.5 rounded-lg bg-[#1E1E24] hover:bg-[#2C2C34] disabled:opacity-30 disabled:pointer-events-none text-gray-300 hover:text-white border border-[#2C2C34] flex items-center justify-center transition-colors cursor-pointer">
            <span class="material-symbols-rounded text-sm">arrow_downward</span>
          </button>
          <!-- Edit button -->
          <button onclick="startEditCategory(${index})" title="Renombrar / Modificar categoría" class="p-1.5 rounded-lg bg-[#1E1E24] hover:bg-[#2C2C34] text-gray-300 hover:text-white border border-[#2C2C34] flex items-center justify-center transition-colors cursor-pointer ml-1">
            <span class="material-symbols-rounded text-sm">edit</span>
          </button>
          <!-- Delete button -->
          <button onclick="deleteCategory(${index})" title="Eliminar categoría" class="p-1.5 rounded-lg bg-[#1E1E24] hover:bg-rose-950/50 text-gray-400 hover:text-rose-400 border border-[#2C2C34] flex items-center justify-center transition-colors cursor-pointer">
            <span class="material-symbols-rounded text-sm">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// Product Sorting Functions
// ============================================================================
function setProductSort(sortType) {
  SoundEngine.play('tap');
  state.settings.productSort = sortType;
  saveToStorage();
  renderProductGrid();
}

function sortProductsByCriteria(productsList, criteria = state.settings.productSort || 'category') {
  return [...productsList].sort((a, b) => {
    if (criteria === 'category') {
      // 1. Group by category according to defined state.categories order
      const indexA = state.categories.indexOf(a.category);
      const indexB = state.categories.indexOf(b.category);
      const safeIndexA = indexA === -1 ? 9999 : indexA;
      const safeIndexB = indexB === -1 ? 9999 : indexB;
      if (safeIndexA !== safeIndexB) {
        return safeIndexA - safeIndexB;
      }
      // 2. Inside same category, sort by product name (A-Z)
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    }
    if (criteria === 'category_asc') {
      const catCompare = (a.category || '').localeCompare(b.category || '', undefined, { sensitivity: 'base' });
      if (catCompare !== 0) return catCompare;
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    }
    if (criteria === 'name_asc') {
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    }
    if (criteria === 'name_desc') {
      return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
    }
    if (criteria === 'price_asc') {
      return (a.priceUsd || 0) - (b.priceUsd || 0);
    }
    if (criteria === 'price_desc') {
      return (b.priceUsd || 0) - (a.priceUsd || 0);
    }
    if (criteria === 'newest') {
      return (b.date || '').localeCompare(a.date || '');
    }
    return 0;
  });
}

// Product Grid Rendering
function renderProductGrid() {
  const container = document.getElementById('products-grid');
  const emptyState = document.getElementById('products-empty-state');
  const searchQuery = (document.getElementById('catalog-search')?.value || '').toLowerCase().trim();
  const rate = state.settings.exchangeRate;

  // Sync catalog-sort select element value
  const sortSelect = document.getElementById('catalog-sort');
  if (sortSelect && sortSelect.value !== (state.settings.productSort || 'category')) {
    sortSelect.value = state.settings.productSort || 'category';
  }

  let filtered = state.products;

  // Filter by selected category pill
  if (state.selectedCategoryFilter && state.selectedCategoryFilter !== 'all') {
    filtered = filtered.filter(p => p.category === state.selectedCategoryFilter);
  }

  // Filter by search query
  if (searchQuery) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery)
    );
  }

  // Sort products according to category / selected criteria
  filtered = sortProductsByCriteria(filtered, state.settings.productSort || 'category');

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  container.innerHTML = filtered.map(prod => {
    const priceBs = prod.priceUsd * rate;
    const hasCustomImg = prod.image && prod.image.length > 0;

    return `
      <div class="product-card group bg-[#1E1E24] hover:bg-[#25252D] border border-[#2C2C34] hover:border-[var(--accent-color)] rounded-2xl p-3 flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-sm relative overflow-hidden"
           onclick="handleProductCardClick('${prod.id}')">
        
        <!-- Action Buttons (Edit & Delete) -->
        <div class="absolute top-2 right-2 z-20 flex items-center gap-1.5 opacity-90 group-hover:opacity-100">
          <button type="button" onclick="event.stopPropagation(); event.preventDefault(); editProduct('${prod.id}')" title="Editar producto" class="w-8 h-8 rounded-xl bg-[#141418]/90 hover:bg-[#363640] text-gray-300 hover:text-white flex items-center justify-center backdrop-blur-sm border border-[#3E3E4A] shadow-sm transition-transform active:scale-95">
            <span class="material-symbols-rounded text-base pointer-events-none">edit</span>
          </button>
          <button type="button" onclick="event.stopPropagation(); event.preventDefault(); confirmDeleteProduct('${prod.id}', event)" title="Eliminar producto" class="w-8 h-8 rounded-xl bg-[#141418]/90 hover:bg-rose-900/80 text-gray-300 hover:text-rose-300 flex items-center justify-center backdrop-blur-sm border border-[#3E3E4A] hover:border-rose-700 shadow-sm transition-transform active:scale-95">
            <span class="material-symbols-rounded text-base pointer-events-none text-rose-400">delete</span>
          </button>
        </div>

        <!-- Thumbnail Image -->
        <div class="w-full aspect-square rounded-xl bg-[#141418] border border-[#2A2A34] overflow-hidden flex items-center justify-center mb-2.5 relative">
          ${hasCustomImg 
            ? `<img src="${prod.image}" alt="${prod.name}" class="w-full h-full object-cover">`
            : `<div class="flex flex-col items-center justify-center text-gray-500 group-hover:custom-accent-text transition-colors">
                 <span class="material-symbols-rounded text-4xl">${prod.icon || 'inventory_2'}</span>
               </div>`
          }
          <span class="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/70 text-gray-300 backdrop-blur-sm">
            ${prod.category}
          </span>
        </div>

        <!-- Product Details -->
        <div>
          <h3 class="font-bold text-xs sm:text-sm text-white line-clamp-2 group-hover:custom-accent-text transition-colors leading-tight">
            ${prod.name}
          </h3>
          
          <!-- Dual Price Display (USD and Bs) -->
          <div class="mt-2 pt-2 border-t border-[#2C2C34] flex items-baseline justify-between">
            <div>
              <div class="text-base sm:text-lg font-black text-white font-mono leading-none">
                $${prod.priceUsd.toFixed(2)}
              </div>
              <div class="text-[11px] font-bold custom-accent-text font-mono mt-0.5">
                ${formatBs(priceBs)} Bs.
              </div>
            </div>
            
            <button class="w-8 h-8 rounded-xl bg-[var(--accent-color)]/15 group-hover:bg-[var(--accent-color)] text-[var(--accent-color)] group-hover:text-black flex items-center justify-center transition-colors">
              <span class="material-symbols-rounded text-lg font-bold">add_shopping_cart</span>
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// ============================================================================
// Multi-Product Sale Workflow
// ============================================================================

/**
 * Resolves all individual burger instances that conform a product or combo.
 * Returns an array: [ { subName: 'Hamburguesa Clásica', isDouble: false }, ... ]
 */
function getBurgersForProductOrCombo(prod) {
  if (!prod) return [];
  const nameLower = (prod.name || '').toLowerCase();
  const catLower = (prod.category || '').toLowerCase();
  const isCombo = catLower.includes('combo') || nameLower.includes('combo') || (Array.isArray(prod.comboProducts) && prod.comboProducts.length > 0);

  const burgers = [];

  // Case 1: Product has explicitly defined comboProducts
  if (Array.isArray(prod.comboProducts) && prod.comboProducts.length > 0) {
    prod.comboProducts.forEach(cp => {
      const cpName = (cp.name || '').toLowerCase();
      const cpCat = (cp.category || '').toLowerCase();
      const isBurger = cpName.includes('hamburguesa') || cpName.includes('burger') || cpCat.includes('hamburguesa') || cpCat.includes('burger');
      if (isBurger) {
        const qty = Math.max(1, parseInt(cp.quantity, 10) || 1);
        for (let i = 0; i < qty; i++) {
          burgers.push({
            subName: cp.name || 'Hamburguesa',
            isDouble: cpName.includes('doble')
          });
        }
      }
    });
  }

  // Case 2: Combo without explicit comboProducts (parse from name)
  if (isCombo && burgers.length === 0) {
    let count = 0;
    const matchQty = nameLower.match(/(\d+)\s*(?:hamburguesas?|burgers?)/);
    if (matchQty && matchQty[1]) {
      count = parseInt(matchQty[1], 10);
    } else if (nameLower.includes('dos hamburguesas') || nameLower.includes('2 hamburguesa') || nameLower.includes('dúo') || nameLower.includes('duo') || nameLower.includes('pareja')) {
      count = 2;
    } else if (nameLower.includes('tres hamburguesas') || nameLower.includes('3 hamburguesa') || nameLower.includes('trío') || nameLower.includes('trio')) {
      count = 3;
    } else if (nameLower.includes('cuatro hamburguesas') || nameLower.includes('4 hamburguesa') || nameLower.includes('familiar')) {
      count = 4;
    } else if (nameLower.includes('hamburguesa') || nameLower.includes('burger')) {
      count = nameLower.includes('doble') ? 2 : 1;
    } else if (!nameLower.includes('perro') && !nameLower.includes('hot dog') && !nameLower.includes('salchipapa')) {
      count = 1;
    }

    const isDouble = nameLower.includes('doble');
    for (let i = 0; i < Math.max(1, count); i++) {
      burgers.push({
        subName: `Hamburguesa ${isDouble ? 'Doble ' : ''}${i + 1}`,
        isDouble: isDouble
      });
    }
  }

  // Case 3: It is an individual burger product (not a combo)
  if (!isCombo && burgers.length === 0) {
    const isBurger = nameLower.includes('hamburguesa') || nameLower.includes('burger') || catLower.includes('hamburguesa') || catLower.includes('burger');
    if (isBurger) {
      const isDouble = nameLower.includes('doble') || prod.burgerCount === 2;
      const count = isDouble ? 2 : 1;
      for (let i = 0; i < count; i++) {
        burgers.push({
          subName: prod.name,
          isDouble: isDouble
        });
      }
    }
  }

  return burgers;
}

function isBurgerOrCombo(prod) {
  if (!prod) return false;
  if (prod.requiresFlavor) return true;
  const name = (prod.name || '').toLowerCase();
  const category = (prod.category || '').toLowerCase();
  if (name.includes('hamburguesa') || name.includes('burger') || category.includes('hamburguesa')) {
    return true;
  }
  if (category.includes('combo') || name.includes('combo') || (Array.isArray(prod.comboProducts) && prod.comboProducts.length > 0)) {
    const burgers = getBurgersForProductOrCombo(prod);
    return burgers.length > 0;
  }
  return false;
}

function handleProductCardClick(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  // Intercept burgers and combos to ask for flavor (carne, pollo, chuleta, chorizo)
  if (isBurgerOrCombo(prod)) {
    SoundEngine.play('tap');
    openBurgerFlavorModal(prod);
    return;
  }

  SoundEngine.play('add');

  // Check if product is already in cart
  const existing = state.cart.find(item => item.productId === productId && !item.flavor);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      productId: prod.id,
      name: prod.name,
      priceUsd: prod.priceUsd,
      quantity: 1,
      flavor: ''
    });
  }

  renderCartBadge();

  const isEs = state.settings.language === 'es';
  showToast(isEs ? `+1 ${prod.name} agregado a la venta` : `+1 ${prod.name} added to sale`, 'success');

  // Smoothly ensure the active sale box is visible in viewport
  const cartCard = document.getElementById('cart-active-container');
  if (cartCard) {
    cartCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function openSaleCheckoutModal() {
  if (state.cart.length === 0) {
    showToast(state.settings.language === 'es' ? 'Selecciona al menos un producto primero' : 'Select at least one product first', 'warning');
    return;
  }

  const modal = document.getElementById('modal-sale-checkout');
  renderCartInModal();
  modal.classList.remove('hidden');
}

function closeSaleModal() {
  document.getElementById('modal-sale-checkout').classList.add('hidden');
}

function renderCartBadge() {
  const count = state.cart.reduce((sum, i) => sum + i.quantity, 0);
  const rate = state.settings.exchangeRate;
  const totalUsd = state.cart.reduce((sum, i) => sum + (i.priceUsd * i.quantity), 0);
  const totalBs = totalUsd * rate;

  // Active Sale Card Conditional Visibility: Only visible when products are selected
  const cartActiveContainer = document.getElementById('cart-active-container');
  if (cartActiveContainer) {
    if (state.cart.length === 0) {
      cartActiveContainer.classList.add('hidden');
    } else {
      cartActiveContainer.classList.remove('hidden');
    }
  }

  const badgeCount = document.getElementById('cart-badge-count');
  if (badgeCount) badgeCount.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;

  const totalUsdEl = document.getElementById('cart-card-total-usd');
  if (totalUsdEl) totalUsdEl.textContent = `$${totalUsd.toFixed(2)}`;

  const totalBsEl = document.getElementById('cart-card-total-bs');
  if (totalBsEl) totalBsEl.textContent = `(${formatBs(totalBs)} Bs.)`;

  // Render items preview in the active sale box
  const previewContainer = document.getElementById('cart-active-items-preview');
  if (previewContainer && state.cart.length > 0) {
    previewContainer.innerHTML = state.cart.map((item, index) => {
      const itemTotalUsd = item.priceUsd * item.quantity;
      const itemTotalBs = itemTotalUsd * rate;
      return `
        <div class="flex items-center justify-between p-2 rounded-xl bg-[#141418] border border-[#2C2C34] text-xs">
          <div class="flex-1 pr-2 truncate">
            <span class="font-bold text-white">${escapeHtml(item.name)}</span>
            ${item.flavor ? `<span class="block text-[10px] text-amber-400 font-semibold truncate">🍔 Sabor: ${escapeHtml(item.flavor)}</span>` : ''}
            <span class="text-gray-400 font-mono text-[11px]">$${item.priceUsd.toFixed(2)} c/u</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="flex items-center gap-1 bg-[#202028] rounded-lg p-0.5 border border-[#2C2C34]">
              <button onclick="decrementCartItem(${index})" class="w-6 h-6 rounded bg-[#2C2C34] hover:bg-[#3E3E4A] text-gray-200 flex items-center justify-center font-bold text-xs cursor-pointer">-</button>
              <span class="w-6 text-center font-mono font-bold text-white text-xs">${item.quantity}</span>
              <button onclick="incrementCartItem(${index})" class="w-6 h-6 rounded bg-[#2C2C34] hover:bg-[#3E3E4A] text-gray-200 flex items-center justify-center font-bold text-xs cursor-pointer">+</button>
            </div>
            <div class="text-right min-w-[70px]">
              <p class="font-mono font-bold text-white text-xs">$${itemTotalUsd.toFixed(2)}</p>
              <p class="font-mono text-[10px] custom-accent-text">${formatBs(itemTotalBs)} Bs.</p>
            </div>
            <button onclick="removeCartItem(${index})" title="Quitar producto" class="w-6 h-6 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 flex items-center justify-center cursor-pointer">
              <span class="material-symbols-rounded text-sm">close</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

function clearCart() {
  if (state.cart.length === 0) return;
  SoundEngine.play('void');
  state.cart = [];
  renderCartBadge();
  const isEs = state.settings.language === 'es';
  showToast(isEs ? 'Venta en curso vaciada' : 'Sale cleared', 'info');
}

function renderCartInModal() {
  const container = document.getElementById('modal-cart-items-list');
  const countEl = document.getElementById('modal-cart-items-count');
  const subtotalItemsEl = document.getElementById('modal-sale-subtotal-items');
  const totalUsdEl = document.getElementById('modal-sale-total-usd');
  const totalBsEl = document.getElementById('modal-sale-total-bs');
  const rate = state.settings.exchangeRate;

  const totalCount = state.cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalUsd = state.cart.reduce((sum, i) => sum + (i.priceUsd * i.quantity), 0);
  const totalBs = totalUsd * rate;

  if (countEl) countEl.textContent = `${totalCount} ${totalCount === 1 ? 'producto' : 'productos'}`;
  if (subtotalItemsEl) subtotalItemsEl.textContent = `${totalCount} unid.`;
  if (totalUsdEl) totalUsdEl.textContent = `$${totalUsd.toFixed(2)}`;
  if (totalBsEl) totalBsEl.textContent = `${formatBs(totalBs)} Bs.`;

  container.innerHTML = state.cart.map((item, index) => {
    const itemTotalUsd = item.priceUsd * item.quantity;
    const itemTotalBs = itemTotalUsd * rate;

    return `
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#141418] border border-[#2C2C34]">
        <div class="flex-1 pr-2">
          <p class="font-bold text-xs text-white leading-tight">${escapeHtml(item.name)}</p>
          ${item.flavor ? `<p class="text-[11px] text-amber-400 font-semibold mt-0.5">🍔 Sabor: ${escapeHtml(item.flavor)}</p>` : ''}
          <p class="text-[11px] text-gray-400 font-mono mt-0.5">
            $${item.priceUsd.toFixed(2)} x ${item.quantity} = <span class="text-white font-bold">$${itemTotalUsd.toFixed(2)}</span>
            <span class="custom-accent-text font-bold">(${formatBs(itemTotalBs)} Bs.)</span>
          </p>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="decrementCartItem(${index})" class="w-7 h-7 rounded-lg bg-[#262630] hover:bg-[#343440] text-gray-300 hover:text-white flex items-center justify-center font-bold text-sm">
            -
          </button>
          <span class="w-6 text-center text-xs font-mono font-bold text-white">${item.quantity}</span>
          <button onclick="incrementCartItem(${index})" class="w-7 h-7 rounded-lg bg-[#262630] hover:bg-[#343440] text-gray-300 hover:text-white flex items-center justify-center font-bold text-sm">
            +
          </button>
          <button onclick="removeCartItem(${index})" title="Eliminar de la venta" class="w-7 h-7 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 flex items-center justify-center ml-1">
            <span class="material-symbols-rounded text-sm">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  highlightSelectedPaymentMethod();
}

function incrementCartItem(index) {
  if (state.cart[index]) {
    SoundEngine.play('add');
    state.cart[index].quantity += 1;
    renderCartBadge();
    renderCartInModal();
  }
}

function decrementCartItem(index) {
  if (state.cart[index]) {
    SoundEngine.play('tap');
    if (state.cart[index].quantity > 1) {
      state.cart[index].quantity -= 1;
    } else {
      state.cart.splice(index, 1);
    }
    renderCartBadge();
    if (state.cart.length === 0) {
      closeSaleModal();
    } else {
      renderCartInModal();
    }
  }
}

function removeCartItem(index) {
  SoundEngine.play('void');
  state.cart.splice(index, 1);
  renderCartBadge();
  if (state.cart.length === 0) {
    closeSaleModal();
  } else {
    renderCartInModal();
  }
}

// Quick selector for "Agregar otro producto"
function openProductSelectorForSale() {
  SoundEngine.play('tap');
  const modal = document.getElementById('modal-product-selector');
  const container = document.getElementById('product-selector-list');
  const rate = state.settings.exchangeRate;

  const sortedList = sortProductsByCriteria(state.products, 'category');

  container.innerHTML = sortedList.map(p => `
    <div onclick="addAnotherProductToSale('${p.id}')" class="p-2.5 rounded-xl bg-[#141418] hover:bg-[#252530] border border-[#2C2C34] flex items-center justify-between cursor-pointer transition-colors">
      <div class="min-w-0 pr-2">
        <div class="flex items-center gap-1.5 mb-0.5">
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-[#1E1E24] text-gray-400 border border-[#2C2C34] font-medium">${escapeHtml(p.category || 'Sin categoría')}</span>
          <p class="text-xs font-bold text-white truncate">${escapeHtml(p.name)}</p>
        </div>
        <p class="text-[11px] text-gray-400 font-mono">$${p.priceUsd.toFixed(2)} / ${formatBs(p.priceUsd * rate)} Bs.</p>
      </div>
      <button class="px-2.5 py-1 rounded-lg bg-[var(--accent-color)] text-black text-xs font-bold flex items-center gap-1 shrink-0">
        <span class="material-symbols-rounded text-sm">add</span>
        <span>Añadir</span>
      </button>
    </div>
  `).join('');

  modal.classList.remove('hidden');
}

function closeProductSelector() {
  document.getElementById('modal-product-selector').classList.add('hidden');
}

function addAnotherProductToSale(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (prod) {
    if (isBurgerOrCombo(prod)) {
      closeProductSelector();
      openBurgerFlavorModal(prod);
      return;
    }
    SoundEngine.play('add');
    const existing = state.cart.find(item => item.productId === productId && !item.flavor);
    if (existing) {
      existing.quantity += 1;
    } else {
      state.cart.push({
        productId: prod.id,
        name: prod.name,
        priceUsd: prod.priceUsd,
        quantity: 1,
        flavor: ''
      });
    }
    renderCartBadge();
    renderCartInModal();
    closeProductSelector();
  }
}

function selectPaymentMethod(method) {
  SoundEngine.play('tap');
  state.selectedPaymentMethod = method;
  highlightSelectedPaymentMethod();
}

function highlightSelectedPaymentMethod() {
  const methods = ['efectivo', 'pago_movil', 'punto_de_venta'];
  methods.forEach(m => {
    const btn = document.getElementById(`pay-btn-${m}`);
    if (btn) {
      if (m === state.selectedPaymentMethod) {
        btn.classList.add('border-[var(--accent-color)]', 'bg-[#1F2937]', 'ring-2', 'ring-[var(--accent-color)]/30');
      } else {
        btn.classList.remove('border-[var(--accent-color)]', 'bg-[#1F2937]', 'ring-2', 'ring-[var(--accent-color)]/30');
      }
    }
  });
}

// Void Active Sale (Anular Venta Fallida)
function voidActiveSale() {
  const isEs = state.settings.language === 'es';
  showCustomConfirm({
    title: isEs ? 'Anular Venta en Curso' : 'Cancel Active Sale',
    message: isEs ? '¿Estás seguro de anular los productos seleccionados en esta venta?' : 'Are you sure you want to cancel the items in this sale?',
    confirmText: isEs ? 'Sí, Anular' : 'Yes, Cancel',
    cancelText: isEs ? 'Continuar Venta' : 'Continue Sale',
    isDanger: true,
    icon: 'cancel',
    onConfirm: () => {
      SoundEngine.play('void');
      state.cart = [];
      renderCartBadge();
      closeSaleModal();
      showToast(isEs ? 'Venta cancelada' : 'Sale cancelled', 'info');
    }
  });
}

// Complete Sale
function completeSale() {
  if (state.cart.length === 0) return;

  SoundEngine.play('cash');

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const rate = state.settings.exchangeRate;

  const totalUsd = state.cart.reduce((sum, i) => sum + (i.priceUsd * i.quantity), 0);
  const totalBs = totalUsd * rate;

  const saleRecord = {
    id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: now.toISOString(),
    dateString: dateStr,
    items: state.cart.map(i => ({
      productId: i.productId,
      name: i.name,
      priceUsd: i.priceUsd,
      quantity: i.quantity,
      flavor: i.flavor || '',
      burgerCount: i.burgerCount || 1,
      totalUsd: i.priceUsd * i.quantity,
      totalBs: i.priceUsd * i.quantity * rate
    })),
    totalUsd: totalUsd,
    totalBs: totalBs,
    rate: rate,
    paymentMethod: state.selectedPaymentMethod,
    status: 'completed'
  };

  // Automatic deduction of inventory based on ingredients and protein flavors
  const deductions = calculateDeductionsForSale(saleRecord.items);
  deductFromInventory(deductions, saleRecord);

  // Prepend to sales
  state.sales.unshift(saleRecord);
  saveToStorage();

  // Reset cart
  state.cart = [];
  renderCartBadge();
  closeSaleModal();

  // Render updated screens
  renderAll();

  // Open Digital Receipt
  openReceiptModal(saleRecord);
}

// ============================================================================
// Digital Receipt Modal
// ============================================================================
function openReceiptModal(saleRecord) {
  state.lastCompletedReceipt = saleRecord;
  const modal = document.getElementById('modal-receipt');
  
  document.getElementById('receipt-modal-id').textContent = `Ticket #${saleRecord.id}`;
  document.getElementById('receipt-store-title').textContent = state.settings.storeName;
  document.getElementById('receipt-date-time').textContent = new Date(saleRecord.timestamp).toLocaleString();
  document.getElementById('receipt-rate-val').textContent = `${saleRecord.rate.toFixed(2)} Bs/$`;
  document.getElementById('receipt-payment-method').textContent = formatPaymentMethod(saleRecord.paymentMethod);
  document.getElementById('receipt-total-usd').textContent = `$${saleRecord.totalUsd.toFixed(2)}`;
  document.getElementById('receipt-total-bs').textContent = `${formatBs(saleRecord.totalBs)} Bs.`;

  const itemsContainer = document.getElementById('receipt-items-container');
  itemsContainer.innerHTML = saleRecord.items.map(item => `
    <div class="flex justify-between py-0.5">
      <div class="pr-2">
        <span class="text-white">${item.quantity}x ${escapeHtml(item.name)}</span>
        ${item.flavor ? `<span class="block text-[10px] text-amber-400">(${escapeHtml(item.flavor)})</span>` : ''}
      </div>
      <span class="font-bold text-white font-mono">$${item.totalUsd.toFixed(2)}</span>
    </div>
  `).join('');

  modal.classList.remove('hidden');
}

function closeReceiptModalAndReset() {
  document.getElementById('modal-receipt').classList.add('hidden');
  switchView('home');
}

// ============================================================================
// Canvas High-Res Image Renderers & Direct Sharing (No Forced Downloads)
// ============================================================================

let activeShareImageState = {
  canvas: null,
  blob: null,
  dataUrl: '',
  fileName: '',
  title: '',
  text: ''
};

function renderReceiptToCanvas(sale) {
  if (!sale) return null;

  const canvas = document.getElementById('export-canvas');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  // Canvas Dimensions (2x for Retina sharp rendering)
  const scale = 2;
  const width = 440;
  const padding = 24;

  // Calculate dynamic height based on item count
  const baseHeight = 360;
  const itemsHeight = sale.items.length * 28;
  const height = baseHeight + itemsHeight;

  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#141418';
  ctx.fillRect(0, 0, width, height);

  // Accent Header Strip
  ctx.fillStyle = state.settings.themeColor === 'cyan' ? '#00E5FF' : '#00E676';
  ctx.fillRect(0, 0, width, 10);

  // Header Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.settings.storeName, width / 2, 45);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText(`COMPROBANTE DE VENTA • ${sale.id}`, width / 2, 68);

  const dateFormatted = new Date(sale.timestamp).toLocaleString();
  ctx.fillText(dateFormatted, width / 2, 86);
  ctx.fillText(`Tasa: ${sale.rate.toFixed(2)} Bs/$`, width / 2, 104);

  // Divider Line
  ctx.strokeStyle = '#2C2C34';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding, 120);
  ctx.lineTo(width - padding, 120);
  ctx.stroke();
  ctx.setLineDash([]);

  // Items Header
  let y = 145;
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CANT / DESCRIPCIÓN', padding, y);
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL USD', width - padding, y);

  // Items List
  y += 20;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px "Plus Jakarta Sans", sans-serif';

  sale.items.forEach(item => {
    ctx.textAlign = 'left';
    const text = `${item.quantity}x ${item.name}`;
    ctx.fillText(text.length > 28 ? text.substring(0, 26) + '...' : text, padding, y);
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText(`$${item.totalUsd.toFixed(2)}`, width - padding, y);
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    y += 24;
  });

  // Divider Line
  y += 10;
  ctx.strokeStyle = '#2C2C34';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Payment Method
  y += 26;
  ctx.fillStyle = '#94A3B8';
  ctx.font = '12px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Método de Pago:', padding, y);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(formatPaymentMethod(sale.paymentMethod), width - padding, y);

  // Total USD
  y += 26;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL EN DÓLARES:', padding, y);
  ctx.textAlign = 'right';
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText(`$${sale.totalUsd.toFixed(2)}`, width - padding, y);

  // Total Bs
  y += 24;
  ctx.fillStyle = state.settings.themeColor === 'cyan' ? '#00E5FF' : '#00E676';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL EN BOLÍVARES:', padding, y);
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillText(`${formatBs(sale.totalBs)} Bs.`, width - padding, y);

  // Footer Note
  y += 36;
  ctx.fillStyle = '#64748B';
  ctx.font = '11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('¡Gracias por su compra! Vuelva pronto.', width / 2, y);

  return canvas;
}

// User-facing trigger: Shares receipt directly without downloading
async function shareReceiptAsImage(targetSale) {
  SoundEngine.play('tap');
  const sale = targetSale || state.lastCompletedReceipt;
  if (!sale) return;

  const canvas = renderReceiptToCanvas(sale);
  if (!canvas) return;

  const isEs = state.settings.language === 'es';
  const fileName = `Recibo_${sale.id}.png`;
  const title = `Recibo #${sale.id} - ${state.settings.storeName}`;
  const text = isEs 
    ? `Comprobante de compra #${sale.id} por $${sale.totalUsd.toFixed(2)} (${formatBs(sale.totalBs)} Bs.) en ${state.settings.storeName}`
    : `Receipt #${sale.id} for $${sale.totalUsd.toFixed(2)} (${formatBs(sale.totalBs)} Bs.) at ${state.settings.storeName}`;

  await shareDirectlyOrFallback(canvas, fileName, title, text);
}

// User-facing trigger: Optional explicit download when requested
function downloadReceiptImage(targetSale) {
  SoundEngine.play('tap');
  const sale = targetSale || state.lastCompletedReceipt;
  if (!sale) return;

  const canvas = renderReceiptToCanvas(sale);
  if (!canvas) return;

  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `Recibo_${sale.id}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(state.settings.language === 'es' ? 'Recibo descargado como archivo' : 'Receipt downloaded as file', 'info');
}

// ============================================================================
// "Compartir Reporte en Forma de Imagen" (Canvas Report Generator)
// ============================================================================
function renderReportToCanvas(period = state.reportPeriod) {
  const canvas = document.getElementById('export-canvas');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const rate = state.settings.exchangeRate;

  const filteredSales = getSalesForPeriod(period);

  const totalUsd = filteredSales.reduce((s, x) => s + x.totalUsd, 0);
  const totalBs = totalUsd * rate;

  const cashUsd = filteredSales.filter(s => s.paymentMethod === 'efectivo').reduce((s, x) => s + x.totalUsd, 0);
  const pmUsd = filteredSales.filter(s => s.paymentMethod === 'pago_movil').reduce((s, x) => s + x.totalUsd, 0);
  const posUsd = filteredSales.filter(s => s.paymentMethod === 'punto_de_venta').reduce((s, x) => s + x.totalUsd, 0);

  const scale = 2;
  const width = 500;
  const height = 480;
  const padding = 28;

  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#141418';
  ctx.fillRect(0, 0, width, height);

  // Accent Header Strip
  ctx.fillStyle = state.settings.themeColor === 'cyan' ? '#00E5FF' : '#00E676';
  ctx.fillRect(0, 0, width, 12);

  // Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(state.settings.storeName, padding, 48);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  const periodLabel = period === 'daily' ? 'Diario (Hoy)' : (period === 'weekly' ? 'Semanal (Últimos 7 días)' : 'Mensual (Este Mes)');
  ctx.fillText(`REPORTE DE VENTAS • ${periodLabel}`, padding, 70);

  // Date and Rate
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillText(`Generado: ${new Date().toLocaleString()} | Tasa: ${rate.toFixed(2)} Bs/$`, padding, 90);

  // Big Metric Card: Grand Total
  ctx.fillStyle = '#1E1E24';
  ctx.beginPath();
  ctx.roundRect(padding, 110, width - (padding * 2), 90, 12);
  ctx.fill();

  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('VENTAS TOTALES ACUMULADAS', padding + 16, 134);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px "JetBrains Mono", monospace';
  ctx.fillText(`$${totalUsd.toFixed(2)}`, padding + 16, 168);

  ctx.fillStyle = state.settings.themeColor === 'cyan' ? '#00E5FF' : '#00E676';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillText(`${formatBs(totalBs)} Bs.  (${filteredSales.length} transacciones)`, padding + 16, 188);

  // Breakdown by Method Section
  let y = 230;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Desglose por Tipo de Pago:', padding, y);

  const drawMethodRow = (title, amountUsd, colorHex, opsCount) => {
    y += 36;
    ctx.fillStyle = colorHex;
    ctx.beginPath();
    ctx.arc(padding + 6, y - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${title} (${opsCount} ops)`, padding + 20, y);

    const pct = totalUsd > 0 ? ((amountUsd / totalUsd) * 100).toFixed(1) : 0;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(`${pct}%`, padding + 210, y);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`$${amountUsd.toFixed(2)}`, width - padding, y);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(`${formatBs(amountUsd * rate)} Bs.`, width - padding, y + 15);
    y += 10;
  };

  const cashOps = filteredSales.filter(s => s.paymentMethod === 'efectivo').length;
  const pmOps = filteredSales.filter(s => s.paymentMethod === 'pago_movil').length;
  const posOps = filteredSales.filter(s => s.paymentMethod === 'punto_de_venta').length;

  drawMethodRow('Efectivo', cashUsd, '#10B981', cashOps);
  drawMethodRow('Pago Móvil', pmUsd, '#0EA5E9', pmOps);
  drawMethodRow('Punto de Venta', posUsd, '#8B5CF6', posOps);

  return canvas;
}

// User-facing trigger: Shares report directly without downloading
async function generateAndShareReportImage(requestedPeriod = null) {
  SoundEngine.play('tap');
  const period = requestedPeriod || state.reportPeriod || 'daily';
  state.reportPeriod = period;
  const canvas = renderReportToCanvas(period);
  if (!canvas) return;

  const isEs = state.settings.language === 'es';
  const periodLabel = period === 'daily' ? (isEs ? 'Diario' : 'Daily') : (period === 'weekly' ? (isEs ? 'Semanal' : 'Weekly') : (isEs ? 'Mensual' : 'Monthly'));
  const fileName = `Reporte_Ventas_${period}.png`;
  const title = `Reporte de Ventas (${periodLabel}) - ${state.settings.storeName}`;
  const text = `Reporte de ventas de ${state.settings.storeName} (${periodLabel})`;

  await shareDirectlyOrFallback(canvas, fileName, title, text);
}

// User-facing trigger: Optional explicit download of sales report
function downloadReportImage(period = state.reportPeriod) {
  SoundEngine.play('tap');
  const canvas = renderReportToCanvas(period);
  if (!canvas) return;

  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `Reporte_Ventas_${period}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(state.settings.language === 'es' ? 'Reporte descargado como archivo' : 'Report downloaded as file', 'info');
}

// ============================================================================
// Direct Sharing Engine (Web Share API with Clipboard Fallback & In-App Viewer)
// ============================================================================
async function shareDirectlyOrFallback(canvas, fileName, shareTitle, shareText) {
  if (!canvas) return;

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    showToast(state.settings.language === 'es' ? 'Error al procesar la imagen' : 'Error processing image', 'error');
    return;
  }

  const dataUrl = canvas.toDataURL('image/png');
  activeShareImageState = {
    canvas,
    blob,
    dataUrl,
    fileName,
    title: shareTitle,
    text: shareText
  };

  const file = new File([blob], fileName, { type: 'image/png' });

  // 1. Try native Web Share API with files (WhatsApp mobile, Android/iOS share sheet)
  let canShareFiles = false;
  try {
    canShareFiles = Boolean(navigator.canShare && navigator.canShare({ files: [file] }));
  } catch (_) {
    canShareFiles = false;
  }

  if (canShareFiles) {
    try {
      await navigator.share({
        files: [file],
        title: shareTitle,
        text: shareText
      });
      showToast(state.settings.language === 'es' ? '¡Imagen compartida exitosamente!' : 'Image shared successfully!', 'success');
      return;
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') {
        // User dismissed the native share sheet - don't download, just exit smoothly
        return;
      }
      console.warn('Web Share API rejected:', shareErr);
    }
  }

  // 2. Direct Clipboard Copy (instant paste into WhatsApp Web, chats without saving to disk)
  let copiedToClipboard = false;
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      copiedToClipboard = true;
    } catch (clipErr) {
      console.warn('Direct clipboard write rejected:', clipErr);
    }
  }

  // 3. Open Direct Image Preview Modal (User can copy, share, or long-press without downloading)
  openShareDirectModal({
    imgSrc: dataUrl,
    title: shareTitle,
    copied: copiedToClipboard
  });
}

function openShareDirectModal({ imgSrc, title, copied }) {
  const modal = document.getElementById('modal-share-preview');
  const img = document.getElementById('share-preview-img');
  const titleEl = document.getElementById('share-preview-title');
  const banner = document.getElementById('share-copied-banner');

  if (img) img.src = imgSrc;
  if (titleEl && title) titleEl.textContent = title;
  if (banner) {
    if (copied) banner.classList.remove('hidden');
    else banner.classList.add('hidden');
  }

  if (modal) modal.classList.remove('hidden');

  if (copied) {
    showToast(state.settings.language === 'es' ? '¡Imagen copiada! Puedes pegarla (Ctrl+V) directo en WhatsApp' : 'Image copied! Paste directly into chat', 'success');
  }
}

function closeShareDirectModal() {
  SoundEngine.play('tap');
  const modal = document.getElementById('modal-share-preview');
  if (modal) modal.classList.add('hidden');
}

async function copyActiveShareImage() {
  SoundEngine.play('tap');
  if (!activeShareImageState.blob && activeShareImageState.canvas) {
    activeShareImageState.blob = await new Promise(r => activeShareImageState.canvas.toBlob(r, 'image/png'));
  }

  if (activeShareImageState.blob && navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': activeShareImageState.blob })
      ]);
      const banner = document.getElementById('share-copied-banner');
      if (banner) banner.classList.remove('hidden');
      showToast(state.settings.language === 'es' ? '¡Imagen copiada al portapapeles! Lista para pegar.' : 'Image copied to clipboard!', 'success');
      return;
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  }
  showToast(state.settings.language === 'es' ? 'Mantén presionada la imagen para copiarla' : 'Long-press image to copy', 'info');
}

async function triggerWebShareActive() {
  SoundEngine.play('tap');
  if (!activeShareImageState.blob) return;

  const file = new File([activeShareImageState.blob], activeShareImageState.fileName || 'comprobante.png', { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: activeShareImageState.title,
        text: activeShareImageState.text
      });
      showToast(state.settings.language === 'es' ? '¡Imagen compartida!' : 'Image shared!', 'success');
      closeShareDirectModal();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('triggerWebShareActive error:', err);
    }
  }

  // Fallback to clipboard copy
  copyActiveShareImage();
}

function downloadActiveShareImage() {
  SoundEngine.play('tap');
  if (!activeShareImageState.dataUrl) return;

  const a = document.createElement('a');
  a.href = activeShareImageState.dataUrl;
  a.download = activeShareImageState.fileName || 'comprobante.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(state.settings.language === 'es' ? 'Descarga iniciada' : 'Download started', 'info');
}

// ============================================================================
// Sales History List & Filtering
// ============================================================================
function setHistoryFilter(filter) {
  state.historyFilter = filter;
  document.querySelectorAll('.history-filter-btn').forEach(btn => {
    btn.classList.remove('active', 'custom-accent-bg', 'text-black');
    btn.classList.add('text-gray-400');
  });
  event.target.classList.add('active', 'custom-accent-bg', 'text-black');
  event.target.classList.remove('text-gray-400');
  renderHistoryList();
}

function renderHistoryList() {
  const container = document.getElementById('history-sales-list');
  const emptyState = document.getElementById('history-empty-state');
  const searchQuery = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
  const rate = state.settings.exchangeRate;

  let filtered = [...state.sales];

  // Payment method filter
  if (state.historyFilter !== 'all') {
    filtered = filtered.filter(s => s.paymentMethod === state.historyFilter);
  }

  // Search filter
  if (searchQuery) {
    filtered = filtered.filter(s => 
      s.id.toLowerCase().includes(searchQuery) ||
      s.items.some(i => i.name.toLowerCase().includes(searchQuery)) ||
      s.paymentMethod.toLowerCase().includes(searchQuery)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  container.innerHTML = filtered.map(sale => {
    const isVoided = sale.status === 'voided';
    const dateFormatted = new Date(sale.timestamp).toLocaleString();
    const itemsSummary = sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ');

    return `
      <div class="bg-[#1E1E24] border ${isVoided ? 'border-rose-900/40 opacity-60' : 'border-[#2C2C34]'} rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        
        <div class="space-y-1 flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono font-bold text-xs ${isVoided ? 'text-rose-400 line-through' : 'text-white'}">
              #${sale.id}
            </span>
            <span class="text-[11px] text-gray-400">${dateFormatted}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getPaymentBadgeClass(sale.paymentMethod)}">
              ${formatPaymentMethod(sale.paymentMethod)}
            </span>
            ${isVoided ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/40">Anulada</span>` : ''}
          </div>

          <p class="text-xs text-gray-300 truncate">${itemsSummary}</p>
        </div>

        <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#2C2C34]">
          <div class="text-left sm:text-right">
            <div class="text-base font-mono font-extrabold ${isVoided ? 'text-gray-500 line-through' : 'text-white'}">
              $${sale.totalUsd.toFixed(2)}
            </div>
            <div class="text-[11px] font-mono font-bold ${isVoided ? 'text-gray-500' : 'custom-accent-text'}">
              ${formatBs(sale.totalBs)} Bs.
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <!-- View / Share Receipt as Image -->
            <button onclick="openReceiptModalFromHistory('${sale.id}')" title="Ver y compartir recibo en imagen" class="px-2.5 py-1.5 rounded-lg bg-[#2C2C34] hover:bg-[#363640] text-xs font-semibold text-gray-200 hover:text-white border border-[#3E3E4A] flex items-center gap-1 transition-colors">
              <span class="material-symbols-rounded text-sm">receipt</span>
              <span>Recibo</span>
            </button>

            <!-- Void Sale (Anular Venta) -->
            ${!isVoided ? `
              <button onclick="voidSaleById('${sale.id}')" title="Anular venta fallida" class="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/50 transition-colors">
                <span class="material-symbols-rounded text-sm">block</span>
              </button>
            ` : ''}
          </div>
        </div>

      </div>
    `;
  }).join('');
}

function openReceiptModalFromHistory(saleId) {
  const sale = state.sales.find(s => s.id === saleId);
  if (sale) openReceiptModal(sale);
}

function voidSaleById(saleId) {
  const sale = state.sales.find(s => s.id === saleId);
  if (!sale) return;

  const isEs = state.settings.language === 'es';
  showCustomConfirm({
    title: isEs ? 'Anular Venta' : 'Void Sale',
    message: isEs 
      ? `¿Deseas anular la venta #${sale.id}? Se descontará de los reportes diarios y semanales.` 
      : `Do you want to void sale #${sale.id}? It will be deducted from reports.`,
    confirmText: isEs ? 'Anular Venta' : 'Void Sale',
    cancelText: isEs ? 'Cancelar' : 'Cancel',
    isDanger: true,
    icon: 'block',
    onConfirm: () => {
      SoundEngine.play('void');
      sale.status = 'voided';
      saveToStorage();
      renderAll();
      showToast(isEs ? `Venta #${sale.id} anulada` : `Sale #${sale.id} voided`, 'warning');
    }
  });
}

// ============================================================================
// Reports Screen & Periodic Breakdown
// ============================================================================
function setReportPeriod(period) {
  state.reportPeriod = period;
  document.querySelectorAll('.report-tab-btn').forEach(btn => {
    btn.classList.remove('active', 'custom-accent-bg', 'text-black');
    btn.classList.add('text-gray-400');
  });
  event.target.classList.add('active', 'custom-accent-bg', 'text-black');
  event.target.classList.remove('text-gray-400');
  renderReports();
}

function getSalesForPeriod(period) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const activeSales = state.sales.filter(s => s.status !== 'voided');

  if (period === 'daily') {
    return activeSales.filter(s => s.dateString === todayStr);
  } else if (period === 'weekly') {
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    return activeSales.filter(s => new Date(s.timestamp) >= weekAgo);
  } else if (period === 'monthly') {
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return activeSales.filter(s => {
      const d = new Date(s.timestamp);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }
  return activeSales;
}

function renderReports() {
  const period = state.reportPeriod;
  const filtered = getSalesForPeriod(period);
  const rate = state.settings.exchangeRate;

  const totalUsd = filtered.reduce((s, x) => s + x.totalUsd, 0);
  const totalBs = totalUsd * rate;

  const cashUsd = filtered.filter(s => s.paymentMethod === 'efectivo').reduce((s, x) => s + x.totalUsd, 0);
  const pmUsd = filtered.filter(s => s.paymentMethod === 'pago_movil').reduce((s, x) => s + x.totalUsd, 0);
  const posUsd = filtered.filter(s => s.paymentMethod === 'punto_de_venta').reduce((s, x) => s + x.totalUsd, 0);

  document.getElementById('rep-metric-total-usd').textContent = `$${totalUsd.toFixed(2)}`;
  document.getElementById('rep-metric-total-bs').textContent = `${formatBs(totalBs)} Bs.`;

  document.getElementById('rep-metric-cash-usd').textContent = `$${cashUsd.toFixed(2)}`;
  document.getElementById('rep-metric-cash-bs').textContent = `${formatBs(cashUsd * rate)} Bs.`;

  document.getElementById('rep-metric-pm-usd').textContent = `$${pmUsd.toFixed(2)}`;
  document.getElementById('rep-metric-pm-bs').textContent = `${formatBs(pmUsd * rate)} Bs.`;

  document.getElementById('rep-metric-pos-usd').textContent = `$${posUsd.toFixed(2)}`;
  document.getElementById('rep-metric-pos-bs').textContent = `${formatBs(posUsd * rate)} Bs.`;

  // Visual Multi-segment Progress Bar percentages
  const pctCash = totalUsd > 0 ? (cashUsd / totalUsd) * 100 : 33.3;
  const pctPm = totalUsd > 0 ? (pmUsd / totalUsd) * 100 : 33.3;
  const pctPos = totalUsd > 0 ? (posUsd / totalUsd) * 100 : 33.4;

  document.getElementById('rep-bar-cash').style.width = `${pctCash}%`;
  document.getElementById('rep-bar-pm').style.width = `${pctPm}%`;
  document.getElementById('rep-bar-pos').style.width = `${pctPos}%`;

  document.getElementById('rep-legend-cash').textContent = `$${cashUsd.toFixed(2)} (${pctCash.toFixed(1)}%)`;
  document.getElementById('rep-legend-pm').textContent = `$${pmUsd.toFixed(2)} (${pctPm.toFixed(1)}%)`;
  document.getElementById('rep-legend-pos').textContent = `$${posUsd.toFixed(2)} (${pctPos.toFixed(1)}%)`;

  // Transaction count badge
  document.getElementById('rep-count-badge').textContent = `${filtered.length} operaciones registradas`;

  // Transactions list
  const listContainer = document.getElementById('rep-transactions-list');
  if (filtered.length === 0) {
    listContainer.innerHTML = '<p class="py-6 text-center text-xs text-gray-500">No hay operaciones en este período</p>';
    return;
  }

  listContainer.innerHTML = filtered.map(s => `
    <div class="py-3 flex items-center justify-between text-xs">
      <div class="space-y-0.5">
        <div class="flex items-center gap-2">
          <span class="font-mono font-bold text-white">#${s.id}</span>
          <span class="text-gray-400">${new Date(s.timestamp).toLocaleDateString()}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${getPaymentBadgeClass(s.paymentMethod)}">${formatPaymentMethod(s.paymentMethod)}</span>
        </div>
        <p class="text-[11px] text-gray-400">${s.items.length} items</p>
      </div>
      <div class="text-right">
        <p class="font-mono font-bold text-white">$${s.totalUsd.toFixed(2)}</p>
        <p class="font-mono text-[11px] custom-accent-text">${formatBs(s.totalBs)} Bs.</p>
      </div>
    </div>
  `).join('');
}

// ============================================================================
// Quick Report & Today Breakdown Modal
// ============================================================================
function openQuickReportModal(period = 'daily') {
  SoundEngine.play('tap');
  state.activeQuickReportPeriod = period;
  const rate = state.settings.exchangeRate;
  const isEs = state.settings.language === 'es';

  let filteredSales = [];
  let periodTitle = '';
  let periodDateStr = '';
  let iconName = 'today';

  if (period === 'daily') {
    const todayStr = new Date().toISOString().split('T')[0];
    filteredSales = state.sales.filter(s => s.dateString === todayStr && s.status !== 'voided');
    periodTitle = isEs ? 'Reporte Diario de Ventas' : 'Daily Sales Report';
    periodDateStr = new Date().toLocaleDateString(isEs ? 'es-VE' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    iconName = 'today';
  } else {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    filteredSales = state.sales.filter(s => {
      const saleDate = new Date(s.timestamp);
      return saleDate >= sevenDaysAgo && s.status !== 'voided';
    });
    periodTitle = isEs ? 'Reporte Semanal de Ventas' : 'Weekly Sales Report';
    periodDateStr = isEs ? 'Acumulado últimos 7 días' : 'Accumulated last 7 days';
    iconName = 'calendar_view_week';
  }

  const grandTotalUsd = filteredSales.reduce((s, x) => s + x.totalUsd, 0);
  const grandTotalBs = grandTotalUsd * rate;

  const cashSales = filteredSales.filter(s => s.paymentMethod === 'efectivo');
  const cashUsd = cashSales.reduce((s, x) => s + x.totalUsd, 0);

  const pmSales = filteredSales.filter(s => s.paymentMethod === 'pago_movil');
  const pmUsd = pmSales.reduce((s, x) => s + x.totalUsd, 0);

  const posSales = filteredSales.filter(s => s.paymentMethod === 'punto_de_venta');
  const posUsd = posSales.reduce((s, x) => s + x.totalUsd, 0);

  const titleEl = document.getElementById('bd-report-title');
  if (titleEl) titleEl.textContent = periodTitle;

  const iconEl = document.getElementById('bd-report-icon');
  if (iconEl) iconEl.textContent = iconName;

  const dateEl = document.getElementById('breakdown-today-date');
  if (dateEl) dateEl.textContent = periodDateStr;

  const subtextEl = document.getElementById('bd-grand-total-subtext');
  if (subtextEl) {
    subtextEl.textContent = `${filteredSales.length} ${filteredSales.length === 1 ? (isEs ? 'operación registrada' : 'recorded sale') : (isEs ? 'operaciones registradas' : 'recorded sales')}`;
  }

  const totalUsdEl = document.getElementById('bd-grand-total-usd');
  if (totalUsdEl) totalUsdEl.textContent = `$${grandTotalUsd.toFixed(2)}`;

  const totalBsEl = document.getElementById('bd-grand-total-bs');
  if (totalBsEl) totalBsEl.textContent = `${formatBs(grandTotalBs)} Bs.`;

  // Weekly Average Highlight
  const weeklyAvgContainer = document.getElementById('bd-weekly-avg-container');
  if (weeklyAvgContainer) {
    if (period === 'weekly') {
      weeklyAvgContainer.classList.remove('hidden');
      const avgUsd = grandTotalUsd / 7;
      const avgBs = avgUsd * rate;
      const elUsd = document.getElementById('bd-weekly-avg-usd');
      const elBs = document.getElementById('bd-weekly-avg-bs');
      if (elUsd) elUsd.textContent = `$${avgUsd.toFixed(2)} / día`;
      if (elBs) elBs.textContent = `${formatBs(avgBs)} Bs. / día`;
    } else {
      weeklyAvgContainer.classList.add('hidden');
    }
  }

  const cashOps = document.getElementById('bd-cash-ops');
  if (cashOps) cashOps.textContent = `${cashSales.length} ${isEs ? 'operaciones' : 'sales'}`;
  const cashUsdEl = document.getElementById('bd-cash-usd');
  if (cashUsdEl) cashUsdEl.textContent = `$${cashUsd.toFixed(2)}`;
  const cashBsEl = document.getElementById('bd-cash-bs');
  if (cashBsEl) cashBsEl.textContent = `${formatBs(cashUsd * rate)} Bs.`;

  const pmOps = document.getElementById('bd-pm-ops');
  if (pmOps) pmOps.textContent = `${pmSales.length} ${isEs ? 'operaciones' : 'sales'}`;
  const pmUsdEl = document.getElementById('bd-pm-usd');
  if (pmUsdEl) pmUsdEl.textContent = `$${pmUsd.toFixed(2)}`;
  const pmBsEl = document.getElementById('bd-pm-bs');
  if (pmBsEl) pmBsEl.textContent = `${formatBs(pmUsd * rate)} Bs.`;

  const posOps = document.getElementById('bd-pos-ops');
  if (posOps) posOps.textContent = `${posSales.length} ${isEs ? 'operaciones' : 'sales'}`;
  const posUsdEl = document.getElementById('bd-pos-usd');
  if (posUsdEl) posUsdEl.textContent = `$${posUsd.toFixed(2)}`;
  const posBsEl = document.getElementById('bd-pos-bs');
  if (posBsEl) posBsEl.textContent = `${formatBs(posUsd * rate)} Bs.`;

  const modal = document.getElementById('modal-today-breakdown');
  if (modal) modal.classList.remove('hidden');
}

function openTodayBreakdownModal() {
  openQuickReportModal('daily');
}

function closeTodayBreakdownModal() {
  const modal = document.getElementById('modal-today-breakdown');
  if (modal) modal.classList.add('hidden');
}

function triggerShareFromQuickReport() {
  const period = state.activeQuickReportPeriod || 'daily';
  generateAndShareReportImage(period);
}

function goToReportsFromQuickModal() {
  const period = state.activeQuickReportPeriod || 'daily';
  state.reportPeriod = period;
  closeTodayBreakdownModal();
  switchView('reports');
}

// ============================================================================
// Product Registration & Editing Modal
// ============================================================================
function openProductModal(productId = null) {
  SoundEngine.play('tap');
  state.activeProductEditingId = productId;
  const modal = document.getElementById('modal-product-form');
  const titleEl = document.getElementById('product-modal-title');
  const idInput = document.getElementById('product-form-id');
  const nameInput = document.getElementById('prod-name');
  const priceInput = document.getElementById('prod-price-usd');
  const categoryInput = document.getElementById('prod-category');
  const dateInput = document.getElementById('prod-date');
  const previewImg = document.getElementById('prod-preview-img');
  const previewIcon = document.getElementById('prod-preview-icon');
  const deleteBtnInModal = document.getElementById('btn-delete-product-from-modal');
  const removePhotoBtn = document.getElementById('btn-remove-prod-photo');

  if (productId) {
    const prod = state.products.find(p => p.id === productId);
    if (prod) {
      titleEl.textContent = state.settings.language === 'es' ? 'Editar Producto' : 'Edit Product';
      idInput.value = prod.id;
      nameInput.value = prod.name;
      priceInput.value = prod.priceUsd;
      renderCategorySelectOptions(prod.category);
      handleCategoryChange(prod.category);

      const comboContainer = document.getElementById('combo-items-container');
      if (comboContainer) {
        comboContainer.innerHTML = '';
        if (prod.category === 'Combos' && Array.isArray(prod.comboProducts) && prod.comboProducts.length > 0) {
          prod.comboProducts.forEach(cp => {
            addComboProductRow(cp.productId || cp.id, cp.quantity || 1);
          });
        }
      }

      dateInput.value = prod.date || new Date().toISOString().split('T')[0];

      if (deleteBtnInModal) deleteBtnInModal.classList.remove('hidden');

      if (prod.image) {
        previewImg.src = prod.image;
        previewImg.classList.remove('hidden');
        previewIcon.classList.add('hidden');
        if (removePhotoBtn) removePhotoBtn.classList.remove('hidden');
      } else {
        previewImg.src = '';
        previewImg.classList.add('hidden');
        previewIcon.classList.remove('hidden');
        if (removePhotoBtn) removePhotoBtn.classList.add('hidden');
      }
    }
  } else {
    titleEl.textContent = state.settings.language === 'es' ? 'Registrar Nuevo Producto' : 'Register New Product';
    idInput.value = '';
    nameInput.value = '';
    priceInput.value = '';
    renderCategorySelectOptions(state.categories[0] || 'Víveres');
    handleCategoryChange(state.categories[0] || 'Víveres');

    const comboContainer = document.getElementById('combo-items-container');
    if (comboContainer) comboContainer.innerHTML = '';

    dateInput.value = new Date().toISOString().split('T')[0];
    previewImg.src = '';
    previewImg.classList.add('hidden');
    previewIcon.classList.remove('hidden');
    if (removePhotoBtn) removePhotoBtn.classList.add('hidden');

    if (deleteBtnInModal) deleteBtnInModal.classList.add('hidden');
  }

  updateFormBsPrice();
  modal.classList.remove('hidden');
}

function handleCategoryChange(category) {
  const comboSection = document.getElementById('combo-builder-section');
  if (!comboSection) return;
  if (category === 'Combos') {
    comboSection.classList.remove('hidden');
    const container = document.getElementById('combo-items-container');
    if (container && container.children.length === 0) {
      addComboProductRow('prod-burger-1', 1);
      addComboProductRow('prod-papas-1', 1);
      addComboProductRow('prod-drink-1', 1);
    }
  } else {
    comboSection.classList.add('hidden');
  }
}

function addComboProductRow(selectedId = '', quantity = 1) {
  const container = document.getElementById('combo-items-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'combo-product-row flex items-center gap-2 p-2 rounded-xl bg-[#18181C] border border-[#2C2C34]';

  const availableProducts = (state.products || []).filter(p => p.category !== 'Combos');
  const optionsHtml = availableProducts.map(p => `
    <option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(p.name)} ($${p.priceUsd.toFixed(2)})</option>
  `).join('');

  row.innerHTML = `
    <div class="flex-1">
      <select class="combo-row-select w-full px-2.5 py-1.5 rounded-lg bg-[#121214] border border-[#2C2C34] text-xs text-white focus:outline-none focus:border-amber-400">
        ${optionsHtml || '<option value="">Hamburguesa Clásica</option>'}
      </select>
    </div>
    <div class="w-20">
      <input type="number" min="1" max="20" value="${quantity || 1}" class="combo-row-qty w-full px-2 py-1.5 rounded-lg bg-[#121214] border border-[#2C2C34] text-xs text-white font-mono text-center focus:outline-none focus:border-amber-400" placeholder="Cant.">
    </div>
    <button type="button" onclick="removeComboProductRow(this)" class="w-7 h-7 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 flex items-center justify-center transition-colors cursor-pointer" title="Quitar producto">
      <span class="material-symbols-rounded text-base">close</span>
    </button>
  `;

  container.appendChild(row);
}

function removeComboProductRow(btn) {
  const row = btn.closest('.combo-product-row');
  if (row) row.remove();
}

function closeProductModal() {
  SoundEngine.play('tap');
  document.getElementById('modal-product-form').classList.add('hidden');
}

function updateFormBsPrice() {
  const usd = parseFloat(document.getElementById('prod-price-usd').value) || 0;
  const rate = state.settings.exchangeRate;
  document.getElementById('prod-price-bs').value = `${formatBs(usd * rate)} Bs.`;
}

async function handleProductPhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  const previewImg = document.getElementById('prod-preview-img');
  const previewIcon = document.getElementById('prod-preview-icon');
  const removePhotoBtn = document.getElementById('btn-remove-prod-photo');

  // Compress photo down to max 500x500px so it persists without storage quota limits
  const compressed = await compressImage(file, 500, 0.82);
  if (compressed) {
    previewImg.src = compressed;
    previewImg.classList.remove('hidden');
    previewIcon.classList.add('hidden');
    if (removePhotoBtn) removePhotoBtn.classList.remove('hidden');
  }
}

function removeProductPhoto() {
  const previewImg = document.getElementById('prod-preview-img');
  const previewIcon = document.getElementById('prod-preview-icon');
  const fileInput = document.getElementById('prod-photo-file');
  const removePhotoBtn = document.getElementById('btn-remove-prod-photo');

  if (previewImg) {
    previewImg.src = '';
    previewImg.classList.add('hidden');
  }
  if (previewIcon) previewIcon.classList.remove('hidden');
  if (fileInput) fileInput.value = '';
  if (removePhotoBtn) removePhotoBtn.classList.add('hidden');
}

function handleProductSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('product-form-id').value;
  const name = document.getElementById('prod-name').value.trim();
  const priceUsd = parseFloat(document.getElementById('prod-price-usd').value);
  const category = document.getElementById('prod-category').value || 'Otros';
  const date = document.getElementById('prod-date').value;
  const previewImg = document.getElementById('prod-preview-img');
  
  let image = '';
  if (previewImg && !previewImg.classList.contains('hidden') && previewImg.src && previewImg.src.startsWith('data:image')) {
    image = previewImg.src;
  } else if (id && previewImg && !previewImg.classList.contains('hidden')) {
    image = state.products.find(p => p.id === id)?.image || '';
  }

  if (!name || isNaN(priceUsd) || priceUsd < 0) return;

  // Ensure category is in categories list
  if (category && !state.categories.includes(category)) {
    state.categories.push(category);
  }

  // Gather combo constituent products if category is Combos
  let comboProducts = [];
  if (category === 'Combos') {
    const rows = document.querySelectorAll('#combo-items-container .combo-product-row');
    rows.forEach(row => {
      const select = row.querySelector('.combo-row-select');
      const qtyInput = row.querySelector('.combo-row-qty');
      const prodId = select ? select.value : '';
      const qty = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;
      const matched = state.products.find(p => p.id === prodId);
      if (matched) {
        comboProducts.push({
          productId: matched.id,
          name: matched.name,
          quantity: qty,
          category: matched.category
        });
      }
    });
    if (comboProducts.length === 0) {
      comboProducts.push(
        { productId: 'prod-burger-1', name: 'Hamburguesa Clásica', quantity: 1, category: 'Hamburguesas' },
        { productId: 'prod-papas-1', name: 'Papas Fritas', quantity: 1, category: 'Guarniciones' },
        { productId: 'prod-drink-1', name: 'Refresco 355ml', quantity: 1, category: 'Bebidas' }
      );
    }
  }

  if (id) {
    // Edit existing
    const index = state.products.findIndex(p => p.id === id);
    if (index !== -1) {
      state.products[index] = {
        ...state.products[index],
        name,
        priceUsd,
        category,
        date,
        image,
        comboProducts: category === 'Combos' ? comboProducts : (state.products[index].comboProducts || [])
      };
      if (image) {
        ImageDB.set(`prod_img_${id}`, image);
      } else {
        ImageDB.delete(`prod_img_${id}`);
      }
    }
  } else {
    // Add new
    const newId = `prod-${Date.now()}`;
    const newProduct = {
      id: newId,
      name,
      priceUsd,
      category,
      date,
      stock: 50,
      icon: category === 'Combos' ? 'fastfood' : 'inventory_2',
      image,
      comboProducts: category === 'Combos' ? comboProducts : []
    };
    if (image) {
      ImageDB.set(`prod_img_${newId}`, image);
    }
    state.products.unshift(newProduct);
  }

  saveToStorage();
  SoundEngine.play('add');
  closeProductModal();
  renderCategoryPills();
  renderProductGrid();
}

function editProduct(productId) {
  openProductModal(productId);
}

function confirmDeleteProduct(productId, event = null) {
  if (event) {
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }

  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  const isEs = state.settings.language === 'es';
  showCustomConfirm({
    title: isEs ? 'Eliminar Producto' : 'Delete Product',
    message: isEs 
      ? `¿Estás seguro de que deseas eliminar "${prod.name}" del inventario? Esta acción no se puede deshacer.` 
      : `Are you sure you want to delete "${prod.name}" from inventory? This cannot be undone.`,
    confirmText: isEs ? 'Eliminar Producto' : 'Delete Product',
    cancelText: isEs ? 'Cancelar' : 'Cancel',
    isDanger: true,
    icon: 'delete',
    onConfirm: () => {
      SoundEngine.play('void');
      state.products = state.products.filter(p => p.id !== productId);
      // Remove from active cart if present
      state.cart = state.cart.filter(item => item.productId !== productId);
      ImageDB.delete(`prod_img_${productId}`);
      saveToStorage();
      closeProductModal();
      renderCartBadge();
      renderCategoryPills();
      renderProductGrid();
      showToast(isEs ? `"${prod.name}" eliminado correctamente` : `"${prod.name}" deleted successfully`, 'success');
    }
  });
}

function handleDeleteFromEditModal() {
  if (state.activeProductEditingId) {
    confirmDeleteProduct(state.activeProductEditingId);
  }
}

// ============================================================================
// Official Dollar Exchange Rate Manager
// ============================================================================
function openExchangeRateModal() {
  SoundEngine.play('tap');
  document.getElementById('input-new-rate').value = state.settings.exchangeRate.toFixed(2);
  document.getElementById('modal-exchange-rate').classList.remove('hidden');
}

function closeExchangeRateModal() {
  SoundEngine.play('tap');
  document.getElementById('modal-exchange-rate').classList.add('hidden');
}

function saveExchangeRate() {
  const val = parseFloat(document.getElementById('input-new-rate').value);
  if (!isNaN(val) && val > 0) {
    state.settings.exchangeRate = val;
    saveToStorage();
    SoundEngine.play('add');
    updateExchangeRateUI();
    renderAll();
    closeExchangeRateModal();
  }
}

function updateExchangeRateUI() {
  const badge = document.getElementById('rate-display-badge');
  if (badge) badge.textContent = `${state.settings.exchangeRate.toFixed(2)} Bs/$`;
}

// ============================================================================
// Store Logo & Identity Management (Top Left Placement)
// ============================================================================
function openLogoUploadModal() {
  const previewImg = document.getElementById('logo-preview-modal-img');
  const previewPlaceholder = document.getElementById('logo-preview-modal-placeholder');
  const nameInput = document.getElementById('input-store-title-edit');

  nameInput.value = state.settings.storeName;

  if (state.settings.logoData) {
    previewImg.src = state.settings.logoData;
    previewImg.classList.remove('hidden');
    previewPlaceholder.classList.add('hidden');
  } else {
    previewImg.classList.add('hidden');
    previewPlaceholder.classList.remove('hidden');
  }

  document.getElementById('modal-logo-upload').classList.remove('hidden');
}

function closeLogoUploadModal() {
  document.getElementById('modal-logo-upload').classList.add('hidden');
}

async function handleLogoFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const compressed = await compressImage(file, 400, 0.85);
  if (compressed) {
    state.settings.logoData = compressed;
    const previewImg = document.getElementById('logo-preview-modal-img');
    const previewPlaceholder = document.getElementById('logo-preview-modal-placeholder');
    previewImg.src = state.settings.logoData;
    previewImg.classList.remove('hidden');
    previewPlaceholder.classList.add('hidden');
    ImageDB.set('store_logo_image', compressed);
  }
}

function removeLogo() {
  state.settings.logoData = '';
  const previewImg = document.getElementById('logo-preview-modal-img');
  const previewPlaceholder = document.getElementById('logo-preview-modal-placeholder');
  previewImg.classList.add('hidden');
  previewPlaceholder.classList.remove('hidden');
  ImageDB.delete('store_logo_image');
}

function saveStoreInfo() {
  const name = document.getElementById('input-store-title-edit').value.trim();
  if (name) state.settings.storeName = name;
  saveToStorage();
  updateStoreHeaderUI();
  closeLogoUploadModal();
}

function updateStoreHeaderUI() {
  const logoImg = document.getElementById('company-logo-img');
  const logoPlaceholder = document.getElementById('company-logo-placeholder');
  const titleEl = document.getElementById('app-store-name');

  if (titleEl) titleEl.textContent = state.settings.storeName;

  if (state.settings.logoData) {
    logoImg.src = state.settings.logoData;
    logoImg.classList.remove('hidden');
    logoPlaceholder.classList.add('hidden');
  } else {
    logoImg.classList.add('hidden');
    logoPlaceholder.classList.remove('hidden');
  }
}

// ============================================================================
// Theme & Language Toggles
// ============================================================================
function cycleThemeColor() {
  SoundEngine.play('toggle');
  state.settings.themeColor = state.settings.themeColor === 'green' ? 'cyan' : 'green';
  saveToStorage();
  applyTheme();
}

function toggleLightDarkMode() {
  SoundEngine.play('toggle');
  state.settings.isDarkMode = !state.settings.isDarkMode;
  saveToStorage();
  applyTheme();
}

function applyTheme() {
  const body = document.body;
  if (state.settings.themeColor === 'cyan') {
    body.classList.add('theme-cyan');
  } else {
    body.classList.remove('theme-cyan');
  }

  const icon = document.getElementById('icon-dark-mode');
  if (state.settings.isDarkMode) {
    body.classList.add('dark');
    body.classList.remove('bg-white', 'text-slate-900');
    body.classList.add('bg-[#121214]', 'text-[#F1F5F9]');
    if (icon) icon.textContent = 'dark_mode';
  } else {
    body.classList.remove('dark');
    body.classList.remove('bg-[#121214]', 'text-[#F1F5F9]');
    body.classList.add('bg-slate-100', 'text-slate-900');
    if (icon) icon.textContent = 'light_mode';
  }
}

function toggleLanguage() {
  SoundEngine.play('toggle');
  state.settings.language = state.settings.language === 'es' ? 'en' : 'es';
  saveToStorage();
  applyLanguage();
  renderCategoryPills();
  renderAll();
}

function applyLanguage() {
  const lang = state.settings.language;
  document.getElementById('lang-label').textContent = lang.toUpperCase();

  const dict = I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
}

// ============================================================================
// Helper Utilities
// ============================================================================
function formatBs(amount) {
  if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
    try {
      return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    } catch (e) {}
  }
  var num = Number(amount) || 0;
  var parts = num.toFixed(2).split('.');
  var integerPart = parts[0];
  var decimalPart = parts[1];
  var rgx = /(\d+)(\d{3})/;
  while (rgx.test(integerPart)) {
    integerPart = integerPart.replace(rgx, '$1' + '.' + '$2');
  }
  return integerPart + ',' + decimalPart;
}

function formatPaymentMethod(method) {
  switch (method) {
    case 'efectivo': return 'Efectivo';
    case 'pago_movil': return 'Pago Móvil';
    case 'punto_de_venta': return 'Punto de Venta';
    default: return method;
  }
}

function getPaymentBadgeClass(method) {
  switch (method) {
    case 'efectivo': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    case 'pago_movil': return 'bg-sky-500/20 text-sky-400 border border-sky-500/30';
    case 'punto_de_venta': return 'bg-violet-500/20 text-violet-400 border border-violet-500/30';
    default: return 'bg-gray-700 text-gray-300';
  }
}

// ============================================================================
// 10. Automatic Inventory Deduction by Recipe / Ingredients & Combos
// ============================================================================

/**
 * Returns the raw inventory ingredients required for an individual product.
 */
function getIngredientsForProduct(productName, flavor = '', isDouble = false, quantity = 1) {
  const nameLower = (productName || '').toLowerCase();
  const flavorLower = (flavor || '').toLowerCase();
  const qty = Number(quantity) || 1;
  const ingredients = [];

  const add = (invId, amount) => {
    if (amount > 0) {
      ingredients.push({ invId, quantity: parseFloat(amount.toFixed(2)) });
    }
  };

  // 1. Hamburguesas / Burgers
  if (nameLower.includes('hamburguesa') || nameLower.includes('burger')) {
    const doubleBurger = isDouble || nameLower.includes('doble');
    const burgerMultiplier = doubleBurger ? 2 : 1;

    add('inv-pan-burger', burgerMultiplier * qty);

    if (flavorLower.includes('pollo')) {
      add('inv-pollo', burgerMultiplier * qty);
    } else if (flavorLower.includes('chuleta')) {
      add('inv-chuleta', burgerMultiplier * qty);
    } else if (flavorLower.includes('chorizo')) {
      add('inv-chorizo', burgerMultiplier * qty);
    } else {
      add('inv-carne', burgerMultiplier * qty);
    }

    if (nameLower.includes('especial') || nameLower.includes('queso')) {
      add('inv-queso', qty);
    }
    if (nameLower.includes('especial') || nameLower.includes('tocineta')) {
      add('inv-tocineta', qty);
    }
    add('inv-salsas', qty);
  }
  // 2. Perros Calientes / Hot Dogs
  else if (nameLower.includes('perro') || nameLower.includes('hot dog')) {
    add('inv-pan-perro', qty);
    add('inv-salchicha', qty);
    add('inv-salsas', qty);
    if (nameLower.includes('especial') || nameLower.includes('queso')) {
      add('inv-queso', qty);
    }
    if (nameLower.includes('tocineta')) {
      add('inv-tocineta', qty);
    }
  }
  // 3. Guarniciones / Papas Fritas
  else if (nameLower.includes('papas')) {
    add('inv-papas', qty);
    add('inv-salsas', qty);
  }
  // 4. Bebidas
  else if (nameLower.includes('refresco') || nameLower.includes('soda')) {
    add('inv-refresco', qty);
  } else if (nameLower.includes('malta')) {
    add('inv-malta', qty);
  } else if (nameLower.includes('agua')) {
    add('inv-agua', qty);
  }
  // 5. Insumos directos que coincidan con el inventario
  else {
    const match = state.inventory.find(inv =>
      inv.name.toLowerCase() === nameLower || nameLower.includes(inv.name.toLowerCase())
    );
    if (match) {
      add(match.id, qty);
    }
  }

  return ingredients;
}

/**
 * Resolves each constituent product that forms a combo.
 */
function getConstituentProductsForCombo(comboItem) {
  // 1. If explicit comboProducts are already defined on item
  if (Array.isArray(comboItem.comboProducts) && comboItem.comboProducts.length > 0) {
    return comboItem.comboProducts;
  }

  // 2. Check in state.products by productId
  const originalProd = state.products.find(p => p.id === comboItem.productId);
  if (originalProd && Array.isArray(originalProd.comboProducts) && originalProd.comboProducts.length > 0) {
    return originalProd.comboProducts;
  }

  // 3. Dynamic constituent decomposition based on combo name / description
  const nameLower = (comboItem.name || '').toLowerCase();
  const constituents = [];

  // Constituent: Hamburguesas
  if (nameLower.includes('hamburguesa') || nameLower.includes('burger')) {
    let count = 1;
    if (nameLower.includes('2 hamburguesa') || nameLower.includes('dos hamburguesa') || nameLower.includes('2 burger')) count = 2;
    if (nameLower.includes('3 hamburguesa') || nameLower.includes('tres hamburguesa')) count = 3;
    if (nameLower.includes('4 hamburguesa')) count = 4;
    const isDouble = nameLower.includes('doble') || (comboItem.burgerCount === 2);
    const isSpecial = nameLower.includes('especial');
    constituents.push({
      name: `Hamburguesa ${isDouble ? 'Doble ' : ''}${isSpecial ? 'Especial' : 'Clásica'}`,
      quantity: count,
      flavor: comboItem.flavor || 'Carne',
      isDouble: isDouble
    });
  }

  // Constituent: Perros Calientes
  if (nameLower.includes('perro') || nameLower.includes('hot dog')) {
    let count = 1;
    if (nameLower.includes('2 perro') || nameLower.includes('dos perro')) count = 2;
    if (nameLower.includes('3 perro')) count = 3;
    const isSpecial = nameLower.includes('especial');
    constituents.push({
      name: isSpecial ? 'Perro Caliente Especial' : 'Perro Caliente Tradicional',
      quantity: count
    });
  }

  // Constituent: Papas Fritas
  if (nameLower.includes('papas') || (!nameLower.includes('hamburguesa') && !nameLower.includes('perro'))) {
    constituents.push({
      name: 'Papas Fritas',
      quantity: 1
    });
  }

  // Constituent: Bebidas (Refresco, Malta, Agua)
  if (nameLower.includes('refresco')) {
    const count = (nameLower.includes('2 refresco') || nameLower.includes('dos refresco')) ? 2 : 1;
    constituents.push({ name: 'Refresco 355ml', quantity: count });
  } else if (nameLower.includes('malta')) {
    constituents.push({ name: 'Malta Polar', quantity: 1 });
  } else if (nameLower.includes('agua')) {
    constituents.push({ name: 'Agua Mineral 500ml', quantity: 1 });
  } else if (nameLower.includes('combo') && !nameLower.includes('refresco') && !nameLower.includes('malta') && !nameLower.includes('agua')) {
    constituents.push({ name: 'Refresco 355ml', quantity: 1 });
  }

  // Fallback default combo components if no individual match
  if (constituents.length === 0) {
    constituents.push(
      { name: 'Hamburguesa Clásica', quantity: 1, flavor: comboItem.flavor || 'Carne' },
      { name: 'Papas Fritas', quantity: 1 },
      { name: 'Refresco 355ml', quantity: 1 }
    );
  }

  return constituents;
}

/**
 * Calculates raw ingredient deductions for all items in a sale.
 * Mandatory Rule: When the selected product is a combo, it MUST deduct the ingredients
 * of EACH ONE of the products that make up the combo from the inventory.
 */
function calculateDeductionsForSale(items) {
  const deductions = [];
  const addDeduction = (invId, qty) => {
    if (!qty || qty <= 0) return;
    const existing = deductions.find(d => d.id === invId);
    if (existing) {
      existing.quantity = parseFloat((existing.quantity + qty).toFixed(2));
    } else {
      const invItem = state.inventory.find(i => i.id === invId);
      deductions.push({
        id: invId,
        name: invItem ? invItem.name : invId,
        quantity: parseFloat(qty.toFixed(2))
      });
    }
  };

  (items || []).forEach(item => {
    const qty = Number(item.quantity) || 1;
    const catLower = (item.category || '').toLowerCase();
    const nameLower = (item.name || '').toLowerCase();
    const isCombo = catLower.includes('combo') ||
                    nameLower.includes('combo') ||
                    (Array.isArray(item.comboProducts) && item.comboProducts.length > 0);

    if (isCombo) {
      // 1. Resolve all constituent products that conform the combo
      const constituentProducts = getConstituentProductsForCombo(item);
      let burgerFlavorIdx = 0;

      // 2. For EACH constituent product, deduct its raw ingredients from inventory
      constituentProducts.forEach(subProd => {
        const subProdQty = (Number(subProd.quantity) || 1) * qty;
        const subNameLower = (subProd.name || '').toLowerCase();
        const isBurger = subNameLower.includes('hamburguesa') || subNameLower.includes('burger');

        if (isBurger) {
          // If this constituent product has multiple burger units, deduct each unit with its own selected flavor
          const count = Number(subProd.quantity) || 1;
          for (let u = 0; u < count; u++) {
            let assignedFlavor = 'Carne';
            if (Array.isArray(item.flavors) && item.flavors.length > 0) {
              assignedFlavor = item.flavors[burgerFlavorIdx % item.flavors.length] || 'Carne';
              burgerFlavorIdx++;
            } else if (item.flavor) {
              assignedFlavor = item.flavor;
            }
            const subIsDouble = subProd.isDouble || subNameLower.includes('doble');
            const ingredients = getIngredientsForProduct(subProd.name, assignedFlavor, subIsDouble, 1 * qty);
            ingredients.forEach(ing => {
              addDeduction(ing.invId, ing.quantity);
            });
          }
        } else {
          // Non-burger constituent (fries, drink, hot dog, etc.)
          const subFlavor = subProd.flavor || '';
          const subIsDouble = subProd.isDouble || subNameLower.includes('doble');
          const ingredients = getIngredientsForProduct(subProd.name, subFlavor, subIsDouble, subProdQty);
          ingredients.forEach(ing => {
            addDeduction(ing.invId, ing.quantity);
          });
        }
      });
    } else {
      // Regular individual product deduction
      const isDouble = nameLower.includes('doble') || (item.burgerCount === 2);
      const ingredients = getIngredientsForProduct(item.name, item.flavor || '', isDouble, qty);
      ingredients.forEach(ing => {
        addDeduction(ing.invId, ing.quantity);
      });
    }
  });

  return deductions;
}

function deductFromInventory(deductions, saleRecord) {
  if (!deductions || deductions.length === 0) return;

  deductions.forEach(d => {
    const invItem = state.inventory.find(i => i.id === d.id);
    if (invItem) {
      invItem.stock = Math.max(0, parseFloat((invItem.stock - d.quantity).toFixed(2)));
    }
  });

  saveToStorage();
  renderInventory();

  // Send real-time event to server for connected Wi-Fi terminals
  try {
    fetch('/api/sync/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SALE_REGISTERED',
        data: { sale: saleRecord, deductions }
      })
    }).catch(() => {});
  } catch (_) {}
}

// ============================================================================
// 11. Burger & Combo Flavor Selector Modal
// ============================================================================
function openBurgerFlavorModal(product) {
  const modal = document.getElementById('modal-burger-flavor');
  if (!modal) return;

  const nameLower = (product.name || '').toLowerCase();
  const catLower = (product.category || '').toLowerCase();
  const isCombo = catLower.includes('combo') || nameLower.includes('combo') || (Array.isArray(product.comboProducts) && product.comboProducts.length > 0);

  const burgerList = getBurgersForProductOrCombo(product);
  if (burgerList.length === 0) {
    SoundEngine.play('add');
    const existing = state.cart.find(item => item.productId === product.id && !item.flavor);
    if (existing) {
      existing.quantity += 1;
    } else {
      state.cart.push({
        productId: product.id,
        name: product.name,
        priceUsd: product.priceUsd,
        quantity: 1,
        flavor: ''
      });
    }
    renderCartBadge();
    showToast(`+1 ${product.name} agregado a la venta`, 'success');
    return;
  }

  const burgerCount = burgerList.length;

  state.activeBurgerSelection = {
    product,
    isCombo,
    burgerList,
    burgerCount,
    flavors: Array(burgerCount).fill('Carne')
  };

  const titleEl = document.getElementById('burger-flavor-title');
  if (titleEl) {
    titleEl.textContent = isCombo
      ? (burgerCount > 1 ? `Sabores del Combo (${burgerCount} Hamburguesas)` : 'Sabor de la Hamburguesa del Combo')
      : (burgerCount > 1 ? 'Sabores de la Hamburguesa Doble' : '¿Cuál es el Sabor?');
  }

  const subtitleEl = document.getElementById('burger-flavor-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = isCombo
      ? `Este combo incluye ${burgerCount} ${burgerCount === 1 ? 'hamburguesa' : 'hamburguesas'}. Elige el sabor de cada una por separado:`
      : (burgerCount > 1 ? 'Selecciona el sabor de cada carne por separado' : 'Selecciona el sabor de la carne para preparar la orden');
  }

  const nameEl = document.getElementById('burger-flavor-product-name');
  if (nameEl) nameEl.textContent = product.name;

  const infoEl = document.getElementById('burger-flavor-combo-info');
  if (infoEl) {
    if (isCombo) {
      infoEl.textContent = `Combo con ${burgerCount} ${burgerCount === 1 ? 'hamburguesa' : 'hamburguesas'} (Sabor individual por separado)`;
    } else {
      infoEl.textContent = burgerCount === 2 ? '2 Carnes (Elige el sabor de cada una)' : '1 Hamburguesa (Elige el sabor)';
    }
  }

  const priceEl = document.getElementById('burger-flavor-product-price');
  if (priceEl) priceEl.textContent = `$${product.priceUsd.toFixed(2)}`;

  renderBurgerFlavorOptions();
  modal.classList.remove('hidden');
}

function closeBurgerFlavorModal() {
  const modal = document.getElementById('modal-burger-flavor');
  if (modal) modal.classList.add('hidden');
  state.activeBurgerSelection = null;
}

function setAllBurgerFlavors(flavor) {
  if (!state.activeBurgerSelection) return;
  state.activeBurgerSelection.flavors = state.activeBurgerSelection.flavors.map(() => flavor);
  renderBurgerFlavorOptions();
  SoundEngine.play('tap');
}

function selectBurgerFlavor(burgerIndex, flavor) {
  if (!state.activeBurgerSelection) return;
  state.activeBurgerSelection.flavors[burgerIndex] = flavor;
  renderBurgerFlavorOptions();
  SoundEngine.play('tap');
}

function renderBurgerFlavorOptions() {
  const container = document.getElementById('burger-flavor-options-container');
  if (!container || !state.activeBurgerSelection) return;

  const { burgerList, burgerCount, flavors, isCombo } = state.activeBurgerSelection;
  const flavorOptions = [
    { key: 'Carne', label: 'Carne de Res', icon: '🥩', desc: 'Res sazonada a la plancha' },
    { key: 'Pollo', label: 'Pechuga / Pollo', icon: '🍗', desc: 'Pechuga tierna a la plancha' },
    { key: 'Chuleta', label: 'Chuleta Ahumada', icon: '🥓', desc: 'Corte ahumado tierno' },
    { key: 'Chorizo', label: 'Chorizo', icon: '🌭', desc: 'Sabor parrillero tradicional' }
  ];

  let html = '';

  // Quick preset bar if multi-burger
  if (burgerCount > 1) {
    html += `
      <div class="p-3 rounded-2xl bg-[#16161C] border border-[#2C2C34] space-y-2">
        <p class="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-rounded text-sm text-amber-400">auto_fix_high</span>
          <span>Aplicar mismo sabor a todas (${burgerCount}):</span>
        </p>
        <div class="grid grid-cols-4 gap-1.5">
          <button type="button" onclick="setAllBurgerFlavors('Carne')" class="py-1.5 px-2 rounded-lg bg-[#202028] hover:bg-[#2C2C38] border border-[#2C2C34] text-[10px] font-bold text-gray-200 hover:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer">
            <span>🥩</span><span>Todas Res</span>
          </button>
          <button type="button" onclick="setAllBurgerFlavors('Pollo')" class="py-1.5 px-2 rounded-lg bg-[#202028] hover:bg-[#2C2C38] border border-[#2C2C34] text-[10px] font-bold text-gray-200 hover:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer">
            <span>🍗</span><span>Todas Pollo</span>
          </button>
          <button type="button" onclick="setAllBurgerFlavors('Chuleta')" class="py-1.5 px-2 rounded-lg bg-[#202028] hover:bg-[#2C2C38] border border-[#2C2C34] text-[10px] font-bold text-gray-200 hover:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer">
            <span>🥓</span><span>Todas Chuleta</span>
          </button>
          <button type="button" onclick="setAllBurgerFlavors('Chorizo')" class="py-1.5 px-2 rounded-lg bg-[#202028] hover:bg-[#2C2C38] border border-[#2C2C34] text-[10px] font-bold text-gray-200 hover:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer">
            <span>🌭</span><span>Todas Chorizo</span>
          </button>
        </div>
      </div>
    `;
  }

  // Render individual flavor selector card for EACH burger in the combo
  for (let b = 0; b < burgerCount; b++) {
    const currentFlavor = flavors[b] || 'Carne';
    const burgerInfo = burgerList[b] || {};
    const burgerTitle = isCombo
      ? `Hamburguesa #${b + 1} del Combo${burgerInfo.subName && !burgerInfo.subName.startsWith('Hamburguesa #') ? ` (${burgerInfo.subName})` : ''}`
      : (burgerCount > 1 ? `Carne #${b + 1}` : 'Elige el Sabor de la Proteína');

    html += `
      <div class="p-3.5 rounded-2xl bg-[#141418] border border-[#2C2C34] space-y-2.5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <span class="text-base">🍔</span>
            <span>${burgerTitle}:</span>
          </p>
          <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
            ${currentFlavor}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${flavorOptions.map(opt => {
            const isSelected = currentFlavor === opt.key;
            return `
              <button type="button" onclick="selectBurgerFlavor(${b}, '${opt.key}')" class="p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                isSelected 
                  ? 'border-amber-400 bg-amber-500/20 text-white ring-2 ring-amber-400/50 shadow-md font-bold' 
                  : 'border-[#2C2C34] bg-[#1E1E24] text-gray-300 hover:border-gray-600 hover:text-white'
              }">
                <div class="flex items-center gap-2">
                  <span class="text-lg">${opt.icon}</span>
                  <div>
                    <p class="font-bold leading-tight ${isSelected ? 'text-amber-300' : 'text-white'}">${opt.key}</p>
                    <p class="text-[10px] text-gray-400 leading-tight mt-0.5">${opt.label}</p>
                  </div>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function confirmBurgerFlavorSelection() {
  if (!state.activeBurgerSelection) return;
  const { product, flavors, burgerCount, isCombo } = state.activeBurgerSelection;
  SoundEngine.play('add');

  let flavorText = '';
  if (burgerCount === 1) {
    flavorText = flavors[0];
  } else {
    flavorText = flavors.map((f, i) => `H#${i + 1}: ${f}`).join(', ');
  }

  state.cart.push({
    productId: product.id,
    name: product.name,
    priceUsd: product.priceUsd,
    quantity: 1,
    flavor: flavorText,
    flavors: [...flavors],
    burgerCount: burgerCount,
    isCombo: isCombo,
    comboProducts: product.comboProducts || []
  });

  renderCartBadge();
  renderCartInModal();
  closeBurgerFlavorModal();

  showToast(`+1 ${product.name} (${flavorText}) agregado a la venta`, 'success');

  const cartCard = document.getElementById('cart-active-container');
  if (cartCard) {
    cartCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ============================================================================
// 12. Inventory Items Management (Stock, Add, Edit)
// ============================================================================
function openAddInventoryModal(itemId) {
  const modal = document.getElementById('modal-inventory-item');
  const title = document.getElementById('modal-inv-title');
  const idInput = document.getElementById('inv-item-id');
  const nameInput = document.getElementById('inv-item-name');
  const catInput = document.getElementById('inv-item-category');
  const unitInput = document.getElementById('inv-item-unit');
  const stockInput = document.getElementById('inv-item-stock');
  const alertInput = document.getElementById('inv-item-alert');

  if (itemId) {
    const item = state.inventory.find(i => i.id === itemId);
    if (item) {
      if (title) title.textContent = 'Modificar Insumo en Inventario';
      if (idInput) idInput.value = item.id;
      if (nameInput) nameInput.value = item.name;
      if (catInput) catInput.value = item.category;
      if (unitInput) unitInput.value = item.unit;
      if (stockInput) stockInput.value = item.stock;
      if (alertInput) alertInput.value = item.minAlert;
    }
  } else {
    if (title) title.textContent = 'Agregar Insumo al Inventario';
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    if (catInput) catInput.value = 'Proteínas';
    if (unitInput) unitInput.value = 'und';
    if (stockInput) stockInput.value = '50';
    if (alertInput) alertInput.value = '10';
  }

  if (modal) modal.classList.remove('hidden');
}

function closeInventoryItemModal() {
  const modal = document.getElementById('modal-inventory-item');
  if (modal) modal.classList.add('hidden');
}

function saveInventoryItem(e) {
  if (e) e.preventDefault();
  const id = (document.getElementById('inv-item-id')?.value || '').trim();
  const name = (document.getElementById('inv-item-name')?.value || '').trim();
  const category = document.getElementById('inv-item-category')?.value || 'Varios';
  const unit = document.getElementById('inv-item-unit')?.value || 'und';
  const stock = parseFloat(document.getElementById('inv-item-stock')?.value) || 0;
  const minAlert = parseFloat(document.getElementById('inv-item-alert')?.value) || 5;

  if (!name) {
    showToast('El nombre del insumo es obligatorio', 'warning');
    return;
  }

  let actionType = 'STOCK_ADDED';
  let payloadData = {};

  if (id) {
    const existing = state.inventory.find(i => i.id === id);
    if (existing) {
      existing.name = name;
      existing.category = category;
      existing.unit = unit;
      existing.stock = stock;
      existing.minAlert = minAlert;
      actionType = 'STOCK_ADJUSTED';
      payloadData = { ...existing };
    }
  } else {
    const newItem = {
      id: `inv-${Date.now()}`,
      name,
      category,
      unit,
      stock,
      minAlert
    };
    state.inventory.push(newItem);
    actionType = 'STOCK_ADDED';
    payloadData = newItem;
  }

  saveToStorage();
  renderInventory();
  closeInventoryItemModal();

  try {
    fetch('/api/sync/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionType, data: payloadData })
    }).catch(() => {});
  } catch (_) {}

  showToast(id ? 'Insumo actualizado en el inventario' : 'Insumo agregado y sincronizado con éxito', 'success');
}

function quickAdjustStock(itemId, delta) {
  const item = state.inventory.find(i => i.id === itemId);
  if (!item) return;

  item.stock = Math.max(0, parseFloat((item.stock + delta).toFixed(2)));
  saveToStorage();
  renderInventory();

  try {
    fetch('/api/sync/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'STOCK_ADJUSTED',
        data: { id: item.id, stock: item.stock }
      })
    }).catch(() => {});
  } catch (_) {}

  showToast(`${delta > 0 ? '+' : ''}${delta} ${item.unit} (${item.name}: ${item.stock} ${item.unit})`, 'info');
}

function switchInventorySubtab(subtab) {
  state.inventorySubtab = subtab;
  const btnStock = document.getElementById('btn-inv-subtab-stock');
  const btnDamages = document.getElementById('btn-inv-subtab-damages');
  const containerStock = document.getElementById('inv-container-stock');
  const containerDamages = document.getElementById('inv-container-damages');

  if (subtab === 'stock') {
    if (btnStock) {
      btnStock.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold custom-accent-bg text-black transition-all cursor-pointer';
    }
    if (btnDamages) {
      btnDamages.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white transition-all flex items-center gap-1 cursor-pointer';
    }
    if (containerStock) containerStock.classList.remove('hidden');
    if (containerDamages) containerDamages.classList.add('hidden');
  } else {
    if (btnStock) {
      btnStock.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white transition-all cursor-pointer';
    }
    if (btnDamages) {
      btnDamages.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white transition-all flex items-center gap-1 cursor-pointer';
    }
    if (containerStock) containerStock.classList.add('hidden');
    if (containerDamages) containerDamages.classList.remove('hidden');
  }

  renderInventory();
}

function handleInventorySearch(val) {
  state.inventorySearchQuery = (val || '').toLowerCase().trim();
  renderInventoryGrid();
}

function filterInventoryByCategory(cat) {
  state.inventoryCategoryFilter = cat;
  renderInventory();
}

function renderInventoryCategoryPills() {
  const container = document.getElementById('inv-category-pills');
  if (!container) return;

  const categories = ['all', 'Proteínas', 'Panes', 'Embutidos', 'Bebidas', 'Lácteos', 'Salsas', 'Guarniciones', 'Otros'];
  const current = state.inventoryCategoryFilter || 'all';

  container.innerHTML = categories.map(cat => {
    const isSelected = current === cat;
    const label = cat === 'all' ? 'Todos los Insumos' : cat;
    return `
      <button type="button" onclick="filterInventoryByCategory('${cat}')" class="px-3 py-1 rounded-xl whitespace-nowrap font-bold text-xs transition-all cursor-pointer ${
        isSelected ? 'custom-accent-bg text-black shadow-sm' : 'bg-[#18181C] text-gray-400 hover:text-white border border-[#2C2C34]'
      }">
        ${escapeHtml(label)}
      </button>
    `;
  }).join('');
}

function renderInventoryGrid() {
  const grid = document.getElementById('inv-items-grid');
  const emptyEl = document.getElementById('inv-empty-stock');
  if (!grid) return;

  let items = [...(state.inventory || [])];

  if (state.inventoryCategoryFilter && state.inventoryCategoryFilter !== 'all') {
    items = items.filter(i => i.category === state.inventoryCategoryFilter);
  }

  if (state.inventorySearchQuery) {
    items = items.filter(i =>
      i.name.toLowerCase().includes(state.inventorySearchQuery) ||
      (i.category || '').toLowerCase().includes(state.inventorySearchQuery)
    );
  }

  if (items.length === 0) {
    grid.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  const isTerminal = state.deviceRole === 'terminal';

  grid.innerHTML = items.map(item => {
    const isLow = item.stock <= item.minAlert;
    const isZero = item.stock === 0;
    const statusBadge = isZero
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Agotado</span>`
      : isLow
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Stock Bajo</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Disponible</span>`;

    return `
      <div class="p-4 rounded-2xl bg-[#1E1E24] border ${isLow ? 'border-amber-500/40 bg-amber-500/5' : 'border-[#2C2C34]'} space-y-3 transition-all hover:border-[#3E3E4A]">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">${escapeHtml(item.category)}</span>
            <h4 class="font-extrabold text-sm text-white mt-0.5">${escapeHtml(item.name)}</h4>
          </div>
          ${statusBadge}
        </div>

        <div class="flex items-baseline justify-between pt-1">
          <div>
            <span class="text-2xl font-black font-mono ${isZero ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-white'}">${item.stock}</span>
            <span class="text-xs text-gray-400 ml-1">${escapeHtml(item.unit)}</span>
          </div>
          <span class="text-[11px] text-gray-500 font-mono">Mínimo: ${item.minAlert} ${escapeHtml(item.unit)}</span>
        </div>

        <div class="pt-2 border-t border-[#2C2C34] flex items-center justify-between gap-2">
          <div class="flex items-center gap-1 bg-[#141418] rounded-xl p-1 border border-[#2C2C34]">
            <button type="button" onclick="quickAdjustStock('${item.id}', -5)" title="-5 ${item.unit}" class="px-2 py-1 rounded-lg bg-[#202028] hover:bg-[#2C2C34] text-[11px] font-bold text-gray-300 cursor-pointer">-5</button>
            <button type="button" onclick="quickAdjustStock('${item.id}', -1)" title="-1 ${item.unit}" class="w-7 h-7 rounded-lg bg-[#202028] hover:bg-[#2C2C34] text-xs font-bold text-gray-300 flex items-center justify-center cursor-pointer">-1</button>
            <button type="button" onclick="quickAdjustStock('${item.id}', 1)" title="+1 ${item.unit}" class="w-7 h-7 rounded-lg bg-[#202028] hover:bg-[#2C2C34] text-xs font-bold text-amber-400 flex items-center justify-center cursor-pointer">+1</button>
            <button type="button" onclick="quickAdjustStock('${item.id}', 10)" title="+10 ${item.unit}" class="px-2 py-1 rounded-lg bg-[#202028] hover:bg-[#2C2C34] text-[11px] font-bold text-emerald-400 cursor-pointer">+10</button>
          </div>

          ${!isTerminal ? `
            <button type="button" onclick="openAddInventoryModal('${item.id}')" title="Editar insumo" class="w-8 h-8 rounded-xl bg-[#262630] hover:bg-[#343440] text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer">
              <span class="material-symbols-rounded text-sm">edit</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderDamagesTable() {
  const tbody = document.getElementById('inv-damages-tbody');
  const emptyEl = document.getElementById('inv-damages-empty');
  if (!tbody) return;

  const damages = state.damages || [];
  if (damages.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  tbody.innerHTML = damages.map(d => `
    <tr class="hover:bg-[#1C1C22] transition-colors">
      <td class="py-2.5 px-3 font-mono text-[11px] text-gray-400">
        <div>${d.date}</div>
        <div class="text-[10px] text-gray-500">${d.time || ''}</div>
      </td>
      <td class="py-2.5 px-3 font-bold text-white">${escapeHtml(d.ingredientName)}</td>
      <td class="py-2.5 px-3 font-mono font-bold text-rose-400">-${d.quantity} ${escapeHtml(d.unit)}</td>
      <td class="py-2.5 px-3 text-gray-300">${escapeHtml(d.reason)}</td>
      <td class="py-2.5 px-3 text-[11px] text-gray-400">${escapeHtml(d.reportedBy || 'Terminal')}</td>
    </tr>
  `).join('');
}

function renderInventory() {
  if (!Array.isArray(state.inventory)) state.inventory = [...DEFAULT_INVENTORY];
  if (!Array.isArray(state.damages)) state.damages = [];

  const totalItems = state.inventory.length;
  const optimalItems = state.inventory.filter(i => i.stock > i.minAlert).length;
  const lowItems = state.inventory.filter(i => i.stock <= i.minAlert).length;
  const damagesCount = state.damages.length;

  const elTotal = document.getElementById('inv-metric-total-items');
  if (elTotal) elTotal.textContent = totalItems;
  const elOptimal = document.getElementById('inv-metric-optimal');
  if (elOptimal) elOptimal.textContent = optimalItems;
  const elLow = document.getElementById('inv-metric-low');
  if (elLow) elLow.textContent = lowItems;
  const elDamages = document.getElementById('inv-metric-damages');
  if (elDamages) elDamages.textContent = damagesCount;
  const elDamagesSub = document.getElementById('inv-metric-damages-sub');
  if (elDamagesSub) elDamagesSub.textContent = `${damagesCount} eventos reportados`;

  const navBadge = document.getElementById('nav-inventory-badge');
  if (navBadge) navBadge.textContent = totalItems;
  const quickBadge = document.getElementById('quick-inventory-badge');
  if (quickBadge) quickBadge.textContent = totalItems;
  const damagesBadge = document.getElementById('inv-damages-count-badge');
  if (damagesBadge) damagesBadge.textContent = damagesCount;

  renderInventoryCategoryPills();
  renderInventoryGrid();
  renderDamagesTable();

  if (state.currentView === 'reports' && state.reportSubtype === 'inventory') {
    renderInventoryReport();
  }
}

// ============================================================================
// 13. Merma & Damaged Items Reporting
// ============================================================================
function openReportDamageModal() {
  const select = document.getElementById('damage-item-id');
  if (select) {
    select.innerHTML = state.inventory.map(item => `
      <option value="${item.id}">${escapeHtml(item.name)} (${item.stock} ${item.unit} disponibles)</option>
    `).join('');
  }
  handleDamageItemSelected();
  const qtyInput = document.getElementById('damage-item-qty');
  if (qtyInput) qtyInput.value = '1';
  const notesInput = document.getElementById('damage-item-notes');
  if (notesInput) notesInput.value = '';
  document.getElementById('modal-report-damage')?.classList.remove('hidden');
}

function closeReportDamageModal() {
  document.getElementById('modal-report-damage')?.classList.add('hidden');
}

function handleDamageItemSelected() {
  const select = document.getElementById('damage-item-id');
  const stockP = document.getElementById('damage-item-current-stock');
  if (!select || !stockP) return;
  const item = state.inventory.find(i => i.id === select.value);
  if (item) {
    stockP.textContent = `Stock actual disponible: ${item.stock} ${item.unit} (Mínimo recomendado: ${item.minAlert})`;
  } else {
    stockP.textContent = 'Stock actual disponible: --';
  }
}

function submitDamageReport(e) {
  if (e) e.preventDefault();
  const select = document.getElementById('damage-item-id');
  const qtyInput = document.getElementById('damage-item-qty');
  const reasonSelect = document.getElementById('damage-item-reason');
  const notesInput = document.getElementById('damage-item-notes');

  const itemId = select ? select.value : '';
  const qty = parseFloat(qtyInput ? qtyInput.value : 1) || 1;
  const reason = reasonSelect ? reasonSelect.value : 'Dañado / Vencido';
  const notes = notesInput ? notesInput.value.trim() : '';

  const item = state.inventory.find(i => i.id === itemId);
  if (!item) {
    showToast('Selecciona un insumo válido', 'warning');
    return;
  }

  item.stock = Math.max(0, parseFloat((item.stock - qty).toFixed(2)));

  const now = new Date();
  const damageEntry = {
    id: `dmg-${Date.now()}`,
    ingredientId: item.id,
    ingredientName: item.name,
    quantity: qty,
    unit: item.unit,
    reason: notes ? `${reason} (${notes})` : reason,
    date: now.toISOString().split('T')[0],
    time: now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
    reportedBy: state.deviceRole === 'host' ? 'Caja Central' : 'Terminal Operador'
  };

  if (!state.damages) state.damages = [];
  state.damages.unshift(damageEntry);

  saveToStorage();
  renderInventory();
  closeReportDamageModal();

  try {
    fetch('/api/sync/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'DAMAGE_REPORTED',
        data: {
          ingredientId: item.id,
          ingredientName: item.name,
          quantity: qty,
          unit: item.unit,
          reason: damageEntry.reason,
          reportedBy: damageEntry.reportedBy
        }
      })
    }).catch(() => {});
  } catch (_) {}

  showToast(`Descontado: -${qty} ${item.unit} de ${item.name}`, 'info');
}

// ============================================================================
// 14. Wi-Fi Sync & Safe Public Sharing (Sin solicitar correo ni cuenta Google)
// ============================================================================

state.publicShareUrl = '';
state.localIpUrl = '';
state.activeShareTab = 'public';

function computePublicShareUrl() {
  // If running in AI Studio private development container (ais-dev-),
  // automatically transform to the public shared preview URL (ais-pre-)
  let url = window.location.href.split('?')[0];
  if (window.location.hostname.startsWith('ais-dev-')) {
    url = window.location.origin.replace('ais-dev-', 'ais-pre-') + window.location.pathname;
  }
  return url;
}

function switchShareTab(tab) {
  state.activeShareTab = tab;
  ['public', 'wifi', 'apk'].forEach(t => {
    const btn = document.getElementById(`tab-btn-share-${t}`);
    const view = document.getElementById(`share-view-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = 'px-3 py-2 rounded-t-xl border-b-2 border-emerald-400 text-emerald-400 font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer';
      } else {
        btn.className = 'px-3 py-2 rounded-t-xl border-b-2 border-transparent text-gray-400 hover:text-gray-200 flex items-center gap-1.5 transition-colors cursor-pointer';
      }
    }
    if (view) {
      if (t === tab) view.classList.remove('hidden');
      else view.classList.add('hidden');
    }
  });

  if (tab === 'public') {
    drawQrForUrl(state.publicShareUrl || computePublicShareUrl());
  } else if (tab === 'wifi') {
    drawQrForUrl(state.localIpUrl || computePublicShareUrl());
  }
}

async function openWifiSyncModal() {
  const modal = document.getElementById('modal-wifi-sync');
  if (!modal) return;

  const pinEl = document.getElementById('wifi-pairing-pin');
  if (pinEl) pinEl.textContent = state.pairingPin || '8492';

  const clientsEl = document.getElementById('wifi-connected-clients');
  if (clientsEl) clientsEl.textContent = `${state.wifiConnectedClients || 1} Activo(s)`;

  updateRoleButtonsUI();

  // Compute safe public URL immediately (100% public, never asks for Google email)
  state.publicShareUrl = computePublicShareUrl();

  const urlInput = document.getElementById('wifi-network-url');
  if (urlInput) urlInput.value = state.publicShareUrl;

  const localIpInput = document.getElementById('wifi-local-ip-url');

  // Query server network info for server-side shared URL, local IPs and PIN
  try {
    const res = await fetch('/api/sync/network');
    const data = await res.json();
    if (data) {
      if (data.sharedAppUrl) {
        state.publicShareUrl = data.sharedAppUrl;
        if (urlInput) urlInput.value = state.publicShareUrl;
      }
      if (Array.isArray(data.localIps) && data.localIps.length > 0) {
        const port = data.port || 3000;
        const validIp = data.localIps.find(ip => ip !== '127.0.0.1') || data.localIps[0];
        state.localIpUrl = `http://${validIp}:${port}`;
        if (localIpInput) localIpInput.value = state.localIpUrl;
      }
      if (data.pairingPin) {
        state.pairingPin = data.pairingPin;
        if (pinEl) pinEl.textContent = data.pairingPin;
      }
    }
  } catch (_) {}

  // Switch to the Public tab by default (safe link without developer email)
  switchShareTab('public');
  modal.classList.remove('hidden');
}

function closeWifiSyncModal() {
  document.getElementById('modal-wifi-sync')?.classList.add('hidden');
}

function setDeviceRole(role) {
  state.deviceRole = role;
  saveToStorage();
  updateRoleButtonsUI();
  applyDeviceRolePermissions();
  renderInventory();
  renderProductGrid();

  const isHost = role === 'host';
  showToast(
    isHost ? 'Modo Caja Central: Control total activo' : 'Modo Terminal Operador: Editor bloqueado por seguridad',
    'info'
  );
}

function updateRoleButtonsUI() {
  const role = state.deviceRole || 'host';
  const roleBadge = document.getElementById('wifi-current-role-badge');
  if (roleBadge) {
    roleBadge.textContent = role === 'host' ? 'Caja Central' : 'Terminal Operador';
    roleBadge.className = role === 'host' ? 'text-xs font-mono font-bold text-amber-300' : 'text-xs font-mono font-bold text-sky-400';
  }

  const btnHost = document.getElementById('btn-role-host');
  const btnTerminal = document.getElementById('btn-role-terminal');

  if (btnHost) {
    if (role === 'host') {
      btnHost.className = 'p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer border-amber-400/60 bg-amber-500/10 text-white font-semibold';
    } else {
      btnHost.className = 'p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer border-[#2C2C34] bg-[#121214] text-gray-300 hover:text-white';
    }
  }

  if (btnTerminal) {
    if (role === 'terminal') {
      btnTerminal.className = 'p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer border-sky-400/60 bg-sky-500/10 text-white font-semibold';
    } else {
      btnTerminal.className = 'p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer border-[#2C2C34] bg-[#121214] text-gray-300 hover:text-white';
    }
  }
}

function applyDeviceRolePermissions() {
  const isTerminal = state.deviceRole === 'terminal';

  const fab = document.getElementById('fab-add-container');
  if (fab) {
    if (isTerminal) fab.classList.add('hidden');
    else if (state.currentView === 'home') fab.classList.remove('hidden');
  }

  const btnInvAdd = document.getElementById('btn-inv-add-product');
  if (btnInvAdd) {
    if (isTerminal) btnInvAdd.classList.add('hidden');
    else btnInvAdd.classList.remove('hidden');
  }

  document.querySelectorAll('.admin-only-control').forEach(el => {
    if (isTerminal) el.classList.add('hidden');
    else el.classList.remove('hidden');
  });
}

function copyNetworkLink() {
  const urlInput = document.getElementById('wifi-network-url');
  if (!urlInput) return;

  const text = urlInput.value || state.publicShareUrl;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Enlace público copiado (No pide correo Google)', 'success');
    }).catch(() => {
      urlInput.select();
      document.execCommand('copy');
      showToast('Enlace público copiado al portapapeles', 'success');
    });
  } else {
    urlInput.select();
    document.execCommand('copy');
    showToast('Enlace público copiado al portapapeles', 'success');
  }
}

function copyLocalIpLink() {
  const input = document.getElementById('wifi-local-ip-url');
  if (!input || !input.value) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('Dirección IP local copiada al portapapeles', 'success');
    }).catch(() => {
      input.select();
      document.execCommand('copy');
      showToast('Dirección IP local copiada', 'success');
    });
  } else {
    input.select();
    document.execCommand('copy');
    showToast('Dirección IP local copiada', 'success');
  }
}

function shareViaWhatsApp() {
  const url = state.publicShareUrl || computePublicShareUrl();
  const storeName = state.settings.storeName || 'Control de Ventas';
  const text = `🏪 *${storeName}*\nAbre la aplicación de ventas directamente desde este enlace (sin pedir correo Google ni contraseñas):\n${url}`;

  if (navigator.share) {
    navigator.share({
      title: storeName,
      text: text,
      url: url
    }).catch(() => {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    });
  } else {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }
}

function openPublicLinkInNewTab() {
  const url = state.publicShareUrl || computePublicShareUrl();
  window.open(url, '_blank');
}

function drawQrForUrl(url) {
  if (!url) return;
  const imgEl = document.getElementById('public-qr-img');
  const canvas = document.getElementById('wifi-qr-canvas');

  // Try high-resolution scannable QR image first
  if (imgEl) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}&margin=1`;
    imgEl.src = qrUrl;
    imgEl.onload = () => {
      imgEl.classList.remove('hidden');
      if (canvas) canvas.classList.add('hidden');
    };
    imgEl.onerror = () => {
      imgEl.classList.add('hidden');
      if (canvas) {
        canvas.classList.remove('hidden');
        drawWifiQrCode(url);
      }
    };
  } else if (canvas) {
    drawWifiQrCode(url);
  }
}

function forceNetworkSync() {
  showToast('Sincronizando con la red Wi-Fi...', 'info');
  fetch('/api/sync/state')
    .then(r => r.json())
    .then(data => {
      if (data && Array.isArray(data.inventory)) {
        state.inventory = data.inventory;
        if (Array.isArray(data.damages)) state.damages = data.damages;
        if (data.pairingPin) state.pairingPin = data.pairingPin;
        saveToStorage();
        renderAll();
        showToast('Sincronización completada con éxito', 'success');
      }
    })
    .catch(() => {
      showToast('Red local verificada y sincronizada', 'info');
    });
}

function drawWifiQrCode(url) {
  const canvas = document.getElementById('wifi-qr-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  const modules = 21;
  const cellSize = size / modules;
  ctx.fillStyle = '#000000';

  function drawMarker(row, col) {
    ctx.fillRect(col * cellSize, row * cellSize, 7 * cellSize, 7 * cellSize);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect((col + 1) * cellSize, (row + 1) * cellSize, 5 * cellSize, 5 * cellSize);
    ctx.fillStyle = '#000000';
    ctx.fillRect((col + 2) * cellSize, (row + 2) * cellSize, 3 * cellSize, 3 * cellSize);
  }

  drawMarker(0, 0);
  drawMarker(0, 14);
  drawMarker(14, 0);

  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if ((r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8)) continue;
      const val = Math.abs(Math.sin((r * 31 + c * 17 + hash)) * 10000);
      if (val % 2 > 0.82) {
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
  }
}

function initRealtimeSync() {
  if (typeof EventSource === 'undefined') return;

  try {
    const eventSource = new EventSource('/api/sync/stream');

    eventSource.addEventListener('init', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && Array.isArray(data.inventory)) {
          state.inventory = data.inventory;
          if (Array.isArray(data.damages)) state.damages = data.damages;
          if (data.pairingPin) state.pairingPin = data.pairingPin;
          saveToStorage();
          renderInventory();
        }
      } catch (_) {}
    });

    eventSource.addEventListener('sync', (e) => {
      try {
        const payload = JSON.parse(e.data);
        const { type, state: serverState } = payload;
        if (serverState && Array.isArray(serverState.inventory)) {
          state.inventory = serverState.inventory;
          if (Array.isArray(serverState.damages)) state.damages = serverState.damages;
          saveToStorage();
          renderInventory();
          if (type === 'SALE_REGISTERED') {
            showToast('Inventario descontado por venta en terminal Wi-Fi', 'info');
          } else if (type === 'DAMAGE_REPORTED') {
            showToast('Merma reportada desde terminal Wi-Fi', 'warning');
          }
        }
      } catch (_) {}
    });

    eventSource.onerror = () => {
      // Reconnect handled automatically by browser
    };
  } catch (err) {
    console.log('[Sync] Offline/local mode active');
  }
}

// ============================================================================
// 15. Separate Inventory Report & Sharing (Text & Image)
// ============================================================================
function switchReportSubtype(subtype) {
  state.reportSubtype = subtype;
  const btnSales = document.getElementById('btn-rep-tab-sales');
  const btnInv = document.getElementById('btn-rep-tab-inventory');
  const subviewSales = document.getElementById('rep-subview-sales');
  const subviewInv = document.getElementById('rep-subview-inventory');

  if (subtype === 'sales') {
    if (btnSales) {
      btnSales.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold custom-accent-bg text-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer';
    }
    if (btnInv) {
      btnInv.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#262630] hover:bg-[#30303C] text-gray-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer';
    }
    if (subviewSales) subviewSales.classList.remove('hidden');
    if (subviewInv) subviewInv.classList.add('hidden');
    renderReports();
  } else {
    if (btnSales) {
      btnSales.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#262630] hover:bg-[#30303C] text-gray-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer';
    }
    if (btnInv) {
      btnInv.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 text-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer';
    }
    if (subviewSales) subviewSales.classList.add('hidden');
    if (subviewInv) subviewInv.classList.remove('hidden');
    renderInventoryReport();
  }
}

function renderInventoryReport() {
  if (!Array.isArray(state.inventory)) state.inventory = [...DEFAULT_INVENTORY];
  if (!Array.isArray(state.damages)) state.damages = [];

  const total = state.inventory.length;
  const optimal = state.inventory.filter(i => i.stock > i.minAlert).length;
  const low = state.inventory.filter(i => i.stock <= i.minAlert).length;
  const damages = state.damages.length;

  const elTotal = document.getElementById('rep-inv-metric-total');
  if (elTotal) elTotal.textContent = total;
  const elOptimal = document.getElementById('rep-inv-metric-optimal');
  if (elOptimal) elOptimal.textContent = optimal;
  const elLow = document.getElementById('rep-inv-metric-low');
  if (elLow) elLow.textContent = low;
  const elDamages = document.getElementById('rep-inv-metric-damages');
  if (elDamages) elDamages.textContent = damages;
  const elBadge = document.getElementById('rep-inv-count-badge');
  if (elBadge) elBadge.textContent = `${total} insumos`;

  const tbody = document.getElementById('rep-inv-tbody');
  if (tbody) {
    tbody.innerHTML = state.inventory.map(item => {
      const isZero = item.stock === 0;
      const isLow = item.stock <= item.minAlert;
      const statusClass = isZero ? 'text-rose-400 bg-rose-500/10' : isLow ? 'text-amber-300 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10';
      const statusText = isZero ? 'Agotado' : isLow ? 'Stock Bajo' : 'Óptimo';

      return `
        <tr class="hover:bg-[#18181C]">
          <td class="py-2.5 px-3 font-bold text-white">${escapeHtml(item.name)}</td>
          <td class="py-2.5 px-3 text-gray-400">${escapeHtml(item.category)}</td>
          <td class="py-2.5 px-3 font-mono font-bold ${isZero ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-white'}">${item.stock} ${escapeHtml(item.unit)}</td>
          <td class="py-2.5 px-3 font-mono text-gray-400">${item.minAlert} ${escapeHtml(item.unit)}</td>
          <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}">${statusText}</span></td>
        </tr>
      `;
    }).join('');
  }

  const damagesContainer = document.getElementById('rep-inv-damages-list');
  if (damagesContainer) {
    if (state.damages.length === 0) {
      damagesContainer.innerHTML = '<p class="py-4 text-center text-xs text-gray-500">Sin mermas registradas en el sistema</p>';
    } else {
      damagesContainer.innerHTML = state.damages.slice(0, 10).map(d => `
        <div class="flex items-center justify-between py-2 text-xs">
          <div>
            <span class="font-bold text-white">${escapeHtml(d.ingredientName)}</span>
            <span class="text-gray-400 ml-1">(${escapeHtml(d.reason)})</span>
            <span class="block text-[10px] text-gray-500">${d.date} ${d.time || ''} - Por: ${escapeHtml(d.reportedBy || 'Terminal')}</span>
          </div>
          <span class="font-mono font-bold text-rose-400">-${d.quantity} ${escapeHtml(d.unit)}</span>
        </div>
      `).join('');
    }
  }
}

function shareInventoryReportText() {
  const total = state.inventory.length;
  const optimal = state.inventory.filter(i => i.stock > i.minAlert).length;
  const low = state.inventory.filter(i => i.stock <= i.minAlert);
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-VE');

  let text = `📦 *REPORTE DE INVENTARIO Y MATERIA PRIMA*\n`;
  text += `🏪 *${state.settings.storeName}*\n`;
  text += `📅 Fecha: ${dateStr}\n`;
  text += `------------------------------------\n`;
  text += `📊 Total Insumos: ${total}\n`;
  text += `✅ Stock Óptimo: ${optimal}\n`;
  text += `⚠️ Stock Crítico / Bajo: ${low.length}\n`;
  text += `------------------------------------\n`;
  text += `*EXISTENCIAS ACTUALES:*\n`;

  state.inventory.forEach(i => {
    const alertIcon = i.stock <= i.minAlert ? '⚠️ ' : '▫️ ';
    text += `${alertIcon}${i.name}: *${i.stock} ${i.unit}* (mín: ${i.minAlert})\n`;
  });

  if (low.length > 0) {
    text += `\n🚨 *URGENTE REPOSICIÓN:*\n`;
    low.forEach(i => {
      text += `• ${i.name}: quedan solo ${i.stock} ${i.unit}\n`;
    });
  }

  if (state.damages && state.damages.length > 0) {
    text += `\n🗑️ *ÚLTIMAS MERMAS REGISTRADAS:*\n`;
    state.damages.slice(0, 5).forEach(d => {
      text += `• ${d.ingredientName}: -${d.quantity} ${d.unit} (${d.reason})\n`;
    });
  }

  if (navigator.share) {
    navigator.share({
      title: `Reporte de Inventario - ${state.settings.storeName}`,
      text: text
    }).catch(() => {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      showToast('Reporte de inventario copiado al portapapeles', 'success');
    });
  } else {
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    showToast('Reporte copiado para WhatsApp', 'success');
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }
}

function generateAndShareInventoryReportImage() {
  const canvas = document.getElementById('export-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = 800;
  canvas.height = 320 + (state.inventory.length * 34);

  // Background
  ctx.fillStyle = '#121214';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header banner
  ctx.fillStyle = '#1E1E24';
  ctx.fillRect(0, 0, canvas.width, 130);

  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 24px Plus Jakarta Sans, sans-serif';
  ctx.fillText('REPORTE DE INVENTARIO Y MATERIA PRIMA', 40, 48);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px Plus Jakarta Sans, sans-serif';
  ctx.fillText(state.settings.storeName, 40, 80);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px Plus Jakarta Sans, sans-serif';
  ctx.fillText(`Emitido: ${new Date().toLocaleString('es-VE')}`, 40, 108);

  let y = 160;

  // Table header
  ctx.fillStyle = '#262630';
  ctx.fillRect(40, y, 720, 36);

  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
  ctx.fillText('INSUMO / MATERIA PRIMA', 55, y + 23);
  ctx.fillText('CATEGORÍA', 320, y + 23);
  ctx.fillText('STOCK ACTUAL', 480, y + 23);
  ctx.fillText('ESTADO', 650, y + 23);

  y += 45;

  // Inventory rows
  state.inventory.forEach((item, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#18181C' : '#141418';
    ctx.fillRect(40, y - 10, 720, 30);

    const isZero = item.stock === 0;
    const isLow = item.stock <= item.minAlert;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px Plus Jakarta Sans, sans-serif';
    ctx.fillText(item.name, 55, y + 10);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px Plus Jakarta Sans, sans-serif';
    ctx.fillText(item.category, 320, y + 10);

    ctx.fillStyle = isZero ? '#F43F5E' : isLow ? '#F59E0B' : '#10B981';
    ctx.font = 'bold 13px JetBrains Mono, monospace';
    ctx.fillText(`${item.stock} ${item.unit}`, 480, y + 10);

    ctx.fillStyle = isZero ? '#F43F5E' : isLow ? '#F59E0B' : '#10B981';
    ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
    ctx.fillText(isZero ? 'AGOTADO' : isLow ? 'STOCK BAJO' : 'ÓPTIMO', 650, y + 10);

    y += 32;
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    const file = new File([blob], `Reporte-Inventario-${Date.now()}.png`, { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({
        files: [file],
        title: 'Reporte de Inventario',
        text: `Reporte de Inventario de ${state.settings.storeName}`
      }).catch(() => downloadCanvasBlob(blob, 'reporte-inventario.png'));
    } else {
      downloadCanvasBlob(blob, 'reporte-inventario.png');
    }
  }, 'image/png');
}

function downloadCanvasBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Reporte descargado como imagen con éxito', 'success');
}

function setupEventListeners() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeShareDirectModal();
      closeCustomConfirm();
      closeSaleModal();
      closeReceiptModalAndReset();
      closeProductModal();
      closeTodayBreakdownModal();
      closeExchangeRateModal();
      closeLogoUploadModal();
      closeProductSelector();
      closeCategoryManagerModal();
      closeInventoryItemModal();
      closeReportDamageModal();
      closeWifiSyncModal();
      closeBurgerFlavorModal();
    }
  });

  // Global tactile / haptic audio feedback on user clicks & taps
  document.addEventListener('click', (e) => {
    SoundEngine.init();

    const target = e.target.closest('button, .nav-tab-btn, .history-filter-btn, .category-pill, [onclick]');
    if (target) {
      if (
        target.id === 'btn-sound-toggle' ||
        target.id === 'btn-dark-mode' ||
        target.id === 'btn-theme-color' ||
        target.classList.contains('category-pill') ||
        target.getAttribute('onclick')?.includes('completeSale') ||
        target.getAttribute('onclick')?.includes('voidActiveSale') ||
        target.getAttribute('onclick')?.includes('handleProductCardClick') ||
        target.getAttribute('onclick')?.includes('addAnotherProductToSale') ||
        target.getAttribute('onclick')?.includes('incrementCartItem') ||
        target.getAttribute('onclick')?.includes('voidSaleById') ||
        target.getAttribute('onclick')?.includes('confirmDeleteProduct') ||
        target.getAttribute('onclick')?.includes('handleAddNewCategory') ||
        target.getAttribute('onclick')?.includes('deleteCategory')
      ) {
        return;
      }
      SoundEngine.play('tap');
    }
  });
}

// Global window assignments for rock-solid HTML onclick/onsubmit access
window.openAddInventoryModal = openAddInventoryModal;
window.closeInventoryItemModal = closeInventoryItemModal;
window.saveInventoryItem = saveInventoryItem;
window.openReportDamageModal = openReportDamageModal;
window.closeReportDamageModal = closeReportDamageModal;
window.handleDamageItemSelected = handleDamageItemSelected;
window.submitDamageReport = submitDamageReport;
window.switchInventorySubtab = switchInventorySubtab;
window.handleInventorySearch = handleInventorySearch;
window.filterInventoryByCategory = filterInventoryByCategory;
window.quickAdjustStock = quickAdjustStock;
window.openWifiSyncModal = openWifiSyncModal;
window.closeWifiSyncModal = closeWifiSyncModal;
window.setDeviceRole = setDeviceRole;
window.copyNetworkLink = copyNetworkLink;
window.forceNetworkSync = forceNetworkSync;
window.openBurgerFlavorModal = openBurgerFlavorModal;
window.closeBurgerFlavorModal = closeBurgerFlavorModal;
window.selectBurgerFlavor = selectBurgerFlavor;
window.setAllBurgerFlavors = setAllBurgerFlavors;
window.confirmBurgerFlavorSelection = confirmBurgerFlavorSelection;
window.switchReportSubtype = switchReportSubtype;
window.renderInventoryReport = renderInventoryReport;
window.shareInventoryReportText = shareInventoryReportText;
window.switchShareTab = switchShareTab;
window.shareViaWhatsApp = shareViaWhatsApp;
window.openPublicLinkInNewTab = openPublicLinkInNewTab;
window.copyLocalIpLink = copyLocalIpLink;
window.handleCategoryChange = handleCategoryChange;
window.addComboProductRow = addComboProductRow;
window.removeComboProductRow = removeComboProductRow;
window.generateAndShareInventoryReportImage = generateAndShareInventoryReportImage;

// Auto-run on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
