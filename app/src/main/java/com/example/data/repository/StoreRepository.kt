package com.example.data.repository

import android.content.Context
import com.example.data.model.AppLanguage
import com.example.data.model.ColorAccent
import com.example.data.model.PaymentMethod
import com.example.data.model.Product
import com.example.data.model.Sale
import com.example.data.model.SaleItem
import com.example.data.model.SaleStatus
import com.example.data.model.StoreSettings
import com.example.util.CurrencyUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Calendar
import java.util.UUID

data class SalesSummary(
    val totalUsd: Double,
    val totalBs: Double,
    val cashUsd: Double,
    val cashBs: Double,
    val pagoMovilUsd: Double,
    val pagoMovilBs: Double,
    val puntoVentaUsd: Double,
    val puntoVentaBs: Double,
    val count: Int,
    val weeklyAverageUsd: Double? = null,
    val weeklyAverageBs: Double? = null
)

class StoreRepository private constructor(private val context: Context) {

    private val scope = CoroutineScope(Dispatchers.IO)

    private val _products = MutableStateFlow<List<Product>>(emptyList())
    val products: StateFlow<List<Product>> = _products.asStateFlow()

    private val _sales = MutableStateFlow<List<Sale>>(emptyList())
    val sales: StateFlow<List<Sale>> = _sales.asStateFlow()

    private val _settings = MutableStateFlow(StoreSettings())
    val settings: StateFlow<StoreSettings> = _settings.asStateFlow()

    init {
        loadSettings()
        loadProducts()
        loadSales()
    }

    // --- SETTINGS ---

    private fun loadSettings() {
        val prefs = context.getSharedPreferences("store_prefs", Context.MODE_PRIVATE)
        val storeName = prefs.getString("store_name", "Minimarket & Bodega La Central") ?: "Minimarket & Bodega La Central"
        val logoUri = prefs.getString("logo_uri", "") ?: ""
        val rate = prefs.getFloat("exchange_rate", 54.20f).toDouble()
        val langCode = prefs.getString("lang", "es") ?: "es"
        val colorCode = prefs.getString("color_accent", "green") ?: "green"
        val isDark = prefs.getBoolean("is_dark", true)

        val lang = if (langCode == "en") AppLanguage.ENGLISH else AppLanguage.SPANISH
        val accent = if (colorCode == "blue") ColorAccent.ELECTRIC_BLUE else ColorAccent.ELECTRIC_GREEN

        _settings.value = StoreSettings(
            storeName = storeName,
            logoUri = logoUri,
            exchangeRateUsdToBs = rate,
            language = lang,
            colorAccent = accent,
            isDarkMode = isDark
        )
    }

    private fun saveSettings(newSettings: StoreSettings) {
        _settings.value = newSettings
        scope.launch {
            val prefs = context.getSharedPreferences("store_prefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putString("store_name", newSettings.storeName)
                .putString("logo_uri", newSettings.logoUri)
                .putFloat("exchange_rate", newSettings.exchangeRateUsdToBs.toFloat())
                .putString("lang", newSettings.language.code)
                .putString("color_accent", newSettings.colorAccent.id)
                .putBoolean("is_dark", newSettings.isDarkMode)
                .apply()
        }
    }

    fun updateExchangeRate(newRate: Double) {
        if (newRate > 0) {
            saveSettings(_settings.value.copy(exchangeRateUsdToBs = newRate))
        }
    }

    fun updateLogo(uri: String) {
        saveSettings(_settings.value.copy(logoUri = uri))
    }

    fun toggleLanguage() {
        val current = _settings.value.language
        val next = if (current == AppLanguage.SPANISH) AppLanguage.ENGLISH else AppLanguage.SPANISH
        saveSettings(_settings.value.copy(language = next))
    }

    fun toggleColorAccent() {
        val current = _settings.value.colorAccent
        val next = if (current == ColorAccent.ELECTRIC_GREEN) ColorAccent.ELECTRIC_BLUE else ColorAccent.ELECTRIC_GREEN
        saveSettings(_settings.value.copy(colorAccent = next))
    }

    fun toggleDarkMode() {
        saveSettings(_settings.value.copy(isDarkMode = !_settings.value.isDarkMode))
    }

    // --- PRODUCTS ---

    private fun loadProducts() {
        val file = File(context.filesDir, "products.json")
        if (!file.exists()) {
            // Seed initial realistic retail products
            val defaultProducts = getSampleProducts()
            _products.value = defaultProducts
            saveProductsToFile(defaultProducts)
            return
        }

        try {
            val jsonStr = file.readText()
            val array = JSONArray(jsonStr)
            val list = mutableListOf<Product>()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                list.add(
                    Product(
                        id = obj.optString("id", UUID.randomUUID().toString()),
                        name = obj.optString("name", "Producto"),
                        priceUsd = obj.optDouble("priceUsd", 1.0),
                        imageUri = obj.optString("imageUri", ""),
                        category = obj.optString("category", "Alimentos"),
                        createdAt = obj.optLong("createdAt", System.currentTimeMillis()),
                        stock = obj.optInt("stock", 50)
                    )
                )
            }
            _products.value = list
        } catch (e: Exception) {
            e.printStackTrace()
            _products.value = getSampleProducts()
        }
    }

