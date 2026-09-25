package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.AppLanguage
import com.example.data.model.PaymentMethod
import com.example.data.model.Sale
import com.example.data.model.SaleStatus
import com.example.ui.theme.PaymentCashColor
import com.example.ui.theme.PaymentPagoMovilColor
import com.example.ui.theme.PaymentPuntoColor
import com.example.ui.theme.VoidBadgeColor
import com.example.util.CurrencyUtils
import com.example.util.ImageUtils
import com.example.util.Strings

@Composable
fun HistoryScreen(
    sales: List<Sale>,
    storeName: String,
    logoUri: String?,
    language: AppLanguage,
    onSelectSale: (Sale) -> Unit,
    onVoidSale: (Sale) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var searchQuery by remember { mutableStateOf("") }
    var selectedMethodFilter by remember { mutableStateOf<PaymentMethod?>(null) } // null = Todos

    val isEs = language == AppLanguage.SPANISH

    val filteredSales = sales.filter { sale ->
        val matchesMethod = selectedMethodFilter == null || sale.paymentMethod == selectedMethodFilter
        val matchesSearch = searchQuery.isBlank() ||
                sale.receiptNumber.toString().contains(searchQuery) ||
                sale.items.any { it.productName.contains(searchQuery, ignoreCase = true) }
        matchesMethod && matchesSearch
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 14.dp, vertical = 10.dp)
    ) {
        // SEARCH INPUT
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text(Strings.get("search_hint", language), fontSize = 13.sp) },
            leadingIcon = {
                Icon(Icons.Default.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(10.dp))

        // PAYMENT METHOD FILTER CHIPS
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            item {
                val isSelected = selectedMethodFilter == null
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier.clickable { selectedMethodFilter = null }
                ) {
                    Text(
                        text = Strings.get("filter_all", language),
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            fontSize = 12.sp
                        ),
                        color = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                    )
                }
            }

            items(PaymentMethod.entries.toTypedArray()) { method ->
                val isSelected = selectedMethodFilter == method
                val color = when (method) {
                    PaymentMethod.EFECTIVO -> PaymentCashColor
                    PaymentMethod.PAGO_MOVIL -> PaymentPagoMovilColor
                    PaymentMethod.PUNTO_VENTA -> PaymentPuntoColor
                }

                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = if (isSelected) color else MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier.clickable { selectedMethodFilter = method }
                ) {
                    Text(
                        text = method.getDisplayName(isEs),
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            fontSize = 12.sp
                        ),
                        color = if (isSelected) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // SALES LIST
        if (filteredSales.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.Receipt,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                        modifier = Modifier.size(54.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = Strings.get("no_sales_yet", language),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(bottom = 80.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                items(filteredSales, key = { it.id }) { sale ->
                    SaleHistoryCard(
                        sale = sale,
                        language = language,
                        onClick = { onSelectSale(sale) },
                        onVoid = { onVoidSale(sale) },
                        onShare = {
                            ImageUtils.shareSaleReceiptAsImage(
                                context = context,
                                sale = sale,
                                storeName = storeName,
                                logoPath = logoUri,
                                language = language
                            )
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun SaleHistoryCard(
    sale: Sale,
    language: AppLanguage,
    onClick: () -> Unit,
    onVoid: () -> Unit,
    onShare: () -> Unit
) {
    val isEs = language == AppLanguage.SPANISH
    val isVoided = sale.status == SaleStatus.VOIDED

    val paymentColor = when (sale.paymentMethod) {
        PaymentMethod.EFECTIVO -> PaymentCashColor
        PaymentMethod.PAGO_MOVIL -> PaymentPagoMovilColor
        PaymentMethod.PUNTO_VENTA -> PaymentPuntoColor
    }

    val methodIcon = when (sale.paymentMethod) {
        PaymentMethod.EFECTIVO -> Icons.Default.Payments
        PaymentMethod.PAGO_MOVIL -> Icons.Default.PhoneAndroid
        PaymentMethod.PUNTO_VENTA -> Icons.Default.CreditCard
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(
                1.dp,
                if (isVoided) VoidBadgeColor.copy(alpha = 0.3f) else MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
                RoundedCornerShape(16.dp)
            )
            .clickable { onClick() },
        colors = CardDefaults.cardColors(
            containerColor = if (isVoided) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f) else MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp)
        ) {
            // TOP ROW: RECEIPT #, DATE & STATUS
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Ticket #${sale.receiptNumber}",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = CurrencyUtils.formatDate(sale.timestamp),
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                if (isVoided) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = VoidBadgeColor.copy(alpha = 0.2f)
                    ) {
                        Text(
                            text = Strings.get("voided", language),
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                color = VoidBadgeColor
                            ),
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // ITEMS SUMMARY LINE
            val itemsPreview = sale.items.joinToString(", ") { "${it.quantity}x ${it.productName}" }
            Text(
                text = itemsPreview,
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2
            )

            Spacer(modifier = Modifier.height(10.dp))

            // BOTTOM ROW: PAYMENT BADGE, TOTALS & QUICK ACTIONS
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Payment Method Pill
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = paymentColor.copy(alpha = 0.15f)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = methodIcon,
                            contentDescription = null,
                            tint = paymentColor,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = sale.paymentMethod.getDisplayName(isEs),
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 11.sp
                            ),
                            color = paymentColor
                        )
                    }
                }

                // Dual Currency Total
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = CurrencyUtils.formatUsd(sale.totalUsd),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = if (isVoided) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.primary
                        )
                    )
                    Text(
                        text = CurrencyUtils.formatBs(sale.totalBs),
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )
                }

                // Quick Action Buttons (Share PNG, Void)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onShare,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = Strings.get("share_image", language),
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    if (!isVoided) {
                        IconButton(
                            onClick = onVoid,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Block,
                                contentDescription = Strings.get("void_sale", language),
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
