package com.example

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.PaymentMethod
import com.example.data.model.Product
import com.example.data.model.Sale
import com.example.data.model.SaleItem
import com.example.data.repository.StoreRepository
import com.example.ui.components.ExchangeRateDialog
import com.example.ui.components.ProductFormDialog
import com.example.ui.components.ReceiptDetailDialog
import com.example.ui.components.SaleInProgressDialog
import com.example.ui.components.SalesSummaryDialog
import com.example.ui.components.StoreTopBar
import com.example.ui.screens.HomeScreen
import com.example.ui.screens.HistoryScreen
import com.example.ui.screens.ReportsScreen
import com.example.ui.theme.MyApplicationTheme
import com.example.util.Strings

class MainActivity : ComponentActivity() {

    private lateinit var repository: StoreRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        repository = StoreRepository.getInstance(applicationContext)

        setContent {
            val settings by repository.settings.collectAsState()
            val products by repository.products.collectAsState()
            val sales by repository.sales.collectAsState()

            MyApplicationTheme(
                darkTheme = settings.isDarkMode,
                accent = settings.colorAccent
            ) {
                MainApp(
                    repository = repository,
                    settings = settings,
                    products = products,
                    sales = sales
                )
            }
        }
    }
}

@Composable
fun MainApp(
    repository: StoreRepository,
    settings: com.example.data.model.StoreSettings,
    products: List<Product>,
    sales: List<Sale>
) {
    var selectedScreen by remember { mutableStateOf(0) } // 0 = Inicio (POS), 1 = Historial, 2 = Reportes

    // Active in-progress sale cart
    val cartItems = remember { mutableStateListOf<SaleItem>() }
    var selectedProductForSale by remember { mutableStateOf<Product?>(null) }
    var showSaleDialog by remember { mutableStateOf(false) }

    // Dialogs state
    var showProductForm by remember { mutableStateOf(false) }
    var productToEdit by remember { mutableStateOf<Product?>(null) }
    var showRateDialog by remember { mutableStateOf(false) }
    var showDailySummaryDialog by remember { mutableStateOf(false) }
    var initialSummaryTab by remember { mutableStateOf(0) }

    // Receipt & Voiding state
    var activeReceiptSale by remember { mutableStateOf<Sale?>(null) }
    var saleToVoidConfirm by remember { mutableStateOf<Sale?>(null) }

    val todaySummary = remember(sales, settings.exchangeRateUsdToBs) {
        repository.getTodaySummary()
    }
    val weeklySummary = remember(sales, settings.exchangeRateUsdToBs) {
        repository.getWeeklySummary()
    }
    val monthlySummary = remember(sales, settings.exchangeRateUsdToBs) {
        repository.getMonthlySummary()
    }

    Scaffold(
        topBar = {
            StoreTopBar(
                settings = settings,
                todaySalesUsd = todaySummary.totalUsd,
                todaySalesBs = todaySummary.totalBs,
                onUpdateLogo = { newLogoUri -> repository.updateLogo(newLogoUri) },
                onOpenRateDialog = { showRateDialog = true },
                onOpenDailyReport = {
                    initialSummaryTab = 0
                    showDailySummaryDialog = true
                },
                onToggleLanguage = { repository.toggleLanguage() },
                onToggleColorAccent = { repository.toggleColorAccent() },
                onToggleDarkMode = { repository.toggleDarkMode() }
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 6.dp
            ) {
                NavigationBarItem(
                    selected = selectedScreen == 0,
                    onClick = { selectedScreen = 0 },
                    icon = { Icon(Icons.Default.Storefront, contentDescription = null, modifier = Modifier.size(22.dp)) },
                    label = {
                        Text(
                            text = Strings.get("products", settings.language),
                            fontSize = 11.sp,
                            fontWeight = if (selectedScreen == 0) FontWeight.Bold else FontWeight.Normal
                        )
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MaterialTheme.colorScheme.onPrimaryContainer,
                        indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                        selectedTextColor = MaterialTheme.colorScheme.primary
                    )
                )

                NavigationBarItem(
                    selected = selectedScreen == 1,
                    onClick = { selectedScreen = 1 },
                    icon = { Icon(Icons.Default.History, contentDescription = null, modifier = Modifier.size(22.dp)) },
                    label = {
                        Text(
                            text = Strings.get("history", settings.language),
                            fontSize = 11.sp,
                            fontWeight = if (selectedScreen == 1) FontWeight.Bold else FontWeight.Normal
                        )
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MaterialTheme.colorScheme.onPrimaryContainer,
                        indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                        selectedTextColor = MaterialTheme.colorScheme.primary
                    )
                )

                NavigationBarItem(
                    selected = selectedScreen == 2,
                    onClick = { selectedScreen = 2 },
                    icon = { Icon(Icons.Default.Assessment, contentDescription = null, modifier = Modifier.size(22.dp)) },
                    label = {
                        Text(
                            text = Strings.get("reports", settings.language),
                            fontSize = 11.sp,
                            fontWeight = if (selectedScreen == 2) FontWeight.Bold else FontWeight.Normal
                        )
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MaterialTheme.colorScheme.onPrimaryContainer,
                        indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                        selectedTextColor = MaterialTheme.colorScheme.primary
                    )
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (selectedScreen) {
                0 -> {
                    HomeScreen(
                        products = products,
                        todaySummary = todaySummary,
                        exchangeRate = settings.exchangeRateUsdToBs,
                        language = settings.language,
                        cartItems = cartItems,
                        onSelectProduct = { product ->
                            // Add or increment this product in the active cart
                            val existingIndex = cartItems.indexOfFirst { it.productId == product.id }
                            if (existingIndex >= 0) {
                                val current = cartItems[existingIndex]
                                cartItems[existingIndex] = current.copy(
                                    quantity = current.quantity + 1,
                                    totalUsd = (current.quantity + 1) * current.unitPriceUsd
                                )
                            } else {
                                cartItems.add(
                                    SaleItem(
                                        productId = product.id,
                                        productName = product.name,
                                        unitPriceUsd = product.priceUsd,
                                        quantity = 1,
                                        totalUsd = product.priceUsd
                                    )
                                )
                            }
                            selectedProductForSale = product
                            showSaleDialog = true
                        },
                        onEditProduct = { product ->
                            productToEdit = product
                            showProductForm = true
                        },
                        onDeleteProduct = { product ->
                            repository.deleteProduct(product.id)
                        },
                        onAddNewProduct = {
                            productToEdit = null
                            showProductForm = true
                        },
                        onOpenDailyReport = {
                            initialSummaryTab = 0
                            showDailySummaryDialog = true
                        },
                        onOpenCart = {
                            showSaleDialog = true
                        }
                    )
                }

                1 -> {
                    HistoryScreen(
                        sales = sales,
                        storeName = settings.storeName,
                        logoUri = settings.logoUri,
                        language = settings.language,
                        onSelectSale = { sale ->
                            activeReceiptSale = sale
                        },
                        onVoidSale = { sale ->
                            saleToVoidConfirm = sale
                        }
                    )
                }

                2 -> {
                    ReportsScreen(
                        todaySummary = todaySummary,
                        weeklySummary = weeklySummary,
                        monthlySummary = monthlySummary,
                        storeName = settings.storeName,
                        language = settings.language
                    )
                }
            }
        }
    }

    // --- SALE IN PROGRESS DIALOG ---
    if (showSaleDialog && cartItems.isNotEmpty()) {
        SaleInProgressDialog(
            cartItems = cartItems,
            currentProduct = selectedProductForSale,
            exchangeRate = settings.exchangeRateUsdToBs,
            language = settings.language,
            onUpdateQuantity = { prodId, newQty ->
                val idx = cartItems.indexOfFirst { it.productId == prodId }
                if (idx >= 0) {
                    if (newQty <= 0) {
                        cartItems.removeAt(idx)
                        if (cartItems.isEmpty()) {
                            showSaleDialog = false
                        }
                    } else {
                        val item = cartItems[idx]
                        cartItems[idx] = item.copy(
                            quantity = newQty,
                            totalUsd = newQty * item.unitPriceUsd
                        )
                    }
                }
            },
            onAddMoreProducts = {
                // Closes the dialog but retains cartItems so the user can pick more products on home screen!
                showSaleDialog = false
            },
            onConfirmSale = { paymentMethod ->
                val recorded = repository.recordSale(
                    items = cartItems.toList(),
                    paymentMethod = paymentMethod
                )
                cartItems.clear()
                showSaleDialog = false
                activeReceiptSale = recorded
            },
            onVoidSale = {
                cartItems.clear()
                showSaleDialog = false
            },
            onDismiss = {
                showSaleDialog = false
            }
        )
    }

    // --- PRODUCT ADD / EDIT DIALOG ---
    if (showProductForm) {
        ProductFormDialog(
            initialProduct = productToEdit,
            exchangeRate = settings.exchangeRateUsdToBs,
            language = settings.language,
            onSaveProduct = { savedProduct ->
                if (productToEdit != null) {
                    repository.updateProduct(savedProduct)
                } else {
                    repository.addProduct(savedProduct)
                }
                showProductForm = false
            },
            onDeleteProduct = { toDelete ->
                repository.deleteProduct(toDelete.id)
                showProductForm = false
            },
            onDismiss = { showProductForm = false }
        )
    }

    // --- DOLLAR EXCHANGE RATE DIALOG ---
    if (showRateDialog) {
        ExchangeRateDialog(
            currentRate = settings.exchangeRateUsdToBs,
            language = settings.language,
            onConfirm = { newRate ->
                repository.updateExchangeRate(newRate)
                showRateDialog = false
            },
            onDismiss = { showRateDialog = false }
        )
    }

    // --- DAILY / WEEKLY / MONTHLY SALES BREAKDOWN DIALOG ---
    if (showDailySummaryDialog) {
        SalesSummaryDialog(
            todaySummary = todaySummary,
            weeklySummary = weeklySummary,
            monthlySummary = monthlySummary,
            storeName = settings.storeName,
            language = settings.language,
            initialTab = initialSummaryTab,
            onDismiss = { showDailySummaryDialog = false }
        )
    }

    // --- RECEIPT DETAIL DIALOG ---
    activeReceiptSale?.let { sale ->
        ReceiptDetailDialog(
            sale = sale,
            storeName = settings.storeName,
            logoUri = settings.logoUri,
            language = settings.language,
            onVoidSale = { toVoid ->
                repository.voidSale(toVoid.id)
                activeReceiptSale = null
            },
            onNewSale = {
                activeReceiptSale = null
                selectedScreen = 0
                cartItems.clear()
            },
            onDismiss = { activeReceiptSale = null }
        )
    }

    // --- VOID SALE CONFIRMATION DIALOG ---
    saleToVoidConfirm?.let { sale ->
        AlertDialog(
            onDismissRequest = { saleToVoidConfirm = null },
            title = {
                Text(
                    text = Strings.get("void_sale", settings.language),
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    text = "${Strings.get("void_sale_confirm", settings.language)}\nTicket #${sale.receiptNumber}"
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        repository.voidSale(sale.id)
                        saleToVoidConfirm = null
                    }
                ) {
                    Text(
                        text = Strings.get("void_sale", settings.language),
                        color = MaterialTheme.colorScheme.error,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { saleToVoidConfirm = null }) {
                    Text(text = Strings.get("cancel", settings.language))
                }
            }
        )
    }
}