    private fun saveProductsToFile(list: List<Product>) {
        scope.launch {
            try {
                val array = JSONArray()
                for (p in list) {
                    val obj = JSONObject().apply {
                        put("id", p.id)
                        put("name", p.name)
                        put("priceUsd", p.priceUsd)
                        put("imageUri", p.imageUri)
                        put("category", p.category)
                        put("createdAt", p.createdAt)
                        put("stock", p.stock)
                    }
                    array.put(obj)
                }
                val file = File(context.filesDir, "products.json")
                file.writeText(array.toString())
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun addProduct(product: Product) {
        val updated = listOf(product) + _products.value
        _products.value = updated
        saveProductsToFile(updated)
    }

    fun updateProduct(product: Product) {
        val updated = _products.value.map { if (it.id == product.id) product else it }
        _products.value = updated
        saveProductsToFile(updated)
    }

    fun deleteProduct(productId: String) {
        val updated = _products.value.filterNot { it.id == productId }
        _products.value = updated
        saveProductsToFile(updated)
    }

    // --- SALES ---

    private fun loadSales() {
        val file = File(context.filesDir, "sales.json")
        if (!file.exists()) {
            val sampleSales = getSampleSales()
            _sales.value = sampleSales
            saveSalesToFile(sampleSales)
            return
        }

        try {
            val jsonStr = file.readText()
            val array = JSONArray(jsonStr)
            val list = mutableListOf<Sale>()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val itemsArr = obj.optJSONArray("items") ?: JSONArray()
                val items = mutableListOf<SaleItem>()
                for (j in 0 until itemsArr.length()) {
                    val itemObj = itemsArr.getJSONObject(j)
                    items.add(
                        SaleItem(
                            productId = itemObj.optString("productId", ""),
                            productName = itemObj.optString("productName", ""),
                            unitPriceUsd = itemObj.optDouble("unitPriceUsd", 0.0),
                            quantity = itemObj.optInt("quantity", 1),
                            totalUsd = itemObj.optDouble("totalUsd", 0.0)
                        )
                    )
                }

                val methodStr = obj.optString("paymentMethod", "cash")
                val method = when (methodStr) {
                    "pago_movil" -> PaymentMethod.PAGO_MOVIL
                    "punto_venta" -> PaymentMethod.PUNTO_VENTA
                    else -> PaymentMethod.EFECTIVO
                }

                val statusStr = obj.optString("status", "completed")
                val status = if (statusStr == "voided") SaleStatus.VOIDED else SaleStatus.COMPLETED

                list.add(
                    Sale(
                        id = obj.optString("id", UUID.randomUUID().toString()),
                        receiptNumber = obj.optLong("receiptNumber", 1001),
                        timestamp = obj.optLong("timestamp", System.currentTimeMillis()),
                        items = items,
                        paymentMethod = method,
                        exchangeRate = obj.optDouble("exchangeRate", 54.20),
                        totalUsd = obj.optDouble("totalUsd", 0.0),
                        totalBs = obj.optDouble("totalBs", 0.0),
                        status = status,
                        note = obj.optString("note", "")
                    )
                )
            }
            _sales.value = list.sortedByDescending { it.timestamp }
        } catch (e: Exception) {
            e.printStackTrace()
            _sales.value = getSampleSales()
        }
    }

    private fun saveSalesToFile(list: List<Sale>) {
        scope.launch {
            try {
                val array = JSONArray()
                for (s in list) {
                    val obj = JSONObject().apply {
                        put("id", s.id)
                        put("receiptNumber", s.receiptNumber)
                        put("timestamp", s.timestamp)
                        put("paymentMethod", s.paymentMethod.id)
                        put("exchangeRate", s.exchangeRate)
                        put("totalUsd", s.totalUsd)
                        put("totalBs", s.totalBs)
                        put("status", s.status.id)
                        put("note", s.note)

                        val itemsArray = JSONArray()
                        for (it in s.items) {
                            val itObj = JSONObject().apply {
                                put("productId", it.productId)
                                put("productName", it.productName)
                                put("unitPriceUsd", it.unitPriceUsd)
                                put("quantity", it.quantity)
                                put("totalUsd", it.totalUsd)
                            }
                            itemsArray.put(itObj)
                        }
                        put("items", itemsArray)
                    }
                    array.put(obj)
                }
                val file = File(context.filesDir, "sales.json")
                file.writeText(array.toString())
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun recordSale(items: List<SaleItem>, paymentMethod: PaymentMethod): Sale {
        val currentRate = _settings.value.exchangeRateUsdToBs
        val totalUsd = items.sumOf { it.totalUsd }
        val totalBs = totalUsd * currentRate

        val newSale = Sale(
            id = UUID.randomUUID().toString(),
            receiptNumber = (System.currentTimeMillis() % 900000) + 100000,
            timestamp = System.currentTimeMillis(),
            items = items,
            paymentMethod = paymentMethod,
            exchangeRate = currentRate,
            totalUsd = totalUsd,
            totalBs = totalBs,
            status = SaleStatus.COMPLETED
        )

        // Deduct inventory/stock for constituent products when item is a combo or individual
        deductStockForSale(items)

        val updated = listOf(newSale) + _sales.value
        _sales.value = updated
        saveSalesToFile(updated)
        return newSale
    }

    private fun deductStockForSale(items: List<SaleItem>) {
        val currentProducts = _products.value.toMutableList()
        var changed = false

        for (item in items) {
            val nameLower = item.productName.lowercase()
            val isCombo = nameLower.contains("combo")

            if (isCombo) {
                // Rule: If item is a combo, deduct stock/ingredients of each constituent product
                if (nameLower.contains("hamburguesa") || nameLower.contains("burger")) {
                    val count = if (nameLower.contains("2 hamburguesa") || nameLower.contains("dos hamburguesa")) 2 else 1
                    deductProductByName(currentProducts, "hamburguesa", count * item.quantity)
                    changed = true
                }
                if (nameLower.contains("perro") || nameLower.contains("hot dog")) {
                    val count = if (nameLower.contains("2 perro") || nameLower.contains("dos perro")) 2 else 1
                    deductProductByName(currentProducts, "perro", count * item.quantity)
                    changed = true
                }
                if (nameLower.contains("papas")) {
                    deductProductByName(currentProducts, "papas", item.quantity)
                    changed = true
                }
                if (nameLower.contains("refresco")) {
                    deductProductByName(currentProducts, "refresco", item.quantity)
                    changed = true
                } else if (nameLower.contains("malta")) {
                    deductProductByName(currentProducts, "malta", item.quantity)
                    changed = true
                } else if (nameLower.contains("agua")) {
                    deductProductByName(currentProducts, "agua", item.quantity)
                    changed = true
                }
                deductProductById(currentProducts, item.productId, item.quantity)
            } else {
                deductProductById(currentProducts, item.productId, item.quantity)
                changed = true
            }
        }

        if (changed) {
            _products.value = currentProducts
            saveProductsToFile(currentProducts)
        }
    }

    private fun deductProductByName(products: MutableList<Product>, nameSubstring: String, quantity: Int) {
        val index = products.indexOfFirst { it.name.lowercase().contains(nameSubstring) }
        if (index != -1) {
            val p = products[index]
            val newStock = (p.stock - quantity).coerceAtLeast(0)
            products[index] = p.copy(stock = newStock)
        }
    }

    private fun deductProductById(products: MutableList<Product>, productId: String, quantity: Int) {
        val index = products.indexOfFirst { it.id == productId }
        if (index != -1) {
            val p = products[index]
            val newStock = (p.stock - quantity).coerceAtLeast(0)
            products[index] = p.copy(stock = newStock)
        }
    }

    fun voidSale(saleId: String) {
        val updated = _sales.value.map {
            if (it.id == saleId) it.copy(status = SaleStatus.VOIDED) else it
        }
        _sales.value = updated
        saveSalesToFile(updated)
    }

    fun deleteSalePermanently(saleId: String) {
        val updated = _sales.value.filterNot { it.id == saleId }
        _sales.value = updated
        saveSalesToFile(updated)
    }

    // --- ANALYTICS & SUMMARIES ---

    fun getTodaySummary(): SalesSummary {
        val now = System.currentTimeMillis()
        val todayCompletedSales = _sales.value.filter {
            it.status == SaleStatus.COMPLETED && CurrencyUtils.isSameDay(it.timestamp, now)
        }
        return computeSummary(todayCompletedSales)
    }

    fun getWeeklySummary(): SalesSummary {
        val cal = Calendar.getInstance()
        cal.set(Calendar.DAY_OF_WEEK, cal.firstDayOfWeek)
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        val startOfWeek = cal.timeInMillis

        val completedSales = _sales.value.filter { it.status == SaleStatus.COMPLETED }
        val thisWeekSales = completedSales.filter { it.timestamp >= startOfWeek }

        // Compute average per week across all recorded weeks (minimum 1)
        val weeklyAverageUsd = computeWeeklyAverageUsd(completedSales)
        val currentRate = _settings.value.exchangeRateUsdToBs

        val summary = computeSummary(thisWeekSales)
        return summary.copy(
            weeklyAverageUsd = weeklyAverageUsd,
            weeklyAverageBs = weeklyAverageUsd * currentRate
        )
    }

    fun getMonthlySummary(): SalesSummary {
        val cal = Calendar.getInstance()
        cal.set(Calendar.DAY_OF_MONTH, 1)
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        val startOfMonth = cal.timeInMillis

        val thisMonthSales = _sales.value.filter {
            it.status == SaleStatus.COMPLETED && it.timestamp >= startOfMonth
        }
        val currentRate = _settings.value.exchangeRateUsdToBs
        val weeklyAverageUsd = computeWeeklyAverageUsd(_sales.value.filter { it.status == SaleStatus.COMPLETED })

        val summary = computeSummary(thisMonthSales)
        return summary.copy(
            weeklyAverageUsd = weeklyAverageUsd,
            weeklyAverageBs = weeklyAverageUsd * currentRate
        )
    }

    private fun computeSummary(salesList: List<Sale>): SalesSummary {
        var totalUsd = 0.0
        var totalBs = 0.0
        var cashUsd = 0.0
        var cashBs = 0.0
        var pmUsd = 0.0
        var pmBs = 0.0
        var posUsd = 0.0
        var posBs = 0.0

        for (s in salesList) {
            totalUsd += s.totalUsd
            totalBs += s.totalBs

            when (s.paymentMethod) {
                PaymentMethod.EFECTIVO -> {
                    cashUsd += s.totalUsd
                    cashBs += s.totalBs
                }
                PaymentMethod.PAGO_MOVIL -> {
                    pmUsd += s.totalUsd
                    pmBs += s.totalBs
                }
                PaymentMethod.PUNTO_VENTA -> {
                    posUsd += s.totalUsd
                    posBs += s.totalBs
                }
            }
        }

        return SalesSummary(
            totalUsd = totalUsd,
            totalBs = totalBs,
            cashUsd = cashUsd,
            cashBs = cashBs,
            pagoMovilUsd = pmUsd,
            pagoMovilBs = pmBs,
            puntoVentaUsd = posUsd,
            puntoVentaBs = posBs,
            count = salesList.size
        )
    }

    private fun computeWeeklyAverageUsd(salesList: List<Sale>): Double {
        if (salesList.isEmpty()) return 0.0

        // Group sales by (Year * 100 + WeekOfYear)
        val salesByWeek = mutableMapOf<Int, Double>()
        val cal = Calendar.getInstance()

        for (s in salesList) {
            cal.timeInMillis = s.timestamp
            val key = cal.get(Calendar.YEAR) * 100 + cal.get(Calendar.WEEK_OF_YEAR)
            salesByWeek[key] = (salesByWeek[key] ?: 0.0) + s.totalUsd
        }

        val weekCount = maxOf(1, salesByWeek.size)
        val totalUsdAcrossWeeks = salesByWeek.values.sum()
        return totalUsdAcrossWeeks / weekCount
    }

    // --- SEED SAMPLE DATA ---

    private fun getSampleProducts(): List<Product> {
        return listOf(
            Product(
                id = "p1",
                name = "Harina PAN Blanca 1kg",
                priceUsd = 1.35,
                category = "Víveres",
                imageUri = "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&auto=format&fit=crop&q=60"
            ),
            Product(
                id = "p2",
                name = "Café Molido 250g",
                priceUsd = 2.80,
                category = "Bebidas",
                imageUri = "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&auto=format&fit=crop&q=60"
            ),
            Product(
                id = "p3",
                name = "Arroz Tradicional 1kg",
                priceUsd = 1.20,
                category = "Víveres",
                imageUri = "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=60"
            ),
            Product(
                id = "p4",
                name = "Queso Blanco Llanero 500g",
                priceUsd = 3.50,
                category = "Lácteos",
                imageUri = "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&auto=format&fit=crop&q=60"
            ),
            Product(
                id = "p5",
                name = "Refresco Cola 2L",
                priceUsd = 2.00,
                category = "Bebidas",
                imageUri = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=60"
            ),
            Product(
                id = "p6",
                name = "Aceite Vegetal 1L",
                priceUsd = 2.60,
                category = "Víveres",
                imageUri = "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=60"
            ),
            Product(
                id = "p7",
                name = "Leche en Polvo Completa 400g",
                priceUsd = 4.20,
                category = "Lácteos",
                imageUri = "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&auto=format&fit=crop&q=60"
            ),
            Product(
                id = "p8",
                name = "Galletas María Pack x3",
                priceUsd = 1.10,
                category = "Snacks",
                imageUri = "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=60"
            )
        )
    }

    private fun getSampleSales(): List<Sale> {
        val now = System.currentTimeMillis()
        val rate = 54.20
        val oneHour = 3600_000L
        val oneDay = 86400_000L

        return listOf(
            Sale(
                id = "s1",
                receiptNumber = 482011,
                timestamp = now - 20 * 60 * 1000, // 20 mins ago
                items = listOf(
                    SaleItem("p1", "Harina PAN Blanca 1kg", 1.35, 2, 2.70),
                    SaleItem("p4", "Queso Blanco Llanero 500g", 3.50, 1, 3.50)
                ),
                paymentMethod = PaymentMethod.PAGO_MOVIL,
                exchangeRate = rate,
                totalUsd = 6.20,
                totalBs = 6.20 * rate,
                status = SaleStatus.COMPLETED
            ),
            Sale(
                id = "s2",
                receiptNumber = 482012,
                timestamp = now - 2 * oneHour,
                items = listOf(
                    SaleItem("p2", "Café Molido 250g", 2.80, 1, 2.80),
                    SaleItem("p5", "Refresco Cola 2L", 2.00, 2, 4.00),
                    SaleItem("p8", "Galletas María Pack x3", 1.10, 2, 2.20)
                ),
                paymentMethod = PaymentMethod.PUNTO_VENTA,
                exchangeRate = rate,
                totalUsd = 9.00,
                totalBs = 9.00 * rate,
                status = SaleStatus.COMPLETED
            ),
            Sale(
                id = "s3",
                receiptNumber = 482013,
                timestamp = now - 4 * oneHour,
                items = listOf(
                    SaleItem("p6", "Aceite Vegetal 1L", 2.60, 2, 5.20),
                    SaleItem("p3", "Arroz Tradicional 1kg", 1.20, 3, 3.60)
                ),
                paymentMethod = PaymentMethod.EFECTIVO,
                exchangeRate = rate,
                totalUsd = 8.80,
                totalBs = 8.80 * rate,
                status = SaleStatus.COMPLETED
            ),
            Sale(
                id = "s4",
                receiptNumber = 482005,
                timestamp = now - oneDay - 3 * oneHour, // yesterday
                items = listOf(
                    SaleItem("p7", "Leche en Polvo Completa 400g", 4.20, 1, 4.20),
                    SaleItem("p1", "Harina PAN Blanca 1kg", 1.35, 3, 4.05)
                ),
                paymentMethod = PaymentMethod.PAGO_MOVIL,
                exchangeRate = rate,
                totalUsd = 8.25,
                totalBs = 8.25 * rate,
                status = SaleStatus.COMPLETED
            ),
            Sale(
                id = "s5",
                receiptNumber = 481990,
                timestamp = now - 3 * oneDay,
                items = listOf(
                    SaleItem("p4", "Queso Blanco Llanero 500g", 3.50, 2, 7.00),
                    SaleItem("p5", "Refresco Cola 2L", 2.00, 1, 2.00)
                ),
                paymentMethod = PaymentMethod.PUNTO_VENTA,
                exchangeRate = rate,
                totalUsd = 9.00,
                totalBs = 9.00 * rate,
                status = SaleStatus.COMPLETED
            ),
            Sale(
                id = "s6",
                receiptNumber = 481840,
                timestamp = now - 8 * oneDay, // previous week
                items = listOf(
                    SaleItem("p6", "Aceite Vegetal 1L", 2.60, 3, 7.80),
                    SaleItem("p7", "Leche en Polvo Completa 400g", 4.20, 2, 8.40)
                ),
                paymentMethod = PaymentMethod.EFECTIVO,
                exchangeRate = rate,
                totalUsd = 16.20,
                totalBs = 16.20 * rate,
                status = SaleStatus.COMPLETED
            )
        )
    }

    companion object {
        @Volatile
        private var INSTANCE: StoreRepository? = null

        fun getInstance(context: Context): StoreRepository {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: StoreRepository(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
}
