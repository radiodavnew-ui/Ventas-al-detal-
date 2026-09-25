package com.example.data.model

import java.util.UUID

enum class PaymentMethod(val id: String, val displayNameEs: String, val displayNameEn: String) {
    EFECTIVO("cash", "Efectivo", "Cash"),
    PAGO_MOVIL("pago_movil", "Pago Móvil", "Mobile Payment"),
    PUNTO_VENTA("punto_venta", "Punto de Venta", "POS Card Terminal");

    fun getDisplayName(isSpanish: Boolean): String = if (isSpanish) displayNameEs else displayNameEn
}

enum class SaleStatus(val id: String, val displayNameEs: String, val displayNameEn: String) {
    COMPLETED("completed", "Completada", "Completed"),
    VOIDED("voided", "Anulada", "Voided");

    fun getDisplayName(isSpanish: Boolean): String = if (isSpanish) displayNameEs else displayNameEn
}

data class SaleItem(
    val productId: String,
    val productName: String,
    val unitPriceUsd: Double,
    val quantity: Int,
    val totalUsd: Double = unitPriceUsd * quantity
)

data class Sale(
    val id: String = UUID.randomUUID().toString(),
    val receiptNumber: Long = System.currentTimeMillis() % 1000000,
    val timestamp: Long = System.currentTimeMillis(),
    val items: List<SaleItem>,
    val paymentMethod: PaymentMethod,
    val exchangeRate: Double,
    val totalUsd: Double,
    val totalBs: Double = totalUsd * exchangeRate,
    val status: SaleStatus = SaleStatus.COMPLETED,
    val note: String = ""
)
